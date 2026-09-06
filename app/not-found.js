'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Link2, Home } from 'lucide-react'

export default function NotFound() {
  const searchParams = useSearchParams()
  const code = searchParams.get('code')

  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '120px 24px 24px', textAlign: 'center' }}>
      <div style={{ animation: 'fadeInUp 0.5s ease forwards' }}>
        
        <div style={{ fontSize: '8rem', fontWeight: 900, background: 'var(--gradient-hero)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1, marginBottom: 8 }}>
          404
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 12 }}>
          Short Link Not Found
        </h1>

        <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: '0.95rem', maxWidth: 400, margin: '0 auto 32px' }}>
          {code ? (
            <>
              The short link <strong style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>&quot;{code}&quot;</strong> doesn&apos;t exist, has expired, or was removed.
            </>
          ) : (
            "This short link doesn't exist or may have been deactivated."
          )}
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {/*  Direct styling on Link (Renders standard, valid <a> tag) */}
          <Link href="/" className="btn-primary" id="go-home-btn">
            <Home size={18} /> Go Home
          </Link>

          <Link href="/shorten" className="btn-secondary" id="create-link-btn">
            <Link2 size={18} /> Create a Link
          </Link>
        </div>

      </div>
    </main>
  )
}