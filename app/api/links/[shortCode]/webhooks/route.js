import { identityFor } from '@/lib/identity'
import { enforceLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { ownedLink } from '@/lib/services/links'
import { retryOwnedDelivery } from '@/lib/services/deliveries'
import { readJson } from '@/lib/request'
import { inngest } from '@/lib/inngest/client'
import { logger } from '@/lib/logger'
import { AppError, errorResponse } from '@/lib/errors'
async function context(request, params) {
  const identity = await identityFor(request, { required: true }),
    headers = await enforceLimit(request, identity, 'dashboard'),
    { shortCode } = await params
  await ownedLink(shortCode, identity.userId)
  return { identity, headers, shortCode }
}
export async function GET(request, { params }) {
  try {
    const { headers, shortCode } = await context(request, params)
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { linkId: shortCode },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        eventId: true,
        milestone: true,
        status: true,
        attemptCount: true,
        lastAttemptAt: true,
        nextAttemptAt: true,
        responseStatus: true,
        errorSummary: true,
        createdAt: true,
        deliveredAt: true,
      },
    })
    return Response.json({ deliveries }, { headers })
  } catch (error) {
    return errorResponse(error)
  }
}
export async function POST(request, { params }) {
  try {
    const { identity, headers, shortCode } = await context(request, params),
      { deliveryId } = await readJson(request)
    if (typeof deliveryId !== 'string')
      throw new AppError('Delivery ID required')
    if (
      !(await prisma.webhookDelivery.findFirst({
        where: { id: deliveryId, linkId: shortCode },
        select: { id: true },
      }))
    )
      throw new AppError('Delivery not found', 404)
    const delivery = await retryOwnedDelivery(deliveryId, identity.userId)
    if (!delivery)
      throw new AppError('Only failed deliveries may be retried', 409)
    try {
      await inngest.send({
        name: 'link/webhook.requested',
        data: { deliveryId: delivery.id, generation: delivery.retryGeneration },
      })
    } catch (error) {
      logger.error('webhook.retry_publication_failed', error, { deliveryId })
    }
    return Response.json({ success: true, status: 'pending' }, { headers })
  } catch (error) {
    return errorResponse(error)
  }
}
