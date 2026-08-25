// lib/shortcode.js
// Short code generation using nanoid.
// Uses a Bloom filter (via Redis) to quickly detect potential collisions
// before hitting the database, reducing DB roundtrips significantly.

import { customAlphabet } from 'nanoid'

// URL-safe alphabet — no confusable chars (0/O, 1/l/I)
const alphabet = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'
const nanoid = customAlphabet(alphabet, 7)

/**
 * Validate URL string and enforce http/https protocols.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidUrl(value) {
  if (!value || typeof value !== 'string') return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Generate a unique short code with an optimistic Bloom filter check.
 * Replaces hardcoded DB checks with modular callbacks for testing/cleanliness.
 * 
 * @param {Object} options
 * @param {import('./bloom').LocalBloomFilter} options.bloomFilter 
 * @param {Function} options.dbInsertCallback - async function(code)
 * @param {Function} options.dbCheckCallback - async function(code) returns boolean (true if exists)
 * @returns {Promise<string>}
 */
export async function generateUniqueCode({ bloomFilter, dbInsertCallback, dbCheckCallback }) {
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const candidate = nanoid();

    if (!bloomFilter.has(candidate)) {
      // 100% Unique (Result = 0)
      // Write to DB first, then add to Bloom to ensure consistency.
      await dbInsertCallback(candidate);
      bloomFilter.add(candidate);
      return candidate;
    }

    // Result = 1 (Possible Collision) — Deterministic DB Verification
    const isTaken = await dbCheckCallback(candidate);

    if (!isTaken) {
      // False Positive
      await dbInsertCallback(candidate);
      bloomFilter.add(candidate);
      return candidate;
    }

    // True Collision
    console.warn(`[shortcode] Collision detected for "${candidate}", retrying (attempt ${attempt + 1})`);
  }

  throw new Error('Failed to generate unique short code after maximum retries');
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
