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
    pipeline: () => ({
      zremrangebyscore: vi.fn(),
      zcard: vi.fn(),
      zadd: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn().mockResolvedValue([0, 0]),
    }),
  },
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockqrdata'),
  },
}))

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
