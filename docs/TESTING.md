# Testing and verification

## Safe local database

Tests use real PostgreSQL, not Prisma mocks, for constraints, transactions and concurrency. Integration setup checks a loopback/container host and a test database name **before truncating application tables**. Treat that database as disposable. Never tunnel a production database into the test URL. Unit tests do not need credentials; E2E uses a seeded ordinary Session row and cookie, with no production authentication bypass route.

Docker example (PostgreSQL 18):

```sh
docker run --name shortlinks-test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=shortlinks_test -p 127.0.0.1:55432:5432 -d postgres:18
export DATABASE_URL=postgresql://test:test@127.0.0.1:55432/shortlinks_test
export DIRECT_URL=$DATABASE_URL
export TEST_DATABASE_URL=$DATABASE_URL
npx prisma migrate deploy
npx prisma generate
```

PowerShell uses `$env:DATABASE_URL='...'` and `$env:DIRECT_URL=$env:DATABASE_URL`. This implementation was verified using installed PostgreSQL 18 binaries with a separate `.test-data/pg` cluster on 127.0.0.1:55432, not Docker (the Docker daemon was unavailable). No live connection was used.

## Commands

```sh
npm run lint
npm test
npm run test:integration
npm run test:coverage
npx prisma validate
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Coverage combines unit/component and PostgreSQL integration suites. It resets the disposable database; do not run it concurrently with E2E. It includes application pages, components, services and routes. Vite's JSX transform handles the repository's `.js` JSX files so untested pages are not silently excluded. E2E browser coverage is not merged into this V8 report.

For E2E, the public origin is embedded at build time:

```sh
export NEXT_PUBLIC_HOST=http://localhost:3100
export NEXTAUTH_URL=http://localhost:3100
npm run build
# Separate terminal; no Inngest Cloud credentials needed
npx inngest-cli@1.45.1 dev --host 127.0.0.1 -u http://localhost:3100/api/inngest --no-discovery --retry-interval 2
# Original terminal
npm run test:e2e
```

Run `npx playwright install chromium` first (Linux CI uses `--with-deps`). The Playwright web server starts `next start --port 3100`, refuses an already-running server, overrides database/auth/Redis/Inngest settings with isolated values and seeds random test sessions. Port3000 is intentionally left available for normal development. No Google/GitHub credentials are needed for test sessions; actual provider login still needs production configuration.

## What the tests establish

- Unit tests exercise production NanoID generation/collision retry, URL/alias validation, request limits/origin checks, canonical fingerprints, cache TTL/serialization/version race, redirect outcomes, parser privacy, HMAC signing, SSRF/DNS pinning, CSV formula escaping, rate failure policies and awaited publication.
- React Testing Library tests explicit duplicate choices, human/all/bot selection and failed webhook retry UI.
- Real PostgreSQL tests: actual unique-constraint collisions; concurrent idempotency; aliases/tombstones; ownership; duplicate event concurrency; forced aggregate failure rollback; dimensional aggregates; one human milestone; persistent webhook status/retry authorization; full-account search/totals; historical backfill; exact retention boundary with permanent counts preserved.
- Playwright API scenario covers creation, conflicts, ownership, partial CSV, 302/404/410, editing/deactivation/expiry/deletion, failed webhook retry and cross-origin rejection.
- Chromium scenario creates a link, visits its 302, processes analytics using the actual service, sees the dashboard, edits its destination and chooses reuse/new for duplicates.
- Inngest Dev Server scenario sends an event before its link exists, verifies no raw insertion, creates the link and verifies retry recovery. A second delivery with the same eventId leaves the count at one.
- Redis unit tests use a boundary fake; real hosted Redis was not contacted. Dedicated optional smoke checks run only with TEST_UPSTASH credentials and explicit confirmation.

## Recorded results

`npm ci` completed for the core restructure; the subsequent export dependency was installed with `npm install pdf-lib@1.17.1` and the lockfile was updated.

Baseline before restructure: 92 tests in 14 suites passed. Final combined suite: **148 tests in 20 suites passed** (136 unit/component/API + 12 real PostgreSQL tests). Critical Playwright/Inngest suite: **4 passed**. Prisma validation and migration drift comparison passed; two tracked migrations were applied to the disposable database. Production build passed on Next.js 16.3.6; ESLint passed after final formatting.

Measured whole-application V8 coverage after formatting: lines **43.74%**, statements **44.93%**, branches **47.57%**, functions **36.04%**. Core `lib/services` coverage is substantially stronger (91.94% lines, 91.06% statements, 80.08% branches). Large pages and route wrappers executed by Playwright are not credited in V8. The requested 80% lines/statements and 75% branches remain a gradual target, not a claimed achievement. CI floors are 38/36/42/29 respectively; raise them as useful tests land and never hide files to inflate coverage. No numeric pre-change coverage baseline was captured.

Expected test logs include intentional database foreign-key failure, unavailable Redis and duplicate-event suppression. They demonstrate failure paths. Test reports live in ignored `coverage/`, `playwright-report/`, `test-results/`, and `reports/`.

## CI and security status

CI uses a PostgreSQL 18 service, Node 22, npm ci, Prisma generation/validation/migrations/drift, ESLint, unit/components, integration, combined coverage, production build, local Inngest and Chromium. Reports are uploaded even on failure. PR verification uses no hosted credentials.

Actionlint1.7.12 locally validated workflow syntax/expressions with shellcheck disabled (shellcheck was not installed). CodeQL analyzes JavaScript/TypeScript and Actions; Dependabot watches npm and workflow actions. Remote Actions could not be inspected through the available access. **Workflows created and locally validated, but not remotely executed.** No push was performed.

`npm run audit:report` executes `npm audit --omit=dev` and stores exact JSON without treating every advisory as an automatic deployment block. Compatible updates removed the critical framework/auth findings. Four high dependency-chain findings remain: Prisma, @prisma/config, deepmerge-ts and mysql2. Their reported automatic remediation downgrades Prisma to6; that conflicts with the selected Prisma 7 architecture. MySQL is not used by this application, and recursive untrusted config merging is not an exposed app operation, but the upstream advisories still require tracking/review. They are not described as fixed. ZAP and a Firefox/WebKit matrix remain optional staging work.


## Export verification (2026-09-29)

The final combined suite passed 148 tests. New checks cover formulas (including whitespace-prefixed formulas), CSV delimiters/newlines/Unicode/malformed cells, filename sanitization, date validation, exact UTC boundaries, human/bot/all totals, zero-day averages, empty reports, PDF-safe text and valid PDF structure. PostgreSQL verifies selected-link and account ownership, dashboard/report equality, older permanent aggregates, the exact raw retention boundary and controlled 413 responses. API tests verify owner identity, private attachment headers, MIME type and rate-limit propagation; the actual limiter test verifies owner quota sharing across keys.

All four Playwright/Inngest scenarios passed. The new scenario uses a safe database session, opens link analytics, chooses seven days, downloads CSV and PDF, checks headers/content/signature/size, checks another owner's PDF request returns 404 and verifies the legacy link export. The PDF downloaded through Next.js was independently parsed with pypdf: title, selected code, date range and total matched the saved API expectations. A 13-page benchmark PDF was rendered with PyMuPDF and every page inspected for clipping and pagination. PDF pixel snapshots are not the correctness oracle.

Run the normal unit/integration/browser commands above. For a separate benchmark, explicitly set `DATABASE_URL` to your disposable local `shortlinks_test` database and run:

```sh
node scripts/benchmark-exports.mjs
```

The script refuses hosted/non-test databases, creates uniquely owned fixtures and removes those fixture rows afterward. It writes ignored `.test-data/export-benchmark.json` and `.test-data/export-report.pdf`. Fixture: 10 links, 180 days, 1,800 daily rows, 9,000 dimension rows and 10,000 raw events in real local PostgreSQL 18. These are synthetic fixtures, not production observations. Each measured operation runs in a separate Node process. Timing includes the query and serialization/rendering, excluding module import/startup; peak RSS is whole-process memory including runtime/libraries, not an allocation delta.

| Operation | Time | Response bytes | Peak process RSS |
| --- | ---: | ---: | ---: |
| Dimension aggregate CSV, 9,000 rows | 533 ms | 660,726 | 125 MiB |
| Raw CSV, default maximum 10,000 rows | 607 ms | 1,438,110 | 131 MiB |
| PDF, 180-day account report, 13 pages | 740 ms | 26,056 | 134 MiB |

Measurements are a single local run on Windows/Node 24, without concurrent load. Vercel cold starts, production latency, concurrent-export contention and hosted Redis rate-limit behavior remain unmeasured. Browser tests deliberately run with Redis unavailable; export rate-limit rejection is verified by unit/API tests, not a live Redis browser test. Export generation is isolated from redirect code, but shares deployed resources. Four existing upstream dependency advisories remain; adding pdf-lib introduced no additional reported advisory.
