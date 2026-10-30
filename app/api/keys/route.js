import { identityFor } from '@/lib/identity'
import { enforceLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { createApiKey } from '@/lib/apikeys'
import { readJson } from '@/lib/request'
import { AppError, errorResponse } from '@/lib/errors'
export async function GET(request) {
  try {
    const identity = await identityFor(request, {
        required: true,
        sessionOnly: true,
      }),
      headers = await enforceLimit(request, identity, 'dashboard')
    const keys = await prisma.apiKey.findMany({
      where: { userId: identity.userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsed: true,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json({ keys }, { headers })
  } catch (error) {
    return errorResponse(error)
  }
}
export async function POST(request) {
  try {
    const identity = await identityFor(request, {
        required: true,
        sessionOnly: true,
      }),
      headers = await enforceLimit(request, identity, 'dashboard'),
      { name } = await readJson(request)
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 80)
      throw new AppError('Key name must contain 2-80 characters')
    return Response.json(
      {
        success: true,
        ...(await createApiKey(identity.userId, name.trim())),
        message: 'Copy this key now; it is shown only once.',
      },
      { headers }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
