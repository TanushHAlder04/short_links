import { Redis } from '@upstash/redis'
import { logger } from './logger.js'
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
        retry: { retries: 0 },
        signal: () => AbortSignal.timeout(1500),
      })
    : null
export const cacheKeys = (code) => [
  `link:v2:${code}`,
  `link-version:v2:${code}`,
]
export const cacheSelect = {
  originalUrl: true,
  iosUrl: true,
  androidUrl: true,
  desktopUrl: true,
  isActive: true,
  deletedAt: true,
  expiresAt: true,
  version: true,
}
export function serializeLink(link) {
  return Object.fromEntries(
    Object.keys(cacheSelect).map((k) => [
      k,
      link[k] instanceof Date ? link[k].toISOString() : (link[k] ?? null),
    ])
  )
}
export function positiveTTL(link, now = Date.now(), random = Math.random()) {
  const ttl = Math.floor(86400 * (1 - 0.05 * random))
  return link.expiresAt
    ? Math.max(
        0,
        Math.min(
          ttl,
          Math.floor((new Date(link.expiresAt).getTime() - now) / 1000)
        )
      )
    : ttl
}
// The version floor outlives every cache entry and every permitted in-flight fill.
export const FILL = `
local floor = tonumber(redis.call('GET', KEYS[2]) or '0')
local version = tonumber(ARGV[1])
if version < floor then return 0 end
if version > 0 then redis.call('SET', KEYS[2], version, 'EX', 90000) end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1`
export const INVALIDATE = `
local floor = tonumber(redis.call('GET', KEYS[2]) or '0')
redis.call('SET', KEYS[2], math.max(floor, tonumber(ARGV[1])), 'EX', 90000)
redis.call('DEL', KEYS[1])
return 1`
export async function cacheGet(code, client = redis) {
  try {
    const value = await client.get(cacheKeys(code)[0])
    logger.info(value ? 'cache.hit' : 'cache.miss', { shortCode: code })
    return value
  } catch (error) {
    logger.error('cache.read_failed', error, { shortCode: code })
    return null
  }
}
export async function cacheSet(
  code,
  link,
  startedAt = Date.now(),
  client = redis
) {
  if (Date.now() - startedAt > 10000) return false
  const ttl = link ? positiveTTL(link) : 45
  if (ttl < 1) return false
  try {
    return Boolean(
      await client.eval(FILL, cacheKeys(code), [
        link?.version || 0,
        JSON.stringify(link ? serializeLink(link) : { missing: true }),
        ttl,
      ])
    )
  } catch (error) {
    logger.error('cache.fill_failed', error, { shortCode: code })
    return false
  }
}
// Throw on invalidation failure so callers can schedule a durable retry.
export async function cacheDel(code, version, client = redis) {
  await client.eval(INVALIDATE, cacheKeys(code), [version])
}
