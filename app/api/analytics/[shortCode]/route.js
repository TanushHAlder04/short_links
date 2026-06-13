// app/api/analytics/[shortCode]/route.js
// Returns analytics data for a given short code.
// Protected: requires session or valid API key.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/apikeys'

export async function GET(request, { params }) {
  const { shortCode } = await params

  // ── Auth check ─────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)
  const userId = await getAuthUserId(request, session)

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Verify ownership ───────────────────────────────────────────────────────
  const urlRecord = await prisma.url.findUnique({
    where: { shortCode },
    select: { id: true, userId: true, shortCode: true, originalUrl: true, clickCount: true, createdAt: true, isActive: true, expiresAt: true },
  })

  if (!urlRecord) {
    return Response.json({ error: 'Link not found' }, { status: 404 })
  }

  if (urlRecord.userId !== userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Clicks over last 30 days ───────────────────────────────────────────────
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const clicks = await prisma.click.findMany({
    where: { shortCode, timestamp: { gte: thirtyDaysAgo } },
    select: { timestamp: true, device: true, browser: true, country: true, referrer: true },
  })

  // Group clicks by day
  const clicksByDay = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    clicksByDay[key] = 0
  }
  clicks.forEach((c) => {
    const key = c.timestamp.toISOString().split('T')[0]
    if (key in clicksByDay) clicksByDay[key]++
  })

  // Group by device
  const deviceMap = {}
  clicks.forEach((c) => {
    const k = c.device || 'Unknown'
    deviceMap[k] = (deviceMap[k] || 0) + 1
  })

  // Group by browser
  const browserMap = {}
  clicks.forEach((c) => {
    const k = c.browser || 'Unknown'
    browserMap[k] = (browserMap[k] || 0) + 1
  })

  // Group by country
  const countryMap = {}
  clicks.forEach((c) => {
    const k = c.country || 'Unknown'
    countryMap[k] = (countryMap[k] || 0) + 1
  })

  // Group by referrer
  const referrerMap = {}
  clicks.forEach((c) => {
    const k = c.referrer || 'Direct'
    // Normalize referrer to domain
    try { const u = new URL(k); referrerMap[u.hostname] = (referrerMap[u.hostname] || 0) + 1 }
    catch { referrerMap[k] = (referrerMap[k] || 0) + 1 }
  })

  const topReferrers = Object.entries(referrerMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  return Response.json({
    url: urlRecord,
    totalClicks: urlRecord.clickCount,
    clicksByDay: Object.entries(clicksByDay).map(([date, count]) => ({ date, count })),
    byDevice: Object.entries(deviceMap).map(([name, count]) => ({ name, count })),
    byBrowser: Object.entries(browserMap).sort(([,a],[,b]) => b-a).slice(0, 8).map(([name, count]) => ({ name, count })),
    byCountry: Object.entries(countryMap).sort(([,a],[,b]) => b-a).slice(0, 10).map(([name, count]) => ({ name, count })),
    topReferrers,
    windowDays: 30,
  })
}
