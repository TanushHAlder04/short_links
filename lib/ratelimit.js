import { logger } from './logger.js'
import { AppError } from './errors.js'
import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { redis } from './redis.js'

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
export async function checkRateLimit(
  identifier,
  { limit = 10, windowMs = 60_000 } = {}
) {
  const now = Date.now()
  try {
    const [allowed, remaining, reset, count] = await redis.eval(
      SLIDING_WINDOW,
      [`rl:${identifier}`],
      [now, windowMs, limit, `${now}-${randomUUID()}`]
    )
    return { allowed: allowed === 1, remaining, reset, count }
  } catch (err) {
    logger.error('ratelimit.dependency_failed', err)
    return {
      unavailable: true,
      allowed: true,
      remaining: limit,
      reset: Math.ceil((now + windowMs) / 1000),
    }
  }
}
const policy = (name, fallback) => ({
  limit: Math.max(1, Number(process.env[`RATE_LIMIT_${name}`]) || fallback),
  windowMs: 60000,
})
export const RATE_LIMITS = {
  anonymous: policy('ANONYMOUS', 10),
  authenticated: policy('AUTHENTICATED', 50),
  apiKey: policy('API_KEY', 100),
  import: policy('IMPORT', 3),
  dashboard: policy('DASHBOARD', 60),
  export: policy('EXPORT', 5),
  scanning: policy('SCANNING', 60),
}
export async function enforceLimit(
  request,
  identity = {},
  operation = 'create'
) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const bucket =
    operation === 'create'
      ? identity.apiKeyId
        ? 'apiKey'
        : identity.userId
          ? 'authenticated'
          : 'anonymous'
      : operation
  const config = RATE_LIMITS[bucket]
  const subject = identity.apiKeyId && operation === 'create'
    ? `key:${identity.apiKeyId}`
    : identity.userId
      ? `user:${identity.userId}`
      : `ip:${createHash('sha256').update(ip).digest('hex')}`
  const result = await checkRateLimit(`${operation}:${subject}`, config)
  if (
    result.unavailable &&
    operation !== 'scanning' &&
    (!identity.userId || identity.apiKeyId)
  )
    throw new AppError(
      'Rate-limit protection unavailable; retry shortly',
      503,
      'RATE_LIMIT_UNAVAILABLE'
    )
  const headers = {
    'X-RateLimit-Limit': String(config.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  }
  if (!result.allowed) {
    const error = new AppError('Too many requests', 429, 'RATE_LIMITED')
    error.headers = {
      ...headers,
      'Retry-After': String(
        Math.max(1, result.reset - Math.floor(Date.now() / 1000))
      ),
    }
    throw error
  }
  return headers
}
