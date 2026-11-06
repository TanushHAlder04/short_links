import { reportFailure } from '../monitoring.js'
import { inngest } from './client.js'
import { logger } from '../logger.js'
import * as redisModule from '../redis.js'

export const FALLBACK_BUFFER_KEY = 'analytics:buffer:failed_clicks'

function getRedisClient(customClient) {
  if (customClient !== undefined) return customClient
  try {
    return redisModule.redis || null
  } catch {
    return null
  }
}

export async function publishClick(data, client = inngest, redisClient) {
  const started = Date.now()
  try {
    await client.send({ id: data.eventId, name: 'link/clicked', data })
    logger.info('analytics.accepted', {
      eventId: data.eventId,
      durationMs: Date.now() - started,
    })
  } catch (error) {
    logger.error('analytics.publication_failed', error, {
      eventId: data.eventId,
    })
    await reportFailure('analytics.publication_failed')
    const rClient = getRedisClient(redisClient)
    if (rClient && typeof rClient.rpush === 'function') {
      try {
        await rClient.rpush(FALLBACK_BUFFER_KEY, JSON.stringify(data))
        logger.info('analytics.buffered_to_redis', { eventId: data.eventId })
      } catch (bufferError) {
        logger.error('analytics.buffer_failed', bufferError, {
          eventId: data.eventId,
        })
      }
    }
  }
}

export async function invalidateCommittedLink(code, version) {
  try {
    await redisModule.cacheDel(code, version)
  } catch (error) {
    logger.error('cache.invalidation_failed', error, { shortCode: code })
    try {
      await inngest.send({
        name: 'link/cache.invalidate',
        data: { shortCode: code, version },
      })
    } catch (sendError) {
      logger.error('cache.retry_publication_failed', sendError, {
        shortCode: code,
      })
    }
  }
}
