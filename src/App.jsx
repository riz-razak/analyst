import { useState, useEffect } from 'react'
import { HashRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useDossiers } from './hooks/useDossiers'
import { useTheme } from './hooks/useTheme'
import HomePage from './pages/HomePage'
import DossierPage from './pages/DossierPage'
import './styles/global.css'

function LegacyRedirect() {
  const { id } = useParams()
  return <Navigate to={`/dossier/${id}`} replace />
}

function MLDisclaimerBanner() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const hasSeen = document.cookie.split(';').some(c => c.trim().startsWith('ml_disclaimer='))
    if (!hasSeen) setVisible(true)
  }, [])
  const dismiss = () => {
    setVisible(false)
    document.cookie = 'ml_disclaimer=1; max-age=31536000; path=/; samesite=lax'
  }
  if (!visible) return null
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'var(--overlay-heavy, rgba(10,10,15,0.97))',
      borderTop: '1px solid rgba(255,215,0,0.22)',
      padding: '0.9rem 2rem',
      display: 'flex', alignItems: 'center', gap: '1.5rem',
      fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
    }}>
      <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🤖</span>
      <p style={{ flex: 1, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
        <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>ML-Assisted Research: </span>
        This site uses machine learning to augment human research and analysis. Errors may exist — please fact-check independently. Reliance is at your own risk.
      </p>
      <button onClick={dismiss} style={{
        background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.35)',
        color: 'var(--accent-gold)', padding: '7px 16px', borderRadius: '6px',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem',
        letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>I Understand</button>
      <button onClick={dismiss} style={{
        background: 'none', border: 'none', color: 'var(--text-muted)',
        cursor: 'pointer', fontSize: '1.2rem', padding: '2px 6px', lineHeight: 1,
      }}>✕</button>
    </div>
  )
}

function App() {
  const { dossiers, allTags, loading, error } = useDossiers()
  const { theme, toggleTheme } = useTheme()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.85rem',
      }}>
        Loading research database...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--accent-red)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.85rem',
        gap: '1rem',
      }}>
        <span style={{ fontSize: '2rem' }}>⚠️</span>
        <p>Failed to load dossiers: {error}</p>
      </div>
    )
  }

  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage dossiers={dossiers} allTags={allTags} theme={theme} toggleTheme={toggleTheme} />} />
          <Route path="/dossier/:id" element={<DossierPage dossiers={dossiers} theme={theme} toggleTheme={toggleTheme} />} />
          {/* Legacy redirect: /political-analysis → /dossier/political-analysis */}
          <Route path="/:id" element={<LegacyRedirect />} />
        </Routes>
      </Router>
      <MLDisclaimerBanner />
    </>
  )
}

export default App
