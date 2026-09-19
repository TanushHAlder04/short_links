import { describe, it, expect, vi } from 'vitest'

// Mock dependencies for API route integration test
vi.mock('next-auth', () => ({
  default: vi.fn(() => () => Promise.resolve(new Response())),
  getServerSession: vi.fn().mockResolvedValue(null),
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    url: {
      create: vi.fn().mockResolvedValue({
        id: 'test-id-123',
        shortCode: 'valid7c',
        originalUrl: 'https://example.com',
        createdAt: new Date(),
      }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}))

vi.mock('../lib/redis', () => ({
  cacheSet: vi.fn().mockResolvedValue(true),
  incrStat: vi.fn().mockResolvedValue(1),
  redis: {
    eval: vi.fn().mockResolvedValue([1, 4, 9999999999, 1]),
  },
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockqrdata'),
  },
}))

vi.mock('../lib/apikeys', () => ({ validateApiKey: vi.fn().mockResolvedValue(null) }))
import { getServerSession } from 'next-auth'
import { validateApiKey } from '../lib/apikeys'
import { redis } from '../lib/redis'
import { prisma } from '../lib/prisma'
import { POST } from '../app/api/generate/route'

describe('POST /api/generate Integration Test', () => {
  it('should reject requests missing a URL with HTTP 400', async () => {
    const req = new Request('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.message).toContain('URL is required')
  })

  it('should reject invalid non-http/https URL schemes with HTTP 400', async () => {
    const req = new Request('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'javascript:alert(1)' }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.message).toContain('Invalid URL')
  })

  it('should generate short code and return HTTP 200 with QR code data for valid HTTP URL', async () => {
    const req = new Request('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/long-page' }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.originalUrl).toBe('https://example.com/long-page')
    expect(data.qrDataUrl).toBe('data:image/png;base64,mockqrdata')
  })
})

  it.each([{ expiresAt: 'not-a-date' }, { iosUrl: 'javascript:alert(1)' }, { webhookUrl: 'https://127.0.0.1' }, { customAlias: 23 }])('rejects invalid creation options %j', async options => {
    const res = await POST(new Request('http://localhost/api/generate', { method: 'POST', body: JSON.stringify({ url: 'https://example.com', ...options }) }))
    expect(res.status).toBe(400)
  })

it.each([
  ['anonymous', null, null, 5],
  ['session', { user: { id: 'user1' } }, null, 50],
  ['api-key', null, { id: 'key1', userId: 'user1' }, 100],
])('uses the correct %s creation tier', async (_label, session, key, limit) => {
  getServerSession.mockResolvedValueOnce(session)
  if (key) validateApiKey.mockResolvedValueOnce(key)
  const res = await POST(new Request('http://localhost/api/generate', {
    method: 'POST', headers: key ? { Authorization: 'Bearer sl_test' } : {},
    body: JSON.stringify({ url: 'https://example.com' }),
  }))
  expect(res.status).toBe(200)
  expect(res.headers.get('X-RateLimit-Limit')).toBe(String(limit))
  expect(redis.eval.mock.lastCall[2][2]).toBe(limit)
})
it('does not silently create an anonymous link for an invalid API key', async () => {
  const res = await POST(new Request('http://localhost/api/generate', {
    method: 'POST', headers: { Authorization: 'Bearer wrong' }, body: JSON.stringify({ url: 'https://example.com' }),
  }))
  expect(res.status).toBe(401)
})
it('returns 409 if a custom alias is claimed between lookup and insertion', async () => {
  prisma.url.create.mockRejectedValueOnce({ code: 'P2002' })
  const res = await POST(new Request('http://localhost/api/generate', {
    method: 'POST', body: JSON.stringify({ url: 'https://example.com', customAlias: 'promo' }),
  }))
  expect(res.status).toBe(409)
})
