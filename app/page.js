'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { Zap, BarChart3, Shield, QrCode, Key, Globe, ArrowRight, Github, Link2 } from 'lucide-react'

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
  return <div style={{ position: 'absolute', width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.55)', ...style }} />
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


export default function Home() {
  const [stats, setStats] = useState({ totalLinks: 0, totalClicks: 0 })

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => { })
  }, [])

  const linksCount = useCountUp(stats.totalLinks || 12847)
  const clicksCount = useCountUp(stats.totalClicks || 284519)

  const features = [
    { icon: Zap, title: 'Redis Caching', color: '#f59e0b', desc: 'Hot URLs served in <5ms via Upstash Redis. Cache-first architecture with automatic TTL and invalidation.' },
    { icon: BarChart3, title: 'Click Analytics', color: '#8b5cf6', desc: 'Device, browser, country, and referrer breakdown for every link. 30-day timeline with live charts.' },
    { icon: Shield, title: 'Rate Limiting', color: '#06b6d4', desc: 'Sliding-window rate limiter per IP and user. Protects against abuse and ensures fair usage.' },
    { icon: QrCode, title: 'QR Code Generation', color: '#ec4899', desc: 'Instant QR codes for every link. Download as PNG. Perfect for print campaigns and events.' },
    { icon: Key, title: 'Developer API Keys', color: '#10b981', desc: 'Create API keys with per-minute rate limits. Integrate ShortLinks into your own apps and pipelines.' },
    { icon: Globe, title: 'Custom Aliases', color: '#f97316', desc: 'Claim memorable short codes like yourdomain.com/product. Supports expiry dates and active toggling.' },
  ]

  return (
    <main style={{ overflow: 'hidden' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', padding: '120px 24px 80px', textAlign: 'center', minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Floating particles */}
        {[...Array(17)].map((_, i) => (
          <Particle key={i} style={{
            left: `${5 + (i * 5.5) % 90}%`,
            top: `${12 + (i * 7.1) % 76}%`,
            animation: `particle ${4 + i * 0.5}s linear infinite`,
            animationDelay: `-${i * 0.35}s`,
          }} />
        ))}



        <div style={{ position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: 24, maxWidth: 800, letterSpacing: '-0.04em', animation: 'fadeInUp 0.7s ease forwards', opacity: 0 }}>
            <span className="gradient-text">Shorten.</span><br />
            <span style={{ color: '#fff' }}>Track.</span>{' '}
            <span className="gradient-text-pink">Analyze.</span>
          </h1>

          {/* Sub */}
          <p style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)', color: '#a19bb0', maxWidth: 600, marginBottom: 40, lineHeight: 1.6, animation: 'fadeInUp 0.7s 0.15s ease forwards', opacity: 0 }}>
            A production-grade URL shortener with Redis Caching,
            Async Analytics, Rate Limiting, and Real-Time Dashboards. Scale Effortlessly.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeInUp 0.7s 0.3s ease forwards', opacity: 0 }}>
            <Link href="/shorten">
              <button className="btn-primary" style={{ fontSize: '1rem', padding: '14px 36px', borderRadius: 9999 }} id="hero-shorten-btn">
                Shorten a Link <ArrowRight size={18} />
              </button>
            </Link>
            <Link href="/dashboard">
              <button className="btn-secondary" style={{ fontSize: '1rem', padding: '14px 36px', borderRadius: 9999, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }} id="hero-dashboard-btn">
                Open Live Dashboard <BarChart3 size={18} />
              </button>
            </Link>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 'clamp(1rem, 4vw, 4rem)', marginTop: 80, justifyContent: 'center', flexWrap: 'nowrap', animation: 'fadeInUp 0.7s 0.45s ease forwards', opacity: 0, width: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)', fontWeight: 900, background: 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {linksCount.toLocaleString()}+
              </div>
              <div style={{ fontSize: 'clamp(0.7rem, 2vw, 0.9rem)', color: '#6b6585', marginTop: 4, whiteSpace: 'nowrap' }}>Links Shortened</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.05)', alignSelf: 'stretch' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)', fontWeight: 900, background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {clicksCount.toLocaleString()}+
              </div>
              <div style={{ fontSize: 'clamp(0.7rem, 2vw, 0.9rem)', color: '#6b6585', marginTop: 4, whiteSpace: 'nowrap' }}>Total Redirects</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.05)', alignSelf: 'stretch' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)', fontWeight: 900, background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                &lt;5ms
              </div>
              <div style={{ fontSize: 'clamp(0.7rem, 2vw, 0.9rem)', color: '#6b6585', marginTop: 4, whiteSpace: 'nowrap' }}>Cached Redirect</div>
            </div>
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
              Everything you need for <span className="gradient-text">Production </span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {features.map((f, i) => <FeatureCard key={i} {...f} delay={i * 80} />)}
          </div>
        </div>
      </section>





      {/* ── How It Works ─────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: 56 }}>
            From URL to analytics in <span className="gradient-text">seconds</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32 }}>
            {[
              { icon: Link2, num: '1', title: 'Paste your URL', desc: 'Drop in any long URL. Pick a custom alias or auto-generate a 7-char code.' },
              { icon: QrCode, num: '2', title: 'Get your short link', desc: 'Instantly receive your short URL + QR code. Share anywhere.' },
              { icon: BarChart3, num: '3', title: 'Track every click', desc: 'See who clicked, where from, on which device. 30-day analytics dashboard.' },
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