import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../lib/redis', () => ({ redis: { eval: vi.fn() } }))
import { redis } from '../lib/redis'
import { checkRateLimit, RATE_LIMITS, enforceLimit } from '../lib/ratelimit'
beforeEach(() => vi.clearAllMocks())
describe('Atomic rate limiter', () => {
  it('preserves the remaining count and future reset from Redis', async () => {
    const reset = Math.ceil(Date.now() / 1000) + 45
    redis.eval.mockResolvedValue([1, 2, reset, 3])
    expect(
      await checkRateLimit('user:1', { limit: 5, windowMs: 60000 })
    ).toEqual({ allowed: true, remaining: 2, reset, count: 3 })
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('ZADD'"),
      ['rl:user:1'],
      [expect.any(Number), 60000, 5, expect.any(String)]
    )
  })
  it('allows the last slot and rejects subsequent requests', async () => {
    redis.eval
      .mockResolvedValueOnce([1, 0, 999, 5])
      .mockResolvedValueOnce([0, 0, 999, 5])
    expect((await checkRateLimit('a')).allowed).toBe(true)
    expect((await checkRateLimit('a')).allowed).toBe(false)
  })
  it('uses distinct members for concurrent calls in the same millisecond', async () => {
    redis.eval.mockResolvedValue([1, 1, 999, 1])
    const spy = vi.spyOn(Date, 'now').mockReturnValue(1000)
    await Promise.all([checkRateLimit('a'), checkRateLimit('a')])
    expect(redis.eval.mock.calls[0][2][3]).not.toBe(
      redis.eval.mock.calls[1][2][3]
    )
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
    expect([
      RATE_LIMITS.anonymous.limit,
      RATE_LIMITS.authenticated.limit,
      RATE_LIMITS.apiKey.limit,
    ]).toEqual([10, 50, 100])
  })
})

it('fails safe for anonymous/API writes and open for session management', async () => {
  redis.eval.mockRejectedValue(Error('offline'))
  const request = new Request('http://localhost/api/generate')
  await expect(enforceLimit(request, {})).rejects.toMatchObject({ status: 503 })
  await expect(
    enforceLimit(request, { userId: 'u', apiKeyId: 'key' })
  ).rejects.toMatchObject({ status: 503 })
  await expect(
    enforceLimit(request, { userId: 'u', type: 'session' }, 'dashboard')
  ).resolves.toHaveProperty('X-RateLimit-Reset')
  await expect(enforceLimit(request, {}, 'scanning')).resolves.toBeTruthy()
})
it('scopes API quotas to the key, not the owner', async () => {
  redis.eval.mockResolvedValue([1, 99, 9999, 1])
  await enforceLimit(new Request('http://localhost'), {
    userId: 'owner',
    apiKeyId: 'key-2',
  })
  expect(redis.eval.mock.calls.at(-1)[1][0]).toBe('rl:create:key:key-2')
})

it('shares import and dashboard quotas across all keys of an owner', async () => {
  redis.eval.mockResolvedValue([1,2,9999,1])
  await enforceLimit(new Request('http://localhost'), {userId:'owner',apiKeyId:'key-1'}, 'import')
  await enforceLimit(new Request('http://localhost'), {userId:'owner',apiKeyId:'key-2'}, 'import')
  expect(redis.eval.mock.calls.slice(-2).map(call=>call[1][0])).toEqual(['rl:import:user:owner','rl:import:user:owner'])
})

it('enforces the shared owner download quota',async()=>{
  const reset=Math.ceil(Date.now()/1000)+30
  redis.eval.mockResolvedValueOnce([1,0,reset,5]).mockResolvedValueOnce([0,0,reset,5])
  const req=new Request('http://localhost/api/reports/export')
  const headers=await enforceLimit(req,{userId:'owner',apiKeyId:'key-a'},'export')
  expect(headers['X-RateLimit-Limit']).toBe('5')
  await expect(enforceLimit(req,{userId:'owner',apiKeyId:'key-b'},'export')).rejects.toMatchObject({status:429})
  expect(redis.eval.mock.calls.slice(-2).map(call=>call[1][0])).toEqual(['rl:export:user:owner','rl:export:user:owner'])
})
