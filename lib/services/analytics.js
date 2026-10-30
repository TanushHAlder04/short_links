import { randomUUID } from 'node:crypto'
import { prisma } from '../prisma.js'
import { enrichClick, utcDay, DAY } from '../analytics.js'
import { logger } from '../logger.js'
export async function storeClick(
  click,
  db = prisma,
  { backfill = false } = {}
) {
  return db.$transaction(
    async (tx) => {
      const inserted = await tx.clickEvent.createMany({
        data: [click],
        skipDuplicates: true,
      })
      if (!inserted.count) {
        logger.info('analytics.duplicate', {
          eventId: click.eventId,
          duplicate: true,
        })
        return {
          duplicate: true,
          deliveries: await tx.webhookDelivery.findMany({
            where: { sourceEventId: click.eventId, status: 'pending' },
            select: { id: true, retryGeneration: true },
          }),
        }
      }
      const counts = {
        totalClicks: 1,
        humanClicks: click.isBot ? 0 : 1,
        botClicks: click.isBot ? 1 : 0,
      }
      const increment = Object.fromEntries(
        Object.entries(counts).map(([k, v]) => [k, { increment: v }])
      )
      // This row lock serializes per-link milestones and dimension cardinality decisions.
      const lifetime = await tx.linkLifetimeStats.upsert({
        where: { linkId: click.linkId },
        create: { linkId: click.linkId, ...counts },
        update: increment,
      })
      const date = utcDay(click.clickedAt)
      await tx.linkDailyStats.upsert({
        where: { linkId_date: { linkId: click.linkId, date } },
        create: { linkId: click.linkId, date, ...counts },
        update: increment,
      })
      for (const dimensionType of [
        'country',
        'device',
        'browser',
        'operatingSystem',
        'referrerDomain',
      ]) {
        let dimensionValue = click[dimensionType]
        if (dimensionType === 'referrerDomain') {
          const where = { linkId: click.linkId, date, dimensionType }
          const exists = await tx.linkDailyDimension.findUnique({
            where: {
              linkId_date_dimensionType_dimensionValue: {
                ...where,
                dimensionValue,
              },
            },
          })
          if (!exists && (await tx.linkDailyDimension.count({ where })) >= 100)
            dimensionValue = 'Other'
        }
        const key = {
          linkId: click.linkId,
          date,
          dimensionType,
          dimensionValue,
        }
        await tx.linkDailyDimension.upsert({
          where: { linkId_date_dimensionType_dimensionValue: key },
          create: { ...key, ...counts },
          update: increment,
        })
      }
      const deliveries = []
      if (!backfill && !click.isBot && lifetime.humanClicks % 10 === 0) {
        const link = await tx.url.findUnique({
          where: { shortCode: click.linkId },
          select: { webhookUrl: true, deletedAt: true },
        })
        if (link.webhookUrl && !link.deletedAt) {
          const delivery = await tx.webhookDelivery.upsert({
            where: {
              linkId_milestone: {
                linkId: click.linkId,
                milestone: lifetime.humanClicks,
              },
            },
            create: {
              eventId: randomUUID(),
              sourceEventId: click.eventId,
              linkId: click.linkId,
              milestone: lifetime.humanClicks,
              destination: link.webhookUrl,
            },
            update: {},
            select: { id: true, retryGeneration: true },
          })
          deliveries.push(delivery)
        }
      }
      logger.info('analytics.processed', {
        eventId: click.eventId,
        delayMs: Date.now() - click.clickedAt.getTime(),
      })
      return { duplicate: false, deliveries }
    },
    { timeout: 15000 }
  )
}
export async function processClick(input, db = prisma, now = new Date()) {
  const click = enrichClick(input)
  // Once raw deduplication rows expire, old replayed events must not count again.
  if (click.clickedAt.getTime() < now.getTime() - 90 * DAY)
    return { expired: true, deliveries: [] }
  if (click.clickedAt.getTime() > now.getTime() + 5 * 60000)
    throw new Error('Future event timestamp')
  try {
    return await storeClick(click, db)
  } catch (error) {
    logger.error('analytics.transaction_failed', error, {
      eventId: click.eventId,
    })
    throw new Error('Analytics transaction failed; retry processing')
  }
}
