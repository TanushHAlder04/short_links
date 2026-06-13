'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Github, Globe, Zap, BarChart3, Shield } from 'lucide-react'

export default function Login() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') router.push('/dashboard')
  }, [status, router])

  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '24px' }}>
      {/* Background */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, background: 'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, animation: 'fadeInUp 0.5s ease forwards' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--gradient-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: 'var(--shadow-purple)' }}>
            <Zap size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8 }}>Welcome back</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sign in to access your dashboard and analytics</p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: '36px 32px' }}>
          {/* Benefits */}
          <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: BarChart3, text: 'Full click analytics & charts', color: '#8b5cf6' },
              { icon: Shield,    text: 'API key management',            color: '#10b981' },
              { icon: Zap,       text: 'Unlimited link creation',       color: '#f59e0b' },
            ].map(({ icon: Icon, text, color }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} color={color} />
                </div>
                {text}
              </div>
            ))}
          </div>

          {/* OAuth buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              id="github-login-btn"
              onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
              className="btn-secondary"
              style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '0.95rem' }}
            >
              <Github size={20} /> Continue with GitHub
            </button>
            <button
              id="google-login-btn"
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '0.95rem' }}
            >
              <Globe size={20} /> Continue with Google
            </button>
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 20, lineHeight: 1.6 }}>
            By signing in, you agree to our terms. We don't store passwords — authentication is handled by GitHub and Google.
          </p>
        </div>
      </div>
    </main>
  )
}