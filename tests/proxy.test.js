import { it, expect, vi, beforeEach } from 'vitest'
vi.mock('../lib/ratelimit', () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }))
import { checkRateLimit } from '../lib/ratelimit'
import { proxy } from '../proxy'
const req = (pathname, method = 'POST') => ({ nextUrl: { pathname }, method, headers: new Headers({ 'x-forwarded-for': '1.2.3.4' }) })
beforeEach(() => vi.clearAllMocks())
it('uses a broad ceiling above the highest creation tier', async () => {
  expect((await proxy(req('/api/generate'))).status).toBe(200)
  expect(checkRateLimit).toHaveBeenCalledWith('api-abuse:1.2.3.4', { limit: 300, windowMs: 60000 })
})
it('does not rate-limit OAuth callbacks or preflight requests', async () => {
  await proxy(req('/api/auth/callback/google'))
  await proxy(req('/api/generate', 'OPTIONS'))
  expect(checkRateLimit).not.toHaveBeenCalled()
})
