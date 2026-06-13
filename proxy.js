// proxy.js (Next.js root proxy — was middleware in Next.js <16)
// Applies rate limiting to all /api/* routes.
// Runs on the Edge runtime — lightweight and fast.

import { NextResponse } from 'next/server'

// Routes that bypass rate limiting
const RATE_LIMIT_BYPASS = ['/api/auth']

// Rate limit config per route type
const LIMITS = {
  default: { limit: 30, windowMs: 60_000 },    // 30 req/min default
  generate: { limit: 10, windowMs: 60_000 },   // 10 req/min for creating links
  analytics: { limit: 60, windowMs: 60_000 },  // 60 req/min for reading analytics
}

export async function proxy(request) {
  const { pathname } = request.nextUrl

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Skip auth routes (NextAuth handles its own security)
  if (RATE_LIMIT_BYPASS.some((bypass) => pathname.startsWith(bypass))) {
    return NextResponse.next()
  }

  // Get identifier: prefer userId from cookie, fallback to IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'

  const identifier = ip

  // Select rate limit config based on route
  let limitConfig = LIMITS.default
  if (pathname.startsWith('/api/generate')) limitConfig = LIMITS.generate
  if (pathname.startsWith('/api/analytics')) limitConfig = LIMITS.analytics

  try {
    // Use Upstash Redis REST API directly (Edge-compatible)
    const now = Date.now()
    const windowStart = now - limitConfig.windowMs
    const key = `rl:${identifier}:${pathname.split('/')[2] || 'api'}`

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!redisUrl || !redisToken) {
      // Redis not configured — allow all requests
      return NextResponse.next()
    }

    // Atomic sliding window via Redis pipeline
    const pipelineBody = [
      ['zremrangebyscore', key, '-inf', windowStart],
      ['zcard', key],
      ['zadd', key, now, `${now}`],
      ['expire', key, Math.ceil(limitConfig.windowMs / 1000)],
    ]

    const res = await fetch(`${redisUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipelineBody),
    })

    if (res.ok) {
      const results = await res.json()
      const count = results[1]?.result ?? 0

      if (count >= limitConfig.limit) {
        return new NextResponse(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many requests. Max ${limitConfig.limit} requests per minute.`,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': String(limitConfig.limit),
              'X-RateLimit-Remaining': '0',
              'Retry-After': String(Math.ceil(limitConfig.windowMs / 1000)),
            },
          }
        )
      }

      const response = NextResponse.next()
      response.headers.set('X-RateLimit-Limit', String(limitConfig.limit))
      response.headers.set('X-RateLimit-Remaining', String(Math.max(0, limitConfig.limit - count - 1)))
      return response
    }
  } catch (err) {
    // Fail open — don't block requests if Redis is unavailable
    console.error('[middleware] Rate limit check failed:', err)
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
