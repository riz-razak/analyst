import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/magazine.css'

const FILTERS = ['All', 'This Week', 'This Month']
const LOCATIONS = ['Colombo, Sri Lanka', 'London, United Kingdom', 'Washington D.C., USA', 'Singapore', 'Dubai, UAE']

const fallbackStripSets = [
  [
    { gradient: 'g2', kicker: 'Corruption', title: 'Sri Lankan Cricket Corruption', meta: 'Dossier' },
    { gradient: 'g3', kicker: 'Geopolitics', title: 'Iran, Israel & American Power', meta: 'Analysis' },
    { gradient: 'g4', kicker: 'Economy', title: 'Sri Lanka & the Hormuz Crisis', meta: 'Explainer' },
  ],
  [
    { gradient: 'g9', kicker: 'Tool', kickerVariant: 'tool', title: 'Hormuz Oracle', meta: 'Scenario model' },
    { gradient: 'g10', kicker: 'Archive', kickerVariant: 'intel', title: 'Architecture Census', meta: 'Infrastructure monitor' },
    { gradient: 'g11', kicker: 'Philosophy', title: 'Anatta, Bamiyan, and Non-Self', meta: 'Essay' },
  ],
  [
    { gradient: 'g5', kicker: 'Accountability', title: 'Caravan Fresh Case Study', meta: 'Consumer advocacy' },
    { gradient: 'g12', kicker: 'Media', title: 'Happy Womaniser Day!', meta: 'Press ethics' },
    { gradient: 'g6', kicker: 'Portal', kickerVariant: 'tool', title: 'WarenYan Document Portal', meta: 'Internal archive' },
  ],
]

const accountabilityAlerts = [
  {
    type: 'internal',
    label: 'Correction',
    title: 'Homepage magazine redesign in progress; live-data labels withheld until sources are wired',
    meta: 'Transparency note',
  },
]

const tools = {
  intelCards: [
    {
      label: 'Editor Pinned',
      figure: 'Hormuz',
      description: 'Crisis scenario modelling for Sri Lanka energy exposure',
      change: 'Reference model, not live market data',
    },
  ],
  featuredTools: [
    {
      name: 'Hormuz Oracle',
      description: 'Probability-weighted crisis scenarios for SL energy supply',
      href: 'https://oracle-v7.pages.dev',
      badges: ['Reference', 'External'],
    },
  ],
  inlineTools: [
    { name: 'Architecture Census', href: '/architecture-census/', status: 'pinned', tag: 'Monitor' },
    { name: 'WarenYan Portal', href: '/waren-yan/', status: 'pinned', tag: 'Portal' },
    { name: 'Admin Preview', href: '/admin-preview.html', status: 'default', tag: 'Admin' },
  ],
}

const formatDate = (date) => {
  if (!date) return 'Undated'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date))
}

const dateMeta = (date, readTime) => `${formatDate(date)} · ${readTime}`

const titleCase = (value = '') => value.split(/[-_\s]+/).filter(Boolean).map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ')

const normalizeDossier = (dossier, index) => {
  const authors = Array.isArray(dossier.authors) ? dossier.authors : [dossier.author].filter(Boolean)
  const sourceCount = dossier.sourceCount || dossier.sources || dossier.sections || 0
  return {
    ...dossier,
    author: authors[0] || 'Riz Razak',
    excerpt: dossier.excerpt || dossier.description || dossier.summary || '',
    gradient: dossier.gradient || `g${(index % 12) + 1}`,
    kicker: dossier.kicker || titleCase(dossier.category || dossier.tags?.[0] || 'Dossier'),
    readTime: dossier.readTime || `${Math.max(8, Math.min(28, (dossier.sections || 6) * 2))} min`,
    sourceLabel: dossier.sourceLabel || (sourceCount ? `${sourceCount} sections` : 'Source register'),
    thumbnail: dossier.thumbnail || dossier.thumbnailUrl,
    url: dossier.contentUrl || `/${dossier.id}`,
  }
}

const useStripRotation = (sets, interval = 15000) => {
  const [currentSet, setCurrentSet] = useState(0)
  const [flipping, setFlipping] = useState([false, false, false])
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (paused || sets.length < 2) return undefined

    timerRef.current = window.setInterval(() => {
      ;[0, 1, 2].forEach((index) => {
        window.setTimeout(() => {
          setFlipping(prev => prev.map((value, itemIndex) => itemIndex === index ? true : value))
        }, index * 120)
      })

      window.setTimeout(() => {
        setCurrentSet(prev => (prev + 1) % sets.length)
        setFlipping([false, false, false])
      }, 720)
    }, interval)

    return () => window.clearInterval(timerRef.current)
  }, [interval, paused, sets.length])

  return { currentSet, flipping, pause: () => setPaused(true), resume: () => setPaused(false), paused }
}

const getFiltered = (items, filter) => {
  if (filter === 'All') return items
  const now = Date.now()
  const limit = filter === 'This Week' ? 7 : 31
  return items.filter(item => {
    const time = new Date(item.date).getTime()
    if (Number.isNaN(time)) return false
    return (now - time) / (1000 * 60 * 60 * 24) <= limit
  })
}

function Nameplate({ view, onViewChange, menuOpen, setMenuOpen }) {
  const [location, setLocation] = useState(LOCATIONS[0])
  const [open, setOpen] = useState(false)
  const date = useMemo(() => new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date()), [])

  return (
    <header className="nameplate">
      <div className="nameplate__left">
        <button className="nameplate__loc" type="button" onClick={() => setOpen(prev => !prev)} aria-expanded={open}>
          {location}
        </button>
        <div className="nameplate__date">{date}</div>
        <div className={`loc-dropdown ${open ? 'open' : ''}`}>
          {LOCATIONS.map(item => (
            <button
              key={item}
              type="button"
              className={`loc-opt ${item === location ? 'loc-opt--active' : ''}`}
              onClick={() => { setLocation(item); setOpen(false) }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="nameplate__brand"><h1>The Analyst</h1><span className="np-dot">&middot;</span></div>

      <div className="nameplate__right">
        <div className="view-sw" role="group" aria-label="Homepage view">
          <button className={`view-sw__opt ${view === 'mag' ? 'view-sw__opt--active' : ''}`} type="button" onClick={() => onViewChange('mag')}>
            <span className="view-sw__grid" aria-hidden="true" /> Magazine
          </button>
          <button className={`view-sw__opt ${view === 'fyp' ? 'view-sw__opt--active' : ''}`} type="button" onClick={() => onViewChange('fyp')}>
            <span className="view-sw__feed" aria-hidden="true" /> FYP
          </button>
        </div>
        <button className="ham" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu" aria-expanded={menuOpen}>
          <span /><span /><span />
        </button>
      </div>
    </header>
  )
}

function MenuPanel({ open, onClose, theme, toggleTheme }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  return (
    <div className={`menu-overlay ${open ? 'open' : ''}`} onClick={onClose}>
      <nav className="menu-panel" aria-label="Site menu" onClick={event => event.stopPropagation()}>
        <button className="menu-close" type="button" onClick={onClose} aria-label="Close menu">&times;</button>

        <div className="menu-label">Navigate</div>
        <a className="menu-link" href="/">Home</a>
        <a className="menu-link" href="#dossiers">Dossiers<span className="menu-link__sub">Published investigations and essays</span></a>
        <a className="menu-link" href="#tools">Tools & Dashboards<span className="menu-link__sub">Models, monitors, and portals</span></a>
        <a className="menu-link" href="https://rizrazak.com">About Riz</a>

        <div className="menu-label">Accountability</div>
        <a className="menu-link menu-link--acct" href="#accountability">MP Accountability Tracker<span className="menu-link__sub">Formerly Pavura.lk · planned section</span></a>
        <a className="menu-link" href="#corrections">Corrections & Retractions<span className="menu-link__sub">Editorial transparency log</span></a>
        <a className="menu-link" href="/admin-submissions.html">Submit Evidence<span className="menu-link__sub">Evidence intake queue</span></a>

        <div className="menu-label">Preferences</div>
        <div className="menu-toggle-row"><span>සිංහල / English</span><span className="menu-note">Soon</span></div>
        <div className="menu-toggle-row">
          <span>Dark Mode</span>
          <button type="button" className={`menu-toggle ${theme === 'dark' ? 'on' : ''}`} onClick={toggleTheme} aria-label="Toggle dark mode" />
        </div>

        <div className="menu-label">Legal</div>
        <a className="menu-link" href="#privacy">Privacy Policy</a>
        <a className="menu-link" href="#terms">Terms of Use</a>
        <a className="menu-link" href="#ai-safety">AI Safety & Ethics</a>
      </nav>
    </div>
  )
}

function AccountabilityTicker({ alerts, hidden }) {
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!alerts.length) return undefined
    const timeout = window.setTimeout(() => setGone(true), alerts.length === 1 ? 60000 : alerts.length * 15000)
    return () => window.clearTimeout(timeout)
  }, [alerts.length])

  if (!alerts.length) return null
  const alert = alerts[0]
  return (
    <div className={`acct-ticker ${gone || hidden ? 'acct-ticker--gone' : ''}`}>
      <div className={`acct-strip ${alert.type === 'internal' ? 'acct-strip--internal' : ''}`}>
        <span className="acct-strip__dot" /><span className="acct-strip__type">{alert.label}</span><span className="acct-strip__sep">|</span>
        <span className="acct-strip__title">{alert.title}</span><span className="acct-strip__meta">{alert.meta}</span>
      </div>
    </div>
  )
}

function GradientImage({ item, className }) {
  const [failed, setFailed] = useState(false)
  if (item?.thumbnail && !failed) return <img className={className} src={item.thumbnail} alt="" loading="lazy" onError={() => setFailed(true)} />
  return <div className={`${className} ${item?.gradient || 'g1'}`} />
}

function Hero({ dossier, navigate }) {
  return (
    <section className="hero" aria-label="Featured investigation">
      <GradientImage item={dossier} className="hero__img" />
      <div className="hero__grad" />
      <article className="hero__card" onClick={() => navigate(dossier.url)}>
        <div className="kicker">Featured Investigation</div>
        <h2 className="hero__card-title">{dossier.title}</h2>
        <p className="hero__card-excerpt">{dossier.excerpt}</p>
        <div className="hero__card-meta">
          <div className="mk"><span className="mk__k">Author</span><span className="mk__v">{dossier.author}</span></div>
          <div className="mk"><span className="mk__k">Published</span><span className="mk__v">{formatDate(dossier.date)}</span></div>
          <div className="mk"><span className="mk__k">Read</span><span className="mk__v">{dossier.readTime}</span></div>
          <div className="mk"><span className="mk__k">Sources</span><span className="mk__v mk__v--hi">{dossier.sourceLabel}</span></div>
        </div>
        <div className="tag-row">{(dossier.tags || []).slice(0, 3).map((tag, index) => <span key={tag} className={`tag ${index === 0 ? 'tg' : index === 1 ? 'tt' : 'tw'}`}>{tag}</span>)}</div>
      </article>
    </section>
  )
}

function RotatingStrip({ sets }) {
  const { currentSet, flipping, pause, resume, paused } = useStripRotation(sets)
  const current = sets[currentSet] || sets[0]
  return (
    <section className="strip" onMouseEnter={pause} onMouseLeave={resume} aria-label="Featured strip">
      {current.map((item, index) => (
        <div className="strip__slot" key={`${currentSet}-${index}`}>
          <article className={`strip__item ${flipping[index] ? 'strip__item--flip-out' : ''}`}>
            <GradientImage item={item} className="strip__thumb" />
            <div><div className={`strip__kicker ${item.kickerVariant ? `strip__kicker--${item.kickerVariant}` : ''}`}>{item.kicker}</div><h3 className="strip__title">{item.title}</h3><div className="strip__meta">{item.meta}</div></div>
          </article>
          {index < current.length - 1 && <div className="strip__rule" />}
        </div>
      ))}
      <div className={`strip__progress ${paused ? 'paused' : ''}`} key={currentSet} />
    </section>
  )
}

function FilterBar({ label, active, onChange }) {
  return (
    <div className="filter-bar">
      <div className="filter-bar__label">{label}</div>
      <div className="filter-bar__tabs">{FILTERS.map(filter => <button key={filter} type="button" className={filter === active ? 'on' : ''} onClick={() => onChange(filter)}>{filter}</button>)}</div>
    </div>
  )
}

function ArticleCard({ dossier, lead, navigate }) {
  return (
    <article className="art" onClick={() => navigate(dossier.url)}>
      {lead && <GradientImage item={dossier} className="art__thumb" />}
      <h3 className="art__title">{dossier.title}</h3>
      {lead && <p className="art__excerpt">{dossier.excerpt}</p>}
      <div className="art__meta">{dateMeta(dossier.date, dossier.readTime)}</div>
    </article>
  )
}

function CategoryColumns({ dossiers, navigate }) {
  const columns = [
    { title: 'Latest', badge: 'Chronological', variant: 'chr', items: dossiers.slice(0, 3) },
    { title: 'Governance & Power', badge: 'For you', variant: 'algo', items: dossiers.filter(d => /corruption|governance|politic|media/i.test(`${d.category} ${d.tags?.join(' ')}`)).slice(0, 3) },
    { title: 'Geopolitics & Ideas', badge: 'For you', variant: 'algo', items: dossiers.filter(d => /geopolitics|philosophy|energy|buddhism/i.test(`${d.category} ${d.tags?.join(' ')}`)).slice(0, 3) },
  ]

  return (
    <div className="cols" id="dossiers">
      {columns.map((column, columnIndex) => (
        <div className="col" key={column.title}>
          <div className="cat-head"><span className="cat-head__title">{column.title}</span><span className={`cat-head__badge cat-head__badge--${column.variant}`}>{column.badge}</span></div>
          {(column.items.length ? column.items : dossiers.slice(columnIndex, columnIndex + 3)).map((dossier, index) => <ArticleCard key={`${column.title}-${dossier.id}`} dossier={dossier} lead={index === 0} navigate={navigate} />)}
        </div>
      ))}
    </div>
  )
}

function Sidebar({ dossiers, navigate }) {
  return (
    <aside className="side" id="tools">
      <div className="sec-label">Trending</div>
      {dossiers.slice(0, 3).map(dossier => (
        <article className="sb-item" key={dossier.id} onClick={() => navigate(dossier.url)}>
          <GradientImage item={dossier} className="sb-thumb" />
          <div><h3 className="sb-title">{dossier.title}</h3><div className="sb-meta">{dossier.readTime}</div></div>
        </article>
      ))}

      <div className="tools-section">
        <div className="tools-label">Tools & Intel</div>
        {tools.intelCards.map(card => <div className="intel-card" key={card.figure}><div className="intel-card__label">{card.label}</div><div className="intel-card__figure">{card.figure}</div><div className="intel-card__desc">{card.description}</div><div className="intel-card__change">{card.change}</div></div>)}
        {tools.featuredTools.map(tool => <a className="tool-feature" href={tool.href} key={tool.name}><div className="tool-feature__pinned">Editor Pinned</div><div className="tool-feature__name">{tool.name}</div><div className="tool-feature__desc">{tool.description}</div><div className="tool-feature__meta">{tool.badges.map(badge => <span className="tool-feature__badge" key={badge}>{badge}</span>)}</div></a>)}
        {tools.inlineTools.map(tool => <a className="tool-inline" href={tool.href} key={tool.name}><span className={`tool-inline__dot tool-inline__dot--${tool.status}`} /><span className="tool-inline__name">{tool.name}</span><span className="tool-inline__tag">{tool.tag}</span></a>)}
      </div>
    </aside>
  )
}

function Pagination() {
  return <div className="pagination"><button type="button">&larr;</button><button className="pg" type="button">1</button><button type="button">2</button><button type="button">3</button><button type="button">&rarr;</button></div>
}

function FYPView({ dossiers, filter, onFilterChange, navigate }) {
  return (
    <main className="fyp-view">
      <FilterBar label="For You" active={filter} onChange={onFilterChange} />
      {dossiers.map(dossier => (
        <article className="fyp-card" key={dossier.id} onClick={() => navigate(dossier.url)}>
          <GradientImage item={dossier} className="fyp-card__img" />
          <div className="fyp-card__body"><div className="fyp-card__kicker">{dossier.kicker}</div><h2 className="fyp-card__title">{dossier.title}</h2><p className="fyp-card__excerpt">{dossier.excerpt}</p><div className="fyp-card__meta"><span>{dossier.author}</span><span>{formatDate(dossier.date)}</span><span>{dossier.readTime}</span></div><div className="fyp-card__tags">{(dossier.tags || []).slice(0, 3).map((tag, index) => <span key={tag} className={`tag ${index === 0 ? 'tg' : index === 1 ? 'tt' : 'tw'}`}>{tag}</span>)}</div></div>
        </article>
      ))}
      <Pagination />
    </main>
  )
}

function MagazineView({ dossiers, filter, onFilterChange, navigate }) {
  const hero = dossiers[0]
  const stripSets = useMemo(() => {
    if (dossiers.length < 3) return fallbackStripSets
    return [0, 1, 2].map(setIndex => dossiers.slice(setIndex * 3, setIndex * 3 + 3).map((dossier, index) => ({ ...dossier, title: dossier.title, meta: dateMeta(dossier.date, dossier.readTime), kicker: dossier.kicker, gradient: dossier.gradient || `g${setIndex * 3 + index + 1}` }))).filter(set => set.length === 3)
  }, [dossiers])

  return (
    <main className="mag-view">
      {hero && <Hero dossier={hero} navigate={navigate} />}
      <RotatingStrip sets={stripSets.length ? stripSets : fallbackStripSets} />
      <div className="wrap">
        <div className="body-grid">
          <section className="main">
            <FilterBar label="Dossiers" active={filter} onChange={onFilterChange} />
            <CategoryColumns dossiers={dossiers} navigate={navigate} />
            <Pagination />
          </section>
          <Sidebar dossiers={dossiers} navigate={navigate} />
        </div>
      </div>
    </main>
  )
}

function MagazineFooter({ dossierCount }) {
  return (
    <footer className="mag-footer">
      <div className="mag-footer__top"><div><div className="mag-footer__brand">The Analyst<span className="np-dot-sm">&middot;</span></div><div className="mag-footer__tagline">Dig deep. Stay free.</div></div><div className="mag-footer__links"><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#ai-safety">AI Safety</a><a href="#ethics">Ethics Protocol</a><a href="mailto:riz@dgtl.lk">Contact</a></div></div>
      <div className="mag-footer__divider" />
      <div className="mag-footer__bottom"><div>&copy; 2026 Riz Razak · analyst.rizrazak.com</div><div className="mag-footer__stats"><span><b>{dossierCount}</b> dossiers</span><span><b>3</b> exclusives</span><span><b>Tools</b> referenced</span></div></div>
    </footer>
  )
}

export default function HomePage({ dossiers, theme, toggleTheme }) {
  const navigate = useNavigate()
  const [view, setView] = useState('mag')
  const [filter, setFilter] = useState('All')
  const [menuOpen, setMenuOpen] = useState(false)

  const publishedDossiers = useMemo(() => dossiers.filter(dossier => dossier.status === 'published').map(normalizeDossier), [dossiers])
  const filteredDossiers = useMemo(() => getFiltered(publishedDossiers, filter), [filter, publishedDossiers])
  const displayDossiers = filteredDossiers.length ? filteredDossiers : publishedDossiers

  const routeTo = useCallback((url) => {
    if (!url) return
    if (/^https?:/.test(url)) window.location.href = url
    else navigate(url.replace(/\/index\.html$/, ''))
  }, [navigate])

  return (
    <div className="magazine-home">
      <a className="skip-link" href="#dossiers">Skip to dossiers</a>
      <Nameplate view={view} onViewChange={setView} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <MenuPanel open={menuOpen} onClose={() => setMenuOpen(false)} theme={theme} toggleTheme={toggleTheme} />
      <AccountabilityTicker alerts={accountabilityAlerts} hidden={view === 'fyp'} />
      {view === 'mag' ? <MagazineView dossiers={displayDossiers} filter={filter} onFilterChange={setFilter} navigate={routeTo} /> : <FYPView dossiers={displayDossiers} filter={filter} onFilterChange={setFilter} navigate={routeTo} />}
      <MagazineFooter dossierCount={publishedDossiers.length} />
    </div>
  )
}
