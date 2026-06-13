'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Copy, Check, ExternalLink, QrCode, BarChart3,
  Globe, Monitor, Smartphone, Tablet, MousePointerClick, Link2,
  Calendar, Activity, Trash2, ToggleRight, ToggleLeft, Loader2, Download
} from 'lucide-react'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, BarElement, Title, Tooltip, Legend, Filler)

const CHART_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#f97316', '#6366f1', '#84cc16']

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#a89fc4', font: { family: 'Inter', size: 12 }, boxWidth: 12 } }, tooltip: { backgroundColor: '#111128', borderColor: '#8b5cf6', borderWidth: 1, titleColor: '#f1f0ff', bodyColor: '#a89fc4', padding: 12 } },
  scales: {
    x: { ticks: { color: '#6b6585', font: { size: 11 } }, grid: { color: 'rgba(139,92,246,0.08)' } },
    y: { ticks: { color: '#6b6585', font: { size: 11 } }, grid: { color: 'rgba(139,92,246,0.08)' } },
  },
}

export default function LinkAnalytics() {
  const { shortCode } = useParams()
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrUrl, setQrUrl] = useState(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch(`/api/analytics/${shortCode}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [shortCode, status])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/${shortCode}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const handleToggle = async () => {
    await fetch(`/api/links/${shortCode}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !data.url.isActive }) })
    setData(d => ({ ...d, url: { ...d.url, isActive: !d.url.isActive } }))
  }

  const handleDelete = async () => {
    if (!confirm('Deactivate this link?')) return
    await fetch(`/api/links/${shortCode}`, { method: 'DELETE' })
    router.push('/dashboard')
  }

  const loadQR = () => {
    setQrUrl(`/api/qr/${shortCode}`)
    setShowQR(true)
  }

  if (status === 'loading' || loading) {
    return <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><Loader2 size={32} className="animate-spin" color="var(--accent-violet)" /></main>
  }

  if (error) {
    return <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: '#fca5a5' }}>{error}</p>
      <Link href="/dashboard"><button className="btn-secondary">Back to Dashboard</button></Link>
    </main>
  }

  const isExpired = data.url.expiresAt && new Date(data.url.expiresAt) < new Date()

  // ── Chart data ──────────────────────────────────────────────────────────────
  const lineData = {
    labels: data.clicksByDay.map(d => d.date.slice(5)), // MM-DD
    datasets: [{
      label: 'Clicks', data: data.clicksByDay.map(d => d.count),
      borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)',
      borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#8b5cf6', fill: true, tension: 0.4,
    }],
  }

  const deviceData = {
    labels: data.byDevice.map(d => d.name),
    datasets: [{ data: data.byDevice.map(d => d.count), backgroundColor: CHART_COLORS, borderWidth: 0, hoverOffset: 4 }],
  }

  const browserData = {
    labels: data.byBrowser.map(d => d.name),
    datasets: [{ data: data.byBrowser.map(d => d.count), backgroundColor: CHART_COLORS, borderRadius: 6, borderWidth: 0 }],
  }

  const countryData = {
    labels: data.byCountry.map(d => d.name),
    datasets: [{ data: data.byCountry.map(d => d.count), backgroundColor: CHART_COLORS, borderRadius: 6, borderWidth: 0 }],
  }

  return (
    <main style={{ padding: '40px 24px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Back */}
      <Link href="/dashboard">
        <button id="back-btn" className="btn-ghost" style={{ marginBottom: 24 }}>
          <ArrowLeft size={16} /> Dashboard
        </button>
      </Link>

      {/* Link header */}
      <div className="glass-card" style={{ padding: '24px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <code style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-violet)' }}>/{shortCode}</code>
            <span className={`badge ${isExpired ? 'badge-red' : data.url.isActive ? 'badge-green' : 'badge-gray'}`}>
              {isExpired ? 'Expired' : data.url.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.url.originalUrl}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button id="copy-link-btn" onClick={handleCopy} className="btn-ghost">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <a href={`/${shortCode}`} target="_blank" rel="noopener noreferrer">
            <button className="btn-ghost"><ExternalLink size={16} /></button>
          </a>
          <button id="qr-btn" onClick={loadQR} className="btn-ghost"><QrCode size={16} /></button>
          <button id="toggle-btn" onClick={handleToggle} className="btn-ghost">
            {data.url.isActive ? <ToggleRight size={16} color="#10b981" /> : <ToggleLeft size={16} />}
          </button>
          <button id="delete-btn" onClick={handleDelete} className="btn-ghost" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
        </div>
      </div>

      {/* QR Modal */}
      {showQR && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowQR(false)}>
          <div className="glass-card animate-fade-in" style={{ padding: 32, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>QR Code</h3>
            <img src={qrUrl} alt="QR" style={{ width: 200, height: 200, borderRadius: 12 }} />
            <div style={{ marginTop: 16 }}>
              <a href={qrUrl} download={`qr-${shortCode}.png`}>
                <button id="download-qr-btn" className="btn-primary" style={{ fontSize: '0.875rem' }}>
                  <Download size={16} /> Download
                </button>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Stat summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { icon: MousePointerClick, label: 'Total Clicks', value: data.totalClicks.toLocaleString(), color: '#8b5cf6' },
          { icon: Calendar, label: 'Created', value: new Date(data.url.createdAt).toLocaleDateString(), color: '#06b6d4' },
          { icon: Activity, label: 'Last 30 Days', value: data.clicksByDay.reduce((s, d) => s + d.count, 0), color: '#10b981' },
          { icon: Link2, label: 'Short Code', value: shortCode, color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} className="glass-card" style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Click timeline */}
      <div className="glass-card" style={{ padding: '24px 28px', marginBottom: 24 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Clicks — Last 30 Days</h3>
        <div style={{ height: 220 }}>
          <Line data={lineData} options={{ ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }} />
        </div>
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>

        {/* Device */}
        <div className="glass-card" style={{ padding: '24px 28px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={16} color="var(--accent-violet)" /> Devices
          </h3>
          {data.byDevice.length > 0 ? (
            <div style={{ height: 180 }}>
              <Doughnut data={deviceData} options={{ ...chartDefaults, scales: undefined, cutout: '65%' }} />
            </div>
          ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No data yet</p>}
        </div>

        {/* Browser */}
        <div className="glass-card" style={{ padding: '24px 28px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Monitor size={16} color="#06b6d4" /> Browsers
          </h3>
          {data.byBrowser.length > 0 ? (
            <div style={{ height: 180 }}>
              <Bar data={browserData} options={{ ...chartDefaults, indexAxis: 'y', plugins: { ...chartDefaults.plugins, legend: { display: false } } }} />
            </div>
          ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No data yet</p>}
        </div>

        {/* Country */}
        <div className="glass-card" style={{ padding: '24px 28px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={16} color="#10b981" /> Countries
          </h3>
          {data.byCountry.length > 0 ? (
            <div style={{ height: 180 }}>
              <Bar data={countryData} options={{ ...chartDefaults, indexAxis: 'y', plugins: { ...chartDefaults.plugins, legend: { display: false } } }} />
            </div>
          ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No data yet</p>}
        </div>
      </div>

      {/* Referrers table */}
      {data.topReferrers.length > 0 && (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontWeight: 700 }}>Top Referrers</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Source</th><th>Clicks</th><th>Share</th></tr>
            </thead>
            <tbody>
              {data.topReferrers.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</td>
                  <td>{r.count}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-card)', width: 100, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--gradient-purple)', width: `${(r.count / data.topReferrers[0].count) * 100}%`, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: '0.8rem' }}>{((r.count / data.totalClicks) * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
