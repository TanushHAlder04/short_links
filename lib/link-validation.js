import { isValidUrl, validateAlias } from './shortcode.js'
import { resolveWebhook } from './webhooks.js'
import { AppError } from './errors.js'
export class ValidationError extends AppError {}
export function normalizeDestination(value, shortCode) {
  if (!isValidUrl(value))
    throw new ValidationError(
      'Destination must be HTTP/HTTPS without embedded credentials'
    )
  const u = new URL(value.trim())
  const base = process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000'
  if (
    u.origin === new URL(base).origin &&
    (/^\/[a-zA-Z0-9_-]+\/?$/.test(u.pathname) || u.pathname === `/${shortCode}`)
  ) {
    throw new ValidationError('Do not shorten a short link on this service')
  }
  return u.href // URL canonicalization preserves query order and fragments.
}
export async function validateLinkOptions(
  body,
  { creation = false, shortCode } = {}
) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ValidationError('Expected a JSON object')
  const data = {}
  if (creation || body.url !== undefined)
    data.originalUrl = normalizeDestination(body.url, shortCode)
  if (data.originalUrl) data.normalizedUrl = data.originalUrl
  for (const field of ['iosUrl', 'androidUrl', 'desktopUrl']) {
    if (body[field] !== undefined)
      data[field] =
        body[field] === null || body[field] === ''
          ? null
          : normalizeDestination(body[field], shortCode)
  }
  if (body.webhookUrl !== undefined) {
    if (body.webhookUrl === null || body.webhookUrl === '')
      data.webhookUrl = null
    else {
      if (typeof body.webhookUrl !== 'string' || body.webhookUrl.length > 2048)
        throw new ValidationError('Invalid webhook URL')
      try {
        const { url } = await resolveWebhook(body.webhookUrl)
        data.webhookUrl = url.href
      } catch {
        throw new ValidationError(
          'Webhook must resolve to public HTTPS on port 443'
        )
      }
    }
  }
  if (body.webhookSecret !== undefined) {
    if (
      typeof body.webhookSecret !== 'string' ||
      body.webhookSecret.length < 16 ||
      body.webhookSecret.length > 256
    )
      throw new ValidationError(
        'Webhook signing secret must be 16-256 characters'
      )
    data.webhookSecret = body.webhookSecret
  }
  // Caller retains the secret; it is never echoed in responses.
  if (data.webhookUrl && !data.webhookSecret)
    throw new ValidationError(
      'Supply a 16-256 character signing secret when setting a webhook URL'
    )
  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null || body.expiresAt === '') data.expiresAt = null
    else {
      const date = new Date(body.expiresAt)
      if (
        typeof body.expiresAt !== 'string' ||
        !Number.isFinite(date.getTime()) ||
        date <= new Date()
      )
        throw new ValidationError('Expiry must be a valid future datetime')
      data.expiresAt = date
    }
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean')
      throw new ValidationError('isActive must be a boolean')
    data.isActive = body.isActive
  }
  if (
    creation &&
    body.customAlias !== undefined &&
    body.customAlias !== null &&
    body.customAlias !== ''
  ) {
    const result = validateAlias(body.customAlias)
    if (!result.valid) throw new ValidationError(result.error)
    data.customAlias = body.customAlias
  }
  return data
}
