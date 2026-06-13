// app/api/stats/route.js
// Public global stats for the landing page hero counter.

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getStat } from '@/lib/redis'
import { prisma } from '@/lib/prisma'



export async function GET() {
  try {
    // Try Redis first (fast)
    const [cachedLinks, cachedClicks] = await Promise.all([
      getStat('total_links'),
      getStat('total_clicks'),
    ])

    // Fall back to DB count if Redis has no data yet
    const [dbLinks, dbClicks] = await Promise.all([
      cachedLinks === 0 ? prisma.url.count() : Promise.resolve(cachedLinks),
      cachedClicks === 0 ? prisma.click.count() : Promise.resolve(cachedClicks),
    ])

    return Response.json({
      totalLinks: dbLinks,
      totalClicks: dbClicks,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
    })
  } catch {
    return Response.json({ totalLinks: 0, totalClicks: 0 })
  }
}
