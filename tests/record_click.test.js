import { it, expect, vi, beforeEach } from 'vitest'
vi.mock('../lib/inngest/client.js', () => ({ inngest: { send: vi.fn() } }))
vi.mock('../lib/redis.js', () => ({ cacheDel: vi.fn() }))
import { inngest } from '../lib/inngest/client.js'
import { cacheDel } from '../lib/redis.js'
import {
  publishClick,
  invalidateCommittedLink,
} from '../lib/inngest/publish.js'
beforeEach(() => vi.resetAllMocks())
it('awaits Inngest acceptance', async () => {
  let finish
  inngest.send.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  let done = false
  const task = publishClick({ eventId: 'id' }).then(() => {
    done = true
  })
  await Promise.resolve()
  expect(done).toBe(false)
  finish()
  await task
  expect(done).toBe(true)
})
it('logs publication errors without rejecting the redirect background callback', async () => {
  inngest.send.mockRejectedValue(Error('offline'))
  await expect(publishClick({ eventId: 'id' })).resolves.toBeUndefined()
})
it('schedules invalidation retry only after immediate deletion fails', async () => {
  await invalidateCommittedLink('abc1234', 2)
  expect(inngest.send).not.toHaveBeenCalled()
  cacheDel.mockRejectedValue(Error('offline'))
  await invalidateCommittedLink('abc1234', 3)
  expect(inngest.send).toHaveBeenCalledWith({
    name: 'link/cache.invalidate',
    data: { shortCode: 'abc1234', version: 3 },
  })
})
