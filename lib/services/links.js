import { prisma } from '../prisma.js'
import { generateUniqueCode } from '../shortcode.js'
import { validateLinkOptions } from '../link-validation.js'
import { idempotencyIdentity } from '../idempotency.js'
import { AppError } from '../errors.js'
export const publicLinkSelect = {
  id: true,
  shortCode: true,
  originalUrl: true,
  iosUrl: true,
  androidUrl: true,
  desktopUrl: true,
  customAlias: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  isActive: true,
  deletedAt: true,
  version: true,
  webhookUrl: true,
}
export function creationResult(link) {
  return {
    success: true,
    shortCode: link.shortCode,
    shortUrl: `${process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000'}/${link.shortCode}`,
    originalUrl: link.originalUrl,
    expiresAt: link.expiresAt?.toISOString() || null,
    createdAt: link.createdAt.toISOString(),
    qrUrl: `/api/qr/${link.shortCode}`,
  }
}
export async function createLink(body, identity = {}, key, db = prisma) {
  const idem = idempotencyIdentity(identity, key, body)
  const where = idem
    ? { scope_keyHash: { scope: idem.scope, keyHash: idem.keyHash } }
    : null
  const replay = async () => {
    const record = await db.creationRequest.findUnique({ where })
    if (!record || record.expiresAt <= new Date()) return null
    if (record.fingerprint !== idem.fingerprint)
      throw new AppError(
        'Idempotency-Key was used with another payload',
        409,
        'IDEMPOTENCY_CONFLICT'
      )
    return { result: record.result, replayed: true }
  }
  if (idem) {
    const found = await replay()
    if (found) return found
  }
  const data = await validateLinkOptions(body, { creation: true })
  const insert = async (shortCode) =>
    db.$transaction(async (tx) => {
      if (idem) {
        await tx.creationRequest.deleteMany({
          where: {
            scope: idem.scope,
            keyHash: idem.keyHash,
            expiresAt: { lte: new Date() },
          },
        })
        await tx.creationRequest.create({
          data: {
            ...idem,
            result: {},
            expiresAt: new Date(Date.now() + 86400000),
          },
        })
      }
      const link = await tx.url.create({
        data: {
          ...data,
          shortCode,
          userId: identity.userId || null,
          apiKeyId: identity.apiKeyId || null,
        },
      })
      const result = creationResult(link)
      if (idem) await tx.creationRequest.update({ where, data: { result } })
      return { result, link, replayed: false }
    })
  let output
  const attempt = async (code) => {
    try {
      output = await insert(code)
    } catch (error) {
      if (error.code === 'P2002' && idem) {
        const existing = await replay()
        if (existing) {
          output = existing
          return
        }
      }
      throw error
    }
  }
  if (data.customAlias) {
    try {
      await attempt(data.customAlias)
    } catch (error) {
      if (error.code === 'P2002')
        throw new AppError(
          'Custom alias is already taken',
          409,
          'ALIAS_CONFLICT'
        )
      throw error
    }
  } else await generateUniqueCode({ dbInsertCallback: attempt })
  return output
}
export async function ownedLink(shortCode, userId, db = prisma) {
  const link = await db.url.findFirst({
    where: { shortCode, userId, deletedAt: null },
    select: publicLinkSelect,
  })
  if (!link) throw new AppError('Link not found', 404)
  return link
}
