import {analyticsReport,rawReportRows} from '../../lib/services/reports.js'
import {reportOptions} from '../../lib/report-options.js'
import {analyticsCsv} from '../../lib/report-csv.js'
import {generateUniqueCode,newShortCode} from '../../lib/shortcode.js'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import { createLink, ownedLink } from '../../lib/services/links.js'
import { processClick, storeClick } from '../../lib/services/analytics.js'
import { cleanupRaw } from '../../lib/services/retention.js'
import { backfillBatch, validateBackfill } from '../../lib/services/backfill.js'
import { linkAnalytics, listLinks } from '../../lib/services/queries.js'
import {
  retryOwnedDelivery,
  attemptDelivery,
} from '../../lib/services/deliveries.js'
import { DAY, enrichClick } from '../../lib/analytics.js'
const run = randomUUID().slice(0, 8),
  owner = { userId: `test-${run}` },
  other = { userId: `other-${run}` }
let code
const event = (patch = {}) => ({
  eventId: randomUUID(),
  linkId: code,
  clickedAt: new Date().toISOString(),
  userAgent: 'Mozilla/5.0 Chrome/130.0',
  referrer: 'https://example.org/path?private=1',
  country: 'IN',
  ipHash: null,
  ...patch,
})
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL || 'http://invalid')
  if (
    !['127.0.0.1', 'localhost', 'postgres'].includes(url.hostname) ||
    !url.pathname.includes('test')
  )
    throw Error('Tests require a disposable local test database')
  await prisma.$executeRaw`TRUNCATE TABLE "User", "Url", "Click", "ClickEvent", "LinkLifetimeStats", "LinkDailyStats", "LinkDailyDimension", "WebhookDelivery", "CreationRequest", "MigrationProgress" CASCADE`
  await prisma.user.createMany({
    data: [{ id: owner.userId }, { id: other.userId }],
  })
  code = (await createLink({ url: 'https://example.com' }, owner, null)).link
    .shortCode
})
afterAll(async () => {
  await prisma.$disconnect()
})
describe('real PostgreSQL guarantees', () => {
  it('retries an actual PostgreSQL unique violation without a precheck',async()=>{
    let first=true; const fresh=newShortCode()
    const result=await generateUniqueCode({generate:()=>{if(first){first=false;return code}return fresh},dbInsertCallback:shortCode=>prisma.url.create({data:{shortCode,originalUrl:'https://collision.test',userId:owner.userId}})})
    expect(result).toBe(fresh)
  })

  it('creates eight-character codes and permits duplicate destinations', async () => {
    expect(code).toHaveLength(8)
    expect(
      (await createLink({ url: 'https://example.com' }, owner)).link.shortCode
    ).not.toBe(code)
  })
  it('serializes concurrent idempotency and rejects changed payload', async () => {
    const outputs = await Promise.all(
      Array.from({ length: 8 }, () =>
        createLink({ url: 'https://same.test/a' }, owner, `key-${run}`)
      )
    )
    expect(new Set(outputs.map((o) => o.result.shortCode)).size).toBe(1)
    await expect(
      createLink({ url: 'https://different.test' }, owner, `key-${run}`)
    ).rejects.toMatchObject({ status: 409 })
  })
  it('enforces alias uniqueness including tombstones', async () => {
    const alias = `alias-${run}`
    await createLink({ url: 'https://example.com', customAlias: alias }, owner)
    await expect(
      createLink({ url: 'https://example.com', customAlias: alias }, other)
    ).rejects.toMatchObject({ status: 409 })
    await prisma.url.update({
      where: { shortCode: alias },
      data: { deletedAt: new Date(), isActive: false },
    })
    await expect(
      createLink({ url: 'https://elsewhere.test', customAlias: alias }, owner)
    ).rejects.toMatchObject({ status: 409 })
    await expect(ownedLink(alias, owner.userId)).rejects.toMatchObject({
      status: 404,
    })
  })
  it('enforces ownership and excludes secret fields', async () => {
    await expect(ownedLink(code, other.userId)).rejects.toMatchObject({
      status: 404,
    })
    expect(await ownedLink(code, owner.userId)).not.toHaveProperty(
      'webhookSecret'
    )
  })
  it('counts concurrent duplicate events exactly once', async () => {
    const e = event()
    await Promise.all(Array.from({ length: 8 }, () => processClick(e)))
    expect(
      await prisma.clickEvent.count({ where: { eventId: e.eventId } })
    ).toBe(1)
    expect(
      (await prisma.linkLifetimeStats.findUnique({ where: { linkId: code } }))
        .totalClicks
    ).toBe(1)
    expect(
      await prisma.linkDailyDimension.count({ where: { linkId: code } })
    ).toBe(5)
  })
  it('rolls back raw insertion when a later aggregate write fails', async () => {
    const e = event()
    const broken = {
      $transaction: (fn) =>
        prisma.$transaction((tx) =>
          fn(
            new Proxy(tx, {
              get(target, key) {
                if (key === 'linkDailyStats')
                  return {
                    upsert: () => {
                      throw Error('injected aggregate failure')
                    },
                  }
                return target[key]
              },
            })
          )
        ),
    }
    await expect(processClick(e, broken)).rejects.toThrow(
      'Analytics transaction failed'
    )
    expect(
      await prisma.clickEvent.count({ where: { eventId: e.eventId } })
    ).toBe(0)
    expect(
      (await prisma.linkLifetimeStats.findUnique({ where: { linkId: code } }))
        .totalClicks
    ).toBe(1)
  })
  it('creates one human milestone under concurrency and filters every aggregate', async () => {
    await prisma.url.update({
      where: { shortCode: code },
      data: {
        webhookUrl: 'https://example.com/hook',
        webhookSecret: 'test-secret-123456789',
      },
    })
    await Promise.all(Array.from({ length: 9 }, () => processClick(event())))
    await processClick(event({ userAgent: 'Googlebot' }))
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { linkId: code },
    })
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].milestone).toBe(10)
    for (const [traffic, total] of [
      ['all', 11],
      ['human', 10],
      ['bot', 1],
    ]) {
      const result = await linkAnalytics(code, owner.userId, traffic)
      expect(result.totalClicks).toBe(total)
      expect(result.windowClicks).toBe(total)
      for (const key of [
        'byCountry',
        'byDevice',
        'byBrowser',
        'byOperatingSystem',
        'topReferrers',
      ])
        expect(result[key].reduce((n, r) => n + r.count, 0)).toBe(total)
    }
  })
  it('persists webhook outcome and enforces retry ownership', async () => {
    const d = await prisma.webhookDelivery.findFirst({
      where: { linkId: code },
    })
    expect(
      (
        await attemptDelivery(
          { deliveryId: d.id, generation: 0 },
          prisma,
          async () => 204
        )
      ).done
    ).toBe(true)
    expect(
      (await prisma.webhookDelivery.findUnique({ where: { id: d.id } })).status
    ).toBe('delivered')
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: { status: 'failed' },
    })
    expect(await retryOwnedDelivery(d.id, other.userId)).toBeNull()
    expect((await retryOwnedDelivery(d.id, owner.userId)).retryGeneration).toBe(
      1
    )
    // The test uses a fake sender. Do not leave a due fixture for a later Dev Server sweep.
    await prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: 'failed', nextAttemptAt: null } })
  })
  it('searches across pages and reports account aggregates', async () => {
    const result = await listLinks(
      owner.userId,
      new URLSearchParams({ limit: '1', q: code, traffic: 'all' })
    )
    expect(result.links[0].shortCode).toBe(code)
    expect(result.stats.clicks).toBe(11)
  })
  it('backfills legacy seven-character links and validates before bounded retention', async () => {
    const old = `L${run.slice(0, 6)}`
    await prisma.url.create({
      data: {
        shortCode: old,
        originalUrl: 'https://legacy.test',
        userId: owner.userId,
      },
    })
    await prisma.click.create({
      data: {
        shortCode: old,
        timestamp: new Date(Date.now() - 100 * DAY),
        referrer: 'https://referrer.test/private',
        isBot: false,
      },
    })
    await prisma.migrationProgress.deleteMany({
      where: { id: 'legacy-analytics-v1' },
    })
    expect((await cleanupRaw()).blocked).toBe(true)
    let progress
    do {
      progress = await backfillBatch(prisma, 2)
    } while (!progress.complete)
    await validateBackfill()
    const now = new Date(),
      boundary = event({
        clickedAt: new Date(now.getTime() - 90 * DAY).toISOString(),
      }),
      older = event({
        clickedAt: new Date(now.getTime() - 90 * DAY - 1).toISOString(),
      })
    await storeClick(enrichClick(boundary))
    await storeClick(enrichClick(older))
    const before = (
      await prisma.linkLifetimeStats.findUnique({ where: { linkId: code } })
    ).totalClicks
    await cleanupRaw(prisma, now, 1, 20)
    expect(
      await prisma.clickEvent.findUnique({
        where: { eventId: boundary.eventId },
      })
    ).not.toBeNull()
    expect(
      await prisma.clickEvent.findUnique({ where: { eventId: older.eventId } })
    ).toBeNull()
    expect(
      (await prisma.linkLifetimeStats.findUnique({ where: { linkId: code } }))
        .totalClicks
    ).toBe(before)
    expect((await processClick(older, prisma, now)).expired).toBe(true)
  })
})


describe('real PostgreSQL analytics exports',()=>{
  it('enforces ownership, consistent traffic totals, retention, empty exports and row limits',async()=>{
    const uid=`export-${run}`,alien=`export-other-${run}`
    await prisma.user.createMany({data:[{id:uid},{id:alien}]})
    const a=(await createLink({url:'https://example.com?secret=hidden'},{userId:uid})).link.shortCode
    const b=(await createLink({url:'https://other.example'},{userId:alien})).link.shortCode
    for(const [linkId,isBot] of [[a,false],[a,true],[b,false]])await storeClick(enrichClick(event({linkId,userAgent:isBot?'Googlebot':'Chrome/130.0'})))
    const now=new Date(),opts=p=>reportOptions(new URLSearchParams(p),now)
    await expect(analyticsReport(uid,opts({shortCode:b}))).rejects.toMatchObject({status:404})
    await expect(rawReportRows(uid,opts({shortCode:b}))).rejects.toMatchObject({status:404})
    for(const [traffic,total] of [['human',1],['bot',1],['all',2]]){
      const report=await analyticsReport(uid,opts({shortCode:a,traffic}))
      const dashboard=await linkAnalytics(a,uid,traffic)
      expect(report.totals.totalClicks).toBe(total);expect(report.totals.totalClicks).toBe(dashboard.windowClicks);expect(report.totals).toEqual(dashboard.report.totals)
      expect(analyticsCsv('daily',report)).toContain(`"${total}"`)
      const raw=await rawReportRows(uid,opts({traffic}));expect(raw).toHaveLength(total);expect(raw.every(r=>r.shortCode===a)).toBe(true);expect(raw[0]).not.toHaveProperty('ipHash')
    }
    const account=await analyticsReport(uid,opts({traffic:'all'}));expect(account.links.map(l=>l.shortCode)).toEqual([a]);expect(JSON.stringify(account)).not.toContain('webhookSecret')
    const empty=await analyticsReport('unknown-user',opts({}));expect(empty.totals.totalClicks).toBe(0);expect(empty.links).toHaveLength(0)
    const oldDate=new Date(+now-100*DAY),date=oldDate.toISOString().slice(0,10)
    await storeClick(enrichClick(event({linkId:a,clickedAt:oldDate.toISOString()})))
    const old=opts({shortCode:a,range:'custom',start:date,end:date})
    expect((await analyticsReport(uid,old)).totals.totalClicks).toBe(1)
    await expect(rawReportRows(uid,old)).rejects.toMatchObject({code:'RAW_RETENTION_LIMIT'})
    const midnight=new Date(new Date().toISOString().slice(0,10)+'T00:00:00Z'),boundary=new Date(+midnight-90*DAY),boundaryDay=boundary.toISOString().slice(0,10)
    await storeClick(enrichClick(event({linkId:a,clickedAt:boundary.toISOString()})))
    const exact=reportOptions(new URLSearchParams({shortCode:a,start:boundaryDay,end:boundaryDay}),midnight)
    expect((await rawReportRows(uid,exact)).length).toBe(1)
    process.env.EXPORT_MAX_RAW_ROWS='1'
    try{await expect(rawReportRows(uid,opts({traffic:'all'}))).rejects.toMatchObject({status:413})}finally{delete process.env.EXPORT_MAX_RAW_ROWS}
  })
})
