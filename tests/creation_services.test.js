import { describe, it, expect, vi } from 'vitest'
import { generateUniqueCode, newShortCode, alphabet } from '../lib/shortcode.js'
import { fingerprint, idempotencyIdentity } from '../lib/idempotency.js'
import { normalizeDestination } from '../lib/link-validation.js'
describe('creation primitives', () => {
  it('uses eight secure characters from the preserved alphabet', () => {
    for (let i = 0; i < 100; i++) {
      const code = newShortCode()
      expect(code).toHaveLength(8)
      expect([...code].every((c) => alphabet.includes(c))).toBe(true)
    }
  })
  it('retries only unique conflicts with a fresh code', async () => {
    const insert = vi
      .fn()
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockResolvedValue(undefined)
    const generate = vi
      .fn()
      .mockReturnValueOnce('first123')
      .mockReturnValue('second12')
    expect(
      await generateUniqueCode({ dbInsertCallback: insert, generate })
    ).toBe('second12')
    expect(insert).toHaveBeenCalledTimes(2)
  })
  it('bounds collision retries', async () => {
    const insert = vi.fn().mockRejectedValue({ code: 'P2002' })
    await expect(
      generateUniqueCode({ dbInsertCallback: insert })
    ).rejects.toMatchObject({ status: 503 })
    expect(insert).toHaveBeenCalledTimes(5)
  })
  it('propagates dependency errors without collision retries', async () => {
    const insert = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(
      generateUniqueCode({ dbInsertCallback: insert })
    ).rejects.toThrow('offline')
    expect(insert).toHaveBeenCalledTimes(1)
  })
  it('canonicalizes object keys but preserves payload distinctions', () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }))
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }))
    expect(
      idempotencyIdentity({ userId: 'u', apiKeyId: 'k' }, 'abc', {}).scope
    ).toBe('key:k')
  })
  it('normalizes safely and rejects credentials and self loops', () => {
    expect(normalizeDestination('https://EXAMPLE.com:443/a?b=2&a=1')).toBe(
      'https://example.com/a?b=2&a=1'
    )
    expect(() =>
      normalizeDestination('https://user:secret@example.com')
    ).toThrow()
    expect(() =>
      normalizeDestination(`${process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000'}/abc1234`)
    ).toThrow()
  })
})
