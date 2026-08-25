// lib/csv.js
// CSV escaping and sanitization utilities.

/**
 * Escapes a cell value for CSV output and neutralizes formula injection (DDE attacks).
 * Prepends a single quote if the value begins with =, +, -, @, \t, or \r.
 *
 * @param {*} value
 * @returns {string} Escaped and sanitized double-quoted CSV field
 */
export function escapeCsv(value) {
  if (value === null || value === undefined) return '""'
  let val = String(value)
  // Neutralize formula injection characters (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(val)) {
    val = `'${val}`
  }
  const stringified = val.replace(/"/g, '""')
  return `"${stringified}"`
}
