export default function DuplicateChoice({ links, onReuse, onCreate, busy }) {
  return (
    <section
      aria-label="Existing links"
      className="glass-card"
      style={{ padding: 20, marginBottom: 20 }}
    >
      <p>
        You already have links to this destination. Reuse one or create another
        campaign link.
      </p>
      {links.map((link) => (
        <div key={link.shortCode} style={{ marginTop: 12 }}>
          <code>/{link.shortCode}</code>{' '}
          <span>
            {!link.isActive
              ? 'Inactive'
              : link.expiresAt && new Date(link.expiresAt) <= new Date()
                ? 'Expired'
                : 'Active'}
          </span>{' '}
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => onReuse(link)}
          >
            Reuse /{link.shortCode}
          </button>
        </div>
      ))}
      <button
        className="btn-primary"
        style={{ marginTop: 16 }}
        disabled={busy}
        onClick={onCreate}
      >
        Create another
      </button>
    </section>
  )
}
