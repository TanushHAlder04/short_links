'use client'
import Link from 'next/link'
import { Zap, Cpu } from 'lucide-react'

const TECH_STACK = [
  { label: 'Next.js 16', color: '#f1f0ff' },
  { label: 'PostgreSQL', color: '#336791' },
  { label: 'Redis', color: '#dc382d' },
  { label: 'Prisma', color: '#5a67d8' },
  { label: 'Upstash', color: '#00c9b1' },
]

export default function Footer() {
  return (
    <footer style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', padding: '40px 24px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, marginBottom: 40 }}>

          {/* Brand */}
          <div>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--gradient-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={15} color="white" />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1rem' }}>Short<span className="gradient-text">Links</span></span>
            </Link>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 240 }}>
              A production-grade URL shortener built with system design principles. Redis caching, async analytics, rate limiting.
            </p>
          </div>

          {/* Links */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Product</div>
            {[
              { href: '/shorten', label: 'Shorten URL' },
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/api-docs', label: 'API Docs' },
              { href: '/login', label: 'Sign In' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', padding: '4px 0', transition: 'color var(--transition)' }}>{label}</Link>
            ))}
          </div>

          {/* Tech stack */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              <Cpu size={12} style={{ display: 'inline', marginRight: 6 }} />Tech Stack
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TECH_STACK.map(({ label, color }) => (
                <span key={label} style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Built as a system design showcase. Redis caching · PostgreSQL · Async analytics
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="badge badge-green" style={{ fontSize: '0.7rem' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> All systems operational
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}