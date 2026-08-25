// app/[shorturl]/route.js
// URL redirect handler with Redis caching and async analytics.
// Performance path: Redis hit → <5ms redirect. DB miss → ~50ms.


export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { redirect } from 'next/navigation'
import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { incrStat } from '@/lib/redis'
import { recordClick } from '@/lib/analytics'
import { fetchCachedUrl } from '@/lib/cache-gatekeeper'
import { checkRateLimit, RATE_LIMITS } from '@/lib/ratelimit'

export async function GET(request, { params }) {
  const { shorturl } = await params

  // Skip Next.js internals
  if (shorturl.startsWith('_') || shorturl === 'favicon.ico') {
    return NextResponse.next()
  }

  // ── Step 0: Rate Limit Check ─────────────────────────────────────────────
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'

  const { allowed, reset } = await checkRateLimit(`redirect:${ip}`, RATE_LIMITS.redirect)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many redirect requests. Please slow down.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMITS.redirect.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil(RATE_LIMITS.redirect.windowMs / 1000)),
        },
      }
    )
  }

  // ── Step 1: Fetch URL via Cache Gatekeeper ───────────────────────────────
  const urlData = await fetchCachedUrl(shorturl);

  if (!urlData) {
    // 404 — not found
    redirect(`${process.env.NEXT_PUBLIC_HOST || ''}/not-found?code=${encodeURIComponent(shorturl)}`)
  }

  // ── Step 4: Validate active / expiry & Evaluate Smart Device Target ───────
  if (!urlData.isActive) {
    return NextResponse.json({ error: 'Link is inactive' }, { status: 410 })
  }

  if (urlData.expiresAt && new Date(urlData.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
  }

  const userAgent = request.headers.get('user-agent') || ''
  const referrer = request.headers.get('referer') || null

  // Smart Device Redirect Override: iOS vs Android vs Fallback Original URL
  let targetUrl = urlData.originalUrl
  if (userAgent) {
    const ua = userAgent.toLowerCase()
    if ((ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || ua.includes('ios')) && urlData.iosUrl) {
      targetUrl = urlData.iosUrl
    } else if (ua.includes('android') && urlData.androidUrl) {
      targetUrl = urlData.androidUrl
    }
  }

  // ── Step 5: Background Analytics via after() (Serverless Safe) ────────────
  after(() => {
    recordClick({ shortCode: shorturl, ip, userAgent, referrer })
    incrStat('total_clicks').catch(() => { })
  })

  // ── Step 6: Redirect ──────────────────────────────────────────────────────
  redirect(targetUrl)
}