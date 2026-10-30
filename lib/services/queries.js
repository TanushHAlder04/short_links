import { analyticsReport } from './reports.js'
import { reportOptions } from '../report-options.js'
import { prisma } from '../prisma.js'
import { trafficColumn, DAY } from '../analytics.js'
import { ownedLink, publicLinkSelect } from './links.js'
export async function linkAnalytics(code,userId,traffic='human',db=prisma,now=new Date(),params=new URLSearchParams()) {
  params = new URLSearchParams(params)
  params.set('shortCode',code); params.set('traffic',traffic)
  const report=await analyticsReport(userId,reportOptions(params,now),db)
  const url=await ownedLink(code,userId,db)
  const lifetime=await db.linkLifetimeStats.findUnique({where:{linkId:code}})
  const list=type=>report.breakdowns[type].slice(0,10)
  return {url,totalClicks:lifetime?.[trafficColumn(traffic)]||0,windowClicks:report.totals.totalClicks,traffic,timezone:'UTC',windowDays:report.options.days,
    clicksByDay:report.days.map(d=>({date:d.date,count:d.totalClicks})),byDevice:list('device'),byBrowser:list('browser'),byCountry:list('country'),byOperatingSystem:list('operatingSystem'),topReferrers:list('referrerDomain'),report}
}
export async function listLinks(userId, params, db = prisma) {
  const page = Math.max(1, parseInt(params.get('page') || '1') || 1),
    limit = Math.min(
      50,
      Math.max(1, parseInt(params.get('limit') || '15') || 15)
    )
  const column = trafficColumn(params.get('traffic')),
    query = (params.get('q') || '').trim().slice(0, 300),
    owner = { userId, deletedAt: null }
  const where = {
    ...owner,
    ...(query
      ? {
          OR: [
            { shortCode: { contains: query, mode: 'insensitive' } },
            { originalUrl: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
  const order = params.get('order') === 'asc' ? 'asc' : 'desc',
    sort =
      params.get('sortBy') === 'clickCount'
        ? { lifetimeStats: { [column]: order } }
        : { createdAt: order },
    now = new Date()
  const [rows, total, accountTotal, clicks, active, thisWeek] =
    await Promise.all([
      db.url.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [sort, { id: order }],
        select: { ...publicLinkSelect, lifetimeStats: true },
      }),
      db.url.count({ where }),
      db.url.count({ where: owner }),
      db.linkLifetimeStats.aggregate({
        where: { link: owner },
        _sum: { [column]: true },
      }),
      db.url.count({
        where: {
          ...owner,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      db.url.count({
        where: {
          ...owner,
          createdAt: { gte: new Date(now.getTime() - 7 * DAY) },
        },
      }),
    ])
  return {
    links: rows.map(({ lifetimeStats, ...l }) => ({
      ...l,
      clickCount: lifetimeStats?.[column] || 0,
    })),
    stats: {
      total: accountTotal,
      clicks: clicks._sum[column] || 0,
      active,
      thisWeek,
    },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}
