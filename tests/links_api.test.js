import { it, expect, vi } from 'vitest'
import { validateLinkOptions } from '../lib/link-validation.js'
import { checkSessionOrigin, readJson } from '../lib/request.js'
it.each([
  { iosUrl: 'javascript:alert(1)' },
  { androidUrl: 123 },
  { desktopUrl: 'https://user:pass@example.com' },
  { webhookUrl: 'http://127.0.0.1' },
  { webhookUrl: 'https://127.0.0.1' },
  { expiresAt: 'invalid' },
  { expiresAt: '2020-01-01' },
  { isActive: 'false' },
  null,
])('rejects unsafe editable input %j', async (body) => {
  await expect(validateLinkOptions(body)).rejects.toThrow()
})
it('permits clearing optional destinations and expiry', async () => {
  expect(
    await validateLinkOptions({
      iosUrl: null,
      androidUrl: '',
      expiresAt: null,
      isActive: false,
    })
  ).toEqual({
    iosUrl: null,
    androidUrl: null,
    expiresAt: null,
    isActive: false,
  })
})
it('checks session mutation origin while permitting bearer API clients', () => {
  vi.stubEnv('NEXTAUTH_URL', 'https://short.test')
  const req = new Request('https://short.test/api/links/abc', {
    method: 'PATCH',
    headers: { origin: 'https://evil.test' },
  })
  expect(() => checkSessionOrigin(req, { type: 'session' })).toThrow('Origin')
  expect(() => checkSessionOrigin(req, { type: 'apiKey' })).not.toThrow()
  vi.unstubAllEnvs()
})
it('rejects malformed JSON', async () => {
  await expect(
    readJson(new Request('https://test', { method: 'POST', body: '{' }))
  ).rejects.toMatchObject({ status: 400 })
})
