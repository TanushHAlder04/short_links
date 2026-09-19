// Broad IP abuse ceiling. Route handlers enforce authenticated/user tiers.
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

export async function proxy(request) {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/api/') || pathname === '/api/auth' || pathname.startsWith('/api/auth/') || request.method === 'OPTIONS') {
    return NextResponse.next()
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const { allowed, reset } = await checkRateLimit(`api-abuse:${ip}`, { limit: 300, windowMs: 60_000 })
  if (!allowed) return NextResponse.json({ error: 'Too many requests from this network' }, {
    status: 429,
    headers: { 'Retry-After': String(Math.max(1, reset - Math.floor(Date.now() / 1000))), 'X-RateLimit-Reset': String(reset) },
  })
  return NextResponse.next()
}
export const config = { matcher: '/api/:path*' }
