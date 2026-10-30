import { AppError } from './errors.js'
export const REPORT_DAY = 86400000
export const DIMENSIONS = ['country', 'device', 'browser', 'operatingSystem', 'referrerDomain']
export function reportOptions(params = new URLSearchParams(), now = new Date()) {
  const today = now.toISOString().slice(0, 10)
  const preset = params.get('range') || '30'
  if (!['7', '30', '90', 'custom'].includes(preset)) throw new AppError('Invalid date preset')
  const parse = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new AppError('Use YYYY-MM-DD dates')
    const date = new Date(value + 'T00:00:00.000Z')
    if (!Number.isFinite(+date) || date.toISOString().slice(0,10) !== value) throw new AppError('Invalid calendar date')
    return date
  }
  const endDate = params.get('end') || today
  const startDate = params.get('start') || new Date(+parse(endDate) - (Number(preset === 'custom' ? 30 : preset)-1)*REPORT_DAY).toISOString().slice(0,10)
  if (preset === 'custom' && (!params.get('start') || !params.get('end'))) throw new AppError('Custom range needs start and end dates')
  const start = parse(startDate), end = new Date(+parse(endDate)+REPORT_DAY), days = (+end-+start)/REPORT_DAY
  if (days < 1 || days > 366 || endDate > today) throw new AppError('Choose an ordered date range of at most 366 days ending today or earlier')
  const traffic = params.get('traffic') || 'human'
  if (!['human','bot','all'].includes(traffic)) throw new AppError('Invalid traffic filter')
  if (params.get('timezone') && params.get('timezone') !== 'UTC') throw new AppError('Daily aggregates use UTC; only UTC reports are supported')
  const shortCode = params.get('shortCode') || null
  if (shortCode && !/^[a-zA-Z0-9_-]{3,30}$/.test(shortCode)) throw new AppError('Invalid short code')
  return { start, end, startDate, endDate, days, traffic, shortCode, timezone:'UTC', generatedAt:now.toISOString(), rawAvailable:+start >= +now-90*REPORT_DAY }
}
export function reportFilename(options, extension, mode='analytics') {
  const safe = value => String(value).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40) || 'account'
  return `shortlinks-${safe(options.shortCode || 'account')}-${safe(mode)}-${safe(options.startDate)}-${safe(options.endDate)}.${extension === 'pdf' ? 'pdf' : 'csv'}`
}
export function filterCounts(row, traffic) {
  const humanClicks = traffic === 'bot' ? 0 : row.humanClicks || 0
  const botClicks = traffic === 'human' ? 0 : row.botClicks || 0
  return { humanClicks, botClicks, totalClicks: humanClicks + botClicks }
}
