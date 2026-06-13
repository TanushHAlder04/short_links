# ShortLinks — Production-Grade URL Shortener

A full-stack URL shortening platform built with **Next.js 16**, **PostgreSQL (Supabase)**, **Upstash Redis**, and **NextAuth.js**. Engineered for performance, security, and scalability.

> 🚀 **Live Demo:** _Coming soon_  
> 📂 **GitHub:** [TanushHAlder04/short_links](https://github.com/TanushHAlder04/short_links)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔗 **URL Shortening** | Auto-generated 7-char codes (nanoid) or custom aliases |
| 🔐 **OAuth Login** | GitHub & Google sign-in via NextAuth.js |
| ⚡ **Redis Caching** | Redirect hits served from Upstash Redis (< 5ms) with smart TTL |
| 🛡️ **Rate Limiting** | Sliding-window rate limiter (Redis sorted sets) — 5/min anonymous, 50/min authenticated |
| 📊 **Click Analytics** | Per-link charts: daily clicks, device, browser, OS, country, referrers |
| 🔑 **API Key System** | Generate hashed API keys (SHA-256); key managed, rate-limited |
| 📱 **QR Codes** | QR PNG generated on creation; downloadable from shorten page & analytics |
| 🎯 **Custom Aliases** | Validate, deduplicate, and block reserved routes |
| ⏰ **Link Expiry** | Optional expiry date; expired links return 410 Gone |
| 🌸 **Bloom Filter** | Probabilistic collision detection for short code uniqueness |
| 🔒 **Security** | Ownership checks on all CRUD, IP hashing for privacy, CORS headers |
| 🌙 **Dark UI** | Glassmorphism design with smooth animations, mobile responsive |

---

## 🏗️ Architecture

```
Browser
  │
  ├─ GET /{shortCode}
  │     └─ Redis cache hit? ─ YES → 307 redirect (< 5ms)
  │                          NO  → PostgreSQL query → cache + 307 redirect
  │
  ├─ POST /api/generate
  │     └─ Rate limit check (Redis) → Bloom filter → PostgreSQL insert → cache warm
  │
  └─ /dashboard, /api/analytics
        └─ NextAuth session → PostgreSQL (Prisma ORM)

Infrastructure:
  PostgreSQL (Supabase)  ←─ Prisma ORM
  Upstash Redis          ←─ @upstash/redis (REST client)
  NextAuth.js            ←─ @next-auth/prisma-adapter
  Vercel                 ←─ Next.js App Router
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 7 |
| Caching | Upstash Redis (REST) |
| Rate Limiting | Sliding window (Redis sorted sets) |
| Auth | NextAuth.js v4 + Prisma adapter |
| OAuth | GitHub, Google |
| Analytics | Chart.js (Line, Doughnut, Bar) |
| QR Codes | `qrcode` npm package |
| User Agent | `ua-parser-js` |
| Styling | Vanilla CSS + Glassmorphism |
| Deployment | Vercel |

---

## 📊 Database Schema

```prisma
model User     { id, name, email, image, accounts[], sessions[], urls[], apiKeys[] }
model Url      { id, shortCode, originalUrl, userId, expiresAt, isActive, clickCount, ... }
model Click    { id, shortCode, timestamp, device, browser, country, referrer, ... }
model ApiKey   { id, userId, keyHash (SHA-256), name, lastUsed, isActive }

// NextAuth models: Account, Session, VerificationToken
```

**Key indexes:** `shortCode` (unique), `userId`, `createdAt`, `expiresAt`, `isActive`

---

## ⚡ Redis Caching

Redirects are served from Upstash Redis with a `url:{shortCode}` key:

```
GET /{shortCode}
  → ZRANGEBYSCORE rl:ip:x.x.x.x    (rate limit check)
  → GET url:{shortCode}              (cache lookup)
     hit  → 307 redirect            (~5ms)
     miss → SELECT from PostgreSQL  → SET url:{shortCode} EX {smart-ttl} → 307 redirect
```

**Smart TTL:** TTL is calculated as `min(1h, time-until-expiry)` so expired links are never cached past their expiry.

---

## 🛡️ Rate Limiting

Implemented as a sliding-window counter using Redis sorted sets (`lib/ratelimit.js`):

| User Type | Limit | Window |
|-----------|-------|--------|
| Anonymous (by IP) | 5 req | 1 min |
| Authenticated (by user ID) | 50 req | 1 min |
| API Key | 100 req | 1 min |
| Link listing | 60 req | 1 min |

Returns `429 Too Many Requests` with `X-RateLimit-Reset` and `Retry-After` headers. Fails **open** (allows request) if Redis is unavailable.

---

## 🔑 API Key System

Developers can authenticate with API keys (header: `Authorization: sk-...`):

```bash
# Create a short link via API key
curl -X POST https://your-domain.com/api/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: sk-your-api-key-here" \
  -d '{"url": "https://example.com/very-long-url", "customAlias": "my-link"}'
```

- Keys are generated as `sk-` prefixed random tokens, hashed with **SHA-256** before storage
- Plaintext key is shown **exactly once** at creation
- Up to **5 active keys** per user
- `lastUsed` timestamp updated on every request (non-blocking)

---

## 📈 Analytics

Each redirect records a `Click` row asynchronously (fire-and-forget, does not block redirect):

- **Device** (mobile / desktop / tablet)
- **Browser** (Chrome, Firefox, Safari, etc.)
- **OS** (Windows, macOS, Android, etc.)
- **Country** (via `x-vercel-ip-country` header)
- **Referrer** (HTTP Referer header)
- **IP Hash** (SHA-256 + salt for privacy — raw IP never stored)

Dashboard charts: 30-day daily clicks (Line), Device breakdown (Doughnut), Browser breakdown (Bar), Country & Referrers (progress bars).

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com/) account (free tier)
- [Upstash](https://upstash.com/) account (free tier)
- GitHub or Google OAuth app credentials

### 1. Clone & Install

```bash
git clone https://github.com/TanushHAlder04/short_links.git
cd short_links
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local` (see [`.env.example`](.env.example) for full documentation).

### 3. Set Up Database

```bash
# Push Prisma schema to your Supabase database
npx prisma db push

# (Optional) Open Prisma Studio to inspect data
npx prisma studio
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 📁 Project Structure

```
short_links/
├── app/
│   ├── [shorturl]/route.js      # Redirect handler (Redis → PostgreSQL)
│   ├── api/
│   │   ├── generate/route.js    # URL creation with rate limiting
│   │   ├── links/route.js       # Paginated link listing
│   │   ├── links/[shortCode]/   # PATCH (toggle/update) + DELETE
│   │   ├── analytics/[shortCode]/ # Click analytics data
│   │   ├── keys/route.js        # API key CRUD
│   │   ├── qr/[shortCode]/      # QR PNG endpoint
│   │   └── auth/[...nextauth]/  # NextAuth config
│   ├── dashboard/
│   │   ├── page.js              # Link management with search
│   │   └── [shortCode]/page.js  # Per-link analytics charts
│   ├── shorten/page.js          # URL creation UI
│   ├── api-docs/page.js         # API documentation + key management
│   ├── login/page.js            # OAuth login page
│   └── globals.css              # Design system (CSS variables)
├── lib/
│   ├── prisma.js                # Prisma client singleton
│   ├── redis.js                 # Upstash Redis helpers + Bloom filter
│   ├── ratelimit.js             # Sliding window rate limiter
│   ├── analytics.js             # Click recording (UA parsing)
│   ├── apikeys.js               # Key creation, validation, hashing
│   └── shortcode.js             # nanoid short code generator + alias validation
├── components/
│   ├── Navbar.js                # Session-aware navigation
│   └── Footer.js                # Site footer
├── prisma/schema.prisma         # Database models + indexes
├── .env.example                 # Environment variable template
└── next.config.mjs              # CORS headers config
```

---

## 🔒 Security

- **Ownership verification** on all CRUD operations (`verifyOwnership()`)
- **API key hashing** — raw key never stored, only SHA-256 hash
- **IP hashing** — raw IPs never stored in analytics
- **CORS headers** — public API routes allow any origin; authenticated routes enforce same-origin
- **Input validation** — URL format, alias regex, reserved route blocklist
- **Prisma ORM** — parameterized queries, no raw SQL injection risk
- **`.env*` gitignored** — no secrets in version control

---

## 👨‍💻 Author

**Tanush Halder**  
GitHub: [TanushHAlder04](https://github.com/TanushHAlder04)  
Email: tanushhalder.2004@gmail.com

---

## 📄 License

MIT — free to use, modify, and distribute.

---

Made with ❤️ using Next.js, PostgreSQL, and Redis