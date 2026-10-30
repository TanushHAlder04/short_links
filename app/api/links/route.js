import { identityFor } from '@/lib/identity'
import { enforceLimit } from '@/lib/ratelimit'
import { listLinks } from '@/lib/services/queries'
import { errorResponse } from '@/lib/errors'
import { POST as generate } from '@/app/api/generate/route'
export async function GET(request) {
  try {
    const identity = await identityFor(request, { required: true })
    const headers = await enforceLimit(request, identity, 'dashboard')
    return Response.json(
      await listLinks(identity.userId, new URL(request.url).searchParams),
      { headers }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
export async function POST(request) {
  return generate(request)
}
