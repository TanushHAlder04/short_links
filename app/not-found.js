import Link from 'next/link'
import { Link2, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '24px', textAlign: 'center' }}>
      <div style={{ animation: 'fadeInUp 0.5s ease forwards' }}>
        <div style={{ fontSize: '8rem', fontWeight: 900, background: 'var(--gradient-hero)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1, marginBottom: 8 }}>
          404
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 12 }}>Short link not found</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: '0.95rem', maxWidth: 360, margin: '0 auto 32px' }}>
          This short link doesn't exist or may have been deactivated.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/">
            <button className="btn-primary" id="go-home-btn"><Home size={18} /> Go Home</button>
          </Link>
          <Link href="/shorten">
            <button className="btn-secondary" id="create-link-btn"><Link2 size={18} /> Create a Link</button>
          </Link>
        </div>
      </div>
    </main>
  )
}
