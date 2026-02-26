import { useState, useCallback } from 'react'

const styles = {
  wrapper: {
    position: 'relative',
    maxWidth: '600px',
    margin: '0 auto 1.5rem',
  },
  icon: {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    fontSize: '1rem',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '14px 44px 14px 44px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
  },
  clear: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'var(--overlay-medium)',
    border: 'none',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'background var(--transition-fast)',
  },
  count: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-mono)',
    marginTop: '0.5rem',
  },
}

export default function SearchBar({ value, onChange, resultCount, totalCount }) {
  const [focused, setFocused] = useState(false)

  const handleClear = useCallback(() => {
    onChange('')
  }, [onChange])

  return (
    <div style={styles.wrapper}>
      <span style={styles.icon}>&#x1F50D;</span>
      <input
        type="text"
        placeholder="Search dossiers by title, topic, tag..."
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...styles.input,
          borderColor: focused ? 'var(--accent-cyan)' : 'var(--border-color)',
          boxShadow: focused ? '0 0 0 3px var(--overlay-medium)' : 'none',
        }}
      />
      {value && (
        <button style={styles.clear} onClick={handleClear} title="Clear search">
          ✕
        </button>
      )}
      {value && (
        <p style={styles.count}>
          {resultCount} of {totalCount} dossier{totalCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
