import { it, expect, vi } from 'vitest'
import { generateUniqueCode } from '../lib/shortcode.js'
it('does not precheck uniqueness before INSERT', async () => {
  const insert = vi
    .fn()
    .mockRejectedValueOnce({ code: 'P2002' })
    .mockResolvedValue({})
  const generate = vi
    .fn()
    .mockReturnValueOnce('taken123')
    .mockReturnValue('fresh123')
  expect(await generateUniqueCode({ dbInsertCallback: insert, generate })).toBe(
    'fresh123'
  )
  expect(insert.mock.calls.map((r) => r[0])).toEqual(['taken123', 'fresh123'])
})
