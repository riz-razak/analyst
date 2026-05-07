import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'public', 'oracle', 'data')
const forecastsDir = path.join(dataDir, 'forecasts')

const readJson = async (file) => JSON.parse(await readFile(path.join(dataDir, file), 'utf8'))
const writeJson = async (file, data) => writeFile(path.join(dataDir, file), `${JSON.stringify(data, null, 2)}\n`)
const writeForecastJson = async (file, data) => {
  await mkdir(forecastsDir, { recursive: true })
  await writeFile(path.join(forecastsDir, file), `${JSON.stringify(data, null, 2)}\n`)
}

const addDays = (date, days) => {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

const normalize = (values) => {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0)
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, +(value / total).toFixed(4)]))
}

const buildReferenceForecast = ({ now, sourceChecks }) => {
  const date = now.slice(0, 10)
  const reachable = sourceChecks.filter((source) => source.ok).length
  const sourceCoverage = +(reachable / Math.max(1, sourceChecks.length)).toFixed(2)
  const blockedSources = sourceChecks.filter((source) => !source.ok).map((source) => source.name)
  const probabilities = normalize({ plc: 0.31, epc: 0.34, irc: 0.12, rc: 0.09, nte: 0.09, udc: 0.05 })

  return {
    id: `OFH-${date}`,
    generated_at: now,
    forecast_date: date,
    mode: 'reference',
    status: 'unverified_reference_forecast',
    horizon_days: 30,
    source_coverage: sourceCoverage,
    top_scenario: 'epc',
    scenarios: [
      { id: 'plc', name: 'Protracted Limited Conflict', probability: probabilities.plc, trend: 'down', rationale: 'Diplomatic off-ramp reporting trims limited-war baseline but does not eliminate attrition risk.' },
      { id: 'epc', name: 'Economic Pressure Ceasefire', probability: probabilities.epc, trend: 'up', rationale: 'Economic pressure and Hormuz bargaining leverage make an interim ceasefire/off-ramp the clearest current pathway.' },
      { id: 'irc', name: 'Iranian Regime Collapse', probability: probabilities.irc, trend: 'flat', rationale: 'Internal stress remains structurally relevant but current accessible signals do not justify a sharp move.' },
      { id: 'rc', name: 'Regional Conflagration', probability: probabilities.rc, trend: 'down', rationale: 'Regional widening risk falls unless maritime security deployments draw direct attacks.' },
      { id: 'nte', name: 'Nuclear Threshold', probability: probabilities.nte, trend: 'flat', rationale: 'Nuclear issue remains a tail risk because enrichment and stockpile disputes are deferred, not resolved.' },
      { id: 'udc', name: 'US Domestic Crisis', probability: probabilities.udc, trend: 'flat', rationale: 'US domestic shock remains secondary unless oil price or constitutional stress accelerates.' }
    ],
    sri_lanka_exposure: {
      status: 'watch',
      key_risks: ['fuel-import affordability', 'war-risk freight premiums', 'FX/import-cover stress', 'port schedule disruption'],
      near_term_assessment: 'Mostly macro-fuel exposure unless Colombo feeder schedules or insurance premia deteriorate.'
    },
    caveats: [
      'This is a deterministic reference forecast generated from the current manual research snapshot and source availability checks.',
      'It is not a verified learning update and should not be scored until resolution criteria are reviewed.',
      blockedSources.length > 0
        ? `${blockedSources.join(', ')} ${blockedSources.length === 1 ? 'was' : 'were'} not reachable during the latest source check.`
        : 'All configured sources were reachable during the latest source check.'
    ]
  }
}

const buildOpenQuestions = ({ now, forecastId }) => {
  const date = now.slice(0, 10)
  const resolveBy = addDays(now, 30)
  return [
    {
      id: `OFH-Q-${date}-001`, forecast_id: forecastId, created_at: now,
      question: 'Will an interim US-Iran/Hormuz de-escalation framework remain intact for 30 days?',
      probability: 0.56, horizon_end: resolveBy,
      resolution_criteria: 'Resolved yes if no confirmed breakdown of the framework and no sustained Hormuz closure occurs by horizon end; otherwise no.',
      status: 'open', scoring: null
    },
    {
      id: `OFH-Q-${date}-002`, forecast_id: forecastId, created_at: now,
      question: 'Will there be a significant Hormuz shipping disruption within 30 days?',
      probability: 0.24, horizon_end: resolveBy,
      resolution_criteria: 'Resolved yes if tanker/commercial traffic through Hormuz is materially disrupted for at least 48 hours by military, mining, blockade, or insurance-denial conditions.',
      status: 'open', scoring: null
    },
    {
      id: `OFH-Q-${date}-003`, forecast_id: forecastId, created_at: now,
      question: 'Will Brent crude trade above USD 110 for five consecutive trading days within 30 days?',
      probability: 0.30, horizon_end: resolveBy,
      resolution_criteria: 'Resolved using a recognized Brent benchmark source. Intraday spikes alone do not count unless the close remains above USD 110 for five consecutive trading days.',
      status: 'open', scoring: null
    },
    {
      id: `OFH-Q-${date}-004`, forecast_id: forecastId, created_at: now,
      question: 'Will Sri Lanka face measurable port or fuel-import stress attributable to Hormuz/Middle East disruption within 30 days?',
      probability: 0.28, horizon_end: resolveBy,
      resolution_criteria: 'Resolved yes if official/publicly verifiable SLPA, CPC, CBSL, shipping-line, or credible market data show schedule disruption, procurement delay, freight/insurance shock, or fuel-stock stress linked to the crisis.',
      status: 'open', scoring: null
    }
  ]
}

const scoreResolvedEntry = (entry, now) => {
  if (entry.status !== 'resolved' || entry.scoring || typeof entry.outcome !== 'boolean') return entry

  const outcome = entry.outcome ? 1 : 0
  const brier = Math.pow(entry.probability - outcome, 2)
  return {
    ...entry,
    scoring: {
      scored_at: now,
      outcome,
      brier: +brier.toFixed(4)
    }
  }
}

const refreshLedgerStatuses = ({ ledger, now }) => {
  const today = now.slice(0, 10)
  return ledger.map((entry) => {
    const scored = scoreResolvedEntry(entry, now)
    if (scored.status !== 'open') return scored
    if (scored.horizon_end && scored.horizon_end < today) {
      return {
        ...scored,
        status: 'review_due',
        review_due_at: scored.review_due_at || now
      }
    }
    return scored
  })
}

const buildLedgerStats = (ledger) => {
  const resolved = ledger.filter((entry) => entry.status === 'resolved')
  const scored = resolved.filter((entry) => entry.scoring?.brier !== undefined)
  const meanBrier = scored.length > 0
    ? +(scored.reduce((sum, entry) => sum + entry.scoring.brier, 0) / scored.length).toFixed(4)
    : null

  return {
    open: ledger.filter((entry) => entry.status === 'open').length,
    review_due: ledger.filter((entry) => entry.status === 'review_due').length,
    resolved: resolved.length,
    scored: scored.length,
    mean_brier: meanBrier,
    verified_accuracy: meanBrier === null ? null : `${((1 - meanBrier) * 100).toFixed(1)}%`
  }
}

const timeoutFetch = async (url, timeoutMs = 10000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'The Analyst Oracle data refresh (+https://analyst.rizrazak.com/oracle/)'
      }
    })

    return {
      ok: response.ok,
      status: response.status,
      status_text: response.statusText,
      final_url: response.url
    }
  } catch (error) {
    return {
      ok: false,
      status: null,
      status_text: error.name === 'AbortError' ? 'timeout' : error.message,
      final_url: url
    }
  } finally {
    clearTimeout(timeout)
  }
}

const now = new Date().toISOString()
const latest = await readJson('latest.json')
const sources = await readJson('sources.json')
const forecastHistory = await readJson('forecast-history.json')
const predictionLedger = await readJson('prediction-ledger.json')

const sourceList = sources.source_groups.flatMap((group) =>
  group.sources.map((source) => ({ group: group.group, ...source }))
)

const sourceChecks = []
for (const source of sourceList) {
  const result = await timeoutFetch(source.url)
  sourceChecks.push({
    group: source.group,
    name: source.name,
    url: source.url,
    checked_at: now,
    ok: result.ok,
    status: result.status,
    status_text: result.status_text,
    final_url: result.final_url,
    access_note: source.status === 'requires_access' ? 'May require paid/API access' : null
  })
}

const forecast = buildReferenceForecast({ now, sourceChecks })
const openQuestions = buildOpenQuestions({ now, forecastId: forecast.id })
const existingQuestionIds = new Set(predictionLedger.ledger.map((entry) => entry.id))
const nextLedger = [
  ...predictionLedger.ledger,
  ...openQuestions.filter((question) => !existingQuestionIds.has(question.id))
]
const refreshedLedger = refreshLedgerStatuses({ ledger: nextLedger, now })
const ledgerStats = buildLedgerStats(refreshedLedger)

latest.generated_at = now
latest.model_health = {
  ...latest.model_health,
  automation: 'Scheduled source check and reference forecast active',
  last_source_check_at: now,
  verified_scoring: false
}
latest.source_checks = sourceChecks
latest.current_forecast = forecast
latest.summary = {
  ...latest.summary,
  status_note: 'Source freshness and a deterministic reference forecast are now generated by automation. Verified scoring remains pending until the resolution pipeline is wired.'
}
latest.accountability = {
  ...latest.accountability,
  open_forecasts: ledgerStats.open + ledgerStats.review_due,
  resolved_forecasts: ledgerStats.resolved,
  review_due: ledgerStats.review_due,
  scored_forecasts: ledgerStats.scored,
  verified_accuracy: ledgerStats.verified_accuracy,
  verified_brier_score: ledgerStats.mean_brier,
  status: ledgerStats.review_due > 0 ? 'Human review due' : ledgerStats.open > 0 ? 'Open questions initialized' : latest.accountability.status
}

sources.generated_at = now
sources.source_groups = sources.source_groups.map((group) => ({
  ...group,
  sources: group.sources.map((source) => {
    const check = sourceChecks.find((item) => item.url === source.url)
    return {
      ...source,
      last_checked_at: now,
      last_http_status: check?.status ?? null,
      last_check_ok: check?.ok ?? false
    }
  })
}))

forecastHistory.generated_at = now
forecastHistory.note = 'Reference forecasts are generated automatically. They remain unverified until resolution criteria are reviewed and scored.'
forecastHistory.forecasts = [
  forecast,
  ...forecastHistory.forecasts.filter((item) => item.id !== forecast.id)
].slice(0, 120)

predictionLedger.generated_at = now
predictionLedger.status = ledgerStats.review_due > 0 ? 'human_review_due' : 'open_questions_initialized'
predictionLedger.stats = ledgerStats
predictionLedger.ledger = refreshedLedger

await writeJson('latest.json', latest)
await writeJson('sources.json', sources)
await writeJson('forecast-history.json', forecastHistory)
await writeJson('prediction-ledger.json', predictionLedger)
await writeForecastJson(`${forecast.forecast_date}.json`, forecast)
await appendFile(
  path.join(dataDir, 'audit-log.jsonl'),
  `${JSON.stringify({
    ts: now,
    actor: 'oracle-data-refresh',
    event: 'reference_forecast_refresh',
    details: {
      checked_sources: sourceChecks.length,
      reachable_sources: sourceChecks.filter((source) => source.ok).length,
      forecast_id: forecast.id,
      open_questions: ledgerStats.open,
      review_due: ledgerStats.review_due,
      scored_forecasts: ledgerStats.scored,
      verified_scoring: ledgerStats.scored > 0
    }
  })}\n`
)

console.log(`Oracle data refreshed: ${forecast.id}; ${sourceChecks.filter((source) => source.ok).length}/${sourceChecks.length} sources reachable; ${ledgerStats.open} open questions; ${ledgerStats.review_due} review due`)
