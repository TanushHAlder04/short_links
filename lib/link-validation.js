import { isValidUrl } from './shortcode'
import { resolveWebhook } from './webhooks'

export class ValidationError extends Error {}

export async function validateLinkOptions(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Expected a JSON object')
  const updates = {}
  for (const field of ['iosUrl', 'androidUrl', 'webhookUrl', 'webhookSecret']) {
    if (body[field] === undefined) continue
    if (body[field] !== null && typeof body[field] !== 'string') throw new ValidationError(`${field} must be a string or null`)
    const value = body[field]?.trim() || null
    if (value && field !== 'webhookSecret' && !isValidUrl(value)) throw new ValidationError(`${field} must be a valid HTTP/HTTPS URL`)
    updates[field] = value
  }
  if (updates.webhookUrl) {
    try { await resolveWebhook(updates.webhookUrl) }
    catch { throw new ValidationError('Webhook must be a DNS-resolvable public HTTPS destination on port 443 without credentials') }
  }
  if (body.expiresAt !== undefined) {
    const value = body.expiresAt
    if (value === null || value === '') updates.expiresAt = null
    else {
      if (typeof value !== 'string') throw new ValidationError('Expiry must be a date string or null')
      const date = new Date(value)
      if (!Number.isFinite(date.getTime()) || date <= new Date()) throw new ValidationError('Expiry date must be valid and in the future')
      updates.expiresAt = date
    }
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') throw new ValidationError('isActive must be a boolean')
    updates.isActive = body.isActive
  }
  return updates
}
