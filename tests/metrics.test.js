import { it, expect, vi } from 'vitest'
import { linkAnalytics } from '../lib/services/queries.js'
it.each([
  ['human', 2],
  ['bot', 1],
  ['all', 3],
])('queries permanent aggregate column for %s', async (traffic, total) => {
  const row = { totalClicks: 3, humanClicks: 2, botClicks: 1 },
    db = {
      url: { findFirst: vi.fn().mockResolvedValue({ shortCode: 'abc1234' }), findMany: vi.fn().mockResolvedValue([{shortCode:'abc1234'}]) },
      linkLifetimeStats: { findUnique: vi.fn().mockResolvedValue(row) },
      linkDailyStats: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ ...row, date: new Date('2026-09-29') }]),
      },
      linkDailyDimension: { findMany: vi.fn().mockResolvedValue([]) },
    }
  db.$transaction=fn=>fn(db)
  const result = await linkAnalytics(
    'abc1234',
    'owner',
    traffic,
    db,
    new Date('2026-09-29T10:00:00Z')
  )
  expect(result.totalClicks).toBe(total)
  expect(result.windowClicks).toBe(total)
  expect(result.clicksByDay).toHaveLength(30)
  expect(result.clicksByDay.at(-1).count).toBe(total)
})
it('stops before aggregate queries for unowned links', async () => {
  const query = vi.fn()
  await expect(
    linkAnalytics('abc1234', 'wrong', 'human', {
      url: { findFirst: async () => null },
      $transaction: fn=>fn({url:{findMany:async()=>[]}}),
      linkLifetimeStats: { findUnique: query },
    })
  ).rejects.toMatchObject({ status: 404 })
  expect(query).not.toHaveBeenCalled()
})
