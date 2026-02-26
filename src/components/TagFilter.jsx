import { getTagColor } from '../styles/theme'

const styles = {
  wrapper: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
    maxWidth: '800px',
    margin: '0 auto 2rem',
    padding: '0 1rem',
  },
  tag: {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 150ms ease',
    userSelect: 'none',
    letterSpacing: '0.3px',
  },
}

export default function TagFilter({ tags, selectedTags, onToggle }) {
  return (
    <div style={styles.wrapper}>
      {tags.map(tag => {
        const colors = getTagColor(tag)
        const isActive = selectedTags.includes(tag)
        return (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            style={{
              ...styles.tag,
              background: isActive ? colors.text : colors.bg,
              color: isActive ? 'var(--tag-active-text)' : colors.text,
              border: `1px solid ${isActive ? colors.text : colors.border}`,
              fontWeight: isActive ? 600 : 500,
              transform: isActive ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            {tag}
          </button>
        )
      })}
      {selectedTags.length > 0 && (
        <button
          onClick={() => selectedTags.forEach(t => onToggle(t))}
          style={{
            ...styles.tag,
            background: 'var(--overlay-light)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-color)',
          }}
        >
          Clear all ✕
        </button>
      )}
    </div>
  )
}
