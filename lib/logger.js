// lib/logger.js
// Production-ready lightweight structured JSON logging to stdout.
// Seamlessly parsed by Vercel Log Drains, Datadog, AWS CloudWatch, and GCP Logging.

export const logger = {
  info(message, context = {}) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...context,
    }))
  },

  warn(message, context = {}) {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      ...context,
    }))
  },

  error(message, error, context = {}) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.message || String(error),
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      ...context,
    }))
  },
}
