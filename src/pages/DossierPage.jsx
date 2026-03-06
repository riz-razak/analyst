import { useParams, useNavigate } from 'react-router-dom'
import { getTagColor } from '../styles/theme'

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    height: '48px',
    padding: '0 1.25rem',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    gap: '0.75rem',
    overflow: 'hidden',
    flexShrink: 0,
  },
  leftGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexShrink: 0,
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 10px',
    color: 'var(--accent-orange)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    transition: 'all 150ms ease',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  title: {
    fontFamily: 'var(--font-serif)',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
    minWidth: 0,
  },
  date: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.68rem',
    color: 'var(--accent-orange)',
    flexShrink: 0,
  },
  tags: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0,
  },
  tag: {
    padding: '2px 7px',
    borderRadius: '10px',
    fontSize: '0.6rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  iframe: {
    flex: 1,
    width: '100%',
    border: 'none',
    background: 'var(--bg-primary)',
  },
  loading: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.85rem',
  },
  notFound: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    color: 'var(--text-muted)',
  },
}

export default function DossierPage({ dossiers, theme, toggleTheme }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const dossier = dossiers.find(d => d.id === id)

  if (!dossier) {
    return (
      <div style={styles.page}>
        <div style={styles.topBar}>
          <button style={styles.backBtn} onClick={() => navigate('/')}>
            ← Back to all dossiers
          </button>
        </div>
        <div style={styles.notFound}>
          <span style={{ fontSize: '3rem' }}>📂</span>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
            Dossier not found
          </p>
          <button
            style={{ ...styles.backBtn, marginTop: '0.5rem' }}
            onClick={() => navigate('/')}
          >
            ← Return to research database
          </button>
        </div>
      </div>
    )
  }

  const formattedDate = new Date(dossier.date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div style={styles.leftGroup}>
          <button
            style={styles.backBtn}
            onClick={() => navigate('/')}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--overlay-light)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            ← All Dossiers
          </button>
        </div>

        <div style={styles.meta}>
          <span style={styles.date}>{formattedDate}</span>
          <span style={styles.title}>{dossier.title}</span>
        </div>
      </div>

      <iframe
        src={`${dossier.contentUrl}?v=${Date.now()}`}
        title={dossier.title}
        style={styles.iframe}
      />
    </div>
  )
}
