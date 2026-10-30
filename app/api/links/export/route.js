import { AppError } from '@/lib/errors'
import { exportLimits } from '@/lib/services/reports'
import { identityFor } from '@/lib/identity'
import { enforceLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { escapeCsv } from '@/lib/csv'
import { errorResponse } from '@/lib/errors'
export async function GET(request) {
  try {
    const identity = await identityFor(request, { required: true }),
      headers = await enforceLimit(request, identity, 'export')
    const links = await prisma.url.findMany({
      where: { userId: identity.userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: exportLimits().links + 1,
      select: {
        shortCode: true,
        originalUrl: true,
        iosUrl: true,
        androidUrl: true,
        desktopUrl: true,
        customAlias: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        lifetimeStats: { select: { humanClicks: true } },
      },
    })
    if (links.length > exportLimits().links) throw new AppError('Too many links; use a selected-link analytics export', 413, 'EXPORT_TOO_LARGE')
    const fields = [
      'shortCode',
      'originalUrl',
      'iosUrl',
      'androidUrl',
      'desktopUrl',
      'customAlias',
      'clickCount',
      'isActive',
      'expiresAt',
      'createdAt',
    ]
    const rows = links.map((l) =>
      fields
        .map((k) =>
          escapeCsv(
            k === 'clickCount'
              ? l.lifetimeStats?.humanClicks || 0
              : l[k] instanceof Date
                ? l[k].toISOString()
                : l[k]
          )
        )
        .join(',')
    )
    return new Response([fields.join(','), ...rows].join('\n'), {
      headers: {
        ...headers,
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'attachment; filename="shortlinks-export.csv"',
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
