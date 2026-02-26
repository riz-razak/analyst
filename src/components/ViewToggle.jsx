const styles = {
  wrapper: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'center',
    marginBottom: '2rem',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    padding: '4px',
    width: 'fit-content',
    margin: '0 auto 2rem',
  },
  button: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.82rem',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 150ms ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
}

export default function ViewToggle({ view, onChangeView }) {
  return (
    <div style={styles.wrapper}>
      <button
        style={{
          ...styles.button,
          background: view === 'list' ? 'var(--bg-card)' : 'transparent',
          color: view === 'list' ? 'var(--text-primary)' : 'var(--text-muted)',
          boxShadow: view === 'list' ? 'var(--shadow-sm)' : 'none',
        }}
        onClick={() => onChangeView('list')}
      >
        <span style={{ fontSize: '1rem' }}>☰</span> List
      </button>
      <button
        style={{
          ...styles.button,
          background: view === 'tile' ? 'var(--bg-card)' : 'transparent',
          color: view === 'tile' ? 'var(--text-primary)' : 'var(--text-muted)',
          boxShadow: view === 'tile' ? 'var(--shadow-sm)' : 'none',
        }}
        onClick={() => onChangeView('tile')}
      >
        <span style={{ fontSize: '1rem' }}>▦</span> Tiles
      </button>
    </div>
  )
}
