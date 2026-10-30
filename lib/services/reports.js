import { prisma } from '../prisma.js'
import { AppError } from '../errors.js'
import { DIMENSIONS, REPORT_DAY, filterCounts } from '../report-options.js'
const setting = (name, fallback, ceiling) => Math.min(ceiling, Math.max(1, Math.floor(Number(process.env[name]) || fallback)))
export const exportLimits = () => ({ links:setting('EXPORT_MAX_LINKS',1000,5000), rows:setting('EXPORT_MAX_AGGREGATE_ROWS',20000,50000), raw:setting('EXPORT_MAX_RAW_ROWS',10000,50000) })
const bounded = (rows, limit) => { if(rows.length > limit) throw new AppError('Export is too large. Choose one link or a smaller date range; use aggregate export for raw events.',413,'EXPORT_TOO_LARGE'); return rows }
const linkSelect = { shortCode:true,originalUrl:true,customAlias:true,isActive:true,createdAt:true,expiresAt:true,iosUrl:true,androidUrl:true,desktopUrl:true }
export async function analyticsReport(userId, options, db=prisma) {
  if (!userId) throw new AppError('Authentication required',401)
  return db.$transaction(async tx => {
    const limits=exportLimits(), owner={userId,deletedAt:null,...(options.shortCode?{shortCode:options.shortCode}:{})}
    const links=bounded(await tx.url.findMany({where:owner,select:linkSelect,orderBy:{shortCode:'asc'},take:limits.links+1}),limits.links)
    if(options.shortCode && !links.length) throw new AppError('Link not found',404,'NOT_FOUND')
    const where={link:owner,date:{gte:options.start,lt:options.end}}
    const daily=bounded(await tx.linkDailyStats.findMany({where,orderBy:[{date:'asc'},{linkId:'asc'}],take:limits.rows+1}),limits.rows)
    const dimensions=bounded(await tx.linkDailyDimension.findMany({where,orderBy:[{date:'asc'},{linkId:'asc'},{dimensionType:'asc'},{dimensionValue:'asc'}],take:limits.rows+1}),limits.rows)
    return summarizeReport(links,daily,dimensions,options)
  },{isolationLevel:'RepeatableRead',timeout:15000})
}
export function summarizeReport(links,daily,dimensions,options) {
  const counts = row => filterCounts(row,options.traffic)
  const dailyRows=daily.map(r=>({date:r.date.toISOString().slice(0,10),shortCode:r.linkId,...counts(r)}))
  const dimensionRows=dimensions.map(r=>({date:r.date.toISOString().slice(0,10),shortCode:r.linkId,dimensionType:r.dimensionType,dimensionValue:r.dimensionValue,...counts(r)})).filter(r=>r.totalClicks>0)
  const byLink=new Map(), byDate=new Map(), breakdowns=Object.fromEntries(DIMENSIONS.map(d=>[d,new Map()]))
  const empty=()=>({humanClicks:0,botClicks:0,totalClicks:0})
  const add=(target,row)=>{for(const k of Object.keys(target)) target[k]+=row[k]}
  const totals=empty()
  for(const row of dailyRows) { add(totals,row); for(const [map,key] of [[byDate,row.date],[byLink,row.shortCode]]) { if(!map.has(key))map.set(key,empty());add(map.get(key),row) } }
  for(const row of dimensionRows) {const map=breakdowns[row.dimensionType];if(map)map.set(row.dimensionValue,(map.get(row.dimensionValue)||0)+row.totalClicks)}
  const days=Array.from({length:options.days},(_,i)=>{const date=new Date(+options.start+i*REPORT_DAY).toISOString().slice(0,10);return {date,...(byDate.get(date)||empty())}})
  const active=days.filter(d=>d.totalClicks>0)
  return { options, totals, averageClicksPerDay:totals.totalClicks/options.days,activeRange:active.length?{start:active[0].date,end:active.at(-1).date}:null,
    links:links.map(l=>({...l,...(byLink.get(l.shortCode)||empty())})),days,dailyRows,dimensionRows,
    breakdowns:Object.fromEntries(DIMENSIONS.map(d=>[d,Array.from(breakdowns[d],([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))])) }
}
export async function rawReportRows(userId,options,db=prisma) {
  if(!userId)throw new AppError('Authentication required',401)
  if(!options.rawAvailable)throw new AppError('Raw events are available only for complete UTC days within the last 90 days. Choose a smaller range or daily/dimension aggregates.',400,'RAW_RETENTION_LIMIT')
  if(options.shortCode && !await db.url.findFirst({where:{shortCode:options.shortCode,userId,deletedAt:null},select:{shortCode:true}}))throw new AppError('Link not found',404,'NOT_FOUND')
  const limit=exportLimits().raw
  return bounded(await db.clickEvent.findMany({where:{link:{userId,deletedAt:null,...(options.shortCode?{shortCode:options.shortCode}:{})},clickedAt:{gte:options.start,lt:options.end},...(options.traffic==='all'?{}:{isBot:options.traffic==='bot'})},
    select:{eventId:true,linkId:true,clickedAt:true,country:true,device:true,browser:true,operatingSystem:true,referrerDomain:true,isBot:true},orderBy:[{clickedAt:'asc'},{eventId:'asc'}],take:limit+1}),limit).map(({linkId,...row})=>({...row,shortCode:linkId}))
}
