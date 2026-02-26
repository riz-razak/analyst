import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTagColor } from '../styles/theme'

const styles = {
  wrapper: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '0 1rem',
  },
  headerRow: {
    display: 'grid',
    gridTemplateColumns: '100px 1fr 2fr 140px',
    gap: '1rem',
    padding: '0.75rem 1.25rem',
    borderBottom: '1px solid var(--border-color)',
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '100px 1fr 2fr 140px',
    gap: '1rem',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    alignItems: 'center',
    animation: 'fadeInUp 0.3s ease both',
  },
  date: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.78rem',
    color: 'var(--accent-orange)',
    whiteSpace: 'nowrap',
  },
  titleCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    fontFamily: 'var(--font-serif)',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  tag: {
    padding: '1px 7px',
    borderRadius: '10px',
    fontSize: '0.6rem',
    fontWeight: 500,
  },
  description: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  authors: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-sans)',
  },
  empty: {
    textAlign: 'center',
    padding: '4rem 2rem',
    color: 'var(--text-muted)',
  },
}

export default function DossierList({ dossiers }) {
  const navigate = useNavigate()

  if (dossiers.length === 0) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.empty}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</p>
          <p style={{ fontFamily: 'var(--font-serif)' }}>No dossiers match your search</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.headerRow}>
        <span>Date</span>
        <span>Title</span>
        <span>Description</span>
        <span>Authors</span>
      </div>
      {dossiers.map((d, i) => (
        <ListRow key={d.id} dossier={d} index={i} onClick={() => navigate(`/dossier/${d.id}`)} />
      ))}
    </div>
  )
}

function ListRow({ dossier, index, onClick }) {
  const [hovered, setHovered] = useState(false)

  const formattedDate = new Date(dossier.date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <div
      style={{
        ...styles.row,
        background: hovered ? 'var(--bg-card)' : 'transparent',
        animationDelay: `${index * 40}ms`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <span style={styles.date}>{formattedDate}</span>
      <div style={styles.titleCol}>
        <span style={styles.title}>{dossier.title}</span>
        <div style={styles.tags}>
          {dossier.tags.slice(0, 4).map(tag => {
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
      <span style={styles.description}>{dossier.description}</span>
      <span style={styles.authors}>{dossier.authors.join(', ')}</span>
    </div>
  )
}
