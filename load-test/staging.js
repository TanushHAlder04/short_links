import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'
const base = (__ENV.STAGING_URL || '').replace(/\/$/, '')
if (
  __ENV.CONFIRM_STAGING !== 'yes' ||
  !__ENV.STAGING_HOST ||
  base !== `https://${__ENV.STAGING_HOST}` ||
  __ENV.STAGING_HOST === 'short-links-mlku.vercel.app'
)
  throw Error(
    'Explicit isolated HTTPS staging host required; production is forbidden'
  )
const redirectLatency = new Trend('redirect_latency', true),
  errors = new Rate('scenario_error')
export const options = {
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    hot: { executor: 'constant-vus', vus: 5, duration: '30s', exec: 'hot' },
    negative: {
      executor: 'constant-vus',
      vus: 1,
      duration: '15s',
      exec: 'negative',
    },
    cold: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: Math.max(
        1,
        (__ENV.COLD_CODES || '').split(',').filter(Boolean).length
      ),
      exec: 'cold',
    },
    creation: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 3,
      exec: 'creation',
    },
    csv: { executor: 'shared-iterations', vus: 1, iterations: 1, exec: 'csv' },
  },
}
function redirect(code, status, label) {
  const r = http.get(`${base}/${code}`, {
    redirects: 0,
    tags: { scenario_kind: label },
    responseCallback: http.expectedStatuses(status),
  })
  redirectLatency.add(r.timings.duration, { kind: label })
  errors.add(!check(r, { [`${label} status`]: (x) => x.status === status }))
  sleep(1)
}
export function hot() {
  if (!__ENV.HOT_CODE) throw Error('HOT_CODE required')
  redirect(__ENV.HOT_CODE, 302, 'cache-hit-candidate')
}
export function negative() {
  redirect('benchmark-never-existed', 404, 'negative-cache-candidate')
}
export function cold() {
  const codes = (__ENV.COLD_CODES || '').split(',').filter(Boolean)
  if (!codes.length)
    throw Error(
      'Supply distinct pre-created cold codes, with their staging cache keys removed'
    )
  redirect(codes[__ITER % codes.length], 302, 'database-fallback-candidate')
}
export function creation() {
  if (!__ENV.API_KEY) throw Error('STAGING API_KEY required')
  const r = http.post(
    `${base}/api/generate`,
    JSON.stringify({ url: 'https://example.com/benchmark' }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${__ENV.API_KEY}`,
        'Idempotency-Key': `k6-${Date.now()}-${__VU}-${__ITER}`,
      },
      tags: { scenario_kind: 'creation' },
    }
  )
  errors.add(!check(r, { created: (x) => x.status === 200 }))
  sleep(1)
}
export function csv() {
  if (!__ENV.SESSION_COOKIE)
    throw Error('Staging session cookie required for CSV')
  const r = http.post(
    `${base}/api/links/import`,
    JSON.stringify({
      rows: [
        { url: 'https://example.com/import-one' },
        { url: 'https://example.com/import-two' },
      ],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Cookie: __ENV.SESSION_COOKIE,
        Origin: base,
      },
      tags: { scenario_kind: 'csv' },
    }
  )
  errors.add(!check(r, { imported: (x) => x.status === 200 }))
}
// Redirects also exercise after() publication. Measure acceptance/processing delay from
// correlated staging logs; HTTP latency alone cannot measure background completion.
