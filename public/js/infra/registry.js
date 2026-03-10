/**
 * Infrastructure Registry — analyst.rizrazak.com
 *
 * Central registry of all services, APIs, and infrastructure.
 * Each entry defines metadata, health check config, limits, and expiry info.
 *
 * Usage:
 *   import { registry, getService, getServicesByTag } from './registry.js';
 *
 * Modular: add new services by pushing to SERVICES array.
 * Tags enable filtering (e.g., all 'hosting' or all 'api' services).
 */

const SERVICES = [
  {
    id: 'cloudflare-dns',
    name: 'Cloudflare DNS & CDN',
    category: 'hosting',
    tags: ['hosting', 'dns', 'cdn', 'core'],
    description: 'DNS, CDN, domain privacy, SSL termination for rizrazak.com',
    tier: 'free',
    setupDate: '2026-02-01',
    expiryDate: null,
    limits: {
      label: 'No hard limits on DNS/CDN free tier',
    },
    healthCheck: {
      type: 'http',
      url: 'https://analyst.rizrazak.com/',
      expectedStatus: 200,
      timeout: 8000,
    },
    dashboard: 'https://dash.cloudflare.com/',
    notes: 'Domain registrar + DNS + CDN + SSL. Worker route configured here.',
  },
  {
    id: 'cloudflare-worker',
    name: 'Cloudflare Worker (CMS)',
    category: 'compute',
    tags: ['compute', 'api', 'core'],
    description: 'analyst-collaborative-cms: session locks, visibility gate, API proxy, email sending',
    tier: 'free',
    setupDate: '2026-03-01',
    expiryDate: null,
    limits: {
      requestsPerDay: 100000,
      kvReadsPerDay: 100000,
      kvWritesPerDay: 1000,
      label: '100K requests/day, 100K KV reads/day, 1K KV writes/day',
    },
    healthCheck: {
      type: 'http',
      url: 'https://analyst-collaborative-cms.riz-1cb.workers.dev/api/session/status?dossierId=_ping',
      expectedStatus: 200,
      timeout: 5000,
    },
    dashboard: 'https://dash.cloudflare.com/',
    secrets: ['RESEND_API_KEY', 'GITHUB_TOKEN'],
    notes: 'Route: analyst.rizrazak.com/*. KV: SESSION_STORE, DRAFT_STORE.',
  },
  {
    id: 'github-pages',
    name: 'GitHub Pages (analyst)',
    category: 'hosting',
    tags: ['hosting', 'core'],
    description: 'Static site hosting for analyst.rizrazak.com, deploys from main branch',
    tier: 'free',
    setupDate: '2026-02-01',
    expiryDate: null,
    limits: {
      storageMB: 1000,
      bandwidthGB: 100,
      label: '1GB storage, 100GB bandwidth/month (soft limits)',
    },
    healthCheck: {
      type: 'http',
      url: 'https://analyst.rizrazak.com/',
      expectedStatus: 200,
      timeout: 8000,
    },
    repo: 'riz-razak/analyst',
    dashboard: 'https://github.com/riz-razak/analyst/settings/pages',
    notes: 'CNAME: analyst.rizrazak.com. Deploy: GitHub Actions on push to main.',
  },
  {
    id: 'github-pages-personal',
    name: 'GitHub Pages (personal)',
    category: 'hosting',
    tags: ['hosting'],
    description: 'Static site hosting for www.rizrazak.com',
    tier: 'free',
    setupDate: '2026-02-01',
    expiryDate: null,
    limits: {
      label: 'Same as GitHub Pages free tier',
    },
    healthCheck: {
      type: 'http',
      url: 'https://www.rizrazak.com/',
      expectedStatus: 200,
      timeout: 8000,
    },
    dashboard: 'https://github.com/riz-razak/rizrazak-site/settings/pages',
  },
  {
    id: 'supabase',
    name: 'Supabase (Comments)',
    category: 'database',
    tags: ['database', 'auth', 'api', 'core'],
    description: 'Comments DB with RLS, magic link auth. Project: analyst-comments, Org: DGTL',
    tier: 'free',
    setupDate: '2026-03-07',
    expiryDate: null,
    projectRef: 'ogunznqyfmxkmmwizpfy',
    region: 'ap-southeast-1',
    limits: {
      dbMB: 500,
      mau: 50000,
      label: '500MB DB, 50K MAU, unlimited API requests',
    },
    healthCheck: {
      type: 'http',
      url: 'https://ogunznqyfmxkmmwizpfy.supabase.co/rest/v1/',
      expectedStatus: [200, 401],
      timeout: 5000,
      headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndW56bnF5Zm14a21td2l6cGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjE0ODAsImV4cCI6MjA4ODYzNzQ4MH0.ElpiHO9FtaxBZlGTWDN6Us2VyWL-uyR2plnjYZ_KwAM' },
    },
    dashboard: 'https://supabase.com/dashboard/project/ogunznqyfmxkmmwizpfy',
    notes: 'Custom SMTP via Resend. Anon key safe to expose (RLS protected).',
  },
  {
    id: 'resend',
    name: 'Resend (Email)',
    category: 'email',
    tags: ['email', 'api', 'core'],
    description: 'Transactional email: magic link auth via Supabase SMTP, pledge confirmations via Worker',
    tier: 'free',
    setupDate: '2026-03-09',
    expiryDate: null,
    limits: {
      emailsPerMonth: 3000,
      supabaseRatePerHour: 30,
      label: '3,000 emails/month free. Supabase SMTP: 30/hour.',
    },
    healthCheck: {
      type: 'worker-proxy',
      url: 'https://api.resend.com/',
      expectedStatus: [200, 401],
      timeout: 5000,
    },
    dashboard: 'https://resend.com/domains',
    secrets: ['API key named "Supabase SMTP" (sending access)'],
    notes: 'Domain rizrazak.com verified. DKIM, SPF, DMARC configured via Cloudflare DNS.',
  },
  {
    id: 'ga4',
    name: 'Google Analytics (GA4)',
    category: 'analytics',
    tags: ['analytics'],
    description: 'Dossier analytics: scroll depth, read time, share clicks, language toggle, outbound clicks',
    tier: 'free',
    setupDate: '2026-03-01',
    expiryDate: null,
    limits: { label: 'No hard limits on free tier' },
    healthCheck: {
      type: 'http',
      url: 'https://www.googletagmanager.com/gtag/js',
      expectedStatus: [200, 301, 302],
      timeout: 5000,
    },
    dashboard: 'https://analytics.google.com/',
    notes: 'Google Search Console NOT yet submitted. Custom events in _analytics_events.js.',
  },
  {
    id: 'mapbox',
    name: 'Mapbox',
    category: 'maps',
    tags: ['api', 'maps'],
    description: 'Map tiles for Kunatu weather app',
    tier: 'free',
    setupDate: '2026-03-02',
    expiryDate: null,
    limits: {
      mapLoadsPerMonth: 50000,
      label: '50K map loads/month free',
    },
    healthCheck: {
      type: 'worker-proxy',
      url: 'https://api.mapbox.com/',
      expectedStatus: [200, 301],
      timeout: 5000,
    },
    dashboard: 'https://account.mapbox.com/',
    notes: 'Public token (pk.*) in kunatu-app .env.local. Health check via Worker proxy.',
  },
  {
    id: 'open-meteo',
    name: 'Open-Meteo',
    category: 'weather',
    tags: ['api', 'weather'],
    description: 'Weather forecast data (ECMWF, ICON, GFS models) for Kunatu',
    tier: 'free',
    setupDate: '2026-03-02',
    expiryDate: null,
    limits: {
      callsPerDay: 10000,
      label: '10K calls/day free (non-commercial)',
    },
    healthCheck: {
      type: 'http',
      url: 'https://api.open-meteo.com/v1/forecast?latitude=6.93&longitude=79.85&hourly=temperature_2m&forecast_days=1',
      expectedStatus: 200,
      timeout: 5000,
    },
    notes: 'No API key required. Commercial licence needed at scale.',
  },
  {
    id: 'google-translate',
    name: 'Google Cloud Translation',
    category: 'translation',
    tags: ['api', 'translation'],
    description: 'Sinhala translation for Kunatu and future dossier use',
    tier: 'free',
    setupDate: null,
    expiryDate: null,
    status: 'not-configured',
    limits: {
      charsPerMonth: 500000,
      label: '500K chars/month free (Basic tier)',
    },
    notes: 'Placeholder in kunatu-app .env.local. Not yet configured.',
  },
  {
    id: 'formspree',
    name: 'Formspree',
    category: 'forms',
    tags: ['api', 'forms'],
    description: 'Comment email notifications (placeholder)',
    tier: 'free',
    setupDate: null,
    expiryDate: null,
    status: 'placeholder',
    limits: {
      submissionsPerMonth: 50,
      label: '50 submissions/month free',
    },
    notes: 'Placeholder ID in comments HTML. Not yet active.',
  },
];

// ── Public API ──────────────────────────────────────────────

/** Get the full registry array */
export function getAll() {
  return SERVICES;
}

/** Get a single service by ID */
export function getService(id) {
  return SERVICES.find(s => s.id === id) || null;
}

/** Get services filtered by tag */
export function getByTag(tag) {
  return SERVICES.filter(s => s.tags?.includes(tag));
}

/** Get services filtered by category */
export function getByCategory(category) {
  return SERVICES.filter(s => s.category === category);
}

/** Get all unique tags */
export function getAllTags() {
  const tags = new Set();
  SERVICES.forEach(s => s.tags?.forEach(t => tags.add(t)));
  return [...tags].sort();
}

/** Get all unique categories */
export function getAllCategories() {
  return [...new Set(SERVICES.map(s => s.category))].sort();
}

/** Add a service dynamically (for runtime extensions) */
export function registerService(service) {
  if (!service.id) throw new Error('Service must have an id');
  const existing = SERVICES.findIndex(s => s.id === service.id);
  if (existing >= 0) {
    SERVICES[existing] = { ...SERVICES[existing], ...service };
  } else {
    SERVICES.push(service);
  }
}

/** Get services with approaching expiry (within N days) */
export function getExpiringSoon(withinDays = 30) {
  const now = Date.now();
  const threshold = withinDays * 86400000;
  return SERVICES.filter(s => {
    if (!s.expiryDate) return false;
    const diff = new Date(s.expiryDate).getTime() - now;
    return diff > 0 && diff <= threshold;
  });
}

/** Get services that are expired */
export function getExpired() {
  const now = Date.now();
  return SERVICES.filter(s => {
    if (!s.expiryDate) return false;
    return new Date(s.expiryDate).getTime() < now;
  });
}

/** Get services that have no health check configured */
export function getUnmonitored() {
  return SERVICES.filter(s => !s.healthCheck);
}

/** Summary stats for dashboard */
export function getSummary() {
  return {
    total: SERVICES.length,
    live: SERVICES.filter(s => !s.status || s.status === 'live').length,
    pending: SERVICES.filter(s => s.status === 'not-configured' || s.status === 'placeholder').length,
    withHealthCheck: SERVICES.filter(s => s.healthCheck).length,
    withExpiry: SERVICES.filter(s => s.expiryDate).length,
    byCategory: getAllCategories().map(c => ({
      category: c,
      count: SERVICES.filter(s => s.category === c).length,
    })),
  };
}
