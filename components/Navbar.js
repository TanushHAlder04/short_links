'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Zap, Menu, X, BarChart3, Code2, ChevronDown, LogOut, User, Link2 } from 'lucide-react'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { data: session } = useSession()

  const navLinks = [
    { href: '/',         label: 'Home' },
    { href: '/shorten',  label: 'Shorten' },
    { href: '/api-docs', label: 'API' },
  ]

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(6,6,15,0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
      height: 64,
      display: 'flex', alignItems: 'center',
    }}>
      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--gradient-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(124,58,237,0.4)' }}>
            <Zap size={18} color="white" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
            Short<span className="gradient-text">Links</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)', transition: 'all var(--transition)', display: 'block' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {session ? (
            <>
              <Link href="/dashboard">
                <button id="nav-dashboard-btn" className="btn-ghost" style={{ gap: 6 }}>
                  <BarChart3 size={16} /> Dashboard
                </button>
              </Link>

              {/* User menu */}
              <div style={{ position: 'relative' }}>
                <button
                  id="user-menu-btn"
                  onClick={() => setUserMenuOpen(o => !o)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', transition: 'all var(--transition)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {session.user?.image ? (
                    <img src={session.user.image} alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />
                  ) : (
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--gradient-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={14} color="white" />
                    </div>
                  )}
                  <ChevronDown size={14} color="var(--text-muted)" />
                </button>

                {userMenuOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 200, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 50 }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user?.email}</div>
                    </div>
                    <Link href="/dashboard" onClick={() => setUserMenuOpen(false)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all var(--transition)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                      >
                        <BarChart3 size={15} /> Dashboard
                      </div>
                    </Link>
                    <Link href="/shorten" onClick={() => setUserMenuOpen(false)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all var(--transition)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                      >
                        <Link2 size={15} /> New Link
                      </div>
                    </Link>
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      <div onClick={() => { signOut(); setUserMenuOpen(false) }}
                        id="signout-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: '0.875rem', color: '#fca5a5', cursor: 'pointer', transition: 'all var(--transition)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <LogOut size={15} /> Sign out
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/login">
                <button id="nav-login-btn" className="btn-secondary" style={{ padding: '8px 20px', fontSize: '0.875rem' }}>Sign in</button>
              </Link>
              <Link href="/shorten">
                <button id="nav-try-btn" className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.875rem' }}>Try Free</button>
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button id="mobile-menu-btn" className="btn-ghost" onClick={() => setIsOpen(o => !o)} style={{ padding: 8, display: 'none' }}>
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div style={{ position: 'absolute', top: 64, left: 0, right: 0, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setIsOpen(false)} style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>{label}</Link>
          ))}
          {session && <Link href="/dashboard" onClick={() => setIsOpen(false)} style={{ padding: '12px 16px', fontSize: '0.95rem', color: 'var(--accent-violet)', fontWeight: 600 }}>Dashboard</Link>}
        </div>
      )}
    </nav>
  )
}