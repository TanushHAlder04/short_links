'use client'
import { useState } from 'react'
export default function LinkEditor({ link, onSaved }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget),
      body = {
        url: form.get('url'),
        iosUrl: form.get('iosUrl'),
        androidUrl: form.get('androidUrl'),
        desktopUrl: form.get('desktopUrl'),
      }
    const secret = form.get('webhookSecret')
    if (form.get('webhookUrl') !== (link.webhookUrl || '') || secret) {
      body.webhookUrl = form.get('webhookUrl')
      if (secret) body.webhookSecret = secret
    }
    try {
      const res = await fetch(`/api/links/${link.shortCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw Error(data.message || 'Update failed')
      onSaved(data.url)
      setOpen(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
      <button className="btn-secondary" onClick={() => setOpen(!open)}>
        Edit destinations
      </button>
      {open && (
        <form onSubmit={save}>
          {[
            ['url', 'Destination URL', link.originalUrl],
            ['iosUrl', 'iOS URL', link.iosUrl],
            ['androidUrl', 'Android URL', link.androidUrl],
            ['desktopUrl', 'Desktop URL', link.desktopUrl],
            ['webhookUrl', 'Webhook URL', link.webhookUrl],
          ].map(([name, label, value]) => (
            <label key={name} style={{ display: 'block', marginTop: 12 }}>
              {label}
              <input
                className="input-field"
                name={name}
                type="url"
                required={name === 'url'}
                defaultValue={value || ''}
              />
            </label>
          ))}
          <label>
            New signing secret (required when changing webhook URL)
            <input
              className="input-field"
              type="password"
              name="webhookSecret"
              minLength={16}
              maxLength={256}
              autoComplete="new-password"
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="btn-primary" disabled={busy}>
            Save changes
          </button>
        </form>
      )}
    </section>
  )
}
