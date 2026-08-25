# ShortLinks — Modern URL Shortener & Link Analytics

A full-stack URL shortening platform built with **Next.js 16 (App Router)**, **PostgreSQL (Supabase)**, **Upstash Redis**, and **NextAuth.js**. Designed for fast redirects, comprehensive analytics, and developer integrations.

> 🚀 **Live Demo:** [https://short-links-mlku.vercel.app/](https://short-links-mlku.vercel.app/)  
> 📂 **GitHub:** [TanushHAlder04/short_links](https://github.com/TanushHAlder04/short_links)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔗 **URL Shortening** | Auto-generated 7-character base62 codes or custom aliases |
| 🔀 **Smart Device Redirects** | Route iOS, Android, and desktop users to platform-specific destination URLs |
| 📁 **Bulk CSV Import & Export** | Batch import up to 100 links at once with error reporting, failed-row retries, and sanitized CSV exports |
| 🤖 **Bot & Crawler Filtering** | Automatically flag search engine and social preview bots, excluding them from headline click totals with a toggleable view |
| 🔔 **Milestone Webhooks** | Dispatch HMAC-SHA256 signed HTTP POST webhooks to custom endpoints upon reaching click thresholds |
| ⚡ **Redis Caching** | Low-latency, cache-first redirect lookups via Upstash Redis with dynamic TTLs |
| 🌸 **Bloom Filter Gatekeeper** | Dual in-memory FNV-1a Bloom filters: uniqueness checking to avoid database collisions, and cache gatekeeping to prevent single-hit cache pollution |
| 🛡️ **Sliding-Window Rate Limiting** | Tiered Redis sorted-set rate limiting across Edge proxy, redirect routes, and API endpoints |
| 📊 **Detailed Analytics** | Track clicks over 30 days with breakdown by device, browser, operating system, country, and referrers |
| 🔑 **API Key System** | SHA-256 hashed API keys for programmatic link generation and automation |
| 📱 **QR Code Generation** | Instant QR codes generated for every shortened link, downloadable as PNG |
| ⏰ **Link Expiration** | Configurable expiry timestamps returning HTTP 410 Gone after expiration |
| 🔒 **Security Hardening** | Content Security Policy, strict HTTP security headers, CSV injection sanitization, and salted IP hashing |
| 🌙 **Modern Glassmorphic UI** | Responsive dark interface with live chart visualizations and accessible motion |

---

## 🏗️ Architecture & Request Flow

```
Client / Browser
  │
  ├─► GET /[shorturl] (Redirect Path)
  │     │
  │     ├─► Route-Level Rate Limiter (200 req/min)
  │     │
  │     ├─► Bloom Filter Cache Gatekeeper (lib/cache-gatekeeper.js)
  │     │     ├─ 1st Hit (Bloom Miss)  ──► Bypass Redis ──► PostgreSQL DB Query
  │     │     └─ 2nd+ Hit (Bloom Hit)  ──► Redis Cache Lookup
  │     │                                    ├─ Hit  ──► Cached Payload
  │     │                                    └─ Miss ──► DB Query ──► Warm Redis Cache
  │     │
  │     ├─► Smart Device Resolution
  │     │     ├─ iOS User-Agent     ──► Redirect to iosUrl (if configured)
  │     │     ├─ Android User-Agent ──► Redirect to androidUrl (if configured)
  │     │     └─ Desktop / Other    ──► Redirect to originalUrl
  │     │
  │     └─► Background Tasks via Next.js after()
  │           ├─ Record click event (device, browser, OS, geo, isBot flag)
  │           ├─ Increment global click stats
  │           └─ If milestone reached (e.g. 10th click) ──► Dispatch HMAC-signed Webhook
  │
  ├─► /api/* (API Routes)
  │     │
  │     ├─► Edge Proxy Middleware (proxy.js — REST Rate Limiting)
  │     │
  │     ├─► POST /api/generate
  │     │     └─ Rate Limit Check ──► Optimistic Bloom Filter ──► DB Insert ──► Warm Cache
  │     │
  │     ├─► POST /api/links/import
  │     │     └─ Batch Row Validation ──► Sequential Creation ──► Detailed Row Status Report
  │     │
  │     └─► GET /api/links/export
  │           └─ Query User Links ──► CSV Injection Neutralization ──► text/csv Download
  │
  └─► /dashboard, /shorten, /api-docs (App Pages)
        └─ NextAuth.js Session ──► PostgreSQL via Prisma ORM
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 16 (App Router, Turbopack) | Server & Client component architecture |
| **Database** | PostgreSQL via Supabase | Relational data store for links, clicks, users, and API keys |
| **ORM** | Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`) | Type-safe database client and migrations |
| **Caching & Rate Limiting** | Upstash Redis (`@upstash/redis`) | Sliding-window sorted sets and cached link payloads |
| **Authentication** | NextAuth.js v4 + Prisma Adapter | GitHub and Google OAuth providers |
| **Testing** | Vitest | Unit and integration test runner |
| **Load Testing** | k6 | Performance and threshold verification scripts |
| **Visualizations** | Chart.js & `react-chartjs-2` | Interactive analytics charts |
| **Utilities** | `nanoid`, `qrcode`, `ua-parser-js` | Base62 ID generation, QR codes, User-Agent parsing |
| **Styling** | Vanilla CSS + Design Tokens | Custom CSS variables and responsive glassmorphism |
| **Deployment** | Vercel | Serverless hosting with Edge proxy execution |

---

## 📊 Database Schema

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())
  accounts      Account[]
  sessions      Session[]
  urls          Url[]
  apiKeys       ApiKey[]
}

model Url {
  id            String    @id @default(cuid())
  shortCode     String    @unique
  originalUrl   String    @db.Text
  iosUrl        String?   @db.Text
  androidUrl    String?   @db.Text
  webhookUrl    String?   @db.Text
  webhookSecret String?   @db.Text
  customAlias   String?
  userId        String?
  apiKeyId      String?
  expiresAt     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  isActive      Boolean   @default(true)
  clickCount    Int       @default(0)
  user          User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  clicks        Click[]

  @@index([userId])
  @@index([createdAt])
  @@index([expiresAt])
  @@index([userId, createdAt])
  @@index([isActive])
}

model Click {
  id        String   @id @default(cuid())
  shortCode String
  timestamp DateTime @default(now())
  ipHash    String?
  country   String?
  city      String?
  device    String?
  browser   String?
  os        String?
  referrer  String?
  isBot     Boolean  @default(false)
  url       Url      @relation(fields: [shortCode], references: [shortCode], onDelete: Cascade)

  @@index([shortCode])
  @@index([timestamp])
  @@index([shortCode, isBot])
}

model ApiKey {
  id        String    @id @default(cuid())
  userId    String
  keyHash   String    @unique
  name      String
  createdAt DateTime  @default(now())
  lastUsed  DateTime?
  isActive  Boolean   @default(true)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// NextAuth Models: Account, Session, VerificationToken
```

---

## 🛡️ Rate Limiting Tiers

Rate limiting is enforced using a sliding-window sorted-set algorithm (`lib/ratelimit.js`) and Edge proxy (`proxy.js`):

| Scope | Target Identifier | Limit | Window | Action on Exceeded |
|-------|-------------------|-------|--------|---------------------|
| **Redirects** | `redirect:<IP>` | 200 req | 60 sec | HTTP 429 + `Retry-After` |
| **Anonymous Link Creation** | `ip:<IP>` | 5 req | 60 sec | HTTP 429 + `Retry-After` |
| **Authenticated Users** | `user:<UserID>` | 50 req | 60 sec | HTTP 429 + `Retry-After` |
| **API Keys** | `apikey:<UserID>` | 100 req | 60 sec | HTTP 429 + `Retry-After` |
| **Link Listing API** | `links-list:<UserID>` | 60 req | 60 sec | HTTP 429 + `Retry-After` |
| **Bulk CSV Import** | `links-import:<UserID>` | 5 req | 60 sec | HTTP 429 + `Retry-After` |
| **Bulk CSV Export** | `links-export:<UserID>` | 10 req | 60 sec | HTTP 429 + `Retry-After` |

*Note: The rate limiter fails open if Redis is temporarily unreachable, ensuring core redirect availability.*

---

## 🔑 API Key System

Developers can authenticate programmatically using API keys via the `Authorization` header (`Authorization: Bearer sk-...` or `Authorization: sk-...`):

```bash
# Create a short link with device redirects via API key
curl -X POST https://short-links-mlku.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: sk-your-api-key-here" \
  -d '{
    "url": "https://example.com/long-page",
    "customAlias": "my-campaign",
    "iosUrl": "https://apps.apple.com/app/id123456789",
    "androidUrl": "https://play.google.com/store/apps/details?id=com.example.app"
  }'
```

- Keys are generated as `sk-` prefixed high-entropy tokens and stored solely as **SHA-256** hashes.
- Plaintext keys are presented **exactly once** upon creation in the UI.
- Up to **5 active keys** per user account.
- `lastUsed` timestamp is updated asynchronously on every authenticated request without adding latency to the response.

---

## 📈 Analytics & Click Tracking

Each link click records a detailed event asynchronously in the background via Next.js `after()`:

- **Device**: Classified as `mobile`, `tablet`, or `desktop` via `ua-parser-js`.
- **Browser & OS**: Extracted client browser name and operating system.
- **Geo-Location**: Country and city resolved via IP lookup.
- **Referrer**: Captured HTTP Referer header or direct referral tag.
- **Privacy Hashing**: IP addresses are one-way hashed with SHA-256 and `IP_HASH_SALT`; raw client IPs are never stored.
- **Bot Detection**: Automated crawlers and preview bots are flagged with `isBot: true` and excluded from core click metrics.

### Visualized Metrics (Dashboard)
- **30-Day Timeline Chart** (`Line`): Daily non-bot clicks vs. total traffic.
- **Device Breakdown** (`Doughnut`): Mobile vs. Desktop vs. Tablet share.
- **Browser Distribution** (`Bar`): Chrome, Safari, Firefox, Edge, etc.
- **Geographic & Referrer Distribution**: Top countries and referral sources.
- **Bot Traffic Toggle**: View clean organic clicks or inspect bot crawler hits.

---

## 🔒 Security Architecture

- **Resource Ownership Verification**: Every link mutation (`GET`, `PATCH`, `DELETE`) enforces strict user ownership checks (`verifyOwnership()`) to prevent unauthorized cross-tenant modifications.
- **Prisma Parameterized Queries**: All database queries are executed via Prisma ORM parameterized statements, eliminating raw SQL injection vulnerabilities.
- **Content Security Policy & Security Headers**: Enforced via `next.config.mjs` with `Strict-Transport-Security` (HSTS), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and restricted `connect-src` / `form-action` origins.
- **CSV Formula Injection Sanitization**: All exported CSV cell values starting with formula-triggering characters (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically neutralized with single quotes (`'`) in `lib/csv.js`.
- **HMAC-SHA256 Webhook Verification**: Outgoing webhook milestone payloads include an `X-ShortLinks-Signature` header computed as `sha256=<hex_hmac>` using the link's configured `webhookSecret`:
  ```javascript
  // Consumer verification example:
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ```
- **IP Anonymization**: IP addresses are hashed using SHA-256 with a secret salt (`IP_HASH_SALT`) before persistence; raw client IPs are never written to the database.
- **API Key Security**: API keys are generated with high entropy (`sk-...`) and stored solely as SHA-256 hashes (`keyHash`). Plaintext keys are presented once upon creation.
- **URL Scheme Restriction**: Enforces strict `http:` and `https:` validation (`lib/shortcode.js`), rejecting `javascript:`, `data:`, or `file:` URIs.

---

## 🧪 Testing & CI Pipeline

### Automated Test Suite (`Vitest`)

The repository includes **32 unit and integration tests across 8 test suites**:

| Test Suite | File | Focus Area |
|------------|------|------------|
| **Bloom Filter** | `tests/bloom.test.js` | FNV-1a hashing, bitwise tracking, collision resistance |
| **Shortcode & Aliases** | `tests/shortcode.test.js` | Base62 generation, custom alias rules, reserved routes, URL validation |
| **Rate Limiter** | `tests/ratelimit.test.js` | Window boundaries, exact limits, over-limit rejections, fail-open behavior |
| **API Generation** | `tests/generate.test.js` | POST `/api/generate` handler integration, payload validation, QR output |
| **Smart Redirects** | `tests/smart_redirects.test.js` | iOS/Android device override resolution, fallback logic |
| **Bot Detection** | `tests/bot.test.js` | Search crawler patterns, standard browser User-Agents |
| **CSV Export Security** | `tests/csv_export.test.js` | Neutralization of formula/DDE injection characters |
| **IP Privacy** | `tests/analytics.test.js` | Salted SHA-256 IP hashing consistency and privacy |

Run the test suite:
```bash
npm test
```

### Continuous Integration (`GitHub Actions`)

The workflow defined in `.github/workflows/ci.yml` triggers on all pushes and pull requests to `main` or `master`:
1. Checks out repository code
2. Configures Node.js 20 with dependency caching
3. Runs clean install (`npm ci`)
4. Generates Prisma client (`npx prisma generate`)
5. Executes linter (`npm run lint`)
6. Executes Vitest test suite (`npm test`)

---

## 🚦 Load Testing (`k6`)

The `load-test/` directory contains automated performance test scripts with threshold assertions:

- **Redirect Load Test** (`load-test/redirect-test.js`):
  - Simulates 20 concurrent virtual users (VUs) for 30 seconds
  - Thresholds: `http_req_duration: ['p(95)<50']` (95% under 50ms), `http_req_failed: ['rate<0.01']` (<1% failures)
- **Generation Load Test** (`load-test/generate-test.js`):
  - Simulates 5 concurrent VUs for 20 seconds against link creation
  - Thresholds: `http_req_duration: ['p(95)<150']` (95% under 150ms), `http_req_failed: ['rate<0.05']` (<5% failures)

Execute tests with k6:
```bash
# Run redirect load test against local environment
k6 run load-test/redirect-test.js

# Run against a remote deployment with custom short code
k6 run --env TARGET_HOST=https://short-links-mlku.vercel.app --env TARGET_CODE=myCode load-test/redirect-test.js
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (e.g. Supabase)
- Upstash Redis instance
- GitHub or Google OAuth application credentials

### 1. Clone Repository

```bash
git clone https://github.com/TanushHAlder04/short_links.git
cd short_links
npm install
```

### 2. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env.local
```
Fill in the database connection strings, OAuth credentials, and Upstash Redis secrets in `.env.local` (see [`.env.example`](.env.example) for documentation).

### 3. Deploy Database Migrations

Apply tracked Prisma migrations to your database:
```bash
# Apply pending migrations
npx prisma migrate deploy

# Generate Prisma client artifacts
npx prisma generate
```

*(For local schema iterations, use `npx prisma migrate dev`)*

### 4. Run Test Suite

```bash
npm test
```

### 5. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## 📁 Project Structure

```
short_links/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI pipeline
├── app/
│   ├── [shorturl]/
│   │   └── route.js             # Dynamic redirect handler with smart routing & after() analytics
│   ├── api/
│   │   ├── analytics/[shortCode]/route.js # Link analytics query endpoint (with bot filter toggle)
│   │   ├── auth/[...nextauth]/route.js    # NextAuth OAuth authentication handlers
│   │   ├── generate/route.js    # URL creation endpoint with QR and validation
│   │   ├── keys/                # Developer API key management endpoints
│   │   ├── links/
│   │   │   ├── route.js         # Paginated links listing & creation delegate
│   │   │   ├── [shortCode]/     # Single link CRUD (GET, PATCH, DELETE)
│   │   │   ├── export/route.js  # CSV export endpoint with DDE sanitization
│   │   │   └── import/route.js  # Bulk CSV/JSON import endpoint
│   │   ├── qr/[shortCode]/      # QR code generation endpoint
│   │   └── stats/route.js       # Global link & click summary counters
│   ├── api-docs/page.js         # API documentation and key management UI
│   ├── dashboard/
│   │   ├── page.js              # Link management dashboard with search, import, export
│   │   └── [shortCode]/page.js  # Detailed visual analytics charts & bot filter
│   ├── login/page.js            # OAuth sign-in page
│   ├── shorten/page.js          # Interactive link shortener UI with smart redirect inputs
│   ├── globals.css              # Design tokens and responsive styles
│   ├── layout.js               # Root application layout
│   └── page.js                  # Homepage with animated counters and feature highlights
├── components/
│   ├── Footer.js                # Site footer component
│   ├── Navbar.js                # Fixed blur navigation pill
│   └── SessionWrapper.js        # NextAuth session context provider
├── lib/
│   ├── analytics.js             # Async click recording, bot detection, milestone webhooks
│   ├── apikeys.js               # API key validation and user authentication helpers
│   ├── bloom.js                 # Local FNV-1a Bloom filter implementation
│   ├── cache-gatekeeper.js      # Two-hit Redis caching gatekeeper pattern
│   ├── csv.js                   # CSV formula injection sanitization utility
│   ├── logger.js                # Structured JSON logging utility
│   ├── prisma.js                # Prisma client singleton
│   ├── ratelimit.js             # Sliding-window Redis rate limiting engine
│   ├── redis.js                 # Upstash Redis client and stats helpers
│   └── shortcode.js             # nanoid generator, URL validation, and alias rules
├── load-test/
│   ├── generate-test.js         # k6 generation load test with thresholds
│   └── redirect-test.js         # k6 redirect load test with thresholds
├── prisma/
│   ├── migrations/
│   │   └── 20260825000000_init/ # Baseline database schema migration
│   ├── schema.prisma            # Data models (Url, Click, User, ApiKey, Account, Session)
│   └── prisma.config.ts         # Prisma CLI configuration
├── tests/
│   ├── analytics.test.js        # IP hashing unit tests
│   ├── bloom.test.js            # Bloom filter unit tests
│   ├── bot.test.js              # Bot/crawler detection unit tests
│   ├── csv_export.test.js       # CSV injection sanitization unit tests
│   ├── generate.test.js         # URL generation route integration tests
│   ├── ratelimit.test.js        # Rate limiter boundary unit tests
│   ├── shortcode.test.js        # Shortcode and alias validation unit tests
│   └── smart_redirects.test.js  # Smart device redirect unit tests
├── .env.example                 # Documented environment variable template
├── .gitignore                   # Git exclusion rules
├── next.config.mjs              # Security headers, CSP, and Next.js settings
├── package.json                 # Project scripts and dependencies
├── proxy.js                     # Next.js 16 Edge proxy rate limiter
└── vitest.config.mjs            # Vitest test runner configuration
```

---

## 👨‍💻 Author & Contact

**Tanush Halder**  
- GitHub: [@TanushHAlder04](https://github.com/TanushHAlder04)  
- Email: [tanushhalder.2004@gmail.com](mailto:tanushhalder.2004@gmail.com)

---

## 📄 License

MIT License. Free for personal and commercial use.