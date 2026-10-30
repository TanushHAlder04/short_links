import { it, expect, vi, beforeEach } from 'vitest'
vi.mock('../lib/identity.js', () => ({ identityFor: vi.fn() }))
vi.mock('../lib/ratelimit.js', () => ({ enforceLimit: vi.fn() }))
vi.mock('../lib/services/links.js', () => ({ createLink: vi.fn() }))
vi.mock('../lib/redis.js', () => ({ cacheSet: vi.fn() }))
import { POST } from '../app/api/generate/route.js'
import { identityFor } from '../lib/identity.js'
import { createLink } from '../lib/services/links.js'
import { cacheSet } from '../lib/redis.js'
import { AppError } from '../lib/errors.js'
beforeEach(() => {
  vi.resetAllMocks()
  identityFor.mockResolvedValue({ userId: 'owner' })
})
const request = (body, key = 'request-1') =>
  new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body),
  })
it('forwards idempotency identity and warms only committed new links', async () => {
  const link = { shortCode: 'abc12345' },
    result = {
      success: true,
      shortCode: link.shortCode,
      qrUrl: '/api/qr/abc12345',
    }
  createLink.mockResolvedValue({ link, result, replayed: false })
  const response = await POST(request({ url: 'https://example.com' }))
  expect(response.status).toBe(200)
  expect(createLink).toHaveBeenCalledWith(
    { url: 'https://example.com' },
    { userId: 'owner' },
    'request-1'
  )
  expect(cacheSet).toHaveBeenCalledWith(link.shortCode, link)
  expect(await response.json()).not.toHaveProperty('qrDataUrl')
})
it('does not rewarm an old idempotency result', async () => {
  createLink.mockResolvedValue({ result: { success: true }, replayed: true })
  expect((await POST(request({}))).headers.get('Idempotency-Replayed')).toBe(
    'true'
  )
  expect(cacheSet).not.toHaveBeenCalled()
})
it.each([400, 409, 503])('preserves controlled status %s', async (status) => {
  createLink.mockRejectedValue(new AppError('reason', status))
  expect((await POST(request({}))).status).toBe(status)
})
it('bounds request bytes', async () => {
  expect((await POST(request({ url: 'x'.repeat(40000) }))).status).toBe(413)
  expect(createLink).not.toHaveBeenCalled()
})
