import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { sendWebhook } from '../webhooks.js'
import { logger } from '../logger.js'
export const deliverySchema = z
  .object({
    deliveryId: z.string().uuid(),
    generation: z.number().int().nonnegative(),
  })
  .strict()
export function webhookRequest(delivery, secret, now = new Date()) {
  if (!secret) throw new Error('Signing secret missing')
  const timestamp = String(Math.floor(now.getTime() / 1000))
  const payload = JSON.stringify({
    event: 'click_milestone',
    eventId: delivery.eventId,
    shortCode: delivery.linkId,
    clickCount: delivery.milestone,
    timestamp: delivery.createdAt.toISOString(),
  })
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  return {
    payload,
    headers: {
      'Content-Type': 'application/json',
      'X-ShortLinks-Signature': `sha256=${signature}`,
      'X-ShortLinks-Timestamp': timestamp,
      'X-ShortLinks-Event-Id': delivery.eventId,
      'Idempotency-Key': delivery.eventId,
    },
  }
}
export async function attemptDelivery(
  input,
  db = prisma,
  send = sendWebhook,
  now = new Date()
) {
  const { deliveryId, generation } = deliverySchema.parse(input)
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { link: { select: { webhookSecret: true } } },
  })
  if (
    !delivery ||
    delivery.retryGeneration !== generation ||
    ['delivered', 'failed'].includes(delivery.status)
  )
    return { done: true }
  if (delivery.nextAttemptAt && delivery.nextAttemptAt > now)
    throw new Error('Delivery lease or backoff active')
  const claimed = await db.webhookDelivery.updateMany({
    where: {
      id: deliveryId,
      retryGeneration: generation,
      status: { in: ['pending', 'delivering'] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    data: {
      status: 'delivering',
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      nextAttemptAt: new Date(now.getTime() + 30000),
    },
  })
  if (!claimed.count) throw new Error('Delivery already claimed')
  const attempt = delivery.attemptCount + 1
  logger.info('webhook.attempt', { deliveryId, attempt })
  try {
    const { payload, headers } = webhookRequest(
      delivery,
      delivery.link.webhookSecret,
      now
    )
    const responseStatus = await send(delivery.destination, payload, headers)
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'delivered',
        responseStatus,
        deliveredAt: new Date(),
        nextAttemptAt: null,
        errorSummary: null,
      },
    })
    return { done: true }
  } catch (error) {
    const exhausted = attempt >= 5 * (generation + 1)
    const delaySeconds = 5 * 2 ** Math.min(4, attempt - 1 - generation * 5)
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: exhausted ? 'failed' : 'pending',
        responseStatus: error.status || null,
        errorSummary: error.status
          ? `HTTP ${error.status}`
          : 'Destination, signing, or network failure',
        nextAttemptAt: exhausted
          ? null
          : new Date(Date.now() + delaySeconds * 1000),
      },
    })
    logger.error('webhook.attempt_failed', error, { deliveryId, attempt })
    return { done: exhausted, delaySeconds }
  }
}
export async function retryOwnedDelivery(id, userId, db = prisma) {
  return db.$transaction(async (tx) => {
    const changed = await tx.webhookDelivery.updateMany({
      where: { id, status: 'failed', link: { userId, deletedAt: null } },
      data: {
        status: 'pending',
        retryGeneration: { increment: 1 },
        nextAttemptAt: null,
        errorSummary: null,
      },
    })
    if (!changed.count) return null
    return tx.webhookDelivery.findUnique({
      where: { id },
      select: { id: true, retryGeneration: true },
    })
  })
}
