'use client'
import Link from 'next/link'
import { Mail, Github, Linkedin, Link as LinkIcon } from 'lucide-react'

export default function Footer() {
  return (
    <footer style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', padding: '40px 24px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* Main Flex Layout */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap',
          gap: 40, 
          marginBottom: 40,
          justifyContent: 'space-between'
        }}>

          {/* Left Column: Brand & Description */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: '1 1 300px', minWidth: 280 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--gradient-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LinkIcon size={15} color="white" />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1rem' }}>Short<span className="gradient-text">Links</span></span>
            </Link>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 380 }}>
              A production-grade URL shortening platform engineered for high performance and scale. Powered by Next.js 16, PostgreSQL, and Upstash Redis caching with dual Bloom filter layers, sliding window rate limiting, and real-time click analytics.
            </p>
          </div>

          {/* Middle Column: Product Links */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: '1 1 120px', minWidth: 120 }}>
            <div style={{ minWidth: '120px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 14 }}>Product</div>
              {[
                { href: '/shorten', label: 'Shorten URL' },
                { href: '/dashboard', label: 'Dashboard' },
                { href: '/api-docs', label: 'API Docs' },
                { href: '/login', label: 'Sign In' },
              ].map(({ href, label }) => (
                <Link 
                  key={href} 
                  href={href} 
                  style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', padding: '2px 0', transition: 'color var(--transition)' }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right Column: Connect */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', flex: '1 1 120px', minWidth: 120 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Connect</div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              
              {/* Email (Contact) */}
              <a 
                href="mailto:tanushhalder.2004@gmail.com" 
                aria-label="Email Me" 
                title="Contact Me"
                style={{ color: 'var(--text-muted)', transition: 'color 0.2s, transform 0.2s', display: 'inline-flex' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <Mail size={22} />
              </a>
              
              {/* GitHub (Projects) */}
              <a 
                href="https://github.com/TanushHAlder04" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="GitHub" 
                title="My Projects"
                style={{ color: 'var(--text-muted)', transition: 'color 0.2s, transform 0.2s', display: 'inline-flex' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <Github size={22} />
              </a>

              {/* LinkedIn (Resume/Network) */}
              <a 
                href="https://linkedin.com/in/tanushhalder-coder401" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="LinkedIn" 
                title="My Resume & Professional Network"
                style={{ color: 'var(--text-muted)', transition: 'color 0.2s, transform 0.2s', display: 'inline-flex' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <Linkedin size={22} />
              </a>
            </div>
          </div>

        </div>

        {/* Bottom copyright alignment */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} ShortLinks • Shrinking URLs. Massive Scale • All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}