import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTagColor } from '../styles/theme'

const styles = {
  card: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'all 250ms ease',
    display: 'flex',
    flexDirection: 'column',
    animation: 'fadeInUp 0.4s ease both',
  },
  imageWrapper: {
    position: 'relative',
    paddingTop: '56.25%', /* 16:9 */
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 400ms ease',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--placeholder-gradient)',
    fontSize: '2.5rem',
  },
  body: {
    padding: '1rem 1.2rem 1.2rem',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  date: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    color: 'var(--accent-orange)',
    letterSpacing: '0.5px',
  },
  title: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1.05rem',
    fontWeight: 600,
    lineHeight: 1.3,
    color: 'var(--text-primary)',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px',
    marginTop: 'auto',
    paddingTop: '0.5rem',
  },
  tag: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.65rem',
    fontWeight: 500,
    letterSpacing: '0.3px',
  },
}

const TOPIC_EMOJIS = {
  'Cricket': '🏏', 'Politics': '🏛️', 'Corruption': '💰', 'Sports': '⚽',
  'Sri Lanka': '🇱🇰', 'Security': '🔒', 'Economy': '📊', 'Military': '⚔️',
  'Religion': '🕉️', 'Government': '🏛️', 'Terrorism': '💣', 'Intelligence': '🕵️',
}

function getEmoji(tags) {
  for (const tag of tags) {
    if (TOPIC_EMOJIS[tag]) return TOPIC_EMOJIS[tag]
  }
  return '📄'
}

export default function DossierTile({ dossier, index }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const [imgError, setImgError] = useState(false)

  const formattedDate = new Date(dossier.date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <div
      style={{
        ...styles.card,
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        borderColor: hovered ? 'var(--border-hover)' : 'var(--border-color)',
        boxShadow: hovered ? 'var(--shadow-hover)' : 'var(--shadow-md)',
        animationDelay: `${index * 50}ms`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/dossier/${dossier.id}`)}
      role="button"
      tabIndex={0}
    >
      <div style={styles.imageWrapper}>
        {!imgError && dossier.thumbnailUrl ? (
          <img
            src={dossier.thumbnailUrl}
            alt={dossier.title}
            style={{
              ...styles.image,
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
            }}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={styles.placeholder}>
            {getEmoji(dossier.tags)}
          </div>
        )}
      </div>

      <div style={styles.body}>
        <span style={styles.date}>{formattedDate}</span>
        <h3 style={styles.title}>{dossier.title}</h3>
        <div style={styles.tags}>
          {dossier.tags.slice(0, 3).map(tag => {
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
          {dossier.tags.length > 3 && (
            <span style={{
              ...styles.tag,
              background: 'var(--overlay-light)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
            }}>
              +{dossier.tags.length - 3}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
