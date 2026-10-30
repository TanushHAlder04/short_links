import { identityFor } from '@/lib/identity'
import { enforceLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { ownedLink, publicLinkSelect } from '@/lib/services/links'
import { readJson } from '@/lib/request'
import { validateLinkOptions } from '@/lib/link-validation'
import { invalidateCommittedLink } from '@/lib/inngest/publish'
import { AppError, errorResponse } from '@/lib/errors'
async function context(request, params) {
  const identity = await identityFor(request, { required: true })
  const headers = await enforceLimit(request, identity, 'dashboard')
  const { shortCode } = await params
  const link = await ownedLink(shortCode, identity.userId)
  return { identity, headers, shortCode, link }
}
export async function GET(request, { params }) {
  try {
    const { link, headers } = await context(request, params)
    return Response.json({ url: link }, { headers })
  } catch (error) {
    return errorResponse(error)
  }
}
async function mutate(request, params, deleted) {
  try {
    const { identity, headers, shortCode } = await context(request, params)
    const updates = deleted
      ? { deletedAt: new Date(), isActive: false }
      : await validateLinkOptions(await readJson(request), { shortCode })
    if (!Object.keys(updates).length)
      throw new AppError('No editable fields supplied')
    const url = await prisma.url.update({
      where: { shortCode, userId: identity.userId, deletedAt: null },
      data: { ...updates, version: { increment: 1 } },
      select: publicLinkSelect,
    })
    await invalidateCommittedLink(shortCode, url.version)
    return Response.json({ success: true, url }, { headers })
  } catch (error) {
    return errorResponse(error)
  }
}
export async function PATCH(request, { params }) {
  return mutate(request, params, false)
}
export async function DELETE(request, { params }) {
  return mutate(request, params, true)
}
