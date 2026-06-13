// app/api/generate/route.js
// Creates a new shortened URL.
// Supports: auto-generated short codes, custom aliases, expiry dates, API key auth.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { generateShortCode, validateAlias } from '@/lib/shortcode'
import { bloomAdd, cacheSet, incrStat } from '@/lib/redis'
import { validateApiKey } from '@/lib/apikeys'
import { checkRateLimit, RATE_LIMITS } from '@/lib/ratelimit'
import QRCode from 'qrcode'

export async function POST(request) {
  try {
    const body = await request.json()
    const { url, customAlias, expiresAt } = body

    // ── Validate URL ────────────────────────────────────────────────────────
    if (!url || typeof url !== 'string') {
      return Response.json({ success: false, message: 'URL is required' }, { status: 400 })
    }

    try {
      new URL(url) // throws if invalid
    } catch {
      return Response.json({ success: false, message: 'Invalid URL format' }, { status: 400 })
    }

    // ── Resolve user identity (session or API key) ─────────────────────────
    const session = await getServerSession(authOptions)
    let userId = session?.user?.id || null
    let apiKeyId = null

    if (!userId) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader) {
        const apiKey = await validateApiKey(authHeader)
        if (apiKey) {
          userId = apiKey.userId
          apiKeyId = apiKey.id
        }
      }
    }

    // ── Rate Limiting ──────────────────────────────────────────────────────
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const identifier = userId
      ? apiKeyId
        ? `apikey:${userId}`   // API key requests
        : `user:${userId}`     // Authenticated session
      : `ip:${ip}`             // Anonymous by IP
    const limitConfig = apiKeyId
      ? RATE_LIMITS.apiKey
      : userId
        ? RATE_LIMITS.authenticated
        : RATE_LIMITS.anonymous
    const { allowed, remaining, reset } = await checkRateLimit(identifier, limitConfig)
    if (!allowed) {
      return Response.json(
        { success: false, message: 'Too many requests. Please slow down.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limitConfig.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(reset),
            'Retry-After': String(Math.ceil(limitConfig.windowMs / 1000)),
          },
        }
      )
    }

    // ── Determine short code ───────────────────────────────────────────────
    let shortCode

    if (customAlias) {
      const validation = validateAlias(customAlias)
      if (!validation.valid) {
        return Response.json({ success: false, message: validation.error }, { status: 400 })
      }

      // Check alias availability
      const existing = await prisma.url.findUnique({ where: { shortCode: customAlias } })
      if (existing) {
        return Response.json({ success: false, message: 'This custom alias is already taken' }, { status: 409 })
      }

      shortCode = customAlias
      await bloomAdd(shortCode)
    } else {
      // Auto-generate unique short code with Bloom filter
      shortCode = await generateShortCode()
    }

    // ── Validate expiry ────────────────────────────────────────────────────
    let expiryDate = null
    if (expiresAt) {
      expiryDate = new Date(expiresAt)
      if (expiryDate <= new Date()) {
        return Response.json({ success: false, message: 'Expiry date must be in the future' }, { status: 400 })
      }
    }

    // ── Save to PostgreSQL ─────────────────────────────────────────────────
    const urlRecord = await prisma.url.create({
      data: {
        shortCode,
        originalUrl: url,
        customAlias: customAlias || null,
        userId,
        apiKeyId,
        expiresAt: expiryDate,
      },
    })

    // ── Prime Redis cache (warm cache on creation) ────────────────────────
    await cacheSet(shortCode, {
      originalUrl: url,
      isActive: true,
      expiresAt: expiryDate ? expiryDate.toISOString() : null,
    })

    // ── Increment global stats ────────────────────────────────────────────
    await incrStat('total_links')

    // ── Generate QR code ──────────────────────────────────────────────────
    const shortUrl = `${process.env.NEXT_PUBLIC_HOST}/${shortCode}`
    const qrDataUrl = await QRCode.toDataURL(shortUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#1e1b4b', light: '#ffffff' },
    })

    return Response.json({
      success: true,
      shortCode,
      shortUrl,
      originalUrl: url,
      qrDataUrl,
      expiresAt: expiryDate,
      createdAt: urlRecord.createdAt,
    })
  } catch (err) {
    console.error('[generate] Error:', err)
    return Response.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}