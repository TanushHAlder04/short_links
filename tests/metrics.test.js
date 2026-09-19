import { it, expect, vi, beforeEach, afterEach } from 'vitest'
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }))
vi.mock('../lib/apikeys', () => ({ getAuthUserId: vi.fn().mockResolvedValue('user-1') }))
vi.mock('../lib/prisma', () => ({ prisma: { url: { count: vi.fn(), findUnique: vi.fn() }, click: { count: vi.fn(), findMany: vi.fn() } } }))
import { prisma } from '../lib/prisma'
import { GET as stats } from '../app/api/stats/route'
import { GET as analytics } from '../app/api/analytics/[shortCode]/route'
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
  prisma.url.findUnique.mockResolvedValue({ shortCode: 'abc', userId: 'user-1', clickCount: 9 })
  prisma.click.findMany.mockResolvedValue([{ timestamp: new Date('2026-09-19T10:00:00Z'), device: 'desktop', browser: 'Chrome', country: 'India', referrer: 'https://example.com/a' }])
})
afterEach(() => vi.useRealTimers())
it('gets global totals from DB, including imports and excluding bots', async () => {
  prisma.url.count.mockResolvedValue(120)
  prisma.click.count.mockResolvedValue(800)
  expect(await (await stats()).json()).toEqual({ totalLinks: 120, totalClicks: 800 })
  expect(prisma.click.count).toHaveBeenCalledWith({ where: { isBot: false } })
})
it.each([false, true])('applies includeBots=%s to lifetime and 30-day metrics', async includeBots => {
  prisma.click.count.mockResolvedValue(includeBots ? 15 : 10)
  const res = await analytics(new Request(`https://app.test/api/analytics/abc?includeBots=${includeBots}`), { params: Promise.resolve({ shortCode: 'abc' }) })
  const data = await res.json()
  expect(data.totalClicks).toBe(includeBots ? 15 : 10)
  expect(data.windowClicks).toBe(1)
  expect(data.clicksByDay).toHaveLength(30)
  expect(data.clicksByDay[0].date).toBe('2026-08-21')
  expect(prisma.click.count).toHaveBeenCalledWith({ where: { shortCode: 'abc', ...(includeBots ? {} : { isBot: false }) } })
  expect(prisma.click.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
    shortCode: 'abc', timestamp: { gte: new Date('2026-08-21T00:00:00Z'), lt: new Date('2026-09-20T00:00:00Z') }, ...(includeBots ? {} : { isBot: false }),
  } }))
})
it('does not expose another users analytics', async () => {
  prisma.url.findUnique.mockResolvedValue({ userId: 'other' })
  const res = await analytics(new Request('https://app.test/api/analytics/abc'), { params: Promise.resolve({ shortCode: 'abc' }) })
  expect(res.status).toBe(403)
  expect(prisma.click.findMany).not.toHaveBeenCalled()
})
