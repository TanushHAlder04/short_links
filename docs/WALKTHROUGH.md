# ShortLinks: Project walkthrough

## 1. The Architecture

React 19 manages interactive components, state and effects. Next.js 16 wraps React with routing, server rendering, API handlers and background lifecycle support. PostgreSQL/Supabase through Prisma 7 stores durable business records. Redis is a disposable acceleration/rate-limit layer. Inngest handles accepted background events and retries.

```text
Create -> validate/auth/limit -> PostgreSQL INSERT -> Redis warm -> result
Visit -> Redis or PostgreSQL -> status/device choice -> HTTP302
                                     -> after(): Inngest acceptance
Inngest -> unique raw event + permanent aggregates in one transaction
        -> persistent milestone -> separate signed webhook workflow
```

This keeps visitor redirects independent of analytics writes and receiver latency.

## 2. Where to read the code

| Concern | Files |
| --- | --- |
| Creation/ownership | `lib/services/links.js`, `lib/shortcode.js`, `lib/idempotency.js` |
| Validation/auth/quotas | `lib/link-validation.js`, `lib/request.js`, `lib/identity.js`, `lib/ratelimit.js` |
| Redirect/cache | `app/[shorturl]/route.js`, `lib/services/redirects.js`, `lib/redis.js` |
| Capture/counting | `lib/analytics.js`, `lib/services/analytics.js` |
| Jobs | `lib/inngest/client.js`, `functions.js`, `publish.js`, `app/api/inngest/route.js` |
| Webhooks | `lib/webhooks.js`, `lib/services/deliveries.js`, owner webhook route |
| Historical data | `lib/services/backfill.js`, `retention.js`, `scripts/backfill-analytics.mjs` |
| Dashboard queries | `lib/services/queries.js`, analytics/list routes |
| UI | `app/shorten/page.js`, dashboard pages, `DuplicateChoice`, `TrafficFilter`, `LinkEditor`, `WebhookDeliveries` |
| Schema | `prisma/schema.prisma`, additive migration |
| Verification | `tests/`, three Vitest configs, Playwright config, `.github/` |


## 3. Dependencies

Added Inngest SDK4, Zod payload validation, optional Sentry server reporting, Playwright, React Testing Library, jsdom and Vitest V8 coverage. Kept Vitest, NextAuth4 database sessions, Prisma 7 PostgreSQL adapter, Upstash, NanoID, UAParser, Chart.js and QR generation. Prisma CLI is declared as development tooling, although npm's peer dependency graph still includes it in audit reporting.

Compatible updates resolved critical Next.js/NextAuth advisories. The verified build used Next.js 16.3.6 and Prisma 7.10.0 (lockfile is authoritative). Four high upstream Prisma-toolchain findings remain; see TESTING. No forced Prisma downgrade or prohibited infrastructure/tool was added. k6 remains the only benchmark runner.

## 5. Database changes

The migration adds `deletedAt`, `desktopUrl`, `normalizedUrl`, and `version` to Url. New tables: ClickEvent, LinkLifetimeStats, LinkDailyStats, LinkDailyDimension, CreationRequest, WebhookDelivery, MigrationProgress. Users, accounts, sessions, links, aliases and legacy Click rows are preserved. `linkId` in analytics references immutable `shortCode`.

Existing raw clicks are copied in batches with deterministic legacy event IDs. Counts are reconciled before the cleanup gate is set. No destructive production migration or automatic db push occurs. See [migration order and rollback](ARCHITECTURE.md#migration-and-rollback).

## 6. Environment 

- `DATABASE_URL`: runtime PostgreSQL connection; `DIRECT_URL`: migration-capable connection.
- `NEXTAUTH_URL`: canonical login origin; `NEXT_PUBLIC_HOST`: short-link origin embedded at build time. Rebuild after changing it.
- `NEXTAUTH_SECRET`, `IP_HASH_SALT`: independent random secrets, at least 32 characters.
- Google/GitHub provider IDs and secrets: OAuth configuration. Register each exact callback URL.
- Upstash REST URL/token: cache and distributed protection.
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`: production event acceptance and signed job endpoint. Local-only `INNGEST_DEV=1` connects to the Dev Server.
- Optional `SENTRY_DSN`; optional centralized RATE_LIMIT overrides.



## 7. Creation flow

Anonymous users may shorten directly. Signed-in users first see their own normalized matches and explicitly reuse one or create another. API-key clients create directly. OAuth creates the account on first provider login; subsequent login uses the existing account/session. A separate password registration flow is intentionally absent.

New random links use secure eight-character NanoID. PostgreSQL's unique constraint decides collisions; five bounded INSERT retries replace probabilistic filters. Custom-alias conflict returns409. Existing seven-character links are unchanged, and duplicate destinations remain allowed.

Authenticated `Idempotency-Key` reserves a fingerprint/result in the link transaction. Same key/same payload replays the result for 24h; changed payload conflicts. Keys are scoped to user or API-key identity. UI double-submit protection is a ref guard plus a retry-stable key. QR generation happens only when requested via qrUrl.

## 8. Redirect flow

The resolver GETs Redis, falls back to indexed PostgreSQL on a miss, checks active/deleted/expiry, and chooses iOS/Android/desktop or the primary URL. It returns302 explicitly. Missing returns404; expired/inactive/deleted returns410; dependency failure without usable cache returns503.

Before returning, it copies bounded privacy-safe click data and creates the event UUID. `after(async () => await publishClick(...))` sends it to Inngest. No analytics DB transaction, bot parsing, external geo, QR work or webhook network call blocks the redirect.

## 9. Cache decisions

Positive TTL is at most 24h with downward5% jitter and capped by link expiry. Missing codes get 45s. Hits do not renew TTL. Mutation commits PostgreSQL first, increments version, then atomically raises a cache version floor and deletes. Stale in-flight fills below that version are rejected. Deletion failures get an Inngest retry; if both layers fail, TTL is the final protection.

Redis can disappear without losing links. Valid cached redirects survive a database outage. Version metadata has a25h TTL; very old fills are rejected after 10s, and Redis HTTP operations have a1.5s abort. Cross-service windows and evicted metadata remain documented consistency limits. Cache stampede locks are deferred until measured fallback spikes justify them.

## 10. Analytics and idempotency

Inngest validates/enriches the event and performs one transaction: unique raw insert, lifetime increment, UTC daily increment, five dimensional increments, new human milestone delivery if due. A duplicate raw insert is a successful no-op. A later aggregate error rolls the raw event back too.

IP is HMAC-hashed, never stored raw; missing salt stores no hash. Full referrer paths and queries are stripped before publication. Country uses trusted Vercel headers or Unknown; no external geo request remains. Browser/OS/device values are bounded and referrer aggregate cardinality is capped per link/day. Human/all/bot filters select consistent columns everywhere. Raw rows expire after90d, while permanent aggregates remain.

## 11. Webhook flow

Each ten human clicks produces at most one `(linkId,milestone)` delivery row. Another Inngest function delivers it, with a database lease, per-delivery concurrency, five attempts and exponential sleeps. A recovery sweep finds pending dispatch gaps. Failed rows remain visible and owners can retry them.

Signature includes timestamp and exact payload; headers include event identity and idempotency key. Public HTTPS443 only, all DNS answers validated and the chosen address pinned, no redirect following,3s timeout, no response body read. Receivers must validate HMAC and deduplicate; exactly-once network delivery cannot be guaranteed. The strengthened signature is a receiver compatibility change.

## 12. Failure behavior

| Failure | Behavior |
| --- | --- |
| Redis unavailable | DB fallback; session management warns/continues; anonymous/API writes503 |
| PostgreSQL unavailable | Valid cache still302; cache miss/management503 |
| Inngest publication unavailable | Redirect continues; pre-acceptance event may be lost |
| Worker failure | Inngest retries; event uniqueness prevents double counting |
| Webhook unavailable | Click remains committed; persisted retries/failed status |
| Monitoring unavailable | Application continues |

Analytics can take several seconds to appear. Priority is redirects, durable links, management, analytics, then webhooks.

## 13. Security changes

Removed email-only OAuth auto-linking and secret-bearing link/cache responses. Private routes enforce ownership, session writes enforce Origin, bodies are byte-bounded, destinations reject credentials and bad schemes, deletion permanently reserves codes, API keys stay hashed, CSV exports neutralize formulas, and structured logs whitelist safe fields. Failed database/service responses are generic503 rather than exposing internals. Optional Sentry records failure codes only. Webhook validation is applied at save and delivery.

## 14. Tests

Tests now exercise production services, not copied redirect functions. Real PostgreSQL verifies concurrency, unique constraints, rollback and aggregates. The cache boundary fake tests TTL, negatives, failures and stale-fill rejection. Component tests cover choices/filter/retry. Seeded-session Playwright covers critical API/UI flows, and local Inngest demonstrates both duplicate suppression and actual retry recovery.

## 15. Commands and observed results

| Command/check | Observed result |
| --- | --- |
| Original `npm test` |92 tests /14 suites passed |
| Focused creation/validation checks |37 passed |
| Focused cache/creation checks |18 passed |
| `npm run test:coverage` |148 tests /20 suites passed, including 12 real-DB tests |
| `npm run test:e2e` |3 passed, including Chromium and local Inngest |
| `npx prisma migrate deploy` |Both tracked migrations applied only to disposable PostgreSQL |
| `npx prisma validate` |Passed |
| `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` |No difference |
| `npm run build` |Passed, Next.js 16.3.6 |
| `npm run lint` |Passed after final formatting |
| `actionlint -shellcheck=` |Passed with actionlint 1.7.12; shellcheck unavailable |
| `k6 inspect -e CONFIRM_STAGING=yes -e STAGING_URL=https://staging.example.test -e STAGING_HOST=staging.example.test load-test/staging.js` |Configuration valid; no traffic sent |
| `npm run audit:report` |4 high,0 critical; upstream toolchain review remains |

Whole-app coverage is43.74% lines/44.93% statements/47.57% branches, with core services roughly 92% lines. Meaningful floors now prevent regressions;80%/75% remains the gradual target. Browser execution is not included in V8 percentages. Earlier failed checks exposed test-origin configuration and a JSX coverage transform issue; both were corrected rather than ignored.

## 16. Actual GitHub Actions status

CI, CodeQL and optional staging workflows are tracked; Dependabot is configured. Local workflow validation passed. Remote access did not provide an inspectable run, and nothing was pushed. **Workflow created and locally validated, but not remotely executed.** No successful remote workflow is claimed.

## 17. Benchmarks

[Benchmark methodology](BENCHMARKS.md) covers hot/cold/negative redirects, creation, concurrent visitors, CSV and background publication/processing measurements. Guarded k6 scripts and a manual/opt-in scheduled workflow are supplied. No staging resources/credentials were used; there are no fabricated RPS or latency results. Same-region p95<50ms redirect and<200ms creation are goals only.

## 18. Known limitations and accepted trade-offs

Pre-Inngest acceptance loss remains possible. Human detection is heuristic. Aggregate writes cost several PostgreSQL operations per click and serialize on a hot link; quotas still matter. Retention removes raw deduplication history, so very late events are ignored. Idempotency lasts24h. Tombstones and aggregates grow permanently. A recovered cache may briefly be stale if invalidation/publication both fail. Full OAuth/cloud-service integration and staging performance remain operational checks. Whole-app coverage remains below target. Four upstream audit findings remain open. No claim of unlimited free-tier capacity is made.

## 19. Deployment checklist

1. Review migration and signature changes; back up/rehearse on restored staging.
2. Fix/verify Supabase Connect values, both OAuth callbacks and runtime secrets; run env:check and read-only db:check against the intended environment.
3. Set the correct NEXT_PUBLIC_HOST **before build**; verify canonical NEXTAUTH_URL.
4. Apply additive migrations with the migration connection, generate Prisma, deploy the new writer/reader and drain old writers.
5. Register `/api/inngest`, event/signing keys and workflows; remove INNGEST_DEV. Verify endpoint signing and a test event in staging.
6. Normalize old links, backfill legacy clicks, reconcile with --validate; inspect permanent counts before retention begins.
7. Coordinate webhook receiver signature updates/secrets; test retry/deduplication.
8. Run real staging OAuth, dedicated Redis smoke, browser/API checks and k6 with approved quotas; inspect errors and delays.
9. Review remaining dependency advisories and the actual remote CI result before release.

No step touching production was executed here.

## 20. Rollback considerations

Retain additive tables and tombstones. Pause jobs if necessary; favor a forward fix. Old code cannot correctly see new analytics-only writes or tombstones, so a rollback needs compatibility handling and data reconciliation. Never reassign codes or drop aggregates. Once raw retention runs, only backups can restore deleted detail. A production restore or destructive schema rollback requires a separate explicit decision.

## 21. Interview explanation and future evolution

**Why PostgreSQL?** Its unique constraints and transactions settle concurrency and preserve durable truth. **Why Redis?** It accelerates reads but can be lost and rebuilt. **TTL versus invalidation versus eviction?** TTL limits age, invalidation responds to known changes, eviction manages memory; none replaces the others.

**Why remove Bloom filters?** Unsynchronized ephemeral filters cannot guarantee absence or uniqueness. The database already supplies correctness and negative caching cheaply handles repeated misses. **Why Inngest?** It separates visitor latency from accepted background retries with less operational work than maintaining a queue/worker fleet. **Why eventually consistent analytics?** Returning the redirect before processing makes the dashboard lag intentionally. **How is counting effectively once?** Only the winning eventId insert updates aggregates in the same transaction.

Kafka, ClickHouse and Kubernetes would introduce operating cost without measured need. Track redirect latency, cache hit/fallback rates, write contention, queue delay, errors and quota consumption. Add cache-refresh coordination only for measured stampedes; regional durable capture for unacceptable pre-acceptance loss; specialized analytics storage for PostgreSQL query/write limits; containerized or distributed infrastructure only when operating requirements justify it. These are scaling triggers, not installed components.


## Analytics CSV and shareable PDF reports

1. **Choose the scope.** On the account dashboard, choose all owned links or one link. On a link page, the current code is already selected. Human/bot/all traffic comes from the dashboard's existing filter. Date presets cover 7, 30 or 90 days; custom ranges support up to 366 days, including historical periods.
2. **Understand the numbers.** Every selected-period number comes from the same aggregate report service. The link page keeps a separately labeled lifetime count. Human-only reports exclude bots from every breakdown and show zero bot clicks; all-traffic reports show both. Daily buckets, metadata and generated timestamps explicitly use UTC.
3. **Choose CSV data.** Links export destinations and period counts; daily export gives one row per stored link/day; dimensions export gives one row per stored link/day/value. Sparse aggregate CSVs omit absent zero rows; PDF trends and daily tables include zero days. Raw mode provides individual retained clicks, without IP hashes or secrets. A request older than the full 90-day window must use aggregates.
4. **Share a PDF.** Download PDF produces a branded report with domain-only destination metadata, summary, daily trend, human/bot and five dimension charts, daily tables and top-50 rankings. It is generated using vector drawing on the server, so dashboard interactivity continues. No browser screenshot, external font call or background export job is needed.
5. **Protect the data.** Server identity determines ownership. The service ignores arbitrary user IDs, returns 404 for another owner's code, caps rows/size, and shares a five-per-minute owner download quota. CSV values are quoted and formula-neutralized. Downloads have private/no-store headers and sanitized names.
6. **Know the tradeoffs.** UTC aggregates cannot reproduce arbitrary local-day boundaries or combined dimension filters. Raw exports reject a partially retained boundary day. PDF labels are shortened and unsupported font glyphs become `?`; CSV preserves Unicode. Ingestion is asynchronous, so a later download can include newly processed clicks. Session exports retain existing fail-open rate-limit behavior when Redis is unavailable.
7. **Verify it.** Unit tests cover escaping, dates, counts, names and PDF creation; real PostgreSQL tests cover ownership, retention, bounds and dashboard equality; Playwright downloads actual CSV/PDF files using a seeded database session. `scripts/benchmark-exports.mjs` uses synthetic fixtures in a guarded local test database; its timings are not production promises. See TESTING for results.

No conversion tracking was added, and no production data or deployment was changed.
