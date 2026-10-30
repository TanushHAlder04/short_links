import { identityFor } from '@/lib/identity'
import { enforceLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { normalizeDestination } from '@/lib/link-validation'
import { errorResponse } from '@/lib/errors'
export async function GET(request) {
  try {
    const identity = await identityFor(request, {
        required: true,
        sessionOnly: true,
      }),
      headers = await enforceLimit(request, identity, 'dashboard')
    const normalizedUrl = normalizeDestination(
      new URL(request.url).searchParams.get('url')
    )
    const links = await prisma.url.findMany({
      where: {
        userId: identity.userId,
        deletedAt: null,
        OR: [
          { normalizedUrl },
          { normalizedUrl: null, originalUrl: normalizedUrl },
        ],
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        shortCode: true,
        originalUrl: true,
        createdAt: true,
        isActive: true,
        expiresAt: true,
      },
    })
    return Response.json({ links }, { headers })
  } catch (error) {
    return errorResponse(error)
  }
}
