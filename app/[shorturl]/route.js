// URL redirect handler with Redis caching and async analytics.
// Performance path: Redis hit → <5ms redirect. DB miss → ~50ms.

import { redirect , notFound } from 'next/navigation'
import { NextResponse, after } from 'next/server'
import { incrStat } from '@/lib/redis'
import { recordClick } from '@/lib/analytics'
import { fetchCachedUrl } from '@/lib/cache-gatekeeper'
import { checkRateLimit, RATE_LIMITS } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request, { params }) {
  const { shorturl } = await params

  // Ignore requests for special paths (e.g., favicon.ico, _next/*, etc.)
  if (shorturl.startsWith('_') || shorturl === 'favicon.ico') {
     notFound()
  }

  //Extract client IP address from headers (x-forwarded-for or x-real-ip) and Check Rate Limit 
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

  //  Fetch URL via Cache Gatekeeper
  const urlData = await fetchCachedUrl(shorturl);

  if (!urlData) {
    // 404 — not found
    redirect(`/not-found?code=${encodeURIComponent(shorturl)}`)
  }

  //  Validate Link Status and Expiration
const isExpired = urlData.expiresAt && new Date(urlData.expiresAt) < new Date()
  if (!urlData.isActive || isExpired) {
    const reason = !urlData.isActive ? 'inactive' : 'expired'
    redirect(`/link-unavailable?reason=${reason}`)
  }
//User-Agent Targetted Device Routing
  const userAgent = request.headers.get('user-agent') || ''
  const referrer = request.headers.get('referer') || null
  const targetUrl = resolveTargetUrl(urlData, userAgent)

  //  Safe Background Analytics Execution
  after(async () => {
    try {
      await Promise.allSettled([
        recordClick({ shortCode: shorturl, ip, userAgent, referrer }),
        incrStat('total_clicks')
      ])
    } catch (err) {
      console.error('Failed to log analytics:', err)
    }
  })

  // Perform Redirect
  redirect(targetUrl)

}

 //Resolves link target URL based on client device platform.
function resolveTargetUrl(urlData, userAgent) {
  if (!userAgent) return urlData.originalUrl

  const ua = userAgent.toLowerCase()
  const isIos = /iphone|ipad|ipod|ios/.test(ua)
  const isAndroid = ua.includes('android')

  if (isIos && urlData.iosUrl) return urlData.iosUrl
  if (isAndroid && urlData.androidUrl) return urlData.androidUrl

  return urlData.originalUrl 
  
}