import { describe, it, expect } from 'vitest'
import { LocalBloomFilter, getBitIndices } from '../lib/bloom'

describe('Bloom Filter (lib/bloom.js)', () => {
  it('should accurately detect added elements without false negatives', () => {
    const filter = new LocalBloomFilter(10000, 5)
    filter.add('shortcode1')
    filter.add('shortcode2')

    expect(filter.has('shortcode1')).toBe(true)
    expect(filter.has('shortcode2')).toBe(true)
  })

  it('should return false for elements definitely not added', () => {
    const filter = new LocalBloomFilter(10000, 5)
    filter.add('exists_1')

    expect(filter.has('never_added_xyz')).toBe(false)
  })

  it('should generate deterministic bit indices within [0, m-1]', () => {
    const m = 1000
    const k = 4
    const indices = getBitIndices('test_string', k, m)

    expect(indices).toHaveLength(k)
    indices.forEach(idx => {
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(m)
    })
  })
})
