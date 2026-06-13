// lib/analytics.js
// Async click analytics recorder — fire-and-forget pattern.
// Records click events to PostgreSQL without blocking the redirect response.
//
// [KAFKA-READY]: In a production high-scale system, replace the direct DB write
// with a Kafka producer:
//   producer.send({ topic: 'click-events', messages: [{ value: JSON.stringify(clickData) }] })
// A separate consumer service would then batch-insert into PostgreSQL/ClickHouse.
// This decouples write-heavy analytics from read-heavy redirects.

import { prisma } from './prisma'
import { createHash } from 'crypto'

/**
 * Parse User-Agent string using ua-parser-js.
 * Returns { browser, os, device }
 */
async function parseUserAgent(ua) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'desktop' }

  try {
    const { UAParser } = await import('ua-parser-js')
    const parser = new UAParser(ua)
    const result = parser.getResult()

    const browser = result.browser.name || 'Unknown'
    const os = result.os.name || 'Unknown'

    let device = 'desktop'
    if (result.device.type === 'mobile') device = 'mobile'
    else if (result.device.type === 'tablet') device = 'tablet'

    return { browser, os, device }
  } catch {
    return { browser: 'Unknown', os: 'Unknown', device: 'desktop' }
  }
}

/**
 * Fetch geo data from ip-api.com (free, no API key for <45 req/min).
 * Returns { country, city }
 * [PRODUCTION]: Replace with MaxMind GeoIP2 database for self-hosted, rate-limit-free geo lookup.
 */
async function getGeoData(ip) {
  if (!ip || ip === '::1' || ip === '127.0.0.1') {
    return { country: 'Local', city: 'Localhost' }
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,status`, {
      signal: AbortSignal.timeout(2000), // 2s timeout max
    })
    if (!res.ok) return { country: null, city: null }
    const data = await res.json()
    if (data.status === 'success') {
      return { country: data.country, city: data.city }
    }
  } catch {
    // Silently fail — geo is non-critical
  }
  return { country: null, city: null }
}

/**
 * Hash an IP address for privacy (one-way, cannot be reversed).
 * @param {string} ip
 * @returns {string} SHA-256 hex hash
 */
function hashIP(ip) {
  if (!ip) return null
  return createHash('sha256').update(ip + process.env.IP_HASH_SALT || 'shortlinks-salt').digest('hex').slice(0, 16)
}

/**
 * Record a click event asynchronously.
 * This function is intentionally fire-and-forget — it does NOT throw.
 * Call it without await in the redirect handler.
 *
 * @param {object} params
 * @param {string} params.shortCode
 * @param {string|null} params.ip
 * @param {string|null} params.userAgent
 * @param {string|null} params.referrer
 */
export function recordClick({ shortCode, ip, userAgent, referrer }) {
  // Fire and forget — [KAFKA-READY]: swap the body below with a Kafka producer.send()
  Promise.all([
    parseUserAgent(userAgent),
    getGeoData(ip),
  ]).then(async ([uaData, geoData]) => {
    await prisma.$transaction([
      // Insert click record
      prisma.click.create({
        data: {
          shortCode,
          ipHash: hashIP(ip),
          country: geoData.country,
          city: geoData.city,
          device: uaData.device,
          browser: uaData.browser,
          os: uaData.os,
          referrer: referrer || null,
        },
      }),
      // Atomically increment click counter on Url
      prisma.url.update({
        where: { shortCode },
        data: { clickCount: { increment: 1 } },
      }),
    ])
  }).catch((err) => {
    // Never crash the redirect — analytics are non-critical
    console.error('[analytics] Failed to record click:', err)
  })
}
