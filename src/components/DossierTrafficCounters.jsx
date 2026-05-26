import { useEffect, useMemo, useRef, useState } from 'react'

const VISITOR_ID_KEY = 'analyst-live-visitor-id'

function normalizePath(path) {
  const value = String(path || '/').trim()
  const prefixed = value.startsWith('/') ? value : `/${value}`
  return prefixed.split('?')[0].split('#')[0].replace(/\/{2,}/g, '/')
}

function storagePathKey(path) {
  return normalizePath(path).replace(/[^a-zA-Z0-9/_-]/g, '_').replace(/\//g, '~')
}

function getVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY)
    if (existing) return existing

    const uuid = window.crypto?.randomUUID?.()
    const generated = (uuid || `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '_')
    localStorage.setItem(VISITOR_ID_KEY, generated)
    return generated
  } catch {
    return `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`.replace(/[^a-zA-Z0-9_-]/g, '_')
  }
}

function getUtmParams() {
  const params = new URLSearchParams(window.location.search)
  return {
    source: params.get('utm_source') || '',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || '',
  }
}

function buildLedgerSnapshot(path) {
  return {
    path,
    visitorId: getVisitorId(),
    referrer: document.referrer || '',
    language: navigator.language || '',
    langMode: document.documentElement.lang || 'en',
    viewport: {
      width: window.innerWidth || 0,
      height: window.innerHeight || 0,
    },
    userAgent: navigator.userAgent || '',
    utm: getUtmParams(),
  }
}

function sendLedgerEvent(path, eventType, extras = {}) {
  if (typeof window === 'undefined') return

  const payload = JSON.stringify({
    ...buildLedgerSnapshot(path),
    ...extras,
    eventType,
  })

  if (navigator.sendBeacon) {
    try {
      const blob = new Blob([payload], { type: 'application/json' })
      if (navigator.sendBeacon('/api/analytics/visit-ledger', blob)) return
    } catch {
      // Fall through to fetch.
    }
  }

  fetch('/api/analytics/visit-ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    keepalive: true,
    body: payload,
  }).catch(() => {})
}

function hasRecordedPageVisit(path) {
  try {
    return Boolean(sessionStorage.getItem(`analyst-page-visit-recorded:${storagePathKey(path)}`))
  } catch {
    return false
  }
}

function markPageVisitRecorded(path) {
  try {
    sessionStorage.setItem(`analyst-page-visit-recorded:${storagePathKey(path)}`, String(Date.now()))
  } catch {
    // The server still stores only aggregate counts if sessionStorage fails.
  }
}

function formatCount(value) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { notation: value >= 10000 ? 'compact' : 'standard' }).format(value)
}

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
    minWidth: 0,
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '28px',
    padding: '4px 9px',
    borderRadius: '999px',
    border: '1px solid var(--border-color)',
    background: 'var(--overlay-subtle)',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.66rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  label: {
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  value: {
    color: 'var(--text-primary)',
  },
  liveDot: {
    width: '7px',
    height: '7px',
    borderRadius: '999px',
    background: 'var(--accent-green)',
    boxShadow: '0 0 0 3px rgba(0, 153, 96, 0.12)',
    flexShrink: 0,
  },
}

export default function DossierTrafficCounters({ path }) {
  const analyticsPath = useMemo(() => normalizePath(path), [path])
  const [pageVisits, setPageVisits] = useState(null)
  const [pageUnavailable, setPageUnavailable] = useState(false)
  const [liveVisitors, setLiveVisitors] = useState(null)
  const [liveUnavailable, setLiveUnavailable] = useState(false)
  const pageVisitsRef = useRef(null)
  const liveVisitorsRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let lastLedgerHeartbeat = 0

    const refreshPageVisits = async () => {
      const recordVisit = !hasRecordedPageVisit(analyticsPath)
      const endpoint = recordVisit
        ? '/api/analytics/page-visits'
        : `/api/analytics/page-visits?path=${encodeURIComponent(analyticsPath)}`

      try {
        const response = await fetch(endpoint, {
          method: recordVisit ? 'POST' : 'GET',
          headers: recordVisit ? { 'Content-Type': 'application/json' } : {},
          cache: 'no-store',
          body: recordVisit ? JSON.stringify({ path: analyticsPath }) : undefined,
        })
        if (!response.ok) throw new Error(`page visits endpoint ${response.status}`)

        const data = await response.json()
        if (recordVisit) markPageVisitRecorded(analyticsPath)
        const nextCount = Number.isFinite(data.pageVisits) ? data.pageVisits : null
        if (!cancelled) {
          setPageVisits(nextCount)
          pageVisitsRef.current = nextCount
          setPageUnavailable(false)
        }
        sendLedgerEvent(analyticsPath, 'page_view', {
          counterVisit: recordVisit,
          pageVisits: nextCount,
        })
      } catch {
        if (!cancelled) setPageUnavailable(true)
        sendLedgerEvent(analyticsPath, 'page_view', { counterVisit: false })
      }
    }

    const refreshLiveVisitors = async () => {
      try {
        const response = await fetch('/api/analytics/live-visitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            visitorId: getVisitorId(),
            path: analyticsPath,
          }),
        })
        if (!response.ok) throw new Error(`live visitor endpoint ${response.status}`)

        const data = await response.json()
        const nextCount = Number.isFinite(data.liveVisitors) ? data.liveVisitors : null
        if (!cancelled) {
          setLiveVisitors(nextCount)
          liveVisitorsRef.current = nextCount
          setLiveUnavailable(false)
        }

        const now = Date.now()
        if (now - lastLedgerHeartbeat > 60000) {
          lastLedgerHeartbeat = now
          sendLedgerEvent(analyticsPath, 'heartbeat', { liveVisitors: nextCount })
        }
      } catch {
        if (!cancelled) setLiveUnavailable(true)
      }
    }

    const handlePageHide = () => {
      sendLedgerEvent(analyticsPath, 'page_exit', {
        pageVisits: pageVisitsRef.current,
        liveVisitors: liveVisitorsRef.current,
      })
    }

    setPageVisits(null)
    pageVisitsRef.current = null
    setPageUnavailable(false)
    setLiveVisitors(null)
    liveVisitorsRef.current = null
    setLiveUnavailable(false)
    refreshPageVisits()
    refreshLiveVisitors()
    const interval = window.setInterval(refreshLiveVisitors, 30000)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [analyticsPath])

  const visitText = pageUnavailable
    ? 'unavailable'
    : pageVisits === null
      ? 'checking'
      : formatCount(pageVisits)
  const liveText = liveUnavailable
    ? 'unavailable'
    : liveVisitors === null
      ? 'checking'
      : formatCount(liveVisitors)

  return (
    <div style={styles.wrap} aria-label="Dossier traffic counters">
      <span
        style={styles.pill}
        title="Approximate recorded page visits for this dossier. This is not a live-reader count."
      >
        <span style={styles.label}>Visits</span>
        <span style={styles.value}>{visitText}</span>
      </span>
      <span
        style={styles.pill}
        title="Approximate active readers seen on this dossier in the last two minutes."
        aria-live="polite"
      >
        {!liveUnavailable && <span style={styles.liveDot} aria-hidden="true" />}
        <span style={styles.label}>Live</span>
        <span style={styles.value}>{liveText}</span>
      </span>
    </div>
  )
}
