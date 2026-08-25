import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockCount = 2
let shouldThrow = false

vi.mock('../lib/redis', () => {
  return {
    redis: {
      pipeline: () => ({
        zremrangebyscore: vi.fn(),
        zcard: vi.fn(),
        zadd: vi.fn(),
        expire: vi.fn(),
        exec: vi.fn().mockImplementation(async () => {
          if (shouldThrow) {
            throw new Error('Upstash connection timeout')
          }
          return [0, mockCount]
        }),
      }),
    },
  }
})

import { checkRateLimit, RATE_LIMITS } from '../lib/ratelimit'

describe('Rate Limiter (lib/ratelimit.js)', () => {
  beforeEach(() => {
    mockCount = 2
    shouldThrow = false
  })

  it('should allow requests within limit threshold', async () => {
    mockCount = 2
    const res = await checkRateLimit('test-ip-1', { limit: 5, windowMs: 60000 })
    expect(res.allowed).toBe(true)
    expect(res.remaining).toBe(2) // 5 - 2 - 1 = 2
  })

  it('should allow request when exactly one slot remains', async () => {
    mockCount = 4
    const res = await checkRateLimit('test-ip-2', { limit: 5, windowMs: 60000 })
    expect(res.allowed).toBe(true)
    expect(res.remaining).toBe(0) // 5 - 4 - 1 = 0
  })

  it('should reject request when count reaches limit threshold exactly', async () => {
    mockCount = 5
    const res = await checkRateLimit('test-ip-3', { limit: 5, windowMs: 60000 })
    expect(res.allowed).toBe(false)
    expect(res.remaining).toBe(0)
  })

  it('should reject request when count is over limit', async () => {
    mockCount = 12
    const res = await checkRateLimit('test-ip-4', { limit: 5, windowMs: 60000 })
    expect(res.allowed).toBe(false)
    expect(res.remaining).toBe(0)
  })

  it('should fail open when Redis encounters an operational failure', async () => {
    shouldThrow = true
    const res = await checkRateLimit('test-ip-5', { limit: 10, windowMs: 60000 })
    expect(res.allowed).toBe(true)
    expect(res.remaining).toBe(10)
  })

  it('should define standard preset limits', () => {
    expect(RATE_LIMITS.anonymous.limit).toBe(5)
    expect(RATE_LIMITS.authenticated.limit).toBe(50)
    expect(RATE_LIMITS.apiKey.limit).toBe(100)
    expect(RATE_LIMITS.redirect.limit).toBe(200)
  })
})
