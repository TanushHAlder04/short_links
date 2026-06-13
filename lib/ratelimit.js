// lib/ratelimit.js
// Sliding window rate limiter backed by Upstash Redis.
// Uses a sorted set per identifier (IP or userId) where each member
// is a timestamp of a request. Old entries are pruned each call.
//
// [INTERVIEW TALKING POINT]: This is the standard sliding-window counter algorithm.
// Alternative: Token bucket or fixed window counter (simpler but less accurate).

import { redis } from './redis'

/**
 * Check rate limit for an identifier (IP or userId).
 *
 * @param {string} identifier - IP address or user ID
 * @param {object} options
 * @param {number} options.limit - Max requests allowed in the window
 * @param {number} options.windowMs - Time window in milliseconds
 * @returns {Promise<{ allowed: boolean, remaining: number, reset: number }>}
 */
export async function checkRateLimit(identifier, { limit = 10, windowMs = 60_000 } = {}) {
  const key = `rl:${identifier}`
  const now = Date.now()
  const windowStart = now - windowMs

  try {
    // Use Redis pipeline for atomic operations
    const pipeline = redis.pipeline()

    // Remove entries older than the window
    pipeline.zremrangebyscore(key, '-inf', windowStart)

    // Count current requests in window
    pipeline.zcard(key)

    // Add current request timestamp
    pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` })

    // Set key expiry to window size (cleanup)
    pipeline.expire(key, Math.ceil(windowMs / 1000))

    const results = await pipeline.exec()
    const count = results[1] // count after removing old entries

    const allowed = count < limit
    const remaining = Math.max(0, limit - count - (allowed ? 1 : 0))
    const reset = Math.ceil((windowStart + windowMs) / 1000)

    return { allowed, remaining, reset, count: count + 1 }
  } catch (err) {
    // If Redis is down, fail open (don't block requests)
    console.error('[ratelimit] Redis error, failing open:', err)
    return { allowed: true, remaining: limit, reset: Math.ceil((now + windowMs) / 1000) }
  }
}

/**
 * Preset rate limit configurations.
 */
export const RATE_LIMITS = {
  anonymous: { limit: 5, windowMs: 60_000 },     // 5 req/min for anonymous
  authenticated: { limit: 50, windowMs: 60_000 }, // 50 req/min for logged-in
  apiKey: { limit: 100, windowMs: 60_000 },        // 100 req/min for API keys
  redirect: { limit: 200, windowMs: 60_000 },      // 200 req/min for redirects
}
