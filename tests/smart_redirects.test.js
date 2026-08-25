import { describe, it, expect } from 'vitest'

describe('Smart Redirect Device Detection', () => {
  const resolveTarget = (userAgent, urlData) => {
    let targetUrl = urlData.originalUrl
    if (userAgent) {
      const ua = userAgent.toLowerCase()
      if ((ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || ua.includes('ios')) && urlData.iosUrl) {
        targetUrl = urlData.iosUrl
      } else if (ua.includes('android') && urlData.androidUrl) {
        targetUrl = urlData.androidUrl
      }
    }
    return targetUrl
  }

  const link = {
    originalUrl: 'https://example.com/fallback',
    iosUrl: 'https://apps.apple.com/app/id123456789',
    androidUrl: 'https://play.google.com/store/apps/details?id=com.example.app',
  }

  it('should redirect iPhone User-Agent to iosUrl', () => {
    const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15'
    expect(resolveTarget(iphoneUA, link)).toBe(link.iosUrl)
  })

  it('should redirect Android User-Agent to androidUrl', () => {
    const androidUA = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 Mobile Safari/537.36'
    expect(resolveTarget(androidUA, link)).toBe(link.androidUrl)
  })

  it('should fall back to originalUrl for desktop or unconfigured platform', () => {
    const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0'
    expect(resolveTarget(desktopUA, link)).toBe(link.originalUrl)
  })
})
