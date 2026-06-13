// lib/apikeys.js
// API Key generation, hashing, and validation.
// Keys are never stored in plaintext — only SHA-256 hashes are persisted.
// The plaintext key is returned once at creation and never retrievable again.

import { createHash, randomBytes } from 'crypto'
import { prisma } from './prisma'

/**
 * Generate a new API key string.
 * Format: "sl_" prefix + 32 random hex bytes = "sl_" + 64 chars
 * @returns {string} plaintext API key
 */
export function generateApiKey() {
  const random = randomBytes(32).toString('hex')
  return `sl_${random}`
}

/**
 * Hash an API key for storage.
 * @param {string} key plaintext API key
 * @returns {string} SHA-256 hex hash
 */
export function hashApiKey(key) {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Create and store a new API key for a user.
 * Returns the plaintext key — this is the ONLY time it's available.
 *
 * @param {string} userId
 * @param {string} name - Human-readable label for the key
 * @returns {Promise<{ key: string, keyId: string, name: string }>}
 */
export async function createApiKey(userId, name) {
  const key = generateApiKey()
  const keyHash = hashApiKey(key)

  const apiKey = await prisma.apiKey.create({
    data: { userId, keyHash, name },
  })

  return { key, keyId: apiKey.id, name: apiKey.name }
}

/**
 * Validate an incoming API key from an Authorization header.
 * Returns the ApiKey record (with user) if valid, null if invalid.
 *
 * @param {string} authHeader - Value of the Authorization header (e.g. "Bearer sl_abc...")
 * @returns {Promise<{id: string, userId: string, name: string}|null>}
 */
export async function validateApiKey(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const key = authHeader.replace('Bearer ', '').trim()
  if (!key.startsWith('sl_')) return null

  const keyHash = hashApiKey(key)

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash, isActive: true },
    })

    if (!apiKey) return null

    // Update last used timestamp (non-blocking)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    }).catch(() => {})

    return apiKey
  } catch {
    return null
  }
}

/**
 * Get the authenticated user from a request — from session OR API key.
 * @param {import('next').NextRequest} request
 * @param {object|null} session - NextAuth session from getServerSession()
 * @returns {Promise<string|null>} userId or null
 */
export async function getAuthUserId(request, session) {
  if (session?.user?.id) return session.user.id

  const authHeader = request.headers.get('Authorization')
  const apiKey = await validateApiKey(authHeader)
  return apiKey?.userId || null
}
