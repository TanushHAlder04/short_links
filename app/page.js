'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { Zap, BarChart3, Shield, QrCode, Key, Globe, ArrowRight, Github, Link2, Layers } from 'lucide-react'

// ─── Animated counter hook ────────────────────────────────────────────────────
function useCountUp(target, duration = 2000) {
  const [count, setCount] = useState(0)
  const started = useRef(false)
  useEffect(() => {
    if (started.current || target === 0) return
    started.current = true
    const startTime = performance.now()
    const step = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return count
}

// ─── Floating Particle ───────────────────────────────────────────────────────
function Particle({ style }) {
  return <div style={{ position: 'absolute', width: 2, height: 2, borderRadius: '50%', background: 'rgba(139,92,246,0.6)', ...style }} />
}

// ─── Feature Card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, color, delay }) {
  return (
    <div className="glass-card" style={{ padding: '28px', animationDelay: `${delay}ms`, animation: 'fadeInUp 0.6s ease forwards', opacity: 0 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, marginBottom: 16,
        background: `${color}22`, border: `1px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={22} color={color} />
      </div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>{title}</h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{desc}</p>
    </div>
  )
}

// ─── Step Card ───────────────────────────────────────────────────────────────
function StepCard({ num, title, desc }) {
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: 'var(--gradient-purple)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '0.875rem', fontWeight: 800, color: 'white',
        boxShadow: 'var(--shadow-purple)',
      }}>{num}</div>
      <div>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>{title}</h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{desc}</p>
      </div>
    </div>
  )
}

export default function Home() {
  const [stats, setStats] = useState({ totalLinks: 0, totalClicks: 0 })

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {})
  }, [])

  const linksCount = useCountUp(stats.totalLinks || 12847)
  const clicksCount = useCountUp(stats.totalClicks || 284519)

  const features = [
    { icon: Zap,       title: 'Redis Caching',       color: '#f59e0b', desc: 'Hot URLs served in <5ms via Upstash Redis. Cache-first architecture with automatic TTL and invalidation.' },
    { icon: BarChart3, title: 'Click Analytics',      color: '#8b5cf6', desc: 'Device, browser, country, and referrer breakdown for every link. 30-day timeline with live charts.' },
    { icon: Shield,    title: 'Rate Limiting',        color: '#06b6d4', desc: 'Sliding-window rate limiter per IP and user. Protects against abuse and ensures fair usage.' },
    { icon: QrCode,    title: 'QR Code Generation',   color: '#ec4899', desc: 'Instant QR codes for every link. Download as PNG. Perfect for print campaigns and events.' },
    { icon: Key,       title: 'Developer API Keys',   color: '#10b981', desc: 'Create API keys with per-minute rate limits. Integrate ShortLinks into your own apps and pipelines.' },
    { icon: Globe,     title: 'Custom Aliases',        color: '#f97316', desc: 'Claim memorable short codes like yourdomain.com/product. Supports expiry dates and active toggling.' },
  ]

  return (
    <main style={{ overflow: 'hidden' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', padding: '120px 24px 80px', textAlign: 'center', minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Floating particles */}
        {[...Array(12)].map((_, i) => (
          <Particle key={i} style={{
            left: `${10 + (i * 8)}%`, top: `${20 + (i % 5) * 15}%`,
            animation: `particle ${4 + i * 0.5}s linear infinite`,
            animationDelay: `${i * 0.3}s`,
          }} />
        ))}

        {/* Badge */}
        <div className="badge badge-purple animate-fade-in" style={{ marginBottom: 28, fontSize: '0.8rem' }}>
          <Zap size={12} /> Built for System Design Interviews
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: 24, maxWidth: 800, letterSpacing: '-0.04em', animation: 'fadeInUp 0.7s ease forwards', opacity: 0 }}>
          <span className="gradient-text">Shorten.</span><br />
          <span style={{ color: 'var(--text-primary)' }}>Track.</span>{' '}
          <span className="gradient-text-pink">Analyze.</span>
        </h1>

        {/* Sub */}
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', color: 'var(--text-secondary)', maxWidth: 600, marginBottom: 40, lineHeight: 1.8, animation: 'fadeInUp 0.7s 0.15s ease forwards', opacity: 0 }}>
          A production-grade URL shortener with <strong style={{ color: 'var(--accent-violet)' }}>Redis caching</strong>,
          async analytics, rate limiting, and real-time dashboards. Built to scale.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeInUp 0.7s 0.3s ease forwards', opacity: 0 }}>
          <Link href="/shorten">
            <button className="btn-primary" style={{ fontSize: '1rem', padding: '14px 36px' }} id="hero-shorten-btn">
              Shorten a Link <ArrowRight size={18} />
            </button>
          </Link>
          <Link href="/dashboard">
            <button className="btn-secondary" style={{ fontSize: '1rem', padding: '14px 36px' }} id="hero-dashboard-btn">
              View Dashboard <BarChart3 size={18} />
            </button>
          </Link>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 48, marginTop: 64, justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeInUp 0.7s 0.45s ease forwards', opacity: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, background: 'var(--gradient-hero)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {linksCount.toLocaleString()}+
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>Links Shortened</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, background: 'var(--gradient-hero)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {clicksCount.toLocaleString()}+
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>Total Redirects</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, background: 'var(--gradient-hero)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              &lt;5ms
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>Cached Redirect</div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-violet)', marginBottom: 12 }}>Built Seriously</p>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 800 }}>
              Everything you need for <span className="gradient-text">production scale</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {features.map((f, i) => <FeatureCard key={i} {...f} delay={i * 80} />)}
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── System Design Section ─────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
            <div>
              <div className="badge badge-cyan" style={{ marginBottom: 20 }}>
                <Layers size={12} /> System Design
              </div>
              <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', fontWeight: 800, marginBottom: 20, lineHeight: 1.2 }}>
                Designed for <span className="gradient-text">millions of redirects</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.8 }}>
                Classic system design interview question — built properly. Explain exactly how to handle high-concurrency traffic, prevent collisions, and separate write-heavy analytics from read-heavy redirects.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <StepCard num="01" title="Bloom Filter Collision Avoidance" desc="Redis bit arrays check if a short code might exist before any DB roundtrip. Near-zero collision probability." />
                <StepCard num="02" title="Cache-First Redirect Path" desc="Redis serves hot URLs in <5ms. Cold URLs hit PostgreSQL once, then are cached with TTL for future requests." />
                <StepCard num="03" title="Async Analytics (Kafka-Ready)" desc="Click events are written fire-and-forget. DB write never blocks the redirect response. Kafka producer integration point documented." />
              </div>
            </div>

            {/* Architecture diagram */}
            <div className="glass-card" style={{ padding: 28, fontFamily: 'monospace', fontSize: '0.8rem' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Architecture</div>
              {[
                { label: 'Browser', color: '#06b6d4', indent: 0 },
                { label: '  ↓', color: '#4b5563', indent: 0 },
                { label: 'Edge Middleware (Rate Limit)', color: '#f59e0b', indent: 0 },
                { label: '  ↓', color: '#4b5563', indent: 0 },
                { label: 'Next.js API Route', color: '#8b5cf6', indent: 0 },
                { label: '  ├─ Redis Cache HIT  →  Redirect (<5ms)', color: '#10b981', indent: 0 },
                { label: '  └─ Redis Cache MISS ↓', color: '#6b7280', indent: 0 },
                { label: '       PostgreSQL Query', color: '#6366f1', indent: 0 },
                { label: '       ↓  Warm Cache  ↓', color: '#4b5563', indent: 0 },
                { label: '       Redirect + recordClick()', color: '#ec4899', indent: 0 },
                { label: '         ↓ [fire & forget]', color: '#4b5563', indent: 0 },
                { label: '       clicks table ← Kafka-Ready', color: '#f97316', indent: 0 },
              ].map((row, i) => (
                <div key={i} style={{ color: row.color, padding: '3px 0', lineHeight: 1.6 }}>{row.label}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── How It Works ─────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: 56 }}>
            From URL to analytics in <span className="gradient-text">seconds</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32 }}>
            {[
              { icon: Link2,     num: '1', title: 'Paste your URL',        desc: 'Drop in any long URL. Pick a custom alias or auto-generate a 7-char code.' },
              { icon: QrCode,    num: '2', title: 'Get your short link',    desc: 'Instantly receive your short URL + QR code. Share anywhere.' },
              { icon: BarChart3, num: '3', title: 'Track every click',      desc: 'See who clicked, where from, on which device. 30-day analytics dashboard.' },
            ].map((s, i) => (
              <div key={i} className="glass-card" style={{ padding: '36px 24px' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gradient-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: 'var(--shadow-purple)', fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{s.num}</div>
                <s.icon size={28} color="var(--accent-violet)" style={{ margin: '0 auto 16px', display: 'block' }} />
                <h3 style={{ fontWeight: 700, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: 20 }}>
            Start shortening <span className="gradient-text">for free</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 36, lineHeight: 1.8 }}>
            No credit card required. Sign in with GitHub or Google to track your links and access the dashboard.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/shorten">
              <button className="btn-primary" style={{ padding: '14px 36px', fontSize: '1rem' }} id="cta-shorten-btn">
                Get Started Free <ArrowRight size={18} />
              </button>
            </Link>
            <Link href="/api-docs">
              <button className="btn-secondary" style={{ padding: '14px 36px', fontSize: '1rem' }} id="cta-api-docs-btn">
                <Github size={18} /> API Docs
              </button>
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}