import { randomUUID } from 'node:crypto'
import { redis } from './redis'

// One atomic operation: concurrent callers cannot count the same free slot.
const SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
local allowed = 0
if count < limit then
  redis.call('ZADD', key, now, ARGV[4])
  count = count + 1
  allowed = 1
end
redis.call('PEXPIRE', key, window)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local reset = now + window
if #oldest > 0 then reset = tonumber(oldest[2]) + window end
return {allowed, math.max(0, limit - count), math.ceil(reset / 1000), count}
`
export async function checkRateLimit(identifier, { limit = 10, windowMs = 60_000 } = {}) {
  const now = Date.now()
  try {
    const [allowed, remaining, reset, count] = await redis.eval(
      SLIDING_WINDOW, [`rl:${identifier}`], [now, windowMs, limit, `${now}-${randomUUID()}`],
    )
    return { allowed: allowed === 1, remaining, reset, count }
  } catch (err) {
    console.error('[ratelimit] Redis error, failing open:', err)
    return { allowed: true, remaining: limit, reset: Math.ceil((now + windowMs) / 1000) }
  }
}
export const RATE_LIMITS = {
  anonymous: { limit: 5, windowMs: 60_000 },
  authenticated: { limit: 50, windowMs: 60_000 },
  apiKey: { limit: 100, windowMs: 60_000 },
  redirect: { limit: 200, windowMs: 60_000 },
}
