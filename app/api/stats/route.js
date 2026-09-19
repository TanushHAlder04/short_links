import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const [totalLinks, totalClicks] = await Promise.all([
      prisma.url.count(), prisma.click.count({ where: { isBot: false } }),
    ])
    return Response.json({ totalLinks, totalClicks }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch {
    return Response.json({ error: 'Statistics temporarily unavailable' }, { status: 503 })
  }
}
