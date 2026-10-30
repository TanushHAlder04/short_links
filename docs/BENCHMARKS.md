# Reproducible staging benchmarks

Only k6 is used. No performance traffic was sent to production or staging during implementation. `k6 inspect` validated the scenario configuration.
## Setup and run

Provision an explicitly approved isolated staging deployment and dedicated database/Redis/Inngest resources. Set `STAGING_URL=https://...`, matching `STAGING_HOST`, and `CONFIRM_STAGING=yes`. The script refuses the known production host. Create a dedicated account/API key, a signed-in session cookie, an active HOT_CODE and a list of distinct COLD_CODES. Warm HOT_CODE; remove only the cold codes' cache entries from **staging Redis** before the run. Retain version floors. Never clear a shared or production Redis database.

```sh
k6 run --summary-export reports/k6.json load-test/staging.js
```

Additional environment: `API_KEY`, `SESSION_COOKIE` (full cookie header), `HOT_CODE`, comma-separated `COLD_CODES`. No secrets belong in source control or uploaded logs. Created benchmark links consume real staging storage; retire them through normal owner APIs after the run.

Scenarios: five concurrent hot-code visitors for 30s; one repeated absent-code visitor for 15s; one visit per preconfigured cold code; three authenticated API creations; one two-row CSV import. Each loop sleeps to respect the free-tier quotas. Raise concurrency/duration only after checking staging quotas. No bypass of production rate policies is installed.

The cache-hit and cold labels are *candidates*, not proof. Correlate `cache.hit`, `cache.miss`, `redirect.database_fallback` and `redirect.completed` structured logs during the exact run. Compute cache hit rate as hits/(hits+misses), separately identifying negative hits where needed by the scenario/code. Record Redis/PG errors and rate rejections. The script uses no response header that exposes cache internals to visitors.

Valid redirects also invoke the actual analytics publication path. `analytics.accepted.durationMs` measures Inngest acceptance latency; `analytics.processed.delayMs` measures timestamp-to-processing lag. Collect p50/p95/p99 from those logs and Inngest's run view. HTTP redirect duration cannot by itself measure background completion. If events are lost before acceptance, include that count/uncertainty in the report.

## Report template

| Field | Record for every run |
| --- | --- |
| Commit/environment | Staging origin, commit, Vercel region, instance/runtime |
| Dependencies | Supabase, Redis, Inngest regions and plans |
| Generator | k6 version, runner region/hardware/network |
| Load | Duration, VUs/concurrency, scenario request counts |
| Throughput | Requests/second per scenario |
| Latency | p50 (med), p95, p99 per scenario |
| Errors | Nonexpected statuses, transport failures, 429/503 rates |
| Cache | Verified hit rate and DB fallback rate from logs |
| Background | Acceptance latency, processing delay, publication/worker failures |
| Cost | Quotas used, DB growth, function invocations |

Aspirational same-region goals: cache-hit redirect p95 below 50ms and creation p95 below 200ms. These are goals, not current measurements. TLS, cold starts, geography and free-tier behavior materially affect them. Compare repeated like-for-like runs; do not add variable network performance to blocking PR CI.

The optional staging workflow is manual/weekly and skips unless `ENABLE_STAGING_CHECKS=true`. Configure the `staging` environment, STAGING_URL/HOST/HOT_CODE/COLD_CODES variables and STAGING_API_KEY/STAGING_SESSION_COOKIE secrets. Optional TEST_UPSTASH_URL/TOKEN must reference a dedicated test database. Environment approval rules can protect these jobs. No staging credentials were available or requested merely to fabricate benchmark results.
