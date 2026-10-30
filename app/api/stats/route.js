import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const [totalLinks, totalClicks] = await Promise.all([
      prisma.url.count(),
      prisma.linkLifetimeStats.aggregate({ _sum: { humanClicks: true } }),
    ])
    return Response.json(
      { totalLinks, totalClicks: totalClicks._sum.humanClicks || 0 },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  } catch {
    return Response.json(
      { error: 'Statistics temporarily unavailable' },
      { status: 503 }
    )
  }
}
