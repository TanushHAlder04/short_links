import { createHmac, randomUUID } from 'node:crypto'
import { UAParser } from 'ua-parser-js'
import { z } from 'zod'
export const DAY = 86400000
export function isBotUserAgent(ua) {
  return /bot|crawler|spider|crawling|slurp|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests/i.test(
    ua || ''
  )
}
export function hashIP(ip) {
  return ip && process.env.IP_HASH_SALT
    ? createHmac('sha256', process.env.IP_HASH_SALT).update(ip).digest('hex')
    : null
}
export function referrerDomain(value) {
  if (!value) return 'Unknown'
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) &&
      url.hostname.length <= 253
      ? url.hostname.toLowerCase().replace(/^www\./, '')
      : 'Unknown'
  } catch {
    return 'Unknown'
  }
}
export const clickSchema = z
  .object({
    eventId: z.string().uuid(),
    linkId: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,29}$/),
    clickedAt: z.iso.datetime(),
    userAgent: z.string().max(512),
    referrer: z.string().max(300),
    country: z.string().max(7),
    ipHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
  })
  .strict()
export function captureClick(code, headers, now = new Date()) {
  const domain = referrerDomain(headers.get('referer'))
  return {
    eventId: randomUUID(),
    linkId: code,
    clickedAt: now.toISOString(),
    userAgent: (headers.get('user-agent') || '').slice(0, 512),
    referrer: domain === 'Unknown' ? '' : `https://${domain}`,
    country:
      process.env.VERCEL === '1' &&
      /^[A-Z]{2}$/.test(headers.get('x-vercel-ip-country') || '')
        ? headers.get('x-vercel-ip-country')
        : 'Unknown',
    ipHash: hashIP(headers.get('x-forwarded-for')?.split(',')[0]?.trim()),
  }
}
const bounded = (value, choices) =>
  choices.includes(value) ? value : 'Unknown'
export function enrichClick(input) {
  const event = clickSchema.parse(input)
  const ua = new UAParser(event.userAgent).getResult()
  return {
    eventId: event.eventId,
    linkId: event.linkId,
    clickedAt: new Date(event.clickedAt),
    ipHash: event.ipHash,
    country: /^[A-Z]{2}$/.test(event.country) ? event.country : 'Unknown',
    device:
      ua.device.type === 'mobile'
        ? 'mobile'
        : ua.device.type === 'tablet'
          ? 'tablet'
          : event.userAgent
            ? 'desktop'
            : 'Unknown',
    browser: bounded(ua.browser.name, [
      'Chrome',
      'Mobile Chrome',
      'Firefox',
      'Mobile Firefox',
      'Safari',
      'Mobile Safari',
      'Edge',
      'Opera',
      'Samsung Internet',
    ]),
    operatingSystem: bounded(ua.os.name, [
      'Windows',
      'macOS',
      'iOS',
      'Android',
      'Linux',
      'Ubuntu',
      'Chrome OS',
    ]),
    referrerDomain: referrerDomain(event.referrer),
    isBot: isBotUserAgent(event.userAgent),
  }
}
export function utcDay(date) {
  return new Date(new Date(date).toISOString().slice(0, 10) + 'T00:00:00.000Z')
}
export function trafficColumn(traffic) {
  return traffic === 'all'
    ? 'totalClicks'
    : traffic === 'bot'
      ? 'botClicks'
      : 'humanClicks'
}
