import { createHash } from 'node:crypto'
import { AppError } from './errors.js'
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    )
  return value
}
export function fingerprint(body) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(body)))
    .digest('hex')
}
export function idempotencyIdentity(identity, key, body) {
  if (!key) return null
  if (!identity?.userId)
    throw new AppError('Idempotency requires authentication', 401)
  if (key.length > 128 || !/^[\x21-\x7e]+$/.test(key))
    throw new AppError('Invalid Idempotency-Key')
  return {
    scope: identity.apiKeyId
      ? `key:${identity.apiKeyId}`
      : `user:${identity.userId}`,
    keyHash: fingerprint(key),
    fingerprint: fingerprint(body),
  }
}
