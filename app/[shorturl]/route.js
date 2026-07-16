// app/[shorturl]/route.js
// URL redirect handler with Redis caching and async analytics.
// Performance path: Redis hit → <5ms redirect. DB miss → ~50ms.


export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { incrStat } from '@/lib/redis'
import { recordClick } from '@/lib/analytics'
import { fetchCachedUrl } from '@/lib/cache-gatekeeper'

export async function GET(request, { params }) {
  const { shorturl } = await params

  // Skip Next.js internals
  if (shorturl.startsWith('_') || shorturl === 'favicon.ico') {
    return NextResponse.next()
  }

  // ── Step 1: Fetch URL via Cache Gatekeeper ───────────────────────────────
  const urlData = await fetchCachedUrl(shorturl);

  if (!urlData) {
    // 404 — not found
    redirect(`${process.env.NEXT_PUBLIC_HOST || ''}/not-found?code=${encodeURIComponent(shorturl)}`)
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