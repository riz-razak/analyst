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
    <Router>
      <Routes>
        <Route path="/" element={<HomePage dossiers={dossiers} allTags={allTags} theme={theme} toggleTheme={toggleTheme} />} />
        <Route path="/dossier/:id" element={<DossierPage dossiers={dossiers} theme={theme} toggleTheme={toggleTheme} />} />
        {/* Legacy redirect: /political-analysis → /dossier/political-analysis */}
        <Route path="/:id" element={<LegacyRedirect />} />
      </Routes>
    </Router>
  )
}

export default App
