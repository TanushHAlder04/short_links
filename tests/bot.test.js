import { describe, it, expect } from 'vitest'
import { isBotUserAgent } from '../lib/analytics'

describe('Bot & Crawler Filtering (lib/analytics.js)', () => {
  it('should identify popular bots and link crawlers', () => {
    expect(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
    expect(isBotUserAgent('Twitterbot/1.0')).toBe(true)
    expect(isBotUserAgent('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)')).toBe(true)
    expect(isBotUserAgent('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)')).toBe(true)
    expect(isBotUserAgent('LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient)')).toBe(true)
  })

  it('should return false for regular browser User-Agents', () => {
    expect(isBotUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')).toBe(false)
    expect(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')).toBe(false)
  })

  it('should return false for missing or null User-Agent', () => {
    expect(isBotUserAgent(null)).toBe(false)
    expect(isBotUserAgent(undefined)).toBe(false)
    expect(isBotUserAgent('')).toBe(false)
  })
})
