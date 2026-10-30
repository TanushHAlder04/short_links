import { identityFor } from '@/lib/identity'
import { enforceLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse } from '@/lib/errors'
export async function DELETE(request, { params }) {
  try {
    const identity = await identityFor(request, {
        required: true,
        sessionOnly: true,
      }),
      headers = await enforceLimit(request, identity, 'dashboard'),
      { keyId } = await params
    const result = await prisma.apiKey.updateMany({
      where: { id: keyId, userId: identity.userId },
      data: { isActive: false },
    })
    if (!result.count) throw new AppError('Key not found', 404)
    return Response.json({ success: true }, { headers })
  } catch (error) {
    return errorResponse(error)
  }
}
