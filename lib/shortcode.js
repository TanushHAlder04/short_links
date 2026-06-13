// lib/shortcode.js
// Short code generation using nanoid.
// Uses a Bloom filter (via Redis) to quickly detect potential collisions
// before hitting the database, reducing DB roundtrips significantly.

import { customAlphabet } from 'nanoid'
import { bloomCheck, bloomAdd } from './redis'
import { prisma } from './prisma'

// URL-safe alphabet — no confusable chars (0/O, 1/l/I)
const alphabet = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'
const nanoid = customAlphabet(alphabet, 7)

/**
 * Generate a unique short code.
 * 1. Generate nanoid(7)
 * 2. Check Bloom filter — if miss → definitely unique, use it
 * 3. If Bloom hit → verify with DB (possible false positive)
 * 4. Retry up to 5 times
 *
 * @returns {Promise<string>} A unique 7-character short code
 */
export async function generateShortCode() {
  const MAX_RETRIES = 5

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = nanoid()

    // Step 1: Bloom filter check (fast, Redis-backed)
    const mightExist = await bloomCheck(code)

    if (!mightExist) {
      // Bloom says it's new — mark it and use it
      await bloomAdd(code)
      return code
    }

    // Step 2: Bloom hit — confirm with DB (handles false positives)
    // [KAFKA-READY]: In a distributed system, this DB check would be replaced
    // by a Zookeeper/Redis-based distributed lock to prevent race conditions
    // across multiple app instances.
    const existing = await prisma.url.findUnique({ where: { shortCode: code } })

    if (!existing) {
      // False positive — safe to use
      await bloomAdd(code)
      return code
    }

    // Genuine collision — retry
    console.warn(`[shortcode] Collision detected for "${code}", retrying (attempt ${attempt + 1})`)
  }

  throw new Error('Failed to generate unique short code after maximum retries')
}

/**
 * Validate a custom alias.
 * Must be 3-30 chars, alphanumeric + hyphens only.
 * @param {string} alias
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAlias(alias) {
  if (!alias || alias.length < 3) {
    return { valid: false, error: 'Alias must be at least 3 characters' }
  }
  if (alias.length > 30) {
    return { valid: false, error: 'Alias must be 30 characters or fewer' }
  }
  if (!/^[a-zA-Z0-9-_]+$/.test(alias)) {
    return { valid: false, error: 'Alias can only contain letters, numbers, hyphens, and underscores' }
  }
  // Block reserved routes
  const reserved = ['api', 'dashboard', 'shorten', 'login', 'api-docs', 'not-found', '_next', 'favicon.ico']
  if (reserved.includes(alias.toLowerCase())) {
    return { valid: false, error: 'This alias is reserved' }
  }
  return { valid: true }
}
