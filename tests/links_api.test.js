import { it, expect, vi, beforeEach } from 'vitest'
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }))
vi.mock('../app/api/generate/route', () => ({ POST: vi.fn() }))
vi.mock('../lib/apikeys', () => ({ getAuthUserId: vi.fn() }))
vi.mock('../lib/ratelimit', () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }))
vi.mock('../lib/redis', () => ({ cacheDel: vi.fn() }))
vi.mock('../lib/prisma', () => ({ prisma: { url: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), update: vi.fn() }, click: { count: vi.fn(), findMany: vi.fn() } } }))
import { GET } from '../app/api/links/route'
import { PATCH, DELETE } from '../app/api/links/[shortCode]/route'
import { getAuthUserId } from '../lib/apikeys'
import { prisma } from '../lib/prisma'
import { cacheDel } from '../lib/redis'
const params = { params: Promise.resolve({ shortCode: 'abc' }) }
const patch = body => PATCH(new Request('https://app.test/api/links/abc', { method: 'PATCH', body: JSON.stringify(body) }), params)
beforeEach(() => {
  vi.clearAllMocks()
  getAuthUserId.mockResolvedValue('user-1')
  prisma.url.findUnique.mockResolvedValue({ userId: 'user-1' })
  prisma.url.update.mockResolvedValue({ shortCode: 'abc' })
})
it('queries all matching owned links while returning independent account totals', async () => {
  prisma.url.findMany.mockResolvedValue([{ shortCode: 'match', clickCount: 1 }])
  prisma.url.count.mockResolvedValueOnce(20).mockResolvedValueOnce(60).mockResolvedValueOnce(40).mockResolvedValueOnce(12)
  prisma.click.count.mockResolvedValue(1000)
  const response = await GET(new Request('https://app.test/api/links?q=match&page=2&limit=15'))
  const data = await response.json()
  expect(data.stats).toEqual({ total: 60, clicks: 1000, active: 40, thisWeek: 12 })
  expect(data.pagination).toMatchObject({ total: 20, pages: 2 })
  expect(prisma.url.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 15, where: { userId: 'user-1', OR: [
    { shortCode: { contains: 'match', mode: 'insensitive' } }, { originalUrl: { contains: 'match', mode: 'insensitive' } },
  ] } }))
  expect(prisma.click.count).toHaveBeenCalledWith({ where: { isBot: false, url: { userId: 'user-1' } } })
})
it.each([{ iosUrl: 'javascript:alert(1)' }, { androidUrl: 123 }, { webhookUrl: 'http://127.0.0.1' }, { webhookUrl: 'https://127.0.0.1' }, { expiresAt: 'invalid' }, { expiresAt: '2020-01-01' }, { isActive: 'false' }, null])('rejects invalid PATCH input %j', async body => {
  expect((await patch(body)).status).toBe(400)
  expect(prisma.url.update).not.toHaveBeenCalled()
})
it('allows clearing options and invalidates the redirect cache', async () => {
  expect((await patch({ iosUrl: null, expiresAt: null })).status).toBe(200)
  expect(prisma.url.update).toHaveBeenCalledWith({ where: { shortCode: 'abc' }, data: { iosUrl: null, expiresAt: null } })
  expect(cacheDel).toHaveBeenCalledWith('abc')
})
it('rejects unauthenticated and cross-account writes before mutation', async () => {
  getAuthUserId.mockResolvedValueOnce(null)
  expect((await patch({ isActive: false })).status).toBe(401)
  prisma.url.findUnique.mockResolvedValue({ userId: 'other-user' })
  expect((await patch({ isActive: false })).status).toBe(403)
  expect((await DELETE(new Request('https://app.test'), params)).status).toBe(403)
  expect(prisma.url.update).not.toHaveBeenCalled()
})
