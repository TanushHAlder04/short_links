import { describe, it, expect, vi } from 'vitest'
import { checkUniqueVisitor, storeClick } from '../lib/services/analytics.js'
import { publishClick, FALLBACK_BUFFER_KEY } from '../lib/inngest/publish.js'

describe('Unique Visitor Tracking', () => {
  it('deduplicates visitors using Redis HyperLogLog when available', async () => {
    const pfadd = vi.fn()
      .mockResolvedValueOnce(1) // first daily: new
      .mockResolvedValueOnce(1) // first lifetime: new
      .mockResolvedValueOnce(0) // second daily: seen
      .mockResolvedValueOnce(0) // second lifetime: seen
    const expire = vi.fn().mockResolvedValue(1)
    const mockRedis = { pfadd, expire }

    const click1 = { linkId: 'abc1234', ipHash: 'hash-abc', isBot: false }
    const res1 = await checkUniqueVisitor(click1, new Date('2026-11-04T00:00:00Z'), mockRedis)
    expect(res1).toEqual({ isDailyUnique: true, isLifetimeUnique: true })
    expect(pfadd).toHaveBeenCalledWith('hll:daily:abc1234:2026-11-04', 'hash-abc')
    expect(pfadd).toHaveBeenCalledWith('hll:lifetime:abc1234', 'hash-abc')

    const res2 = await checkUniqueVisitor(click1, new Date('2026-11-04T00:00:00Z'), mockRedis)
    expect(res2).toEqual({ isDailyUnique: false, isLifetimeUnique: false })
  })

  it('never counts bot traffic or unhashed IPs as unique visitors', async () => {
    const pfadd = vi.fn()
    const mockRedis = { pfadd }

    const botClick = { linkId: 'abc1234', ipHash: 'hash-bot', isBot: true }
    expect(await checkUniqueVisitor(botClick, new Date(), mockRedis)).toEqual({
      isDailyUnique: false,
      isLifetimeUnique: false,
    })
    expect(pfadd).not.toHaveBeenCalled()

    const noIpClick = { linkId: 'abc1234', ipHash: null, isBot: false }
    expect(await checkUniqueVisitor(noIpClick, new Date(), mockRedis)).toEqual({
      isDailyUnique: false,
      isLifetimeUnique: false,
    })
  })

  it('falls back to database queries when Redis is unavailable', async () => {
    const mockTx = {
      clickEvent: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null) // no prior daily
          .mockResolvedValueOnce(null) // no prior lifetime
      },
    }
    const click = { linkId: 'code1', ipHash: 'ip123', eventId: 'evt1', isBot: false }
    const res = await checkUniqueVisitor(click, new Date('2026-11-04T12:00:00Z'), null, mockTx)
    expect(res).toEqual({ isDailyUnique: true, isLifetimeUnique: true })
    expect(mockTx.clickEvent.findFirst).toHaveBeenCalledTimes(2)
  })
})

describe('Durable Click Ingestion Buffer', () => {
  it('buffers event to Redis list when Inngest send fails', async () => {
    const mockInngest = {
      send: vi.fn().mockRejectedValue(new Error('Inngest 503 Service Unavailable')),
    }
    const rpush = vi.fn().mockResolvedValue(1)
    const mockRedis = { rpush }

    const event = { eventId: 'event-uuid-1', linkId: 'mycode' }
    await publishClick(event, mockInngest, mockRedis)

    expect(mockInngest.send).toHaveBeenCalledTimes(1)
    expect(rpush).toHaveBeenCalledWith(FALLBACK_BUFFER_KEY, JSON.stringify(event))
  })
})

