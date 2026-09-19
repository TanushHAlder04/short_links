import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url) => { throw new Error(`REDIRECT:${url}`) }),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))
vi.mock('next/server', () => ({ after: vi.fn(), NextResponse: { json: Response.json } }))
vi.mock('../lib/cache-gatekeeper', () => ({ fetchCachedUrl: vi.fn() }))
vi.mock('../lib/analytics', () => ({ recordClick: vi.fn() }))
vi.mock('../lib/ratelimit', () => ({ checkRateLimit: vi.fn(), RATE_LIMITS: { redirect: { limit: 200, windowMs: 60000 } } }))
import { GET } from '../app/[shorturl]/route'
import { after } from 'next/server'
import { fetchCachedUrl } from '../lib/cache-gatekeeper'
import { recordClick } from '../lib/analytics'
import { checkRateLimit } from '../lib/ratelimit'
const link = { originalUrl: 'https://example.com', iosUrl: 'https://apple.com', androidUrl: 'https://android.com', isActive: true }
const call = (ua = '') => GET(new Request('https://short.test/abc', { headers: { 'user-agent': ua } }), { params: Promise.resolve({ shorturl: 'abc' }) })
beforeEach(() => { vi.clearAllMocks(); fetchCachedUrl.mockResolvedValue(link); checkRateLimit.mockResolvedValue({ allowed: true }) })
describe('Actual redirect route', () => {
  it.each([['iPhone', link.iosUrl], ['Android', link.androidUrl], ['Chrome', link.originalUrl], ['', link.originalUrl]])('routes %s', async (ua, target) => {
    await expect(call(ua)).rejects.toThrow(`REDIRECT:${target}`)
  })
  it('falls back when a device override is missing', async () => {
    fetchCachedUrl.mockResolvedValue({ ...link, iosUrl: null })
    await expect(call('iPhone')).rejects.toThrow(`REDIRECT:${link.originalUrl}`)
  })
  it.each([{ ...link, isActive: false }, { ...link, expiresAt: '2020-01-01' }])('returns 410 without recording unavailable links', async (data) => {
    fetchCachedUrl.mockResolvedValue(data)
    const res = await call()
    expect(res.status).toBe(410)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).toContain('Link unavailable')
    expect(after).not.toHaveBeenCalled()
  })
  it('returns not found for missing links', async () => {
    fetchCachedUrl.mockResolvedValue(null)
    await expect(call()).rejects.toThrow('NOT_FOUND')
  })
  it('passes an awaitable analytics task to after()', async () => {
    const pending = new Promise(() => {})
    recordClick.mockReturnValue(pending)
    await expect(call()).rejects.toThrow('REDIRECT:')
    expect(after.mock.calls[0][0]()).toBe(pending)
  })
  it('rejects rate-limited visits before looking up the link', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, reset: 123 })
    expect((await call()).status).toBe(429)
    expect(fetchCachedUrl).not.toHaveBeenCalled()
  })
})
