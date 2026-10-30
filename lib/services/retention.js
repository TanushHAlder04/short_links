import { prisma } from '../prisma.js'
import { DAY } from '../analytics.js'
import { logger } from '../logger.js'
export async function cleanupRaw(
  db = prisma,
  now = new Date(),
  batchSize = 500,
  maxBatches = 10
) {
  const gate = await db.migrationProgress.findUnique({
    where: { id: 'legacy-analytics-v1' },
  })
  if (!gate?.validatedAt) return { blocked: true, deleted: 0 }
  const cutoff = new Date(now.getTime() - 90 * DAY)
  let deleted = 0
  for (let batch = 0; batch < maxBatches; batch++) {
    const rows = await db.clickEvent.findMany({
      where: { clickedAt: { lt: cutoff } },
      orderBy: [{ clickedAt: 'asc' }, { eventId: 'asc' }],
      take: batchSize,
      select: { eventId: true },
    })
    if (!rows.length) break
    deleted += (
      await db.clickEvent.deleteMany({
        where: {
          eventId: { in: rows.map((r) => r.eventId) },
          clickedAt: { lt: cutoff },
        },
      })
    ).count
  }
  // Legacy records are removed only behind the same verified migration gate.
  for (let batch = 0; batch < maxBatches; batch++) {
    const rows = await db.click.findMany({
      where: { timestamp: { lt: cutoff } },
      take: batchSize,
      select: { id: true },
    })
    if (!rows.length) break
    await db.click.deleteMany({
      where: { id: { in: rows.map((r) => r.id) }, timestamp: { lt: cutoff } },
    })
  }
  logger.info('cleanup.completed', { count: deleted })
  return { blocked: false, deleted }
}
export async function cleanupIdempotency(db = prisma, now = new Date()) {
  const rows = await db.creationRequest.findMany({
    where: { expiresAt: { lte: now } },
    take: 500,
    select: { scope: true, keyHash: true },
  })
  if (!rows.length) return 0
  return (
    await db.creationRequest.deleteMany({
      where: { expiresAt: { lte: now }, OR: rows },
    })
  ).count
}
