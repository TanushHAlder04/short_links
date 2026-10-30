import { identityFor } from '@/lib/identity'
import { enforceLimit } from '@/lib/ratelimit'
import { linkAnalytics } from '@/lib/services/queries'
import { errorResponse } from '@/lib/errors'
export async function GET(request, { params }) {
  try {
    const identity = await identityFor(request, { required: true }),
      headers = await enforceLimit(request, identity, 'dashboard'),
      { shortCode } = await params,
      p = new URL(request.url).searchParams
    return Response.json(
      await linkAnalytics(
        shortCode,
        identity.userId,
        p.get('traffic') || (p.get('includeBots') === 'true' ? 'all' : 'human'),
        undefined, undefined, p
      ),
      { headers: { ...headers, 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
