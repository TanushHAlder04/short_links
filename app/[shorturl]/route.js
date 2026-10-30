import { after } from 'next/server'
import { resolveRedirect } from '@/lib/services/redirects'
import { captureClick } from '@/lib/analytics'
import { publishClick } from '@/lib/inngest/publish'
import { enforceLimit } from '@/lib/ratelimit'
import { errorResponse } from '@/lib/errors'
import { logger } from '@/lib/logger'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request, { params }) {
  const started = Date.now()
  const { shorturl } = await params
  const result = await resolveRedirect(shorturl, request.headers.get('user-agent') || '')
  if (result.status === 404) {
    try { await enforceLimit(request, {}, 'scanning') } catch(error) { return errorResponse(error) }
  }
  logger.info('redirect.completed', { status: result.status, durationMs: Date.now()-started })
  if (result.status === 302) {
    const event = captureClick(shorturl, request.headers)
    after(async () => { await publishClick(event) })
    return new Response(null, { status: 302, headers: { Location: result.location, 'Cache-Control': 'no-store' } })
  }
  return new Response(result.status === 410 ? 'This link is expired, inactive, or deleted.' : result.status === 404 ? 'Link not found.' : 'Temporarily unavailable. Please retry.', { status: result.status, headers: { 'Cache-Control': 'no-store', ...(result.status === 503 ? { 'Retry-After': '10' } : {}) } })
}
