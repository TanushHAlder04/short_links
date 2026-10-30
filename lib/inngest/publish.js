import { reportFailure } from '../monitoring.js'
import { inngest } from './client.js'
import { logger } from '../logger.js'
import { cacheDel } from '../redis.js'
export async function publishClick(data) {
  const started = Date.now()
  try {
    await inngest.send({ id: data.eventId, name: 'link/clicked', data })
    logger.info('analytics.accepted', { eventId: data.eventId, durationMs: Date.now() - started })
  } catch (error) {
    logger.error('analytics.publication_failed', error, {
      eventId: data.eventId,
    })
    await reportFailure('analytics.publication_failed')
  }
}
export async function invalidateCommittedLink(code, version) {
  try {
    await cacheDel(code, version)
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
