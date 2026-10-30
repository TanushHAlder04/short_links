import { escapeCsv } from './csv.js'
import { AppError } from './errors.js'
export const CSV_FIELDS = {
  links:['shortCode','shortUrl','originalUrl','iosUrl','androidUrl','desktopUrl','customAlias','isActive','createdAt','expiresAt','humanClicks','botClicks','totalClicks','clickCount'],
  daily:['date','shortCode','humanClicks','botClicks','totalClicks'],
  dimensions:['date','shortCode','dimensionType','dimensionValue','humanClicks','botClicks','totalClicks'],
  raw:['eventId','shortCode','clickedAt','country','device','browser','operatingSystem','referrerDomain','isBot']
}
export function analyticsCsv(mode,report,raw=[]) {
  const fields=CSV_FIELDS[mode]
  if(!fields)throw new AppError('Choose links, daily, dimensions or raw CSV')
  const host=(process.env.NEXT_PUBLIC_HOST||'http://localhost:3000').replace(/\/$/,'')
  const rows=mode==='raw'?raw:mode==='daily'?report.dailyRows:mode==='dimensions'?report.dimensionRows:report.links.map(l=>({...l,shortUrl:`${host}/${l.shortCode}`,clickCount:l.totalClicks}))
  const line=row=>fields.map(k=>escapeCsv(row[k] instanceof Date?row[k].toISOString():row[k])).join(',')
  const lines=[fields.map(escapeCsv).join(',')]; let bytes=0
  for(const row of rows){const value=line(row);bytes+=Buffer.byteLength(value,'utf8')+2;if(bytes>16*1024*1024)throw new AppError('CSV exceeds 16 MiB; choose a smaller date range',413,'EXPORT_TOO_LARGE');lines.push(value)}
  return '\ufeff'+lines.join('\r\n')+'\r\n'
}
