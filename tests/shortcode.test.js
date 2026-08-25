import { describe, it, expect } from 'vitest'
import { validateAlias, isValidUrl } from '../lib/shortcode'

describe('Shortcode and Alias Validation (lib/shortcode.js)', () => {
  describe('validateAlias', () => {
    it('should reject aliases shorter than 3 characters', () => {
      const res = validateAlias('ab')
      expect(res.valid).toBe(false)
      expect(res.error).toContain('at least 3 characters')
    })

    it('should reject aliases longer than 30 characters', () => {
      const res = validateAlias('a'.repeat(31))
      expect(res.valid).toBe(false)
      expect(res.error).toContain('30 characters or fewer')
    })

    it('should reject aliases with invalid characters', () => {
      const res = validateAlias('my alias!')
      expect(res.valid).toBe(false)
      expect(res.error).toContain('letters, numbers, hyphens')
    })

    it('should reject reserved system routes', () => {
      const res = validateAlias('dashboard')
      expect(res.valid).toBe(false)
      expect(res.error).toContain('reserved')
    })

    it('should accept valid custom aliases', () => {
      const res = validateAlias('promo-2026_test')
      expect(res.valid).toBe(true)
    })
  })

  describe('isValidUrl', () => {
    it('should validate http and https URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true)
      expect(isValidUrl('https://sub.domain.com/path?query=1')).toBe(true)
    })

    it('should reject non-http/https protocols like javascript: or file:', () => {
      expect(isValidUrl('javascript:alert(1)')).toBe(false)
      expect(isValidUrl('file:///C:/Windows/system32')).toBe(false)
      expect(isValidUrl('ftp://files.com')).toBe(false)
    })

    it('should reject invalid URL strings', () => {
      expect(isValidUrl('not-a-url')).toBe(false)
      expect(isValidUrl('')).toBe(false)
      expect(isValidUrl(null)).toBe(false)
    })
  })
})
