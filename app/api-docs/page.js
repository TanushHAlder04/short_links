'use client'

import { useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { Github, Globe, Plus, Trash2, Eye, EyeOff, Copy, Check, Key, Loader2, Terminal, Code2, Zap, Shield, AlertCircle } from 'lucide-react'

function CodeBlock({ code, lang = 'bash' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <pre className="code-block" style={{ paddingRight: 52 }}><code>{code}</code></pre>
      <button onClick={copy} className="btn-ghost" style={{ position: 'absolute', top: 10, right: 10, padding: 8 }}>
        {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
      </button>
    </div>
  )
}

function Endpoint({ method, path, desc, params, example }) {
  const colors = { GET: '#10b981', POST: '#8b5cf6', PATCH: '#f59e0b', DELETE: '#ef4444' }
  return (
    <div className="glass-card" style={{ padding: '24px 28px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span className="badge" style={{ background: `${colors[method]}22`, color: colors[method], border: `1px solid ${colors[method]}44`, fontFamily: 'monospace', fontSize: '0.7rem' }}>{method}</span>
        <code style={{ color: 'var(--accent-violet)', fontWeight: 600 }}>{path}</code>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: params ? 16 : 0, lineHeight: 1.7 }}>{desc}</p>
      {params && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Parameters</div>
          {params.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, fontSize: '0.8rem', padding: '6px 0', borderBottom: '1px solid rgba(139,92,246,0.08)' }}>
              <code style={{ color: '#f59e0b', minWidth: 120 }}>{p.name}</code>
              <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{p.type}</span>
              <span style={{ color: 'var(--text-muted)' }}>{p.desc}</span>
            </div>
          ))}
        </div>
      )}
      {example && <CodeBlock code={example} />}
    </div>
  )
}

export default function ApiDocs() {
  const { data: session, status } = useSession()
  const [keys, setKeys] = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyResult, setNewKeyResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [keysLoaded, setKeysLoaded] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  const loadKeys = async () => {
    if (keysLoaded) return
    const res = await fetch('/api/keys')
    const data = await res.json()
    setKeys(data.keys || [])
    setKeysLoaded(true)
  }

  const createKey = async () => {
    if (!newKeyName.trim()) return
    setLoading(true)
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName }),
    })
    const data = await res.json()
    if (data.success) {
      setNewKeyResult(data)
      setNewKeyName('')
      setKeys(k => [...k, { id: data.keyId, name: data.name, createdAt: new Date(), isActive: true }])
    }
    setLoading(false)
  }

  const revokeKey = async (keyId) => {
    await fetch(`/api/keys/${keyId}`, { method: 'DELETE' })
    setKeys(k => k.filter(key => key.id !== keyId))
  }

  const copyKey = () => {
    navigator.clipboard.writeText(newKeyResult?.key)
    setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000)
  }

  const HOST = process.env.NEXT_PUBLIC_HOST || 'https://your-domain.com'

  return (
    <main style={{ padding: '60px 24px', maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <div className="badge badge-purple" style={{ marginBottom: 16 }}>
          <Terminal size={12} /> Developer API
        </div>
        <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: 12 }}>
          API <span className="gradient-text">Reference</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: 600 }}>
          Integrate ShortLinks into your apps via our REST API. Authenticate using your personal API key in the <code style={{ color: 'var(--accent-violet)' }}>Authorization: Bearer sl_xxx</code> header.
        </p>
      </div>

      {/* Auth section */}
      <div className="glass-card" style={{ padding: '24px 28px', marginBottom: 32, borderColor: 'rgba(245,158,11,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Shield size={18} color="#f59e0b" />
          <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>Authentication</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 16, lineHeight: 1.7 }}>
          All authenticated endpoints require an <code style={{ color: 'var(--accent-violet)' }}>Authorization</code> header with your API key.
        </p>
        <CodeBlock code={`curl -H "Authorization: Bearer sl_your_api_key" ${HOST}/api/links`} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="badge badge-green">Rate limit: 100 req/min</div>
          <div className="badge badge-purple">Format: JSON</div>
          <div className="badge badge-cyan">Base URL: {HOST}</div>
        </div>
      </div>

      {/* Endpoints */}
      <h2 style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Code2 size={18} color="var(--accent-violet)" /> Endpoints
      </h2>

      <Endpoint
        method="POST" path="/api/generate"
        desc="Create a new short URL. Works without authentication (rate-limited). Authenticated requests get higher limits and link tracking."
        params={[
          { name: 'url', type: 'string*', desc: 'The original URL to shorten' },
          { name: 'customAlias', type: 'string?', desc: '3–30 chars, alphanumeric + hyphens' },
          { name: 'expiresAt', type: 'ISO 8601?', desc: 'Optional expiry datetime' },
        ]}
        example={`curl -X POST ${HOST}/api/generate \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sl_your_api_key" \\
  -d '{"url":"https://example.com/long-path","customAlias":"my-link"}'`}
      />

      <Endpoint
        method="GET" path="/api/links"
        desc="List all your shortened links with pagination. Requires authentication."
        params={[
          { name: 'page', type: 'number?', desc: 'Page number (default: 1)' },
          { name: 'limit', type: 'number?', desc: 'Results per page, max 50 (default: 20)' },
          { name: 'sortBy', type: 'string?', desc: 'createdAt | clickCount' },
          { name: 'order', type: 'string?', desc: 'asc | desc' },
        ]}
        example={`curl "${HOST}/api/links?page=1&sortBy=clickCount&order=desc" \\
  -H "Authorization: Bearer sl_your_api_key"`}
      />

      <Endpoint
        method="GET" path="/api/analytics/:shortCode"
        desc="Get full analytics for a link: 30-day click timeline, device, browser, country, and referrer breakdowns."
        example={`curl ${HOST}/api/analytics/abc123 \\
  -H "Authorization: Bearer sl_your_api_key"`}
      />

      <Endpoint
        method="PATCH" path="/api/links/:shortCode"
        desc="Update a link's active status or expiry date."
        params={[
          { name: 'isActive', type: 'boolean?', desc: 'Enable or disable the link' },
          { name: 'expiresAt', type: 'ISO 8601?', desc: 'New expiry date, or null to remove' },
        ]}
        example={`curl -X PATCH ${HOST}/api/links/abc123 \\
  -H "Authorization: Bearer sl_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"isActive":false}'`}
      />

      <Endpoint
        method="DELETE" path="/api/links/:shortCode"
        desc="Deactivate (soft-delete) a link. It will no longer redirect."
        example={`curl -X DELETE ${HOST}/api/links/abc123 \\
  -H "Authorization: Bearer sl_your_api_key"`}
      />

      <Endpoint
        method="GET" path="/api/qr/:shortCode"
        desc="Returns a QR code PNG image for the given short code. No auth required for public links."
        example={`# Open in browser or download:
curl ${HOST}/api/qr/abc123 --output qr.png`}
      />

      <div className="divider" style={{ margin: '40px 0' }} />

      {/* API Key Management */}
      <h2 style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Key size={18} color="var(--accent-violet)" /> Your API Keys
      </h2>

      {status === 'unauthenticated' ? (
        <div className="glass-card" style={{ padding: '36px 28px', textAlign: 'center' }}>
          <Key size={36} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Sign in to create and manage API keys</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => signIn('github')} className="btn-secondary" id="signin-github-btn"><Github size={18} /> GitHub</button>
            <button onClick={() => signIn('google')} className="btn-primary" id="signin-google-btn"><Globe size={18} /> Google</button>
          </div>
        </div>
      ) : (
        <div>
          {/* New key result */}
          {newKeyResult && (
            <div className="glass-card animate-fade-in" style={{ padding: '20px 24px', marginBottom: 20, borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#f59e0b', fontWeight: 700 }}>
                <AlertCircle size={16} /> Save this key — it won&apos;t be shown again!
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code id="new-key-display" style={{ flex: 1, fontSize: '0.875rem', wordBreak: 'break-all', color: 'var(--text-primary)', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 8 }}>
                  {showKey ? newKeyResult.key : '•'.repeat(40)}
                </code>
                <button onClick={() => setShowKey(s => !s)} className="btn-ghost" style={{ padding: 8 }}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                <button id="copy-new-key-btn" onClick={copyKey} className="btn-ghost" style={{ padding: 8 }}>{copiedKey ? <Check size={16} color="#10b981" /> : <Copy size={16} />}</button>
              </div>
            </div>
          )}

          {/* Create key */}
          <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                id="key-name-input"
                type="text"
                className="input-field"
                placeholder="Key name (e.g. Production App)"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                onFocus={loadKeys}
                onKeyDown={e => e.key === 'Enter' && createKey()}
                style={{ flex: 1 }}
              />
              <button id="create-key-btn" onClick={createKey} disabled={loading || !newKeyName.trim()} className="btn-primary" style={{ flexShrink: 0 }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create
              </button>
            </div>
          </div>

          {/* Keys list */}
          {keys.length > 0 && (
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Created</th><th>Last Used</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {keys.map(k => (
                    <tr key={k.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}><Key size={14} style={{ marginRight: 6 }} />{k.name}</td>
                      <td>{new Date(k.createdAt).toLocaleDateString()}</td>
                      <td>{k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : 'Never'}</td>
                      <td><span className={`badge ${k.isActive ? 'badge-green' : 'badge-red'}`}>{k.isActive ? 'Active' : 'Revoked'}</span></td>
                      <td>
                        {k.isActive && (
                          <button id={`revoke-${k.id}`} onClick={() => revokeKey(k.id)} className="btn-ghost" style={{ color: '#ef4444', padding: '6px 10px', fontSize: '0.8rem' }}>
                            <Trash2 size={14} /> Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
