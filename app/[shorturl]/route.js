// app/[shorturl]/route.js
// URL redirect handler with Redis caching and async analytics.
// Performance path: Redis hit → <5ms redirect. DB miss → ~50ms.


export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, incrStat } from '@/lib/redis'
import { recordClick } from '@/lib/analytics'

export async function GET(request, { params }) {
  const { shorturl } = await params

  // Skip Next.js internals
  if (shorturl.startsWith('_') || shorturl === 'favicon.ico') {
    return NextResponse.next()
  }

  // ── Step 1: Check Redis cache (hot path) ─────────────────────────────────
  let urlData = await cacheGet(shorturl)

  if (!urlData) {
    // ── Step 2: Cache miss → query PostgreSQL ───────────────────────────────
    const doc = await prisma.url.findUnique({
      where: { shortCode: shorturl },
      select: { originalUrl: true, isActive: true, expiresAt: true },
    })

    if (!doc) {
      // 404 — not found
      redirect(`${process.env.NEXT_PUBLIC_HOST || ''}/not-found?code=${encodeURIComponent(shorturl)}`)
    }

    urlData = {
      originalUrl: doc.originalUrl,
      isActive: doc.isActive,
      expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
    }

    // ── Step 3: Warm the cache ─────────────────────────────────────────────
    // Use shorter TTL if link expires soon
    let ttl = 3600
    if (urlData.expiresAt) {
      const msToExpiry = new Date(urlData.expiresAt) - Date.now()
      if (msToExpiry < 0) {
        // Already expired — don't cache
        return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
      }
      ttl = Math.min(3600, Math.floor(msToExpiry / 1000))
    }

    await cacheSet(shorturl, urlData, ttl)
  }

  // ── Step 4: Validate active / expiry ─────────────────────────────────────
  if (!urlData.isActive) {
    return NextResponse.json({ error: 'Link is inactive' }, { status: 410 })
  }

  if (urlData.expiresAt && new Date(urlData.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
  }

  // ── Step 5: Fire-and-forget analytics (non-blocking) ─────────────────────
  // [KAFKA-READY]: Replace recordClick() with kafka.producer.send() here
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  const userAgent = request.headers.get('user-agent')
  const referrer = request.headers.get('referer') || null

  recordClick({ shortCode: shorturl, ip, userAgent, referrer })

  // ── Step 6: Increment global redirect counter ─────────────────────────────
  incrStat('total_clicks').catch(() => { })

  // ── Step 7: Redirect ──────────────────────────────────────────────────────
  redirect(urlData.originalUrl)
}