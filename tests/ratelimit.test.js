import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../lib/redis', () => ({ redis: { eval: vi.fn() } }))
import { redis } from '../lib/redis'
import { checkRateLimit, RATE_LIMITS } from '../lib/ratelimit'
beforeEach(() => vi.clearAllMocks())
describe('Atomic rate limiter', () => {
  it('preserves the remaining count and future reset from Redis', async () => {
    const reset = Math.ceil(Date.now() / 1000) + 45
    redis.eval.mockResolvedValue([1, 2, reset, 3])
    expect(await checkRateLimit('user:1', { limit: 5, windowMs: 60000 })).toEqual({ allowed: true, remaining: 2, reset, count: 3 })
    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("redis.call('ZADD'"), ['rl:user:1'], [expect.any(Number), 60000, 5, expect.any(String)])
  })
  it('allows the last slot and rejects subsequent requests', async () => {
    redis.eval.mockResolvedValueOnce([1, 0, 999, 5]).mockResolvedValueOnce([0, 0, 999, 5])
    expect((await checkRateLimit('a')).allowed).toBe(true)
    expect((await checkRateLimit('a')).allowed).toBe(false)
  })
  it('uses distinct members for concurrent calls in the same millisecond', async () => {
    redis.eval.mockResolvedValue([1, 1, 999, 1])
    const spy = vi.spyOn(Date, 'now').mockReturnValue(1000)
    await Promise.all([checkRateLimit('a'), checkRateLimit('a')])
    expect(redis.eval.mock.calls[0][2][3]).not.toBe(redis.eval.mock.calls[1][2][3])
    spy.mockRestore()
  })
  it('fails open with a future reset when Redis fails', async () => {
    redis.eval.mockRejectedValue(new Error('unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await checkRateLimit('a', { limit: 5, windowMs: 60000 })
    expect(result.allowed).toBe(true)
    expect(result.reset).toBeGreaterThan(Date.now() / 1000)
    log.mockRestore()
  })
  it('keeps the advertised creation tiers', () => {
    expect([RATE_LIMITS.anonymous.limit, RATE_LIMITS.authenticated.limit, RATE_LIMITS.apiKey.limit]).toEqual([5, 50, 100])
  })
})
