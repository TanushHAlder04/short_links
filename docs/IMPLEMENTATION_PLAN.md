# Implementation record

Baseline: clean working tree at 4d0fbf6. 92 tests / 14 suites passed before changes.

1. Audit: schema/migrations, all route handlers, shared services, UI flows, tests, CI and environment template reviewed. Existing problems: local Bloom filters, seven-character new codes, per-redirect rate-limit Redis call, direct analytics writes/external geo, raw-row dashboard queries, no tombstones/idempotency/aggregates/delivery records. Cached secrets and dangerous OAuth email linking also found.
2. Data and creation: additive migration; eight-character insert/retry; scoped request idempotency; deletion tombstones; duplicate preflight.
3. Cache and redirects: cache-aside, negative cache, bounded jittered TTL, version barrier for stale fills, Inngest invalidation retry, explicit 302/404/410/503. Central rate policies.
4. Background processing: validated Inngest events, transactional event deduplication and aggregates, persistent retried signed webhooks, gated batched retention/backfill.
5. Product/API: duplicate choice, on-demand QR, consistent traffic filters, owner-only management, CSV and request security.
6. Verification/docs: real disposable PostgreSQL, Vitest/RTL, Playwright, coverage baseline, k6 scripts, CI/CodeQL/Dependabot/audit, ADRs and walkthrough.

No production migrations, pushes, deployments or infrastructure changes are authorized. Existing data and seven-character codes must remain. Local disposable PostgreSQL only for destructive tests. GitHub workflow execution and staging performance are reported separately from local tests.

## Phase results

- Creation/schema: additive migration applied to isolated PostgreSQL 18;37 focused checks passed.
- Cache/redirect:18 focused checks passed, including stale-fill race and outage semantics.
- Analytics/webhook/retention: real PostgreSQL concurrency/rollback/retention integration passed; local Inngest retry and duplicate recovery passed.
- Frontend/API: component tests and critical Chromium/API flow passed; fixed build-time test origin and moved test server to3100 to avoid user's occupied3000.
- Verification/docs:121 combined tests and 3 E2E scenarios passed; schema valid with no drift; build passed; workflows validated locally with actionlint; no hosted benchmark or remote Actions execution claimed. Whole-app coverage baseline/floors and open audit findings are documented.

- Follow-on exports: shared owner-authorized CSV/PDF report service, UTC date controls, bounded raw/aggregate downloads and vector PDF reports. Combined 148 tests and four browser scenarios passed; details and measured local benchmarks are in TESTING.md.
