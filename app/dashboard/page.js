'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Link2,
  BarChart3,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Plus,
  TrendingUp,
  MousePointerClick,
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  QrCode,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Search,
  X,
  Clock,
} from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLinkStatus(link) {
  if (!link.isActive) return 'inactive'
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return 'expired'
  return 'active'
}

function formatDateForInput(dateValue) {
  if (!dateValue) return ''

  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)

  return localDate.toISOString().slice(0, 16)
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div
      className="glass-card"
      style={{
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: color + '22',
          border: '1px solid' + color + '44',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={22} color={color} />
      </div>

      <div>
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 4,
          }}
        >
          {label}
        </div>

        {loading ? (
          <div className="skeleton" style={{ width: 80, height: 28 }} />
        ) : (
          <div style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1 }}>
            {value}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Link Row ────────────────────────────────────────────────────────────────

function LinkRow({
  link,
  onDelete,
  onToggle,
  onCopy,
  onUpdateExpiry,
  copiedId,
  updatingExpiry,
}) {
  const status = getLinkStatus(link)

  return (
    <tr>
      <td>
        <div>
          <div
            style={{
              fontWeight: 700,
              color: 'var(--accent-violet)',
              fontSize: '0.9rem',
            }}
          >
            /{link.shortCode}
          </div>

          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              maxWidth: 240,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}
          >
            {link.originalUrl}
          </div>
        </div>
      </td>

      <td>
        <span
          className={`badge ${status === 'expired'
            ? 'badge-red'
            : status === 'active'
              ? 'badge-green'
              : 'badge-gray'
            }`}
        >
          {status === 'expired'
            ? 'Expired'
            : status === 'active'
              ? 'Active'
              : 'Inactive'}
        </span>
      </td>

      <td style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
        {Number(link.clickCount || 0).toLocaleString()}
      </td>

      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {new Date(link.createdAt).toLocaleDateString()}
      </td>

      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={14} color="var(--text-muted)" />

          <input
            type="datetime-local"
            value={formatDateForInput(link.expiresAt)}
            disabled={updatingExpiry === link.shortCode}
            onChange={(event) => onUpdateExpiry(link.shortCode, event.target.value)}
            title="Update expiry date"
            style={{
              width: 175,
              height: 34,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-secondary)',
              padding: '0 10px',
              fontSize: '0.75rem',
              outline: 'none',
            }}
          />

          {link.expiresAt && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onUpdateExpiry(link.shortCode, '')}
              disabled={updatingExpiry === link.shortCode}
              title="Remove expiry"
              style={{ padding: 8, color: '#ef4444' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </td>

      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            id={`copy-${link.shortCode}`}
            className="btn-ghost"
            onClick={() => onCopy(link)}
            style={{
              padding: 8,
              color: copiedId === link.shortCode ? '#10b981' : undefined,
            }}
          >
            {copiedId === link.shortCode ? <Check size={15} /> : <Copy size={15} />}
          </button>

          <a href={`/${link.shortCode}`} target="_blank" rel="noopener noreferrer">
            <button type="button" className="btn-ghost" style={{ padding: 8 }}>
              <ExternalLink size={15} />
            </button>
          </a>

          <Link href={`/api/qr/${link.shortCode}`} target="_blank">
            <button type="button" className="btn-ghost" style={{ padding: 8 }}>
              <QrCode size={15} />
            </button>
          </Link>

          <Link href={`/dashboard/${link.shortCode}`}>
            <button
              type="button"
              id={`analytics-${link.shortCode}`}
              className="btn-ghost"
              style={{ padding: 8, color: 'var(--accent-violet)' }}
            >
              <BarChart3 size={15} />
            </button>
          </Link>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => onToggle(link)}
            style={{ padding: 8 }}
          >
            {link.isActive ? (
              <ToggleRight size={15} color="#10b981" />
            ) : (
              <ToggleLeft size={15} />
            )}
          </button>

          <button
            type="button"
            id={`delete-${link.shortCode}`}
            className="btn-ghost"
            onClick={() => onDelete(link)}
            style={{ padding: 8, color: '#ef4444' }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [allLinks, setAllLinks] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    clicks: 0,
    active: 0,
    thisWeek: 0,
  })

  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ pages: 1, total: 0 })
  const [sortBy, setSortBy] = useState('createdAt')
  const [order, setOrder] = useState('desc')
  const [copiedId, setCopiedId] = useState(null)
  const [search, setSearch] = useState('')
  const [updatingExpiry, setUpdatingExpiry] = useState(null)

  const fetchLinks = useCallback(async () => {
    setLoading(true)

    try {
      const requestSortBy = sortBy === 'status' ? 'createdAt' : sortBy

      const res = await fetch(
        `/api/links?page=${page}&limit=15&sortBy=${requestSortBy}&order=${order}`
      )

      const data = await res.json()
      const links = data.links || []

      setAllLinks(links)
      setPagination(data.pagination || { pages: 1, total: 0 })

      const totalClicks = links.reduce((sum, link) => sum + Number(link.clickCount || 0), 0)
      const activeLinks = links.filter((link) => getLinkStatus(link) === 'active').length
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const thisWeek = links.filter((link) => new Date(link.createdAt) >= sevenDaysAgo).length

      setStats({
        total: data.pagination?.total || 0,
        clicks: totalClicks,
        active: activeLinks,
        thisWeek,
      })
    } catch (error) {
      console.error('Failed to fetch dashboard links:', error)
    } finally {
      setLoading(false)
    }
  }, [page, sortBy, order])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchLinks()
  }, [status, fetchLinks])

  const filteredLinks = useMemo(() => {
    let links = [...allLinks]

    if (search.trim()) {
      const query = search.toLowerCase()

      links = links.filter(
        (link) =>
          link.shortCode.toLowerCase().includes(query) ||
          link.originalUrl.toLowerCase().includes(query)
      )
    }

    if (sortBy === 'status') {
      const statusOrder = {
        active: 1,
        expired: 2,
        inactive: 3,
      }

      links.sort((a, b) => {
        const first = statusOrder[getLinkStatus(a)]
        const second = statusOrder[getLinkStatus(b)]

        return order === 'asc' ? first - second : second - first
      })
    }

    return links
  }, [allLinks, search, sortBy, order])

  const handleCopy = async (link) => {
    const shortUrl = `${window.location.origin}/${link.shortCode}`

    await navigator.clipboard.writeText(shortUrl)

    setCopiedId(link.shortCode)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (link) => {
    if (!confirm(`Delete /${link.shortCode}? This will deactivate the link.`)) return

    await fetch(`/api/links/${link.shortCode}`, {
      method: 'DELETE',
    })

    fetchLinks()
  }

  const handleToggle = async (link) => {
    await fetch(`/api/links/${link.shortCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !link.isActive }),
    })

    fetchLinks()
  }

  const handleUpdateExpiry = async (shortCode, value) => {
    setUpdatingExpiry(shortCode)

    try {
      const res = await fetch(`/api/links/${shortCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresAt: value ? new Date(value).toISOString() : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        alert(data?.error || 'Failed to update expiry date')
        return
      }

      fetchLinks()
    } catch (error) {
      console.error('Failed to update expiry date:', error)
      alert('Failed to update expiry date')
    } finally {
      setUpdatingExpiry(null)
    }
  }

  const toggleSort = (field) => {
    if (sortBy === field) {
      setOrder((currentOrder) => (currentOrder === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(field)
      setOrder('desc')
    }

    setPage(1)
  }

  if (status === 'loading') {
    return (
      <main
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <Loader2 size={32} className="animate-spin" color="var(--accent-violet)" />
      </main>
    )
  }

  return (
    <main style={{ padding: '40px 24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 36,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>
            Dashboard
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Welcome back,{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {session?.user?.name}
            </strong>
          </p>
        </div>

        <Link href="/shorten">
          <button id="new-link-btn" type="button" className="btn-primary" style={{ fontSize: '0.9rem' }}>
            <Plus size={16} /> New Link
          </button>
        </Link>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard
          icon={Link2}
          label="Total Links"
          value={pagination.total}
          color="#8b5cf6"
          loading={loading}
        />

        <StatCard
          icon={MousePointerClick}
          label="Total Clicks"
          value={stats.clicks.toLocaleString()}
          color="#06b6d4"
          loading={loading}
        />

        <StatCard
          icon={Activity}
          label="Active Links"
          value={stats.active}
          color="#10b981"
          loading={loading}
        />

        <StatCard
          icon={TrendingUp}
          label="This Week"
          value={stats.thisWeek}
          color="#f59e0b"
          loading={loading}
        />
      </div>

      {/* Links Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>Your Links</h2>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />

              <input
                id="dashboard-search"
                className="input-field"
                type="text"
                placeholder="Search links…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{
                  paddingLeft: 32,
                  paddingRight: search ? 32 : 14,
                  fontSize: '0.82rem',
                  height: 36,
                  width: 200,
                }}
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Sort Buttons */}
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: '0.8rem' }}
              onClick={() => toggleSort('clickCount')}
            >
              <ArrowUpDown size={14} /> Clicks
            </button>

            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: '0.8rem' }}
              onClick={() => toggleSort('createdAt')}
            >
              <Calendar size={14} /> Date
            </button>

            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: '0.8rem' }}
              onClick={() => toggleSort('status')}
            >
              <Activity size={14} /> Status
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(5)].map((_, index) => (
              <div key={index} className="skeleton" style={{ height: 48 }} />
            ))}
          </div>
        ) : filteredLinks.length === 0 ? (
          <div style={{ padding: '60px 32px', textAlign: 'center' }}>
            {search ? (
              <>
                <Search
                  size={40}
                  color="var(--text-muted)"
                  style={{ margin: '0 auto 16px' }}
                />

                <p style={{ color: 'var(--text-muted)' }}>
                  No links match{' '}
                  <strong style={{ color: 'var(--text-secondary)' }}>
                    &ldquo;{search}&rdquo;
                  </strong>
                </p>

                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="btn-ghost"
                  style={{ marginTop: 12, color: 'var(--accent-violet)' }}
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <Link2
                  size={40}
                  color="var(--text-muted)"
                  style={{ margin: '0 auto 16px' }}
                />

                <p style={{ color: 'var(--text-muted)' }}>
                  No links yet.{' '}
                  <Link href="/shorten" style={{ color: 'var(--accent-violet)' }}>
                    Create your first one!
                  </Link>
                </p>
              </>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Short Link</th>
                  <th>Status</th>
                  <th>Clicks</th>
                  <th>Created</th>
                  <th>Expiry</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredLinks.map((link) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                    onCopy={handleCopy}
                    onUpdateExpiry={handleUpdateExpiry}
                    copiedId={copiedId}
                    updatingExpiry={updatingExpiry}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Search result count */}
        {search && filteredLinks.length > 0 && (
          <div
            style={{
              padding: '10px 24px',
              borderTop: '1px solid var(--border)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            Showing {filteredLinks.length} of {allLinks.length} links matching &ldquo;
            {search}&rdquo;
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && !search && sortBy !== 'status' && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Page {page} of {pagination.pages} ({pagination.total} links)
            </span>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                id="prev-page-btn"
                className="btn-ghost"
                onClick={() => setPage((currentPage) => currentPage - 1)}
                disabled={page <= 1}
                style={{ padding: '8px 12px' }}
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                id="next-page-btn"
                className="btn-ghost"
                onClick={() => setPage((currentPage) => currentPage + 1)}
                disabled={page >= pagination.pages}
                style={{ padding: '8px 12px' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {sortBy === 'status' && (
          <div
            style={{
              padding: '10px 24px',
              borderTop: '1px solid var(--border)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            Status sorting is applied on the current loaded page.
          </div>
        )}
      </div>
    </main>
  )
}

