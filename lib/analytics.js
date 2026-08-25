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
import { createHash, createHmac } from 'crypto'

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
 * Detect if User-Agent belongs to a known crawler or bot.
 * 
 * [MAINTENANCE TRADE-OFF]: Uses a curated regular expression to identify prominent
 * search engines, social media previews, and automated HTTP clients without introducing
 * external runtime dependencies. For higher precision against emerging crawlers, consider
 * the maintained `isbot` package.
 *
 * @param {string|null} ua
 * @returns {boolean}
 */
export function isBotUserAgent(ua) {
  if (!ua) return false
  const botPattern = /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|twitterbot|facebookexternalhit|slackbot|discordbot|linkedinbot|whatsapp|telegram/i
  return botPattern.test(ua)
}

/**
 * Hash an IP address for privacy (one-way, cannot be reversed).
 * @param {string} ip
 * @returns {string} SHA-256 hex hash
 */
export function hashIP(ip) {
  if (!ip) return null
  return createHash('sha256').update(ip + (process.env.IP_HASH_SALT || 'shortlinks-salt')).digest('hex').slice(0, 16)
}

/**
 * Trigger milestone webhook when link reaches click thresholds (e.g. every 10 clicks).
 * 
 * [WEBHOOK SPECIFICATION FOR CONSUMERS]:
 * - Method: POST
 * - Content-Type: application/json
 * - Header: `X-ShortLinks-Signature: sha256=<hex_hmac>` (computed via HMAC-SHA256 of raw JSON body with webhookSecret)
 * - Payload: { "event": "click_milestone", "shortCode": "abc1234", "clickCount": 10, "timestamp": "ISO-8601" }
 */
async function triggerMilestoneWebhook(urlRecord, clickCount) {
  if (!urlRecord?.webhookUrl) return
  if (clickCount % 10 !== 0) return // Trigger every 10th click milestone

  try {
    const payload = JSON.stringify({
      event: 'click_milestone',
      shortCode: urlRecord.shortCode,
      clickCount,
      timestamp: new Date().toISOString(),
    })

    const headers = { 'Content-Type': 'application/json' }
    if (urlRecord.webhookSecret) {
      const signature = createHmac('sha256', urlRecord.webhookSecret)
        .update(payload)
        .digest('hex')
      headers['X-ShortLinks-Signature'] = `sha256=${signature}`
    }

    await fetch(urlRecord.webhookUrl, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(3000),
    })
  } catch (err) {
    console.error('[webhook] Failed to trigger milestone webhook:', err)
  }
}

/**
 * Record a click event asynchronously.
 * Flag bots, record analytics, and trigger webhooks without blocking redirects.
 *
 * @param {object} params
 * @param {string} params.shortCode
 * @param {string|null} params.ip
 * @param {string|null} params.userAgent
 * @param {string|null} params.referrer
 */
export function recordClick({ shortCode, ip, userAgent, referrer }) {
  const isBot = isBotUserAgent(userAgent)

  Promise.all([
    parseUserAgent(userAgent),
    getGeoData(ip),
  ]).then(async ([uaData, geoData]) => {
    // 1. Insert click record with isBot flag
    await prisma.click.create({
      data: {
        shortCode,
        ipHash: hashIP(ip),
        country: geoData.country,
        city: geoData.city,
        device: uaData.device,
        browser: uaData.browser,
        os: uaData.os,
        referrer: referrer || null,
        isBot,
      },
    })

    // 2. If non-bot click, update URL click counter and check webhooks
    if (!isBot) {
      const updatedUrl = await prisma.url.update({
        where: { shortCode },
        data: { clickCount: { increment: 1 } },
        select: { shortCode: true, clickCount: true, webhookUrl: true, webhookSecret: true },
      })

      // 3. Trigger milestone webhooks if configured
      if (updatedUrl.webhookUrl) {
        triggerMilestoneWebhook(updatedUrl, updatedUrl.clickCount).catch(() => {})
      }
    }
  }).catch((err) => {
    // Never crash the redirect — analytics are non-critical
    console.error('[analytics] Failed to record click:', err)
  })
}
