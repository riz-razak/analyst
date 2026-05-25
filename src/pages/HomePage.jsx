import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import '../styles/magazine.css'

const TOPIC_TABS = [
  { id: 'all', label: 'All', labelSi: 'All', description: 'One editorial feed', descriptionSi: 'එක editorial feed එකක්', terms: [] },
  { id: 'power', label: 'Power', labelSi: 'බලය', description: 'Politics, governance, accountability', descriptionSi: 'දේශපාලනය, governance සහ වගවීම', terms: ['politics', 'governance', 'accountability', 'corruption', 'procurement', 'election', 'npp', 'state'] },
  { id: 'economy', label: 'Economy', labelSi: 'ආර්ථිකය', description: 'Finance, trade, energy, industry', descriptionSi: 'මුදල්, වෙළඳාම, energy සහ කර්මාන්තය', terms: ['economy', 'economic', 'finance', 'trade', 'industry', 'energy', 'oil', 'hormuz', 'business'] },
  { id: 'world', label: 'World', labelSi: 'ලෝකය', description: 'Geopolitics and global shocks', descriptionSi: 'Geopolitics සහ global shocks', terms: ['geopolitics', 'global', 'world', 'war', 'iran', 'israel', 'american', 'us decline'] },
  { id: 'rights', label: 'Rights', labelSi: 'අයිතිවාසිකම්', description: 'Law, violence, evidence, justice', descriptionSi: 'නීතිය, violence, evidence සහ යුක්තිය', terms: ['rights', 'law', 'justice', 'war crimes', 'women', 'sexual harassment', 'violence'] },
  { id: 'ideas', label: 'Ideas', labelSi: 'අදහස්', description: 'Culture, history, philosophy, media', descriptionSi: 'සංස්කෘතිය, ඉතිහාසය, philosophy සහ media', terms: ['culture', 'history', 'philosophy', 'buddhism', 'media', 'press ethics', 'design', 'art'] },
]

const HOME_COPY = {
  en: {
    edition: 'Ranked public feed',
    dossiers: 'Dossiers',
    search: 'Search',
    feedEyebrow: 'Ranked Feed',
    feedTitle: 'One wall for investigations, explainers, opinion, history, industry and breaking context.',
    feedIntro: 'Ranked by recency, public evidence depth, topic fit and editorial priority. Topic tabs reshape the same wall without splitting the homepage into competing modes.',
    loading: 'Loading more pieces',
    end: 'End of ranked wall',
    empty: 'No published pieces in this topic yet',
    orderLabel: 'Feed sort',
    orderRanked: 'Ranked',
    orderLatest: 'Latest',
    latestDescription: 'Newest first by publication date',
    footerTagline: 'Evidence-led public analysis from Sri Lanka outward.',
    publishedPieces: 'published pieces',
    skip: 'Skip to articles',
    languageLabel: 'Switch homepage language',
    tagsLabel: 'Tags',
    menuAccount: 'Account',
    menuChecking: 'Checking session',
    menuNavigate: 'Navigate',
    menuHome: 'Home',
    menuDossiersSub: 'Published investigations and essays',
    menuTopics: 'Topics',
    menuTopicsSub: 'Ranked wall by subject',
    menuAbout: 'About Riz',
    menuAccountability: 'Accountability',
    menuTracker: 'MP Accountability Tracker',
    menuTrackerSub: 'Planned public section',
    menuCorrections: 'Corrections & Retractions',
    menuCorrectionsSub: 'Editorial transparency log',
    menuSubmit: 'Submit Evidence',
    menuSubmitSub: 'Evidence intake queue',
    menuLegal: 'Legal',
  },
  si: {
    edition: 'තේරූ පොදු feed එක',
    dossiers: 'Dossiers',
    search: 'Search',
    feedEyebrow: 'Ranked Feed',
    feedTitle: 'පර්යේෂණ, පැහැදිලි කිරීම්, මත, ඉතිහාසය, කර්මාන්තය සහ breaking context එකම wall එකක.',
    feedIntro: 'අලුත් බව, public evidence depth, topic fit සහ editorial priority අනුව rank කරන feed එකක්. Topic tabs එකම wall එක subject අනුව නැවත සකස් කරයි.',
    loading: 'තවත් pieces load වෙමින්',
    end: 'Ranked wall අවසානය',
    empty: 'මෙම topic එකට published pieces තවම නැහැ',
    orderLabel: 'Feed sort',
    orderRanked: 'Ranked',
    orderLatest: 'Latest',
    latestDescription: 'Newest first by publication date',
    footerTagline: 'ශ්‍රී ලංකාවෙන් පිටතට යන evidence-led public analysis.',
    publishedPieces: 'published pieces',
    skip: 'ලිපි වෙත යන්න',
    languageLabel: 'Homepage language මාරු කරන්න',
    tagsLabel: 'Tags',
    menuAccount: 'Account',
    menuChecking: 'Session එක පරීක්ෂා වෙමින්',
    menuNavigate: 'Navigate',
    menuHome: 'Home',
    menuDossiersSub: 'Published investigations සහ essays',
    menuTopics: 'Topics',
    menuTopicsSub: 'Subject අනුව ranked wall එක',
    menuAbout: 'Riz ගැන',
    menuAccountability: 'වගවීම',
    menuTracker: 'MP Accountability Tracker',
    menuTrackerSub: 'සැලසුම් කර ඇති public section එක',
    menuCorrections: 'Corrections & Retractions',
    menuCorrectionsSub: 'Editorial transparency log',
    menuSubmit: 'Evidence Submit කරන්න',
    menuSubmitSub: 'Evidence intake queue',
    menuLegal: 'Legal',
  },
}

const topicById = TOPIC_TABS.reduce((acc, topic) => ({ ...acc, [topic.id]: topic }), {})

const localizedValue = (item, field, language) => {
  if (language === 'si') return item?.[`${field}Si`] || item?.[field]
  return item?.[field]
}

const localizedArray = (item, field, language) => {
  const value = localizedValue(item, field, language)
  return Array.isArray(value) ? value : []
}

const localizedTopic = (topic, language) => ({
  ...topic,
  label: language === 'si' ? topic.labelSi || topic.label : topic.label,
  description: language === 'si' ? topic.descriptionSi || topic.description : topic.description,
})

const formatDate = (date, language = 'en') => {
  if (!date) return 'Undated'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return 'Undated'
  const locale = language === 'si' ? 'si-LK' : 'en-GB'
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed)
}

const dateMeta = (date, readTime, language) => `${formatDate(date, language)} · ${readTime}`

const formatReadTime = (sections, readTime, language) => {
  if (readTime) return readTime
  const minutes = Math.max(8, Math.min(28, (sections || 6) * 2))
  return language === 'si' ? `විනාඩි ${minutes}` : `${minutes} min`
}

const formatSourceLabel = (sourceCount, language) => {
  if (!sourceCount) return language === 'si' ? 'Source register' : 'Source register'
  return language === 'si' ? `කොටස් ${sourceCount}` : `${sourceCount} sections`
}

const titleCase = (value = '') => value.split(/[-_\s]+/).filter(Boolean).map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ')

const normalizeDossier = (dossier, index, language = 'en') => {
  const authors = Array.isArray(dossier.authors) ? dossier.authors : [dossier.author].filter(Boolean)
  const sourceCount = dossier.sourceCount || dossier.sources || dossier.sections || 0
  const title = localizedValue(dossier, 'title', language)
  const description = localizedValue(dossier, 'description', language)
  const tags = localizedArray(dossier, 'tags', language)
  const features = localizedArray(dossier, 'features', language)
  const kicker = localizedValue(dossier, 'kicker', language) || titleCase(dossier.category || dossier.tags?.[0] || 'Dossier')
  return {
    ...dossier,
    title,
    description,
    tags,
    features,
    author: authors[0] || 'Riz Razak',
    excerpt: localizedValue(dossier, 'excerpt', language) || description || localizedValue(dossier, 'summary', language) || '',
    gradient: dossier.gradient || `g${(index % 12) + 1}`,
    kicker,
    readTime: formatReadTime(dossier.sections, dossier.readTime, language),
    sourceLabel: dossier.sourceLabel || formatSourceLabel(sourceCount, language),
    thumbnail: dossier.thumbnail || dossier.thumbnailUrl,
    heroImage: dossier.heroImage || dossier.heroImageUrl || dossier.thumbnail || dossier.thumbnailUrl,
    url: dossier.contentUrl || `/${dossier.id}`,
    searchText: [
      dossier.title,
      dossier.description,
      dossier.summary,
      dossier.category,
      dossier.kicker,
      dossier.titleSi,
      dossier.descriptionSi,
      dossier.kickerSi,
      ...(dossier.tags || []),
      ...(dossier.tagsSi || []),
    ].filter(Boolean).join(' '),
  }
}

const dossierText = (dossier) => [
  dossier.searchText,
  dossier.title,
  dossier.subtitle,
  dossier.excerpt,
  dossier.category,
  dossier.kicker,
  ...(dossier.tags || []),
].filter(Boolean).join(' ').toLowerCase()

const matchesTopic = (dossier, topic) => {
  if (!topic || topic.id === 'all') return true
  const haystack = dossierText(dossier)
  return topic.terms.some(term => haystack.includes(term))
}

const resolveTopic = (dossier) => TOPIC_TABS.find(topic => topic.id !== 'all' && matchesTopic(dossier, topic)) || topicById.ideas

const rankDossier = (dossier, index) => {
  const time = publishedTimestamp(dossier)
  const ageDays = time ? Math.max(0, (Date.now() - time) / 86400000) : 120
  const freshness = Math.max(0, 40 - Math.min(ageDays, 120) * 0.32)
  const sourceDepth = Math.min(24, (Number(dossier.sourceCount || dossier.sources || dossier.sections) || 0) * 1.75)
  const evidenceBoost = /evidence|source|claim|audit|dossier/i.test([dossier.sourceLabel, dossier.excerpt, dossier.category].filter(Boolean).join(' ')) ? 9 : 0
  const featureBoost = /investigation|exclusive|dossier|oracle|accountability/i.test(dossierText(dossier)) ? 12 : 0
  return freshness + sourceDepth + evidenceBoost + featureBoost - (index * 0.01)
}

const publishedTimestamp = (dossier) => {
  const parsed = new Date(dossier.date || dossier.publishedAt || 0).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

const normalizeRoute = (url) => {
  if (!url) return '/'
  return /^https?:/.test(url) ? url : url.replace(/\/index\.html$/, '')
}

function Nameplate({ menuOpen, setMenuOpen, language, setLanguage }) {
  const date = useMemo(() => new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date()), [])
  const copy = HOME_COPY[language] || HOME_COPY.en
  const nextLanguage = language === 'si' ? 'en' : 'si'

  return (
    <header className="nameplate">
      <div className="nameplate__left">
        <div className="nameplate__edition">{copy.edition}</div>
        <div className="nameplate__date">{date}</div>
      </div>

      <a className="nameplate__brand" href="/" aria-label="The Analyst home"><h1>The Analyst</h1><span className="np-dot">&middot;</span></a>

      <div className="nameplate__right">
        <button
          className="nameplate__lang"
          type="button"
          onClick={() => setLanguage(nextLanguage)}
          aria-label={copy.languageLabel}
        >
          <span className={language === 'en' ? 'active' : ''}>EN</span>
          <span aria-hidden="true">/</span>
          <span className={language === 'si' ? 'active' : ''}>සිංහල</span>
        </button>
        <a className="nameplate__action" href="/search">{copy.search}</a>
        <a className="nameplate__action" href="#dossiers">{copy.dossiers}</a>
        <button className="ham" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu" aria-expanded={menuOpen}>
          <span /><span /><span />
        </button>
      </div>
    </header>
  )
}

function MenuPanel({ open, onClose, language }) {
  const [authState, setAuthState] = useState({ loading: true, authenticated: false, admin: false, user: null })
  const copy = HOME_COPY[language] || HOME_COPY.en

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setAuthState(prev => ({ ...prev, loading: true }))

    fetch('/auth/me?right=analyst.admin.access', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(response => response.ok ? response.json() : null)
      .then(session => {
        if (cancelled) return
        setAuthState({
          loading: false,
          authenticated: Boolean(session?.authenticated),
          admin: Boolean(session?.admin),
          user: session?.user || null,
        })
      })
      .catch(() => {
        if (!cancelled) setAuthState({ loading: false, authenticated: false, admin: false, user: null })
      })

    return () => { cancelled = true }
  }, [open])

  return (
    <div className={`menu-overlay ${open ? 'open' : ''}`} onClick={onClose}>
      <nav className="menu-panel" aria-label="Site menu" onClick={event => event.stopPropagation()}>
        <button className="menu-close" type="button" onClick={onClose} aria-label="Close menu">&times;</button>

        <div className="menu-label">{copy.menuAccount}</div>
        {authState.loading ? (
          <div className="menu-status">{copy.menuChecking}</div>
        ) : authState.authenticated ? (
          <>
            <div className="menu-session"><span>Signed in</span><span className="menu-link__sub">{authState.user?.email || 'Analyst member'}</span></div>
            {authState.admin && <a className="menu-link menu-link--acct" href="/admin-preview.html">Admin Dashboard<span className="menu-link__sub">CMS and publishing tools</span></a>}
            <a className="menu-link" href="https://auth.yan.lk/login">Yan Account<span className="menu-link__sub">Central profile and security</span></a>
            <a className="menu-link" href="/auth/logout">Sign out<span className="menu-link__sub">Clear this browser session</span></a>
          </>
        ) : (
          <a className="menu-link menu-link--acct" href="/auth/unified/start?next=%2Fadmin-preview.html">Sign in<span className="menu-link__sub">Admin dashboard and protected tools</span></a>
        )}

        <div className="menu-label">{copy.menuNavigate}</div>
        <a className="menu-link" href="/">{copy.menuHome}</a>
        <a className="menu-link" href="#dossiers">{copy.dossiers}<span className="menu-link__sub">{copy.menuDossiersSub}</span></a>
        <a className="menu-link" href="#topics">{copy.menuTopics}<span className="menu-link__sub">{copy.menuTopicsSub}</span></a>
        <a className="menu-link" href="https://rizrazak.com">{copy.menuAbout}</a>

        <div className="menu-label">{copy.menuAccountability}</div>
        <a className="menu-link menu-link--acct" href="#accountability">{copy.menuTracker}<span className="menu-link__sub">{copy.menuTrackerSub}</span></a>
        <a className="menu-link" href="#corrections">{copy.menuCorrections}<span className="menu-link__sub">{copy.menuCorrectionsSub}</span></a>
        <a className="menu-link" href="/admin-submissions.html">{copy.menuSubmit}<span className="menu-link__sub">{copy.menuSubmitSub}</span></a>

        <div className="menu-label">{copy.menuLegal}</div>
        <a className="menu-link" href="#privacy">Privacy Policy</a>
        <a className="menu-link" href="#terms">Terms of Use</a>
        <a className="menu-link" href="#ai-safety">AI Safety & Ethics</a>
      </nav>
    </div>
  )
}

function GradientImage({ item, className }) {
  if (item?.heroImage) return <img src={item.heroImage} alt={item.title || ''} className={className} loading="lazy" />
  return <div className={`${className} ${item?.gradient || 'g1'}`} role="presentation" />
}

function TopicTabs({ topics, activeTopic, counts, onChange, language }) {
  return (
    <div className="topic-tabs" id="topics" role="tablist" aria-label="Article topics">
      {topics.map(rawTopic => {
        const topic = localizedTopic(rawTopic, language)
        return (
        <button
          key={topic.id}
          type="button"
          className={`topic-tab topic-tab--${topic.id} ${activeTopic === topic.id ? 'topic-tab--active' : ''}`}
          onClick={() => onChange(topic.id)}
          role="tab"
          aria-selected={activeTopic === topic.id}
        >
          <span className="topic-tab__label">{topic.label}</span>
          <span className="topic-tab__meta">{counts[topic.id] || 0}</span>
        </button>
        )
      })}
    </div>
  )
}

function OrderToggle({ sortMode, setSortMode, language }) {
  const copy = HOME_COPY[language] || HOME_COPY.en
  const modes = [
    { id: 'ranked', label: copy.orderRanked },
    { id: 'latest', label: copy.orderLatest },
  ]

  return (
    <div className="wall-order" aria-label={copy.orderLabel}>
      <div className="wall-order__buttons">
        {modes.map((mode, index) => (
          <span key={mode.id} className="wall-order__item">
            {index > 0 && <span className="wall-order__divider" aria-hidden="true">|</span>}
            <button
              type="button"
              className={`wall-order__button ${sortMode === mode.id ? 'wall-order__button--active' : ''}`}
              onClick={() => setSortMode(mode.id)}
              aria-pressed={sortMode === mode.id}
            >
              {mode.label}
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

function RankedCard({ dossier, index, navigate, language }) {
  const topic = localizedTopic(resolveTopic(dossier), language)
  const copy = HOME_COPY[language] || HOME_COPY.en
  const route = normalizeRoute(dossier.url || `/${dossier.id}`)
  const isFeature = index === 0

  const openDossier = useCallback((event) => {
    event.preventDefault()
    if (/^https?:/.test(route)) window.location.href = route
    else navigate(route)
  }, [navigate, route])

  return (
    <a
      className={`ranked-card ranked-card--${topic.id} ${isFeature ? 'ranked-card--feature' : ''}`}
      href={route}
      onClick={openDossier}
    >
      <div className="ranked-card__media">
        <GradientImage item={dossier} className="ranked-card__img" />
      </div>
      <div className="ranked-card__body">
        <div className="ranked-card__rail">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <span>{topic.label}</span>
        </div>
        <div className="ranked-card__kicker">{dossier.kicker}</div>
        <h3 className="ranked-card__title">{dossier.title}</h3>
        {dossier.excerpt && <p className="ranked-card__excerpt">{dossier.excerpt}</p>}
        <div className="ranked-card__meta">
          <span>{dateMeta(dossier.date, dossier.readTime, language)}</span>
          <span>{dossier.sourceLabel}</span>
        </div>
        {dossier.tags?.length > 0 && (
          <div className="ranked-card__tags" aria-label={copy.tagsLabel}>
            {dossier.tags.slice(0, 4).map((tag, tagIndex) => <span key={tag} className={`tag ${tagIndex % 2 === 0 ? 'tg' : 'tt'}`}>{tag}</span>)}
          </div>
        )}
      </div>
    </a>
  )
}

function RankedFeed({ items, activeTopic, setActiveTopic, topicCounts, navigate, language, sortMode, setSortMode }) {
  const { displayedItems, hasMore, sentinelRef } = useInfiniteScroll(items, 6)
  const active = localizedTopic(topicById[activeTopic] || topicById.all, language)
  const copy = HOME_COPY[language] || HOME_COPY.en
  const contextLabel = sortMode === 'latest' && activeTopic === 'all' ? copy.orderLatest : active.label
  const contextDescription = sortMode === 'latest' ? copy.latestDescription : active.description

  return (
    <main className="ranked-home" id="dossiers">
      <section className="feed-brief" aria-labelledby="feed-title">
        <div>
          <p className="feed-brief__eyebrow">{copy.feedEyebrow}</p>
          <h2 id="feed-title">{copy.feedTitle}</h2>
        </div>
        <p>{copy.feedIntro}</p>
      </section>

      <TopicTabs topics={TOPIC_TABS} activeTopic={activeTopic} counts={topicCounts} onChange={setActiveTopic} language={language} />

      <div className="wall-toolbar">
        <div className="topic-context" aria-live="polite">
          <span>{contextLabel}</span>
          <p>{contextDescription}</p>
        </div>
        <OrderToggle sortMode={sortMode} setSortMode={setSortMode} language={language} />
      </div>

      <section className="feed-wall" aria-label={`${active.label} articles`}>
        {displayedItems.map((item, index) => (
          <RankedCard key={item.id || item.title} dossier={item} index={index} navigate={navigate} language={language} />
        ))}
      </section>

      <div ref={sentinelRef} className="feed-sentinel">
        {hasMore ? copy.loading : displayedItems.length ? copy.end : copy.empty}
      </div>
    </main>
  )
}

function SiteFooter({ dossierCount, language }) {
  const copy = HOME_COPY[language] || HOME_COPY.en
  return (
    <footer className="mag-footer">
      <div className="mag-footer__top">
        <div><span className="mag-footer__brand">The Analyst<span className="np-dot-sm">&middot;</span></span><div className="mag-footer__tagline">{copy.footerTagline}</div></div>
        <div className="mag-footer__links">
          <a href="#dossiers">Dossiers</a><a href="#accountability">Accountability</a><a href="#privacy">Privacy</a><a href="#ai-safety">AI Safety</a>
        </div>
      </div>
      <div className="mag-footer__divider" />
      <div className="mag-footer__bottom">
        <span>&copy; {new Date().getFullYear()} Riz Razak. All rights reserved.</span>
        <span className="mag-footer__stats"><b>{dossierCount}</b> {copy.publishedPieces}</span>
      </div>
    </footer>
  )
}

export default function HomePage({ dossiers }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTopic, setActiveTopic] = useState('all')
  const [sortMode, setSortMode] = useState('latest')
  const [language, setLanguageState] = useState(() => {
    if (typeof window === 'undefined') return 'en'
    return window.localStorage.getItem('analyst.home.language') || 'en'
  })
  const setLanguage = useCallback((nextLanguage) => {
    setLanguageState(nextLanguage)
    if (typeof window !== 'undefined') window.localStorage.setItem('analyst.home.language', nextLanguage)
  }, [])
  const copy = HOME_COPY[language] || HOME_COPY.en

  const rankedDossiers = useMemo(() => {
    return dossiers
      .filter(item => item.status === 'published')
      .map((item, index) => {
        const normalized = normalizeDossier(item, index, language)
        return { ...normalized, rankScore: rankDossier(normalized, index) }
      })
      .sort((a, b) => b.rankScore - a.rankScore)
  }, [dossiers, language])

  const topicCounts = useMemo(() => {
    const counts = { all: rankedDossiers.length }
    TOPIC_TABS.filter(topic => topic.id !== 'all').forEach((topic) => {
      counts[topic.id] = rankedDossiers.filter(item => matchesTopic(item, topic)).length
    })
    return counts
  }, [rankedDossiers])

  const filteredDossiers = useMemo(() => {
    const topic = topicById[activeTopic] || topicById.all
    const topicItems = rankedDossiers.filter(item => matchesTopic(item, topic))
    if (sortMode !== 'latest') return topicItems
    return [...topicItems].sort((a, b) => {
      const dateDelta = publishedTimestamp(b) - publishedTimestamp(a)
      return dateDelta || (b.rankScore || 0) - (a.rankScore || 0)
    })
  }, [activeTopic, rankedDossiers, sortMode])

  return (
    <div className="magazine-home" data-language={language}>
      <a className="skip-link" href="#dossiers">{copy.skip}</a>
      <Nameplate menuOpen={menuOpen} setMenuOpen={setMenuOpen} language={language} setLanguage={setLanguage} />
      <MenuPanel open={menuOpen} onClose={() => setMenuOpen(false)} language={language} />
      <RankedFeed
        items={filteredDossiers}
        activeTopic={activeTopic}
        setActiveTopic={setActiveTopic}
        topicCounts={topicCounts}
        navigate={navigate}
        language={language}
        sortMode={sortMode}
        setSortMode={setSortMode}
      />
      <SiteFooter dossierCount={rankedDossiers.length} language={language} />
    </div>
  )
}
