import { it, expect, vi, afterEach } from 'vitest'
import {
  hashIP,
  referrerDomain,
  captureClick,
  enrichClick,
  utcDay,
  trafficColumn,
} from '../lib/analytics.js'
afterEach(() => vi.unstubAllEnvs())
it('uses HMAC only when salt exists and retains no raw IP', () => {
  vi.stubEnv('IP_HASH_SALT', '')
  expect(hashIP('1.2.3.4')).toBeNull()
  vi.stubEnv('IP_HASH_SALT', 'secret')
  expect(hashIP('1.2.3.4')).toHaveLength(64)
  const first = hashIP('1.2.3.4')
  expect(hashIP('1.2.3.4')).toBe(first)
  vi.stubEnv('IP_HASH_SALT', 'different')
  expect(hashIP('1.2.3.4')).not.toBe(first)
  expect(hashIP(null)).toBeNull()
})
it('strips paths, query, credentials and fragments from referrers', () => {
  expect(
    referrerDomain('https://user:secret@www.Example.com/private?token=x#s')
  ).toBe('example.com')
  expect(referrerDomain('garbage')).toBe('Unknown')
  expect(referrerDomain('file:///etc/passwd')).toBe('Unknown')
})
it('copies bounded privacy-safe request data and distrusts country outside Vercel', () => {
  vi.stubEnv('VERCEL', '')
  const h = new Headers({
    'user-agent': 'x'.repeat(1000),
    referer: 'https://example.org/private?secret=1',
    'x-vercel-ip-country': 'IN',
    'x-forwarded-for': '1.2.3.4',
  })
  const e = captureClick('abc1234', h)
  expect(e.country).toBe('Unknown')
  expect(e.userAgent).toHaveLength(512)
  expect(e.referrer).toBe('https://example.org')
  expect(e).not.toHaveProperty('ip')
  vi.stubEnv('VERCEL', '1')
  expect(captureClick('abc1234', h).country).toBe('IN')
})
it('validates events and derives bounded bot/device dimensions', () => {
  const e = captureClick('abc1234', new Headers({ 'user-agent': 'Googlebot' }))
  const result = enrichClick(e)
  expect(result.isBot).toBe(true)
  expect(result.browser).toBe('Unknown')
  expect(() => enrichClick({ ...e, eventId: 'bad' })).toThrow()
  expect(() => enrichClick({ ...e, unexpected: 'raw' })).toThrow()
})
it('uses UTC buckets and consistent traffic columns', () => {
  expect(utcDay('2026-09-29T01:00:00+05:30').toISOString()).toBe(
    '2026-09-28T00:00:00.000Z'
  )
  expect(['all', 'human', 'bot'].map(trafficColumn)).toEqual([
    'totalClicks',
    'humanClicks',
    'botClicks',
  ])
})
