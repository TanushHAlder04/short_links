import { it, expect, vi } from 'vitest'
import { randomUUID, createHmac } from 'node:crypto'
import { webhookRequest, attemptDelivery } from '../lib/services/deliveries.js'
const delivery = {
  id: randomUUID(),
  eventId: randomUUID(),
  linkId: 'abc1234',
  milestone: 10,
  createdAt: new Date('2026-09-01'),
  status: 'pending',
  retryGeneration: 0,
  attemptCount: 0,
  nextAttemptAt: null,
  destination: 'https://example.com/hook',
  link: { webhookSecret: 'long-signing-secret' },
}
it('authenticates timestamp and exact payload and supplies stable idempotency headers', () => {
  const { payload, headers } = webhookRequest(
    delivery,
    'secret',
    new Date('2026-09-01')
  )
  expect(headers['X-ShortLinks-Signature']).toBe(
    `sha256=${createHmac('sha256', 'secret').update(`${headers['X-ShortLinks-Timestamp']}.${payload}`).digest('hex')}`
  )
  expect(headers['Idempotency-Key']).toBe(delivery.eventId)
  expect(() => webhookRequest(delivery, null)).toThrow()
})
it.each([
  [0, 'pending', 5],
  [4, 'failed', 80],
])(
  'persists attempt %s and its bounded backoff',
  async (attemptCount, status, delaySeconds) => {
    const update = vi.fn(),
      db = {
        webhookDelivery: {
          findUnique: async () => ({ ...delivery, attemptCount }),
          updateMany: async () => ({ count: 1 }),
          update,
        },
      }
    const result = await attemptDelivery(
      { deliveryId: delivery.id, generation: 0 },
      db,
      async () => {
        throw Object.assign(Error('private error details'), { status: 503 })
      }
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status,
          errorSummary: 'HTTP 503',
          responseStatus: 503,
        }),
      })
    )
    expect(result.delaySeconds).toBe(delaySeconds)
    expect(result.done).toBe(status === 'failed')
  }
)
it('does not send stale generations or already delivered jobs', async () => {
  const send = vi.fn()
  await attemptDelivery(
    { deliveryId: delivery.id, generation: 1 },
    { webhookDelivery: { findUnique: async () => delivery } },
    send
  )
  expect(send).not.toHaveBeenCalled()
})
it('does not steal an unexpired delivery lease', async () => {
  const send = vi.fn()
  await expect(
    attemptDelivery(
      { deliveryId: delivery.id, generation: 0 },
      {
        webhookDelivery: {
          findUnique: async () => ({
            ...delivery,
            nextAttemptAt: new Date(Date.now() + 30000),
          }),
        },
      },
      send
    )
  ).rejects.toThrow('lease')
  expect(send).not.toHaveBeenCalled()
})
