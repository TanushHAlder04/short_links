// app/api/links/route.js
// List links and create authenticated links.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/apikeys'
import { checkRateLimit } from '@/lib/ratelimit'
import { generateShortCode } from '@/lib/shortcode'

const RESERVED_ALIASES = [
  'api',
  'dashboard',
  'login',
  'register',
  'shorten',
  'admin',
  'docs',
  'api-docs',
  'auth',
  'settings',
  'profile',
]

function isValidUrl(value) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function isValidAlias(alias) {
  return /^[a-zA-Z0-9-_]+$/.test(alias)
}

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

// POST /api/links — create authenticated short link
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = await getAuthUserId(request, session)

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { allowed, reset } = await checkRateLimit(`links-create:${userId}`, {
      limit: 30,
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

    const body = await request.json()
    const originalUrl = body.url || body.originalUrl
    const customAlias = body.customAlias?.trim() || ''
    const expiresAt = body.expiresAt

    if (!originalUrl) {
      return Response.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    if (!isValidUrl(originalUrl)) {
      return Response.json(
        { error: 'Invalid URL. Only http and https URLs are allowed.' },
        { status: 400 }
      )
    }

    let shortCode

    if (customAlias) {
      if (customAlias.length > 30) {
        return Response.json(
          { error: 'Custom alias must be 30 characters or less.' },
          { status: 400 }
        )
      }

      if (!isValidAlias(customAlias)) {
        return Response.json(
          { error: 'Alias can only contain letters, numbers, hyphen, and underscore.' },
          { status: 400 }
        )
      }

      if (RESERVED_ALIASES.includes(customAlias.toLowerCase())) {
        return Response.json(
          { error: 'This alias is reserved.' },
          { status: 400 }
        )
      }

      const existing = await prisma.url.findUnique({
        where: { shortCode: customAlias },
      })

      if (existing) {
        return Response.json(
          { error: 'Alias already exists.' },
          { status: 409 }
        )
      }

      shortCode = customAlias
    } else {
      shortCode = await generateShortCode()
    }

    const link = await prisma.url.create({
      data: {
        originalUrl,
        shortCode,
        customAlias: customAlias || null,
        userId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
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
    })

    const host = process.env.NEXT_PUBLIC_HOST || new URL(request.url).origin

    return Response.json(
      {
        success: true,
        link,
        shortUrl: `${host}/${shortCode}`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/links error:', error)

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

