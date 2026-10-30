import { reportFailure } from '../monitoring.js'
import { z } from 'zod'
import { inngest } from './client.js'
import { processClick } from '../services/analytics.js'
import { attemptDelivery, deliverySchema } from '../services/deliveries.js'
import { cleanupRaw, cleanupIdempotency } from '../services/retention.js'
import { cacheDel } from '../redis.js'
import { prisma } from '../prisma.js'
import { logger } from '../logger.js'
const onFailure = async ({ error }) => {
  logger.error('inngest.processing_failed', error)
  await reportFailure('inngest.processing_failed')
}
export const clickProcessor = inngest.createFunction(
  {
    id: 'process-click',
    triggers: { event: 'link/clicked' },
    retries: 5,
    onFailure,
  },
  async ({ event, step }) => {
    const result = await step.run('count-once', () => processClick(event.data))
    if (result.deliveries.length)
      await step.sendEvent(
        'request-webhooks',
        result.deliveries.map((d) => ({
          name: 'link/webhook.requested',
          data: { deliveryId: d.id, generation: d.retryGeneration },
        }))
      )
    return result
  }
)
export const webhookDelivery = inngest.createFunction(
  {
    id: 'deliver-webhook',
    triggers: { event: 'link/webhook.requested' },
    retries: 5,
    concurrency: { limit: 1, key: 'event.data.deliveryId' },
    onFailure,
  },
  async ({ event, step }) => {
    const data = deliverySchema.parse(event.data)
    for (let i = 0; i < 5; i++) {
      const result = await step.run(`attempt-${i}`, () => attemptDelivery(data))
      if (result.done) return result
      await step.sleep(`backoff-${i}`, `${result.delaySeconds}s`)
    }
    return { done: true }
  }
)
const invalidationSchema = z
  .object({
    shortCode: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,29}$/),
    version: z.number().int().positive(),
  })
  .strict()
export const invalidationRetry = inngest.createFunction(
  {
    id: 'invalidate-cache',
    triggers: { event: 'link/cache.invalidate' },
    retries: 8,
    onFailure,
  },
  async ({ event, step }) => {
    const data = invalidationSchema.parse(event.data)
    await step.run('invalidate', () => cacheDel(data.shortCode, data.version))
    return { invalidated: true }
  }
)
export const cleanup = inngest.createFunction(
  {
    id: 'raw-retention',
    triggers: [
      { cron: '17 * * * *' },
      { event: 'analytics/cleanup.requested' },
    ],
    retries: 3,
    onFailure,
  },
  async ({ event, step }) => {
    if (event.name === 'analytics/cleanup.requested')
      z.object({}).strict().parse(event.data)
    await step.run('idempotency-expiry', () => cleanupIdempotency())
    return step.run('bounded-raw-cleanup', () => cleanupRaw())
  }
)
// Recovers the database-commit/event-publication gap without a per-click outbox.
export const deliveryRecovery = inngest.createFunction(
  {
    id: 'recover-pending-webhooks',
    triggers: { cron: '*/5 * * * *' },
    retries: 3,
    onFailure,
  },
  async ({ step }) => {
    const rows = await step.run('due-deliveries', () =>
      prisma.webhookDelivery.findMany({
        where: {
          status: { in: ['pending', 'delivering'] },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        },
        take: 100,
        orderBy: { createdAt: 'asc' },
        select: { id: true, retryGeneration: true },
      })
    )
    if (rows.length)
      await step.sendEvent(
        'recover',
        rows.map((d) => ({
          name: 'link/webhook.requested',
          data: { deliveryId: d.id, generation: d.retryGeneration },
        }))
      )
    return { count: rows.length }
  }
)
export const functions = [
  clickProcessor,
  webhookDelivery,
  invalidationRetry,
  cleanup,
  deliveryRecovery,
]
