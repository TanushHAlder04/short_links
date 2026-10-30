// Only explicit, non-sensitive fields may cross the logging boundary.
const fields = new Set([
  'shortCode',
  'eventId',
  'deliveryId',
  'status',
  'count',
  'durationMs',
  'cache',
  'attempt',
  'code',
  'phase',
  'duplicate',
  'delayMs',
])
function emit(level, message, context = {}) {
  const safe = Object.fromEntries(
    Object.entries(context).filter(
      ([key, value]) =>
        fields.has(key) &&
        ['string', 'number', 'boolean'].includes(typeof value)
    )
  )
  console[level === 'info' ? 'log' : level](
    JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...safe,
    })
  )
}
export const logger = {
  info: (message, context) => emit('info', message, context),
  warn: (message, context) => emit('warn', message, context),
  error: (message, error, context) =>
    emit('error', message, {
      ...context,
      code: error?.code || error?.name || 'ERROR',
    }),
}
