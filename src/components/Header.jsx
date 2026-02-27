import { useNavigate, useLocation } from 'react-router-dom'

const styles = {
  header: {
    padding: '3rem 0 2rem',
    textAlign: 'center',
    position: 'relative',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 14px',
    background: 'var(--overlay-medium)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    fontSize: '0.7rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-orange)',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    marginBottom: '1rem',
    cursor: 'pointer',
  },
  title: {
    fontFamily: 'var(--font-serif)',
    fontSize: 'clamp(2rem, 5vw, 3.2rem)',
    fontWeight: 700,
    background: 'var(--header-gradient)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1.2,
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '1rem',
    fontWeight: 300,
    letterSpacing: '0.5px',
  },
  author: {
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    marginTop: '0.5rem',
    fontFamily: 'var(--font-mono)',
  },
  themeToggle: {
    position: 'absolute',
    top: '1.5rem',
    right: '1.5rem',
    background: 'var(--overlay-light)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '1.1rem',
    lineHeight: 1,
    transition: 'all 150ms ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--text-muted)',
  },
  themeLabel: {
    fontSize: '0.7rem',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.5px',
  },
}

export default function Header({ theme, toggleTheme }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <header style={styles.header}>
      {toggleTheme && (
        <button
          style={styles.themeToggle}
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
          <span style={styles.themeLabel}>{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
      )}
      {!isHome && (
        <div
          style={styles.badge}
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
        >
          Deep Dives
        </div>
      )}
      <h1
        style={{ ...styles.title, cursor: isHome ? 'default' : 'pointer' }}
        onClick={() => !isHome && navigate('/')}
      >
        Digging Deep
      </h1>
      <p style={styles.subtitle}>Deep analysis beyond the headlines</p>
      <p style={styles.author}>with<br />Riz Razak</p>
    </header>
  )
}
