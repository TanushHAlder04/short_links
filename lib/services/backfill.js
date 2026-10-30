import { prisma } from '../prisma.js'
import { referrerDomain } from '../analytics.js'
import { storeClick } from './analytics.js'
const id = 'legacy-analytics-v1'
const value = (s, max = 64) =>
  typeof s === 'string' && s.length > 0 && s.length <= max ? s : 'Unknown'
export async function backfillBatch(db = prisma, size = 100) {
  const progress = await db.migrationProgress.upsert({
    where: { id },
    create: { id },
    update: {},
  })
  if (progress.validatedAt)
    return { complete: true, processed: progress.processed }
  const rows = await db.click.findMany({
    where: progress.cursor ? { id: { gt: progress.cursor } } : {},
    orderBy: { id: 'asc' },
    take: size,
  })
  for (const row of rows) {
    await storeClick(
      {
        eventId: `legacy:${row.id}`,
        linkId: row.shortCode,
        clickedAt: row.timestamp,
        country: value(row.country),
        device: value(row.device),
        browser: value(row.browser),
        operatingSystem: value(row.os),
        referrerDomain: referrerDomain(row.referrer),
        isBot: row.isBot,
        ipHash: null,
      },
      db,
      { backfill: true }
    )
    await db.migrationProgress.update({
      where: { id },
      data: { cursor: row.id, processed: { increment: 1 } },
    })
  }
  return { complete: rows.length < size, processed: rows.length }
}
export async function validateBackfill(db = prisma) {
  return db.$transaction(
    async (tx) => {
      const existing = await tx.migrationProgress.findUnique({ where: { id } })
      if (existing?.validatedAt) return { alreadyValidated: true }
      const missing =
        await tx.$queryRaw`SELECT COUNT(*)::int AS n FROM "Click" c LEFT JOIN "ClickEvent" e ON e."eventId"='legacy:'||c.id WHERE e."eventId" IS NULL`
      if (missing[0].n)
        throw new Error(
          'Legacy events missing; keep cleanup disabled and resume backfill'
        )
      const mismatch = await tx.$queryRaw`
      WITH raw AS (SELECT "linkId",COUNT(*)::int AS total,COUNT(*) FILTER(WHERE NOT "isBot")::int AS human,COUNT(*) FILTER(WHERE "isBot")::int AS bot FROM "ClickEvent" GROUP BY "linkId")
      SELECT COUNT(*)::int AS n FROM raw FULL JOIN "LinkLifetimeStats" s USING ("linkId") WHERE COALESCE(raw.total,0)<>COALESCE(s."totalClicks",0) OR COALESCE(raw.human,0)<>COALESCE(s."humanClicks",0) OR COALESCE(raw.bot,0)<>COALESCE(s."botClicks",0)`
      const dailyMismatch = await tx.$queryRaw`
      WITH raw AS (SELECT "linkId", "clickedAt"::date AS date,COUNT(*)::int AS total,COUNT(*) FILTER(WHERE NOT "isBot")::int AS human,COUNT(*) FILTER(WHERE "isBot")::int AS bot FROM "ClickEvent" GROUP BY "linkId", "clickedAt"::date)
      SELECT COUNT(*)::int AS n FROM raw FULL JOIN "LinkDailyStats" s USING ("linkId",date) WHERE COALESCE(raw.total,0)<>COALESCE(s."totalClicks",0) OR COALESCE(raw.human,0)<>COALESCE(s."humanClicks",0) OR COALESCE(raw.bot,0)<>COALESCE(s."botClicks",0)`
      const dimensions = await tx.$queryRaw`
      SELECT COUNT(*)::int AS n FROM "LinkDailyStats" s CROSS JOIN (VALUES ('country'),('device'),('browser'),('operatingSystem'),('referrerDomain')) types(kind)
      LEFT JOIN LATERAL (SELECT SUM("totalClicks") t,SUM("humanClicks") h,SUM("botClicks") b FROM "LinkDailyDimension" d WHERE d."linkId"=s."linkId" AND d.date=s.date AND d."dimensionType"=types.kind) d ON true
      WHERE COALESCE(d.t,0)<>s."totalClicks" OR COALESCE(d.h,0)<>s."humanClicks" OR COALESCE(d.b,0)<>s."botClicks"`
      if (mismatch[0].n || dailyMismatch[0].n || dimensions[0].n)
        throw new Error('Aggregate mismatch; cleanup remains disabled')
      await tx.migrationProgress.upsert({
        where: { id },
        create: { id, validatedAt: new Date() },
        update: { validatedAt: new Date() },
      })
      return { validated: true }
    },
    { isolationLevel: 'RepeatableRead', timeout: 60000 }
  )
}

export async function normalizeLegacyLinks(db = prisma, size = 100) {
  const progress = await db.migrationProgress.upsert({
    where: { id: 'normalized-links-v1' },
    create: { id: 'normalized-links-v1' },
    update: {},
  })
  const rows = await db.url.findMany({
    where: progress.cursor ? { id: { gt: progress.cursor } } : {},
    orderBy: { id: 'asc' },
    take: size,
    select: { id: true, originalUrl: true, normalizedUrl: true },
  })
  for (const row of rows) {
    let normalizedUrl = null
    try {
      normalizedUrl = new URL(row.originalUrl).href
    } catch {
      /* Preserve malformed legacy destinations for owner review. */
    }
    if (!row.normalizedUrl && normalizedUrl)
      await db.url.updateMany({
        where: {
          id: row.id,
          originalUrl: row.originalUrl,
          normalizedUrl: null,
        },
        data: { normalizedUrl },
      })
    await db.migrationProgress.update({
      where: { id: 'normalized-links-v1' },
      data: { cursor: row.id, processed: { increment: 1 } },
    })
  }
  return { complete: rows.length < size, processed: rows.length }
}
