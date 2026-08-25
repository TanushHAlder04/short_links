// app/api/links/export/route.js
// Export authenticated user's short links as CSV format.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/apikeys'
import { checkRateLimit } from '@/lib/ratelimit'
import { escapeCsv } from '@/lib/csv'

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = await getAuthUserId(request, session)

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { allowed, reset } = await checkRateLimit(`links-export:${userId}`, {
      limit: 10,
      windowMs: 60_000,
    })

    if (!allowed) {
      return Response.json(
        { error: 'Too many export requests. Please slow down.' },
        { status: 429, headers: { 'X-RateLimit-Reset': String(reset), 'Retry-After': '60' } }
      )
    }

    const links = await prisma.url.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        shortCode: true,
        originalUrl: true,
        iosUrl: true,
        androidUrl: true,
        customAlias: true,
        clickCount: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    const headers = ['shortCode', 'originalUrl', 'iosUrl', 'androidUrl', 'customAlias', 'clickCount', 'isActive', 'expiresAt', 'createdAt']
    const rows = links.map((l) => [
      escapeCsv(l.shortCode),
      escapeCsv(l.originalUrl),
      escapeCsv(l.iosUrl),
      escapeCsv(l.androidUrl),
      escapeCsv(l.customAlias),
      l.clickCount,
      l.isActive,
      escapeCsv(l.expiresAt ? l.expiresAt.toISOString() : ''),
      escapeCsv(l.createdAt ? l.createdAt.toISOString() : ''),
    ].join(','))

    const csvContent = [headers.join(','), ...rows].join('\n')

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="shortlinks-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    console.error('GET /api/links/export error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
