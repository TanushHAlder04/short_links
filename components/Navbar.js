'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Zap, Menu, X, BarChart3, Code2, ChevronDown, LogOut, User, Link2 } from 'lucide-react'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { data: session } = useSession()

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/shorten', label: 'Shorten' },
    { href: '/api-docs', label: 'API' },
  ]

  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Close open menus when scrolling
      setIsOpen(false)
      setUserMenuOpen(false)

      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setIsVisible(false) // scroll down
      } else {
        setIsVisible(true)  // scroll up
      }
      lastScrollY.current = currentScrollY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 24, left: '50%',
      transform: `translate(-50%, ${isVisible ? '0' : '-150%'})`,
      zIndex: 40,
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 9999,
      height: 64,
      width: 'calc(100% - 48px)',
      maxWidth: 1000,
      display: 'flex', alignItems: 'center',
      transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), background 0.3s ease',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ width: '100%', padding: '0 8px 0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

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
        <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'absolute', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 9999, border: '1px solid rgba(255,255,255,0.05)' }}>
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} style={{ padding: '6px 16px', borderRadius: 9999, fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', transition: 'all var(--transition)', display: 'block' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={session.user.image} alt="" referrerPolicy="no-referrer" style={{ width: 26, height: 26, borderRadius: '50%' }} />
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
          </div>

          {/* Mobile menu toggle */}
          <button id="mobile-menu-btn" className="btn-ghost mobile-only" onClick={() => setIsOpen(o => !o)} style={{ padding: 8 }}>
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="mobile-only" style={{ position: 'absolute', top: 'calc(100% + 12px)', left: 0, right: 0, background: 'rgb(12, 7, 24)', backdropFilter: 'blur(30px)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.15)', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 4, zIndex: 100, boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setIsOpen(false)} style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>{label}</Link>
          ))}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />

          {session ? (
            <>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                {session.user?.image ? (
                  <img src={session.user.image} alt="" referrerPolicy="no-referrer" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={16} color="white" />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{session.user?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{session.user?.email}</div>
                </div>
              </div>
              <Link href="/dashboard" onClick={() => setIsOpen(false)} style={{ padding: '12px 16px', fontSize: '0.95rem', color: 'var(--text-secondary)', transition: 'all 0.2s' }}>Dashboard</Link>
              <div onClick={() => { signOut(); setIsOpen(false) }} style={{ padding: '12px 16px', fontSize: '0.95rem', color: '#fca5a5', cursor: 'pointer', transition: 'all 0.2s' }}>Sign out</div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
              <Link href="/login" onClick={() => setIsOpen(false)} style={{ width: '100%' }}>
                <button className="btn-secondary" style={{ width: '100%', padding: '10px' }}>Sign in</button>
              </Link>
              <Link href="/shorten" onClick={() => setIsOpen(false)} style={{ width: '100%' }}>
                <button className="btn-primary" style={{ width: '100%', padding: '10px' }}>Try Free</button>
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}