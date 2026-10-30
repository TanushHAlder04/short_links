import { customAlphabet } from 'nanoid'
import { AppError } from './errors.js'
import { logger } from './logger.js'
export const alphabet = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'
export const newShortCode = customAlphabet(alphabet, 8)
export async function generateUniqueCode({
  dbInsertCallback,
  generate = newShortCode,
}) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const candidate = generate()
    try {
      await dbInsertCallback(candidate)
      return candidate
    } catch (error) {
      if (error.code !== 'P2002') throw error
      logger.warn('shortcode.collision', { attempt })
    }
  }
  throw new AppError(
    'Could not allocate a code; please retry',
    503,
    'CODE_EXHAUSTED'
  )
}
export function isValidUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 4096) return false
  try {
    const u = new URL(value)
    return (
      ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password
    )
  } catch {
    return false
  }
}
export function validateAlias(alias) {
  if (typeof alias !== 'string' || alias.length < 3)
    return { valid: false, error: 'Alias must be at least 3 characters' }
  if (alias.length > 30)
    return { valid: false, error: 'Alias must be 30 characters or fewer' }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(alias))
    return {
      valid: false,
      error:
        'Alias can only contain letters, numbers, hyphens, and underscores; start with a letter or number',
    }
  const reserved = [
    'api',
    'dashboard',
    'shorten',
    'login',
    'api-docs',
    'not-found',
    'link-unavailable',
    'favicon',
    'robots',
    'sitemap',
  ]
  if (reserved.includes(alias.toLowerCase()))
    return { valid: false, error: 'This alias is reserved' }
  return { valid: true } // Case-sensitive, including existing aliases. Reserved names ignore case.
}
