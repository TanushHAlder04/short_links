import { describe, it, expect, vi } from 'vitest'
import {
  positiveTTL,
  serializeLink,
  cacheGet,
  cacheSet,
  cacheDel,
  FILL,
  INVALIDATE,
} from '../lib/redis.js'
import { resolveRedirect, resolveTargetUrl } from '../lib/services/redirects.js'
const link = {
  originalUrl: 'https://example.com',
  isActive: true,
  version: 1,
  expiresAt: null,
}
function fakeRedis() {
  const values = new Map(),
    floors = new Map()
  return {
    values,
    async get(key) {
      return values.get(key) || null
    },
    async eval(script, keys, args) {
      if (script === INVALIDATE) {
        floors.set(keys[1], Math.max(floors.get(keys[1]) || 0, args[0]))
        values.delete(keys[0])
        return 1
      }
      if (script !== FILL) throw Error('unexpected script')
      if (args[0] < (floors.get(keys[1]) || 0)) return 0
      if (args[0] > 0) floors.set(keys[1], args[0])
      values.set(keys[0], JSON.parse(args[1]))
      return 1
    },
  }
}
describe('Redis boundary and production redirect resolver', () => {
  it('bounds jitter, lifetime, and subsecond expiry', () => {
    expect(positiveTTL(link, 0, 0)).toBe(86400)
    expect(positiveTTL(link, 0, 1)).toBe(82080)
    expect(positiveTTL({ ...link, expiresAt: new Date(50500) }, 50000, 0)).toBe(
      0
    )
    expect(positiveTTL({ ...link, expiresAt: new Date(60000) }, 0, 0)).toBe(60)
  })
  it('serializes only redirect fields', () => {
    const output = serializeLink({
      ...link,
      userId: 'secret',
      webhookSecret: 'secret',
      clickCount: 99,
    })
    expect(output).not.toHaveProperty('userId')
    expect(output).not.toHaveProperty('webhookSecret')
    expect(output).not.toHaveProperty('clickCount')
  })
  it('rejects stale positive and negative fill after invalidation', async () => {
    const r = fakeRedis()
    await cacheSet('oldcode', link, Date.now(), r)
    await cacheDel('oldcode', 2, r)
    expect(await cacheSet('oldcode', link, Date.now(), r)).toBe(false)
    expect(await cacheSet('oldcode', null, Date.now(), r)).toBe(false)
    expect(await cacheGet('oldcode', r)).toBeNull()
    await cacheSet('oldcode', { ...link, version: 2 }, Date.now(), r)
    expect((await cacheGet('oldcode', r)).version).toBe(2)
  })
  it('does not fill after a long stalled request', async () => {
    const r = fakeRedis()
    expect(await cacheSet('oldcode', link, Date.now() - 11000, r)).toBe(false)
  })
  it('positive cache hit works without database or TTL refresh', async () => {
    const db = { url: { findUnique: vi.fn() } },
      set = vi.fn()
    expect(
      await resolveRedirect('abc1234', '', { db, get: async () => link, set })
    ).toEqual({ status: 302, location: link.originalUrl })
    expect(db.url.findUnique).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })
  it('negative hit avoids DB; a miss caches only confirmed absence', async () => {
    const db = { url: { findUnique: vi.fn().mockResolvedValue(null) } },
      set = vi.fn()
    expect(
      (
        await resolveRedirect('abc1234', '', {
          db,
          get: async () => ({ missing: true }),
          set,
        })
      ).status
    ).toBe(404)
    expect(db.url.findUnique).not.toHaveBeenCalled()
    await resolveRedirect('abc1234', '', { db, get: async () => null, set })
    expect(set).toHaveBeenCalledWith('abc1234', null, expect.any(Number))
  })
  it('returns 503 without negative caching database outages', async () => {
    const set = vi.fn()
    expect(
      (
        await resolveRedirect('abc1234', '', {
          db: {
            url: { findUnique: vi.fn().mockRejectedValue(Error('offline')) },
          },
          get: async () => null,
          set,
        })
      ).status
    ).toBe(503)
    expect(set).not.toHaveBeenCalled()
  })
  it.each([
    { isActive: false },
    { deletedAt: new Date() },
    { expiresAt: new Date(1000) },
  ])('locally rejects unavailable cache entries %j', async (patch) => {
    expect(
      (
        await resolveRedirect('abc1234', '', {
          get: async () => ({ ...link, ...patch }),
          now: 1000,
        })
      ).status
    ).toBe(410)
  })
  it('preserves seven-character and custom codes; selects devices safely', () => {
    const l = {
      ...link,
      iosUrl: 'https://ios.test',
      androidUrl: 'https://android.test',
      desktopUrl: 'https://desktop.test',
    }
    expect(resolveTargetUrl(l, 'iPhone')).toBe(l.iosUrl)
    expect(resolveTargetUrl(l, 'Android')).toBe(l.androidUrl)
    expect(resolveTargetUrl(l, 'Windows NT')).toBe(l.desktopUrl)
    expect(resolveTargetUrl(l, '')).toBe(l.originalUrl)
  })
  it('tolerates reads/warming failing but surfaces invalidation failure', async () => {
    const r = {
      get: vi.fn().mockRejectedValue(Error()),
      eval: vi.fn().mockRejectedValue(Error()),
    }
    expect(await cacheGet('code', r)).toBeNull()
    expect(await cacheSet('code', link, Date.now(), r)).toBe(false)
    await expect(cacheDel('code', 2, r)).rejects.toThrow()
  })
})
