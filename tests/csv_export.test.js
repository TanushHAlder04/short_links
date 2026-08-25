import { describe, it, expect } from 'vitest'

describe('CSV Formula Injection Sanitization', () => {
  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""'
    let val = String(str)
    if (/^[=+\-@\t\r]/.test(val)) {
      val = `'${val}`
    }
    const stringified = val.replace(/"/g, '""')
    return `"${stringified}"`
  }

  it('should neutralize formula prefixes (=, +, -, @, \\t, \\r)', () => {
    expect(escapeCsv('=SUM(A1:A10)')).toBe(`"'=SUM(A1:A10)"`)
    expect(escapeCsv('+cmd|"/C calc"!A0')).toBe(`"'+cmd|""/C calc""!A0"`)
    expect(escapeCsv('-1+1')).toBe(`"'-1+1"`)
    expect(escapeCsv('@SUM(1,2)')).toBe(`"'@SUM(1,2)"`)
    expect(escapeCsv('\tcmd')).toBe(`"'\tcmd"`)
  })

  it('should format normal URLs and text values without modifying safe values', () => {
    expect(escapeCsv('https://example.com')).toBe(`"https://example.com"`)
    expect(escapeCsv('promo-link_2026')).toBe(`"promo-link_2026"`)
    expect(escapeCsv('text "with quotes" inside')).toBe(`"text ""with quotes"" inside"`)
  })

  it('should handle null and undefined safely', () => {
    expect(escapeCsv(null)).toBe('""')
    expect(escapeCsv(undefined)).toBe('""')
  })
})
