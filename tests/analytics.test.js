import { describe, it, expect } from 'vitest'
import { hashIP } from '../lib/analytics'

describe('Analytics IP Hashing (lib/analytics.js)', () => {
  it('should return null for empty IP', () => {
    expect(hashIP(null)).toBeNull()
    expect(hashIP(undefined)).toBeNull()
    expect(hashIP('')).toBeNull()
  })

  it('should produce consistent, non-null 16-character SHA-256 hash for identical IPs', () => {
    const ip = '192.168.1.1'
    const hash1 = hashIP(ip)
    const hash2 = hashIP(ip)

    expect(hash1).toHaveLength(16)
    expect(hash1).toBe(hash2)
  })

  it('should evaluate salt correctly without literal undefined bug when IP_HASH_SALT is unset', () => {
    const oldSalt = process.env.IP_HASH_SALT
    delete process.env.IP_HASH_SALT

    const hashWithoutEnv = hashIP('127.0.0.1')

    process.env.IP_HASH_SALT = 'custom-salt-123'
    const hashWithEnv = hashIP('127.0.0.1')

    expect(hashWithoutEnv).toHaveLength(16)
    expect(hashWithEnv).toHaveLength(16)
    expect(hashWithoutEnv).not.toBe(hashWithEnv)

    if (oldSalt) process.env.IP_HASH_SALT = oldSalt
    else delete process.env.IP_HASH_SALT
  })
})
