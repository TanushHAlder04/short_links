import { logger } from '@/lib/logger'
import { identityFor } from '@/lib/identity'
import { readJson } from '@/lib/request'
import { enforceLimit } from '@/lib/ratelimit'
import { createLink } from '@/lib/services/links'
import { cacheSet } from '@/lib/redis'
import { errorResponse } from '@/lib/errors'
export async function POST(request) {
  const started = Date.now()
  try {
    const identity = await identityFor(request)
    const headers = await enforceLimit(request, identity)
    const body = await readJson(request)
    const output = await createLink(
      body,
      identity,
      request.headers.get('idempotency-key')
    )
    if (output.link) await cacheSet(output.link.shortCode, output.link)
    logger.info('creation.completed', { durationMs: Date.now() - started })
    return Response.json(output.result, {
      headers: { ...headers, 'Idempotency-Replayed': String(output.replayed) },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
