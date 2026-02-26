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
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  leftGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'var(--overlay-light)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontFamily: 'var(--font-sans)',
    transition: 'all 150ms ease',
  },
  themeBtn: {
    background: 'var(--overlay-light)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
    transition: 'all 150ms ease',
    color: 'var(--text-muted)',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    maxWidth: '500px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  date: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    color: 'var(--accent-orange)',
  },
  tags: {
    display: 'flex',
    gap: '5px',
  },
  tag: {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '0.62rem',
    fontWeight: 500,
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
              e.currentTarget.style.background = 'var(--overlay-strong)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--overlay-light)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            ← All Dossiers
          </button>
          {toggleTheme && (
            <button
              style={styles.themeBtn}
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          )}
        </div>

        <div style={styles.meta}>
          <span style={styles.date}>{formattedDate}</span>
          <span style={styles.title}>{dossier.title}</span>
          <div style={styles.tags}>
            {dossier.tags.map(tag => {
              const colors = getTagColor(tag)
              return (
                <span
                  key={tag}
                  style={{
                    ...styles.tag,
                    background: colors.bg,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {tag}
                </span>
              )
            })}
          </div>
        </div>

        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
        }}>
          {dossier.authors.join(', ')}
        </span>
      </div>

      <iframe
        src={dossier.contentUrl}
        title={dossier.title}
        style={styles.iframe}
      />
    </div>
  )
}
