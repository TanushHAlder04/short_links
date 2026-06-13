
// app/api/links/[shortCode]/route.js
// CRUD operations on a single link: GET, PATCH, DELETE.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { cacheDel } from '@/lib/redis'
import { getAuthUserId } from '@/lib/apikeys'

async function getShortCode(params) {
  const resolvedParams = await params
  return resolvedParams.shortCode
}

async function verifyOwnership(shortCode, userId) {
  const url = await prisma.url.findUnique({
    where: { shortCode },
  })

  if (!url) {
    return { error: 'Link not found', status: 404 }
  }

  if (url.userId !== userId) {
    return { error: 'Forbidden', status: 403 }
  }

  return { url }
}

function getLinkStatus(url) {
  if (!url.isActive) return 'inactive'
  if (url.expiresAt && new Date(url.expiresAt) < new Date()) return 'expired'
  return 'active'
}

// GET /api/links/[shortCode] — get one owned link with recent clicks
export async function GET(request, { params }) {
  try {
    const shortCode = await getShortCode(params)

    const session = await getServerSession(authOptions)
    const userId = await getAuthUserId(request, session)

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url, error, status } = await verifyOwnership(shortCode, userId)

    if (error) {
      return Response.json({ error }, { status })
    }

    const [totalClicks, recentClicks] = await Promise.all([
      prisma.click.count({
        where: { shortCode },
      }),

      prisma.click.findMany({
        where: { shortCode },
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: {
          id: true,
          timestamp: true,
          country: true,
          city: true,
          device: true,
          browser: true,
          os: true,
          referrer: true,
        },
      }),
    ])

    return Response.json({
      url,
      totalClicks,
      recentClicks,
      status: getLinkStatus(url),
    })
  } catch (error) {
    console.error('GET /api/links/[shortCode] error:', error)

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/links/[shortCode] — update isActive, expiresAt
export async function PATCH(request, { params }) {
  try {
    const shortCode = await getShortCode(params)

    const session = await getServerSession(authOptions)
    const userId = await getAuthUserId(request, session)

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error, status } = await verifyOwnership(shortCode, userId)

    if (error) {
      return Response.json({ error }, { status })
    }

    const body = await request.json()
    const updates = {}

    if (typeof body.isActive === 'boolean') {
      updates.isActive = body.isActive
    }

    if (body.expiresAt !== undefined) {
      updates.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      )
    }

    const updated = await prisma.url.update({
      where: { shortCode },
      data: updates,
    })

    await cacheDel(shortCode)

    return Response.json({
      success: true,
      url: updated,
    })
  } catch (error) {
    console.error('PATCH /api/links/[shortCode] error:', error)

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/links/[shortCode] — soft delete
export async function DELETE(request, { params }) {
  try {
    const shortCode = await getShortCode(params)

    const session = await getServerSession(authOptions)
    const userId = await getAuthUserId(request, session)

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error, status } = await verifyOwnership(shortCode, userId)

    if (error) {
      return Response.json({ error }, { status })
    }

    const updated = await prisma.url.update({
      where: { shortCode },
      data: { isActive: false },
    })

    await cacheDel(shortCode)

    return Response.json({
      success: true,
      url: updated,
    })
  } catch (error) {
    console.error('DELETE /api/links/[shortCode] error:', error)

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
