import { it, expect, vi, beforeEach } from 'vitest'
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('../lib/services/redirects.js', () => ({ resolveRedirect: vi.fn() }))
vi.mock('../lib/inngest/publish.js', () => ({ publishClick: vi.fn() }))
vi.mock('../lib/ratelimit.js', () => ({ enforceLimit: vi.fn() }))
import { GET } from '../app/[shorturl]/route.js'
import { after } from 'next/server'
import { resolveRedirect } from '../lib/services/redirects.js'
import { publishClick } from '../lib/inngest/publish.js'
import { enforceLimit } from '../lib/ratelimit.js'
beforeEach(() => vi.clearAllMocks())
it('returns explicit 302 without waiting for analytics or a redirect quota call', async () => {
  resolveRedirect.mockResolvedValue({
    status: 302,
    location: 'https://example.com',
  })
  const res = await GET(new Request('https://short.test/abc1234'), {
    params: Promise.resolve({ shorturl: 'abc1234' }),
  })
  expect(res.status).toBe(302)
  expect(enforceLimit).not.toHaveBeenCalled()
  expect(publishClick).not.toHaveBeenCalled()
  await after.mock.calls[0][0]()
  expect(publishClick).toHaveBeenCalledWith(
    expect.objectContaining({ eventId: expect.any(String), linkId: 'abc1234' })
  )
})
it.each([404, 410, 503])(
  'returns status %s without analytics',
  async (status) => {
    resolveRedirect.mockResolvedValue({ status })
    const res = await GET(new Request('https://short.test/abc1234'), {
      params: { shorturl: 'abc1234' },
    })
    expect(res.status).toBe(status)
    expect(after).not.toHaveBeenCalled()
    expect(enforceLimit).toHaveBeenCalledTimes(status === 404 ? 1 : 0)
  }
)
