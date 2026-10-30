let clientPromise
// No automatic instrumentation or request attachment: report only a safe event code.
export async function reportFailure(code) {
  if (!process.env.SENTRY_DSN) return
  try {
    clientPromise ||= import('@sentry/node').then((sentry) => {
      sentry.init({
        dsn: process.env.SENTRY_DSN,
        defaultIntegrations: false,
        sendDefaultPii: false,
        tracesSampleRate: 0,
      })
      return sentry
    })
    const sentry = await clientPromise
    sentry.captureMessage(code, 'error')
    await sentry.flush(1000)
  } catch {
    /* Monitoring must never affect application behavior. */
  }
}
