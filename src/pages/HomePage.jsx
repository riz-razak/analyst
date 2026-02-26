import { useState, useMemo, useCallback } from 'react'
import Header from '../components/Header'
import SearchBar from '../components/SearchBar'
import TagFilter from '../components/TagFilter'
import ViewToggle from '../components/ViewToggle'
import TileGrid from '../components/TileGrid'
import DossierList from '../components/DossierList'
import Footer from '../components/Footer'
import { useSearch } from '../hooks/useSearch'

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    paddingBottom: '3rem',
  },
  stats: {
    textAlign: 'center',
    marginBottom: '1.5rem',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-mono)',
  },
}

export default function HomePage({ dossiers, allTags, theme, toggleTheme }) {
  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [view, setView] = useState('list')

  const searched = useSearch(dossiers, query)

  const filtered = useMemo(() => {
    if (selectedTags.length === 0) return searched
    return searched.filter(d =>
      selectedTags.every(tag => d.tags.includes(tag))
    )
  }, [searched, selectedTags])

  const handleToggleTag = useCallback((tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }, [])

  return (
    <div style={styles.page}>
      <Header theme={theme} toggleTheme={toggleTheme} />

      <div style={styles.content}>
        <SearchBar
          value={query}
          onChange={setQuery}
          resultCount={filtered.length}
          totalCount={dossiers.length}
        />

        <TagFilter
          tags={allTags}
          selectedTags={selectedTags}
          onToggle={handleToggleTag}
        />

        <ViewToggle view={view} onChangeView={setView} />

        <p style={styles.stats}>
          {filtered.length} dossier{filtered.length !== 1 ? 's' : ''}
          {selectedTags.length > 0 ? ` · filtered by ${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}` : ''}
        </p>

        {view === 'tile' ? (
          <TileGrid dossiers={filtered} />
        ) : (
          <DossierList dossiers={filtered} />
        )}
      </div>

      <Footer />
    </div>
  )
}
