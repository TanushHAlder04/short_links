import { prisma } from '../prisma.js'
import { cacheGet, cacheSet, cacheSelect } from '../redis.js'
import { logger } from '../logger.js'
export function resolveTargetUrl(link, ua = '') {
  if (/iphone|ipad|ipod/i.test(ua)) return link.iosUrl || link.originalUrl
  if (/android/i.test(ua)) return link.androidUrl || link.originalUrl
  if (/windows nt|macintosh|x11/i.test(ua))
    return link.desktopUrl || link.originalUrl
  return link.originalUrl
}
export async function resolveRedirect(
  code,
  ua = '',
  { db = prisma, get = cacheGet, set = cacheSet, now = Date.now() } = {}
) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,29}$/.test(code)) return { status: 404 }
  const startedAt = Date.now()
  let link = await get(code)
  if (link?.missing) return { status: 404 }
  if (!link) {
    logger.info('redirect.database_fallback', { shortCode: code })
    try {
      link = await db.url.findUnique({
        where: { shortCode: code },
        select: cacheSelect,
      })
    } catch (error) {
      logger.error('redirect.database_failed', error, { shortCode: code })
      return { status: 503 }
    }
    await set(code, link, startedAt)
  }
  if (!link) return { status: 404 }
  if (
    !link.isActive ||
    link.deletedAt ||
    (link.expiresAt && new Date(link.expiresAt).getTime() <= now)
  )
    return { status: 410 }
  return { status: 302, location: resolveTargetUrl(link, ua) }
}
