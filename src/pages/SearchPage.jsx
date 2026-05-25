import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import '../styles/search.css'

const TOPIC_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'power', label: 'Power' },
  { id: 'economy', label: 'Economy' },
  { id: 'world', label: 'World' },
  { id: 'rights', label: 'Rights' },
  { id: 'ideas', label: 'Ideas' },
]

const normalizeText = value => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

const normalizeRoute = (url, slug) => {
  if (!url) return `/${slug}`
  if (/^https?:/.test(url)) return new URL(url).pathname.replace(/\/index\.html$/, '')
  return url.replace(/\/index\.html$/, '')
}

const inferEvidenceStatus = (item) => {
  const haystack = normalizeText([item.category, item.kicker, item.description, ...(item.tags || [])].join(' '))
  if (haystack.includes('allegation') || haystack.includes('alleged')) return 'allegation'
  if (haystack.includes('source') || haystack.includes('evidence') || haystack.includes('claim')) return 'source-gated'
  if (haystack.includes('opinion')) return 'opinion'
  return 'published'
}

const inferTopic = (item) => {
  const haystack = normalizeText([item.category, item.kicker, item.description, ...(item.tags || [])].join(' '))
  if (/politics|governance|accountability|corruption|procurement|state|law|religious/.test(haystack)) return 'power'
  if (/economy|finance|trade|energy|oil|hormuz|business/.test(haystack)) return 'economy'
  if (/geopolitics|global|world|war|iran|israel/.test(haystack)) return 'world'
  if (/rights|justice|women|sexual|violence|child/.test(haystack)) return 'rights'
  return 'ideas'
}

function localSearch(dossiers, query, topic) {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean)
  return dossiers
    .filter(item => item.status === 'published')
    .map(item => {
      const searchText = normalizeText([
        item.title,
        item.titleSi,
        item.description,
        item.descriptionSi,
        item.category,
        item.kicker,
        ...(item.tags || []),
        ...(item.tagsSi || []),
      ].join(' '))
      const itemTopic = inferTopic(item)
      let score = terms.length ? 0 : 1
      terms.forEach(term => {
        if (normalizeText(item.title).includes(term)) score += 10
        if (searchText.includes(term)) score += 2
      })
      return {
        slug: item.id,
        title: item.title,
        url: normalizeRoute(item.contentUrl, item.id),
        date: item.date,
        category: item.category || itemTopic,
        tags: item.tags || [],
        language: item.titleSi || item.descriptionSi ? 'mixed' : 'en',
        evidenceStatus: inferEvidenceStatus(item),
        snippet: item.description || '',
        score,
        topic: itemTopic,
      }
    })
    .filter(item => topic === 'all' || item.topic === topic || normalizeText(item.tags.join(' ')).includes(topic))
    .filter(item => !terms.length || item.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 12)
}

function SearchResultCard({ result }) {
  return (
    <Link className="search-result" to={result.url}>
      <div className="search-result__meta">
        <span>{result.category || 'Article'}</span>
        <span>{result.date || 'Undated'}</span>
        <span>{result.language || 'en'}</span>
      </div>
      <h2>{result.title}</h2>
      {result.snippet && <p>{result.snippet}</p>}
      <div className="search-result__footer">
        <span className="search-result__evidence">{result.evidenceStatus || 'published'}</span>
        {(result.tags || []).slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}
      </div>
    </Link>
  )
}

export default function SearchPage({ dossiers }) {
  const [params, setParams] = useSearchParams()
  const initialQuery = params.get('q') || ''
  const initialTopic = params.get('topic') || 'all'
  const [query, setQuery] = useState(initialQuery)
  const [topic, setTopic] = useState(initialTopic)
  const [apiState, setApiState] = useState({ loading: false, error: '', results: [], answer: null, source: 'local' })

  const fallbackResults = useMemo(() => localSearch(dossiers, query, topic), [dossiers, query, topic])

  const runSearch = useCallback(async ({ nextQuery = query, nextTopic = topic, mode = 'retrieve' } = {}) => {
    const trimmed = nextQuery.trim()
    setQuery(nextQuery)
    setTopic(nextTopic)
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (trimmed) next.set('q', trimmed)
      else next.delete('q')
      if (nextTopic && nextTopic !== 'all') next.set('topic', nextTopic)
      else next.delete('topic')
      return next
    })

    if (!trimmed) {
      setApiState({ loading: false, error: '', results: [], answer: null, source: 'local' })
      return
    }

    setApiState(prev => ({ ...prev, loading: true, error: '' }))
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&topic=${encodeURIComponent(nextTopic)}&mode=${mode}`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`Search API returned ${response.status}`)
      const data = await response.json()
      setApiState({
        loading: false,
        error: '',
        results: Array.isArray(data.results) ? data.results : [],
        answer: data.answer || null,
        source: 'api',
      })
    } catch (_error) {
      setApiState({
        loading: false,
        error: 'Worker search unavailable in this environment; showing local registry results.',
        results: [],
        answer: null,
        source: 'local',
      })
    }
  }, [query, setParams, topic])

  useEffect(() => {
    if (initialQuery) runSearch({ nextQuery: initialQuery, nextTopic: initialTopic })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleResults = apiState.source === 'api' ? apiState.results : fallbackResults

  return (
    <main className="search-page">
      <header className="search-header">
        <Link className="search-header__brand" to="/">The Analyst<span>·</span></Link>
        <div>
          <p>Evidence Search</p>
          <h1>Search the approved public archive.</h1>
        </div>
      </header>

      <section className="search-console" aria-label="Search the archive">
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault()
            runSearch()
          }}
        >
          <label htmlFor="archive-search">Archive query</label>
          <div className="search-form__row">
            <input
              id="archive-search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search dossiers, claims, people, topics"
              maxLength={160}
            />
            <button type="submit">Search</button>
          </div>
        </form>

        <div className="search-filters" aria-label="Topic filters">
          {TOPIC_FILTERS.map(filter => (
            <button
              key={filter.id}
              type="button"
              className={topic === filter.id ? 'active' : ''}
              onClick={() => runSearch({ nextTopic: filter.id })}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="search-policy">
          <span>Retrieval first</span>
          <span>Approved public material only</span>
          <span>Answer mode stays citation-gated</span>
        </div>
      </section>

      {apiState.answer && (
        <section className="search-answer" aria-label="Answer mode status">
          <strong>{apiState.answer.status}</strong>
          <p>{apiState.answer.message}</p>
        </section>
      )}

      {apiState.error && <p className="search-note">{apiState.error}</p>}

      <section className="search-results" aria-live="polite">
        <div className="search-results__head">
          <span>{apiState.loading ? 'Searching' : `${visibleResults.length} results`}</span>
          <span>{apiState.source === 'api' ? 'Worker index' : 'Local registry fallback'}</span>
        </div>
        {visibleResults.map(result => <SearchResultCard key={result.slug} result={result} />)}
        {!apiState.loading && visibleResults.length === 0 && (
          <div className="search-empty">
            <h2>No supported result in the indexed archive.</h2>
            <p>Try a person, place, article title, topic, or evidence phrase from a published dossier.</p>
          </div>
        )}
      </section>
    </main>
  )
}
