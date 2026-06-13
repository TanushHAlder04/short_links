'use client'

import { useState } from 'react'
import { Link2, Shuffle, Calendar, Copy, Check, QrCode, ExternalLink, BarChart3, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function Shorten() {
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState('auto') // 'auto' | 'custom'
  const [customAlias, setCustomAlias] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const handleGenerate = async () => {
    setError('')
    setResult(null)

    if (!url.trim()) { setError('Please enter a URL'); return }
    try { new URL(url) } catch { setError('Please enter a valid URL (include https://)'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          customAlias: mode === 'custom' ? customAlias.trim() : undefined,
          expiresAt: expiresAt || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.message || 'Something went wrong')
      } else {
        setResult(data)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.shortUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadQR = () => {
    const a = document.createElement('a')
    a.href = result.qrDataUrl
    a.download = `qr-${result.shortCode}.png`
    a.click()
  }

  const resetForm = () => {
    setResult(null)
    setUrl('')
    setCustomAlias('')
    setExpiresAt('')
    setError('')
  }

  const minDate = new Date()
  minDate.setMinutes(minDate.getMinutes() + 5)
  const minDateStr = minDate.toISOString().slice(0, 16)

  return (
    <main style={{ padding: '60px 24px', minHeight: '80vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 560, animation: 'fadeInUp 0.5s ease forwards' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="badge badge-purple" style={{ marginBottom: 16 }}>
            <Sparkles size={12} /> Free URL Shortener
          </div>
          <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, marginBottom: 12 }}>
            Shorten your <span className="gradient-text">link</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Create short links with analytics, QR codes, and expiry dates.
          </p>
        </div>

        {!result ? (
          <div className="glass-card" style={{ padding: '36px 32px' }}>

            {/* URL Input */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Destination URL
              </label>
              <div style={{ position: 'relative' }}>
                <Link2 size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="url-input"
                  type="url"
                  className="input-field"
                  placeholder="https://your-very-long-url.com/with/path"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  style={{ paddingLeft: 42 }}
                />
              </div>
            </div>

            {/* Mode Toggle */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Short Code
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[{ id: 'auto', icon: Shuffle, label: 'Auto-generate' }, { id: 'custom', icon: Link2, label: 'Custom alias' }].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    id={`mode-${id}-btn`}
                    onClick={() => setMode(id)}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-md)',
                      border: `1px solid ${mode === id ? 'var(--accent-violet)' : 'var(--border)'}`,
                      background: mode === id ? 'rgba(139,92,246,0.15)' : 'transparent',
                      color: mode === id ? 'var(--accent-violet)' : 'var(--text-muted)',
                      fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'all var(--transition)',
                    }}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
              {mode === 'custom' && (
                <input
                  id="alias-input"
                  type="text"
                  className="input-field"
                  placeholder="my-custom-alias"
                  value={customAlias}
                  onChange={e => setCustomAlias(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                  maxLength={30}
                />
              )}
              {mode === 'auto' && (
                <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  A unique 7-character code will be generated (e.g. <code style={{ color: 'var(--accent-violet)' }}>aBcD3f7</code>)
                </div>
              )}
            </div>

            {/* Expiry */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Expiry Date <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Calendar size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="expiry-input"
                  type="datetime-local"
                  className="input-field"
                  value={expiresAt}
                  min={minDateStr}
                  onChange={e => setExpiresAt(e.target.value)}
                  style={{ paddingLeft: 42, colorScheme: 'dark' }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 20, fontSize: '0.875rem', color: '#fca5a5' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="generate-btn"
              onClick={handleGenerate}
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '1rem', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Generating...</> : <><Sparkles size={18} /> Shorten Link</>}
            </button>
          </div>
        ) : (
          /* ── Result Card ─────────────────────────────────────────────────── */
          <div className="glass-card animate-fade-in" style={{ padding: '36px 32px' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Check size={24} color="#10b981" />
              </div>
              <h2 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: 6 }}>Link Created!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Your short link is ready to share</p>
            </div>

            {/* Short URL display */}
            <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <code style={{ color: 'var(--accent-violet)', fontWeight: 700, fontSize: '1rem', wordBreak: 'break-all' }}>{result.shortUrl}</code>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <a href={result.shortUrl} target="_blank" rel="noopener noreferrer">
                  <button className="btn-ghost" id="open-link-btn" style={{ padding: '8px' }}><ExternalLink size={16} /></button>
                </a>
                <button id="copy-btn" onClick={handleCopy} className="btn-ghost" style={{ padding: '8px', color: copied ? '#10b981' : undefined }}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {/* Original URL truncated */}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              → {result.originalUrl}
            </div>

            {/* QR Code */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 20 }}>
              <button id="toggle-qr-btn" onClick={() => setShowQR(!showQR)} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '10px', color: 'var(--accent-violet)' }}>
                <QrCode size={16} /> {showQR ? 'Hide' : 'Show'} QR Code
              </button>
              {showQR && (
                <div className="animate-fade-in" style={{ textAlign: 'center', paddingTop: 16 }}>
                  <img src={result.qrDataUrl} alt="QR Code" style={{ width: 180, height: 180, borderRadius: 12, border: '1px solid var(--border)' }} />
                  <div style={{ marginTop: 12 }}>
                    <button id="download-qr-btn" onClick={handleDownloadQR} className="btn-secondary" style={{ fontSize: '0.875rem', padding: '8px 20px' }}>
                      Download PNG
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Link href={`/dashboard/${result.shortCode}`}>
                <button id="view-analytics-btn" className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.875rem' }}>
                  <BarChart3 size={16} /> Analytics
                </button>
              </Link>
              <button id="shorten-another-btn" onClick={resetForm} className="btn-secondary" style={{ padding: '12px', fontSize: '0.875rem' }}>
                Shorten Another
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}