'use client'
import { useCallback, useEffect, useState } from 'react'
export default function WebhookDeliveries({ shortCode }) {
  const [rows, setRows] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(null)
  const load = useCallback(async () => {
    const res = await fetch(`/api/links/${shortCode}/webhooks`)
    const data = await res.json()
    if (!res.ok) throw Error(data.message || 'Unable to load deliveries')
    setRows(data.deliveries)
  }, [shortCode])
  // Network responses update state after the effect has returned.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setError(e.message))
  }, [load])
  async function retry(id) {
    setBusy(id)
    setError('')
    try {
      const res = await fetch(`/api/links/${shortCode}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw Error(data.message || 'Retry failed')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="glass-card" style={{ padding: 24, marginTop: 20 }}>
      <h3>Webhook deliveries</h3>
      <p>Every 10 human clicks. Delivery status updates asynchronously.</p>
      {error && <p role="alert">{error}</p>}
      {rows.length === 0 && <p>No deliveries yet.</p>}
      {rows.map((row) => (
        <div key={row.id} style={{ padding: 12 }}>
          <span>
            {row.milestone} clicks: {row.status} ({row.attemptCount} attempts)
          </span>
          {row.errorSummary && <p>{row.errorSummary}</p>}
          {row.status === 'failed' && (
            <button
              className="btn-secondary"
              disabled={busy === row.id}
              onClick={() => retry(row.id)}
            >
              Retry delivery
            </button>
          )}
        </div>
      ))}
      <button
        className="btn-ghost"
        onClick={() => load().catch((e) => setError(e.message))}
      >
        Refresh deliveries
      </button>
    </section>
  )
}
