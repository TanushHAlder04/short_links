// app/api/links/route.js
// List links and create authenticated links.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/apikeys'
import { checkRateLimit } from '@/lib/ratelimit'
import { POST as createLinkHandler } from '@/app/api/generate/route'

function safeSortBy(sortBy) {
  const allowed = ['createdAt', 'clickCount']
  return allowed.includes(sortBy) ? sortBy : 'createdAt'
}

// GET /api/links — list authenticated user's links
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = await getAuthUserId(request, session)

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { allowed, reset } = await checkRateLimit(`links-list:${userId}`, {
      limit: 60,
      windowMs: 60_000,
    })

    if (!allowed) {
      return Response.json(
        { error: 'Too many requests. Please slow down.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Reset': String(reset),
            'Retry-After': '60',
          },
        }
      )
    }

    const { searchParams } = new URL(request.url)

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const sortBy = safeSortBy(searchParams.get('sortBy') || 'createdAt')
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'

    const [links, total] = await Promise.all([
      prisma.url.findMany({
        where: { userId },
        orderBy: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          shortCode: true,
          originalUrl: true,
          customAlias: true,
          clickCount: true,
          isActive: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      prisma.url.count({
        where: { userId },
      }),
    ])

    return Response.json({
      links,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('GET /api/links error:', error)

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/links — thin wrapper over /api/generate single source of truth
export async function POST(request) {
  return createLinkHandler(request)
}

