import { it, expect, vi } from 'vitest'
vi.mock('nanoid', () => ({ customAlphabet: () => vi.fn().mockReturnValueOnce('taken01').mockReturnValueOnce('fresh02').mockReturnValue('other03') }))
import { generateUniqueCode } from '../lib/shortcode'
it('retries a DB collision even when the local Bloom filter is empty', async () => {
  const insert = vi.fn().mockRejectedValueOnce({ code: 'P2002' }).mockResolvedValueOnce({})
  const bloom = { has: () => false, add: vi.fn() }
  expect(await generateUniqueCode({ bloomFilter: bloom, dbInsertCallback: insert, dbCheckCallback: vi.fn() })).toBe('fresh02')
  expect(insert).toHaveBeenCalledTimes(2)
})
it('does not retry unrelated DB failures', async () => {
  const insert = vi.fn().mockRejectedValue(new Error('database unavailable'))
  await expect(generateUniqueCode({ bloomFilter: { has: () => false }, dbInsertCallback: insert })).rejects.toThrow('database unavailable')
  expect(insert).toHaveBeenCalledTimes(1)
})
