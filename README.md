<div align="center">

# 🔗 ShortLinks

**Modern URL Shortener with a Link Analytics Dashboard**

</div>


A full-stack URL shortening platform built with Next.js 16 (App Router), PostgreSQL (Supabase), Upstash Redis, and NextAuth.js. Designed for fast redirects, comprehensive analytics, and developer integrations.


> 🚀 **Live:** [https://short-links-mlku.vercel.app/](https://short-links-mlku.vercel.app/)  



---

## ✨ Features

| | Feature | Description |
|---|---------|-------------|
| 🔗 | **URL Shortening** | New codes are 8 cryptographically random NanoID characters from an ambiguity-reduced alphabet. Custom case-sensitive aliases are supported, and existing 7-character links keep working. Unique INSERT with up to 5 collision retries; alias conflicts return `409`. |
| 🔐 | **Authentication** | Anonymous shortening works out of the box. Google/GitHub OAuth creates an account on first sign-in and uses database sessions. No passwords, no JWT access/refresh-token system. |
| 🔁 | **Idempotent Creation** | Authenticated `Idempotency-Key` replay for 24 hours, scoped to user/API-key identity. Same key with a different payload returns `409`. |
| ⚡ | **Redis Cache-Aside** | 24-hour maximum TTL with downward jitter, expiry-bounded TTLs, 45-second negative cache, versioned invalidation and Inngest retries. No local cache, no Bloom filters. |
| 🔀 | **Smart Device Redirects** | Separate iOS, Android and desktop destinations. Redirects return explicit `302` / `404` / `410` / `503`. |
| 🪦 | **Tombstone Deletion** | Deleted links return `410` and their codes can never be reassigned. |
| 📊 | **Privacy-Safe Analytics** | Events are published from `after()` to Inngest. Unique event IDs give transactional, effectively-once counting. Human / bot / all filters sit on permanent lifetime, daily and dimensional aggregates. |
| 📤 | **Analytics Export** | Sanitized CSV (links, daily, dimensions, raw events) and shareable PDF reports with summary metrics, vector charts and traffic breakdowns. |
| 🔔 | **Signed Webhooks** | SSRF-protected, signed delivery every ten human clicks. Persistent delivery status, five attempts with exponential delays, owner-only manual retry. |
| 📁 | **Bulk CSV Import / Export** | Import up to 100 rows with partial success and failed-row retry. Formula-safe, owner-only CSV export. |
| 🔑 | **API Keys** | SHA-256 hashed keys (`sl_` prefix, `Bearer` auth) for programmatic link creation. |
| 📱 | **QR Codes** | PNGs generated on demand for active, unexpired public links. |
| 🛡️ | **Tiered Rate Limiting** | Redis-backed quotas per IP, user and API key. |
| 🌙 | **Glassmorphic UI** | Responsive dark interface with chart-based analytics dashboard. |

---

## 🏗️ Architecture & Request Flow

```
Client / Browser
  │
  ├─► GET /[shorturl]  (Redirect Path)
  │     │
  │     ├─► Redis cache-aside lookup (versioned key)
  │     │     ├─ Hit            ──► cached destination
  │     │     ├─ Negative hit   ──► 404  (45 s negative cache)
  │     │     └─ Miss           ──► PostgreSQL ──► warm cache
  │     │                           (≤ 24 h, jittered, bounded by link expiry)
  │     │
  │     ├─► Unknown code ──► counts toward invalid-code quota (60 / IP / min)
  │     │
  │     ├─► Resolve destination
  │     │     ├─ iOS      ──► iosUrl      (if configured)
  │     │     ├─ Android  ──► androidUrl  (if configured)
  │     │     └─ Other    ──► originalUrl
  │     │
  │     ├─► Respond:  302 redirect │ 404 missing │ 410 deleted/expired │ 503 unavailable
  │     │
  │     └─► after() ──► publish privacy-safe click event to Inngest
  │
  ├─► Inngest  (async, retried)   ◄── registered at /api/inngest
  │     ├─ Count click (unique event ID ⇒ effectively-once, transactional)
  │     ├─ Update lifetime / daily / dimensional aggregates (UTC)
  │     ├─ Store raw event (90-day retention, after validated backfill)
  │     ├─ Cache invalidation retries
  │     └─ Every 10th human click ──► signed webhook
  │           └─ persistent delivery status · 5 attempts · exponential delay
  │
  ├─► /api/*  (Route Handlers)
  │     ├─► POST /api/generate
  │     │     └─ Quota check ──► Idempotency-Key check ──► validation
  │     │          ──► unique INSERT (≤ 5 retries) ──► response (+ qrUrl)
  │     ├─► POST /api/links/import ──► row validation ──► partial-success report
  │     ├─► GET  /api/links/export ──► formula-safe CSV
  │     └─► GET  /api/reports/export ──► CSV / PDF / JSON analytics report
  │
  └─► /dashboard, /shorten, /api-docs  (App Pages)
        └─ NextAuth.js database session ──► PostgreSQL via Prisma
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 16 (App Router) · React 19 | Server and client components, route handlers |
| **Database** | PostgreSQL via Supabase | Durable links, aggregates, users, keys |
| **ORM** | Prisma 7 | Type-safe client and tracked migrations |
| **Cache & Quotas** | Upstash Redis | Redirect cache-aside and distributed rate limits |
| **Background Jobs** | Inngest | Click processing, webhook delivery, cache-invalidation retries |
| **Authentication** | NextAuth.js v4 + Prisma adapter | GitHub and Google OAuth, database sessions |
| **Visualizations** | Chart.js · `react-chartjs-2` | Dashboard charts |
| **Utilities** | `nanoid` · `qrcode` · `ua-parser-js` | Code generation, QR PNGs, device/browser/OS parsing |
| **Testing** | Vitest · k6 | Unit/route tests and load tests |
| **Styling** | Vanilla CSS + design tokens | Responsive glassmorphism |
| **Deployment** | Vercel | Serverless hosting |

---

## 🗄️ Data Model

Exact definitions live in [`prisma/schema.prisma`](prisma/schema.prisma).

| Area | Holds |
|------|-------|
| **Auth** | Users, OAuth accounts and database sessions (NextAuth + Prisma adapter) |
| **Links** | Destination, optional iOS/Android URLs, expiry, owner, tombstone state |
| **API keys** | SHA-256 hash, name, last-used timestamp. Plaintext is never stored |
| **Click aggregates** | Permanent lifetime, daily and dimensional (country / device / browser / OS / referrer domain) counts, split human vs. bot |
| **Raw click events** | Retained **90 days**, only after validated historical backfill. No raw IPs, referrers stored as domains |
| **Webhook deliveries** | Persistent per-attempt status, owner-visible |
| **Idempotency records** | 24-hour replay window, scoped to user/API-key identity |

---

## 🛡️ Rate Limiting

Redis-backed quotas, per minute:

| Scope | Identifier | Limit |
|-------|------------|------:|
| Anonymous link creation | IP | **10** |
| Session link creation | user | **50** |
| API-key link creation | API key | **100** |
| CSV import | user | **3** |
| Link management | user | **60** |
| Invalid-code scans | IP | **60** |
| Analytics downloads (CSV / PDF) | owner | **5** |

Valid redirects carry **no extra rate-limit operation**. Errors are safe JSON with consistent limit headers where available.

**If Redis is unavailable:** anonymous and API-key writes return `503`; session-based management fails open with a logged warning.

---

## 🔑 API

```bash
curl -X POST https://YOUR_HOST/api/generate \
  -H 'Authorization: Bearer sl_YOUR_KEY' \
  -H 'Idempotency-Key: campaign-request-001' \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/campaign","customAlias":"campaign-2026"}'
```

**Response:** `success`, `shortCode`, `shortUrl`, `originalUrl`, `expiresAt`, `createdAt`, `qrUrl`. Secrets never appear in link responses.

| Endpoint | Purpose |
|----------|---------|
| `POST /api/generate` | Create a link. API key or session optional; anonymous supported |
| `GET /api/links?q=&traffic=human&page=1` | Owner-wide search and totals, paginated links |
| `GET /api/links/matches?url=...` | Session-only owned duplicate choices |
| `GET` `PATCH` `DELETE /api/links/:code` | Owner-only read / edit / tombstone |
| `GET /api/analytics/:code?traffic=human` | Owner-only human / all / bot aggregate analytics |
| `GET` `POST /api/links/:code/webhooks` | Owner-only delivery status / manual retry of failed deliveries |
| `POST /api/links/import` · `GET /api/links/export` | Owner-only CSV/JSON import and CSV export |
| `GET /api/reports/export` | Owner-only analytics export (CSV / PDF / JSON) |
| `GET /api/qr/:code` | Public PNG for an active, unexpired public link |
| `GET` `POST /api/keys` · `DELETE /api/keys/:id` | Session-only key management |

---

## 📈 Analytics & Export

### Collection

- Events are published privacy-safe: **raw IPs are never stored**, referrers are reduced to domains.
- Counts are **UTC** calendar days. Human, bot and all-traffic views are available everywhere.
- Raw events are kept 90 days; aggregates are permanent.

### Exporting

Open the dashboard or a link's analytics page and choose:

1. **Scope**: all owned links, or one link
2. **Period**: 7 / 30 / 90-day preset, or custom UTC dates
3. **Traffic**: human, bot or all
4. **Format**: **Export CSV** or **Download PDF**

Selected-period totals use the same query as the dashboard. Lifetime totals stay separately labeled.

```bash
# Daily human-traffic aggregates for the last 30 days, as CSV
GET /api/reports/export?format=csv&mode=daily&traffic=human&range=30

# One link, custom UTC range, PDF
GET /api/reports/export?format=pdf&shortCode=CODE&range=custom&start=YYYY-MM-DD&end=YYYY-MM-DD
```

`format=json` returns authorized report data. The report endpoint is separate from `/api/links/export` (which remains the lifetime link export with its original columns) so it can never shadow a short code named `export`.

<details>
<summary><b>CSV modes, limits and PDF contents</b></summary>

<br>

**CSV modes:** links with period counts · daily aggregates · dimension aggregates (country / device / browser / OS / referrer) · recent raw events.

Raw-event exports require the **entire** requested UTC range to fall inside the rolling 90-day window; older periods use permanent aggregates. Empty CSVs still contain headers; empty PDFs explain that no clicks were recorded.

| Default limit | Value |
|---------------|------:|
| Calendar days per report | 366 |
| Owned links per report | 1,000 |
| Rows per aggregate query | 20,000 |
| Raw rows per CSV | 10,000 |
| CSV size | 16 MiB |
| Cell length | 8,192 chars (longer cells are capped) |

Oversized requests fail clearly with `413`: choose fewer links or days. Overrides are bounded and documented in `.env.example`.

**CSV format:** UTF-8 with BOM, quoted, formula-safe. Reports never contain IP hashes, API keys, webhook secrets or session fields.

**PDF contents:** metadata, filtered summary metrics, vector charts, all daily rows and top-50 dimension tables, repeated table headings and page numbers. Destination metadata includes the **domain only**.

**Known PDF limits:** UTC is the only report timezone (stored daily aggregates cannot be rebucketed exactly into another zone). Built-in PDF fonts keep deployment lightweight, so unsupported characters render as `?` and long labels are shortened. CSV retains full Unicode. Conversion tracking is out of scope.

</details>

---

## 🔔 Webhooks

Configure a webhook URL on a link with your own **16–256 character signing secret** and retain that secret at your receiver.

- Fires at every **ten human clicks**
- **SSRF-protected** (public HTTPS destinations only)
- **Five attempts** with exponential delays
- Persistent delivery status, visible to the link owner, with manual retry for failed deliveries

```javascript
// Consumer-side verification
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
const isValid  = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
```

The signature arrives in the `X-ShortLinks-Signature` header as `sha256=<hex_hmac>`.

---

## 🔒 Security

| Area | Measure |
|------|---------|
| **Ownership** | Every link read/mutation and analytics/report call enforces owner checks |
| **Queries** | Prisma parameterized statements, no raw SQL |
| **Headers** | CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, set in `next.config.mjs` |
| **URL validation** | `http:` / `https:` only. `javascript:`, `data:`, `file:` rejected |
| **Webhooks** | SSRF-protected destinations, HMAC-SHA256 signatures, retained secrets never returned in responses |
| **CSV** | Formula-injection neutralization on every export |
| **Privacy** | Raw IPs never stored; hashing uses `IP_HASH_SALT` (≥ 32 random characters) |
| **API keys** | High-entropy `sl_` tokens, stored only as SHA-256 hashes, shown once at creation |
| **Account linking** | OAuth email auto-linking is **disabled**. Matching email alone does not merge providers; link the second provider while signed in |
| **Deletion** | Tombstones return `410` and prevent code reassignment |
| **Anonymous links** | Have no account owner and are never silently claimed later |

---

## 🧪 Testing & CI

```bash
npm test        # Vitest
npm run lint    # ESLint
```

CI runs Prisma client generation, lint, tests and a production build. See [TESTING](docs/TESTING.md) for coverage and strategy.

> [!IMPORTANT]
> Tests mock hosted services. A passing CI run does **not** establish live OAuth, database, Redis or throughput health.

### 🚦 Load testing (k6)

Scripts in [`load-test/`](load-test/) assert latency and error-rate thresholds. Methodology and results: [BENCHMARKS](docs/BENCHMARKS.md).

```bash
# Local
k6 run load-test/redirect-test.js

# Remote deployment with a real short code
k6 run --env TARGET_HOST=https://short-links-mlku.vercel.app \
       --env TARGET_CODE=myCode load-test/redirect-test.js
```

---

## 🚀 Getting Started

**Requirements:** Node **22.12+** or **24**, a *disposable* PostgreSQL database, and a *dedicated* Upstash development database. Do not point local tests at production.

```bash
git clone https://github.com/TanushHAlder04/short_links.git
cd short_links

cp .env.example .env      # replace every placeholder

npm ci
npx prisma generate
npm run env:check
npx prisma migrate deploy
npm run dev

# in a second terminal
npm run inngest:dev
```

> [!WARNING]
> `migrate deploy` applies tracked migrations to whichever database you configured. **Verify its identity first.** Existing installations must follow the migration procedure in [ARCHITECTURE](docs/ARCHITECTURE.md#migration-and-rollback), including batched backfill and validation, *before* enabling retention. No migration or backfill ever runs automatically during startup or build.

---

## ⚙️ Production Configuration

| Variable | Notes |
|----------|-------|
| `NEXTAUTH_URL` | Deployment origin, no trailing slash |
| `NEXT_PUBLIC_HOST` | Same origin. **Build-time** variable, redeploy after changing |
| `NEXTAUTH_SECRET` | Stable random secret |
| `IP_HASH_SALT` | ≥ 32 random characters |
| `DATABASE_URL` | Runtime connection, from the correct Supabase project's **Connect** dialog (URL-encode the password) |
| `DIRECT_URL` | Used by Prisma CLI for migrations: direct connection or Session pooler |
| Upstash credentials | Dedicated production Redis database |
| Inngest event + signing keys | Register `/api/inngest` in Inngest and **remove `INNGEST_DEV`** |

See [`.env.example`](.env.example) for exact names and bounded overrides.

**OAuth callbacks** must match exactly in each provider's console:

```text
https://YOUR_HOST/api/auth/callback/google
https://YOUR_HOST/api/auth/callback/github
```

<details>
<summary><b>🩺 Troubleshooting login and database errors</b></summary>

<br>

OAuth callback mismatches and PostgreSQL connection errors are **separate failures**. Changing OAuth providers never repairs a database error.

| Symptom | Cause | Fix |
|---------|-------|-----|
| Google `redirect_uri_mismatch` | Callback URL not registered | Fix it in the provider console |
| NextAuth `error=Callback` | Server-side failure during callback | Check Vercel logs for `[auth]` codes, database connectivity/migrations, and matching client ID/secret |
| `ENOTFOUND` | Hostname does not resolve | Check the hostname and that the project is available |
| `Tenant or user not found` | Pooler project/username/endpoint mismatch | Copy the full **Transaction pooler** URI from Supabase's **Connect** dialog into Vercel's Production `DATABASE_URL` |

Notes for the pooler error: shared-pooler usernames look like `postgres.PROJECT_REF`; the pooler hostname must belong to that same project; use the **database password** (URL-encoded), not a Supabase API key; never guess the region or host prefix. `DIRECT_URL` only affects migrations. It will not fix runtime login.

Run `npm run db:check` for a read-only connection and auth-table check. It prints no credentials. Local success does not validate Vercel's separately configured variables. **Redeploy after correcting production variables.**

Reference: [Supabase: "Tenant or user not found"](https://supabase.com/docs/guides/troubleshooting/tenant-or-user-not-found)

</details>

---

## ⚖️ Guarantees & Limits

| Topic | Behavior |
|-------|----------|
| **Click capture** | Publication is best effort until Inngest accepts the event, so rare losses are possible. After acceptance, retries plus database idempotency prevent duplicate counting |
| **Consistency** | Analytics are **eventually consistent** |
| **Cache** | Cache-aside with versioned invalidation and Inngest retries |
| **Not promised** | Lossless click capture, unlimited quota, measured production latency |
| **Out of scope** | Conversion tracking |

---

## 📚 Documentation

| Doc | Contents |
|-----|----------|
| [WALKTHROUGH](docs/WALKTHROUGH.md) | Complete explanation, decisions, deployment checklist. **Start here** |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | System design, migration and rollback |
| [TESTING](docs/TESTING.md) | Test strategy and coverage |
| [BENCHMARKS](docs/BENCHMARKS.md) | Load-test methodology and results |


---

## 📁 Project Structure

```
short_links/
├── app/                  # App Router: pages, route handlers, redirect route
│   ├── [shorturl]/       #   redirect handler
│   ├── api/              #   generate · links · analytics · reports · keys · qr · inngest · auth
│   ├── dashboard/        #   link management and per-link analytics
│   ├── shorten/          #   link creation UI
│   ├── api-docs/         #   API docs and key management UI
│   └── login/            #   OAuth sign-in
├── components/           # Shared UI (navbar, footer, providers)
├── lib/                  # Cache, quotas, analytics, validation, webhooks, CSV, logging
├── prisma/               # schema.prisma + tracked migrations
├── scripts/              # Operational checks (e.g. db:check)
├── tests/                # Vitest suites
├── load-test/            # k6 scripts
├── docs/                 # Walkthrough, architecture, testing, benchmarks, ADRs
├── prisma.config.ts      # Prisma CLI configuration
├── next.config.mjs       # Security headers and CSP
└── vitest.config.mjs     # Test runner configuration
```

---

## 👨‍💻 Author

**Tanush Halder**

- GitHub: [@TanushHAlder04](https://github.com/TanushHAlder04)
- Email: [tanushhalder.2004@gmail.com](mailto:tanushhalder.2004@gmail.com)

---

## 📄 License

MIT. Free for personal and commercial use.