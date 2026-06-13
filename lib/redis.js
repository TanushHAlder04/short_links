// lib/redis.js
// Upstash Redis client — REST-based, works in serverless/Edge environments.
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local

import { Redis } from '@upstash/redis'

const globalForRedis = globalThis

export const redis =
  globalForRedis.redis ??
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// ─── Cache Helpers ────────────────────────────────────────────────────────────

const CACHE_TTL = 3600 // 1 hour in seconds
const CACHE_PREFIX = 'url:'

/**
 * Get a cached URL by short code.
 * @param {string} shortCode
 * @returns {Promise<{originalUrl: string, isActive: boolean, expiresAt: string|null}|null>}
 */
export async function cacheGet(shortCode) {
  try {
    const data = await redis.get(`${CACHE_PREFIX}${shortCode}`)
    return data
  } catch (err) {
    console.error('[Redis] cacheGet error:', err)
    return null
  }
}

/**
 * Cache a URL entry by short code.
 * @param {string} shortCode
 * @param {{ originalUrl: string, isActive: boolean, expiresAt: string|null }} data
 * @param {number} ttl - TTL in seconds (default 1 hour)
 */
export async function cacheSet(shortCode, data, ttl = CACHE_TTL) {
  try {
    await redis.set(`${CACHE_PREFIX}${shortCode}`, data, { ex: ttl })
  } catch (err) {
    console.error('[Redis] cacheSet error:', err)
  }
}

/**
 * Invalidate a cached URL.
 * @param {string} shortCode
 */
export async function cacheDel(shortCode) {
  try {
    await redis.del(`${CACHE_PREFIX}${shortCode}`)
  } catch (err) {
    console.error('[Redis] cacheDel error:', err)
  }
}

// ─── Bloom Filter (Collision Avoidance) ──────────────────────────────────────
// Uses a Redis bit array to quickly check if a short code *might* exist.
// False positives are possible (we do a DB check to confirm), but false
// negatives are not — avoids unnecessary DB roundtrips on new code generation.

const BLOOM_KEY = 'bloom:shortcodes'

/**
 * Mark a short code as "possibly exists" in the Bloom filter.
 * @param {string} shortCode
 */
export async function bloomAdd(shortCode) {
  try {
    const pos = simpleHash(shortCode, 1_000_000)
    await redis.setbit(BLOOM_KEY, pos, 1)
  } catch (err) {
    console.error('[Redis] bloomAdd error:', err)
  }
}

/**
 * Check if a short code might exist.
 * @param {string} shortCode
 * @returns {Promise<boolean>} true = might exist, false = definitely doesn't exist
 */
export async function bloomCheck(shortCode) {
  try {
    const pos = simpleHash(shortCode, 1_000_000)
    const bit = await redis.getbit(BLOOM_KEY, pos)
    return bit === 1
  } catch (err) {
    console.error('[Redis] bloomCheck error:', err)
    return false // fail open — let DB handle it
  }
}

function simpleHash(str, max) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % max
  }
  return Math.abs(hash)
}

// ─── Global Stats Counter ─────────────────────────────────────────────────────

export async function incrStat(key) {
  try {
    return await redis.incr(`stats:${key}`)
  } catch (err) {
    console.error('[Redis] incrStat error:', err)
    return 0
  }
}

export async function getStat(key) {
  try {
    const val = await redis.get(`stats:${key}`)
    return val ? parseInt(val) : 0
  } catch (err) {
    console.error('[Redis] getStat error:', err)
    return 0
  }
}
