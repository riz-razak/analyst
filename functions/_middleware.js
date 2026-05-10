/**
 * Cloudflare Pages Middleware — Authentication Gate
 *
 * Verifies the Supabase JWT stored in a httpOnly cookie before serving
 * any protected path. Requires AAL2 (password + TOTP both satisfied).
 *
 * Environment variables required (set in Cloudflare Pages → Settings):
 *   SUPABASE_JWT_SECRET  — from Supabase: Project Settings → API → JWT Settings
 */

const FALLBACK_SUPABASE_URL = 'https://ogunznqyfmxkmmwizpfy.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndW56bnF5Zm14a21td2l6cGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjE0ODAsImV4cCI6MjA4ODYzNzQ4MH0.ElpiHO9FtaxBZlGTWDN6Us2VyWL-uyR2plnjYZ_KwAM';
const ANALYST_ADMIN_RIGHTS = ['analyst.admin', 'analyst.admin.access'];
const ANALYST_RIGHT_ALIASES = {
  'analyst.admin': ANALYST_ADMIN_RIGHTS,
  'analyst.admin.access': ANALYST_ADMIN_RIGHTS,
  'analyst.cms.read': ['analyst.cms.read', 'analyst.cms.edit', 'analyst.cms.publish'],
  'analyst.cms.write': ['analyst.cms.write', 'analyst.cms.edit', 'analyst.cms.publish'],
  'analyst.thumbnail.write': ['analyst.thumbnail.write', 'analyst.assets.manage'],
  'analyst.submissions.read': ['analyst.submissions.read', 'analyst.evidence.review'],
  'analyst.submissions.review': ['analyst.submissions.review', 'analyst.evidence.review'],
};
const ANALYST_BUNDLE_RIGHTS = {
  'analyst.admin': ['analyst.admin.access'],
  'analyst.editor': ['analyst.cms.edit', 'analyst.cms.publish', 'analyst.assets.manage', 'analyst.evidence.review'],
  'analyst.moderator': ['analyst.comments.moderate'],
};

// Paths that require authentication (AAL2)
const PROTECTED_PATHS = [
  '/sri-lanka-cricket-corruption/analytics.html',
  '/sri-lanka-cricket-corruption/sources.html',
  '/sri-lanka-cricket-corruption/kalathma-scandal.html',
  '/profile.html',
  '/admin-preview.html',
  '/admin-submissions.html',
];

const PROTECTED_PATH_RIGHTS = new Map([
  ['/admin-preview.html', ['analyst.admin', 'analyst.cms.read', 'analyst.cms.write']],
  ['/admin-submissions.html', ['analyst.admin', 'analyst.submissions.read', 'analyst.submissions.review']],
]);

const PROTECTED_PREFIX_RIGHTS = [
  { prefix: '/admin/', rights: ['analyst.admin'] },
];

// Prefix patterns that require authentication
const PROTECTED_PREFIXES = [
  '/admin/',
];

// Paths that are always public (never intercepted)
const PUBLIC_PATHS = [
  '/login.html',
  '/auth/',
  '/api/comments',  // Public comments endpoint (submit + read approved)
];

// Worker URL for visibility checks
const WORKER_URL = 'https://analyst-collaborative-cms.riz-1cb.workers.dev';

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Never gate public paths or static assets
  if (isPublicPath(path)) {
    return next();
  }

  // First-time MFA enrollment uses a temporary Supabase browser session before
  // the httpOnly AAL2 admin cookie exists.
  if (path === '/profile.html' && url.searchParams.get('setup_mfa') === '1') {
    return next();
  }

  // ── Dossier visibility check ──────────────────────────────────
  // If this is a dossier page, check if it's hidden via the Worker
  const dossierSlug = extractDossierSlug(path);
  if (dossierSlug) {
    const blocked = await isDossierHidden(dossierSlug);
    if (blocked) {
      return new Response(buildHiddenPage(dossierSlug), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  }

  // Check if this path is protected
  if (!isProtectedPath(path)) {
    return next();
  }

  // Get the JWT from the httpOnly cookie
  const cookieHeader = request.headers.get('Cookie') || '';
  const tokens = parseCookies(cookieHeader, 'sb-token');

  // Verify the JWT and check AAL2
  const jwtSecret = env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    console.error('[auth] SUPABASE_JWT_SECRET not set; refusing protected request');
    return authUnavailable();
  }

  const session = await getBestVerifiedSession(tokens, jwtSecret, env, request);

  if (!session) {
    // Token invalid or expired
    return redirectToLogin(url);
  }

  // Check MFA assurance level — must be aal2 (password + TOTP verified)
  const { payload, access, rights, aal } = session;
  if (!isAal2(aal)) {
    return redirectToLogin(url, true);
  }

  const requiredRights = getRequiredRights(path);
  if (requiredRights.length > 0) {
    if (!hasAnyAnalystRight(rights, requiredRights)) {
      const error = getAnalystAccessError(access);
      console.warn(`[auth] Analyst page denied: ${error}; ${formatAnalystAccessSummary(access)}`);
      return forbidden(error, statusForAnalystAccessError(error));
    }
  }

  // All checks passed — serve the page
  return withSessionCookies(await next(), session);
}

async function getBestVerifiedSession(tokens, jwtSecret, env, request) {
  const candidates = [];
  for (const token of tokens) {
    const payload = await verifyJWT(token, jwtSecret, env);
    if (!payload) continue;
    const access = await resolveAnalystAccess(payload, env);
    const rights = access.rights;
    const aal = payload.aal || payload.amr_aal || 'aal1';
    candidates.push({ payload, access, rights, aal, score: scoreSession(payload, rights, aal) });
  }
  if (!candidates.length) return refreshVerifiedSession(request, jwtSecret, env);
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

async function refreshVerifiedSession(request, jwtSecret, env) {
  const refreshed = await refreshSupabaseSessionFromCookie(request, env);
  if (!refreshed.ok) return null;

  const payload = await verifyJWT(refreshed.accessToken, jwtSecret, env);
  if (!payload) return null;

  const access = await resolveAnalystAccess(payload, env);
  const rights = access.rights;
  const aal = payload.aal || payload.amr_aal || 'aal1';
  const accessMaxAge = Math.max(0, (payload.exp || Math.floor(Date.now() / 1000) + 3600) - Math.floor(Date.now() / 1000));

  return {
    payload,
    access,
    rights,
    aal,
    score: scoreSession(payload, rights, aal),
    setCookies: buildAuthSessionCookies(new URL(request.url), refreshed.accessToken, refreshed.refreshToken, accessMaxAge),
  };
}

async function refreshSupabaseSessionFromCookie(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const refreshTokens = parseCookies(cookieHeader, 'sb-refresh');
  if (refreshTokens.length === 0) return { ok: false };

  const supabaseUrl = env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const apiKey = env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !apiKey) return { ok: false };

  for (const refreshToken of [...refreshTokens].reverse()) {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) continue;

      const data = await response.json().catch(() => null);
      if (data?.access_token && data?.refresh_token) {
        return { ok: true, accessToken: data.access_token, refreshToken: data.refresh_token };
      }
    } catch {}
  }

  return { ok: false };
}

function buildAuthSessionCookies(url, accessToken, refreshToken, accessMaxAge, refreshMaxAge = 60 * 60 * 24 * 30) {
  const secureFlag = url.host.includes('localhost') ? '' : '; Secure';
  return [
    ...buildClearedAuthCookies(url),
    `sb-token=${encodeURIComponent(accessToken)}; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=${accessMaxAge}`,
    `sb-refresh=${encodeURIComponent(refreshToken)}; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=${refreshMaxAge}`,
  ];
}

function buildClearedAuthCookies(url) {
  const secureFlag = url.host.includes('localhost') ? '' : '; Secure';
  const names = ['sb-token', 'sb-refresh'];
  const domains = new Set(['']);
  if (!url.hostname.includes('localhost')) {
    domains.add(`; Domain=${url.hostname}`);
    domains.add('; Domain=rizrazak.com');
    domains.add('; Domain=.rizrazak.com');
  }

  const cookies = [];
  names.forEach(name => {
    domains.forEach(domain => {
      cookies.push(`${name}=; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=0${domain}`);
    });
  });
  return cookies;
}

function withSessionCookies(response, session) {
  if (!session?.setCookies?.length) return response;
  const headers = new Headers(response.headers);
  session.setCookies.forEach(cookie => headers.append('Set-Cookie', cookie));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function scoreSession(payload, rights, aal) {
  const analystRightCount = rights.filter(right => right.startsWith('analyst.')).length;
  let score = 0;
  if (isAal2(aal)) score += 1000000;
  if (hasAnyAnalystRight(rights, ['analyst.admin'])) score += 100000;
  score += analystRightCount * 100;
  score += Math.min(Number(payload.exp || 0), 9999999999) / 100000;
  return score;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isProtectedPath(path) {
  if (PROTECTED_PATHS.includes(path)) return true;
  if (PROTECTED_PREFIXES.some(prefix => path.startsWith(prefix))) return true;
  return false;
}

function isPublicPath(path) {
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) return true;
  // Static assets — never intercept
  if (/\.(css|js|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf|mp4|webm|pdf|json|xml|txt)$/i.test(path)) return true;
  return false;
}

function getRequiredRights(path) {
  const directRights = PROTECTED_PATH_RIGHTS.get(path);
  if (directRights) return directRights;

  const prefixMatch = PROTECTED_PREFIX_RIGHTS.find(entry => path.startsWith(entry.prefix));
  return prefixMatch ? prefixMatch.rights : [];
}

function collectRights(source = {}) {
  const rights = new Set();
  [source.rights, source.yan_rights, source.permissions, source.member_rights]
    .forEach(value => addRightsFromValue(rights, value));
  addRightsFromValue(rights, source.analyst_rights, 'analyst.');
  return [...rights];
}

async function resolveAnalystAccess(payload, env) {
  const rights = new Set([
    ...collectRights(payload),
    ...collectRights(payload.app_metadata || {}),
  ]);
  const tokenAnalystRightCount = [...rights].filter(right => right.startsWith('analyst.')).length;

  const peopleAccess = await fetchPeopleAnalystAccess(payload, env);
  peopleAccess.rights.forEach(right => rights.add(right));

  const sortedRights = [...rights].sort();
  return {
    ...peopleAccess,
    rights: sortedRights,
    tokenAnalystRightCount,
    analystRightCount: sortedRights.filter(right => right.startsWith('analyst.')).length,
  };
}

async function resolveAnalystRights(payload, env) {
  const access = await resolveAnalystAccess(payload, env);
  return access.rights;
}

function addRightsFromValue(rights, value, prefix = '') {
  if (Array.isArray(value)) value.forEach(item => rights.add(normalizeRightKey(item, prefix)));
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, enabled]) => {
      if (enabled) rights.add(normalizeRightKey(key, prefix));
    });
  }
  else if (typeof value === 'string') rights.add(normalizeRightKey(value, prefix));
}

function normalizeRightKey(value, prefix = '') {
  const right = String(value).trim();
  if (!right || !prefix || hasKnownProductPrefix(right)) return right;
  return `${prefix}${right}`;
}

function hasKnownProductPrefix(right) {
  return /^(analyst|yan|yan_vada|braincentre|dgtl)\./.test(right);
}

function addBundleFallbackRights(rights, bundleKey) {
  const normalized = normalizeRightKey(bundleKey, 'analyst.');
  (ANALYST_BUNDLE_RIGHTS[normalized] || []).forEach(right => rights.add(right));
}

async function fetchPeopleAnalystAccess(payload, env) {
  const email = getPayloadEmail(payload);
  const serviceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const summary = {
    peopleStatus: 'ok',
    rights: [],
    serviceKeyPresent: !!serviceKey,
    supabaseUrlPresent: !!supabaseUrl,
    supabaseRef: getSupabaseProjectRef(supabaseUrl),
    serviceKeyRef: getJwtPayloadValue(serviceKey, 'ref'),
    serviceKeyRole: getJwtPayloadValue(serviceKey, 'role'),
    personCount: 0,
    membershipCount: 0,
  };

  if (!email) return { ...summary, peopleStatus: 'no_membership' };
  if (!serviceKey || !supabaseUrl) return analystLookupFailure(summary);

  const personIds = new Set();
  const people = await fetchSupabaseRestResult(env, `people?primary_email=eq.${encodeURIComponent(email)}&person_status=eq.active&select=id`);
  if (!people.ok) return analystLookupFailure(summary, people);
  people.rows.forEach(person => personIds.add(person.id));

  const identities = await fetchSupabaseRestResult(env, `identity_emails?normalized_email=eq.${encodeURIComponent(email.toLowerCase())}&select=person_id`);
  if (!identities.ok) return analystLookupFailure(summary, identities);
  for (const identity of identities.rows) {
    const rows = await fetchSupabaseRestResult(env, `people?id=eq.${encodeURIComponent(identity.person_id)}&person_status=eq.active&select=id`);
    if (!rows.ok) return analystLookupFailure(summary, rows);
    if (rows.rows[0]?.id) personIds.add(rows.rows[0].id);
  }

  summary.personCount = personIds.size;
  if (personIds.size === 0) return { ...summary, peopleStatus: 'no_membership' };

  const rights = new Set();
  for (const personId of personIds) {
    const memberships = await fetchSupabaseRestResult(
      env,
      `product_memberships?person_id=eq.${encodeURIComponent(personId)}&product_key=eq.analyst&membership_status=eq.active&select=id,access_bundle_key`
    );
    if (!memberships.ok) return analystLookupFailure(summary, memberships);

    for (const membership of memberships.rows) {
      summary.membershipCount += 1;

      if (membership.access_bundle_key) {
        const bundles = await fetchSupabaseRestResult(
          env,
          `access_bundles?product_key=eq.analyst&bundle_key=eq.${encodeURIComponent(membership.access_bundle_key)}&select=rights`
        );
        if (!bundles.ok) return analystLookupFailure(summary, bundles);
        addRightsFromValue(rights, bundles.rows[0]?.rights, 'analyst.');
        addBundleFallbackRights(rights, membership.access_bundle_key);
      }

      const overrides = await fetchSupabaseRestResult(env, `right_overrides?membership_id=eq.${encodeURIComponent(membership.id)}&select=right_key,value`);
      if (!overrides.ok) return analystLookupFailure(summary, overrides);
      overrides.rows.forEach(override => {
        const right = normalizeRightKey(override.right_key, 'analyst.');
        if (override.value) rights.add(right);
        else rights.delete(right);
      });
    }
  }

  if (summary.membershipCount === 0) return { ...summary, peopleStatus: 'no_membership' };

  const analystRights = [...rights].filter(right => right.startsWith('analyst.')).sort();
  return {
    ...summary,
    peopleStatus: analystRights.length > 0 ? 'ok' : 'no_rights',
    rights: analystRights,
  };
}

function analystLookupFailure(summary, restResult = {}) {
  return {
    ...summary,
    peopleStatus: 'lookup_unavailable',
    ...(restResult.status ? { restStatus: restResult.status } : {}),
    ...(restResult.table ? { restTable: restResult.table } : {}),
  };
}

function getPayloadEmail(payload) {
  return String(payload.email || payload.user_metadata?.email || payload.app_metadata?.email || '').trim().toLowerCase();
}

async function fetchSupabaseRestResult(env, path) {
  const supabaseUrl = env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const table = path.split('?')[0];
  if (!supabaseUrl || !serviceKey) return { ok: false, status: 'not_configured', table, rows: [] };

  let response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${path}`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
    });
  } catch (error) {
    console.error(`[auth/rights] Supabase REST request failed for ${table}: ${error.message}`);
    return { ok: false, status: 'request_failed', table, rows: [] };
  }

  if (!response.ok) {
    console.error(`[auth/rights] Supabase REST returned ${response.status} for ${table}`);
    return { ok: false, status: `http_${response.status}`, table, rows: [] };
  }

  try {
    const rows = await response.json();
    return { ok: true, status: 'ok', table, rows: Array.isArray(rows) ? rows : [] };
  } catch (error) {
    console.error(`[auth/rights] Supabase REST JSON parse failed for ${table}: ${error.message}`);
    return { ok: false, status: 'invalid_json', table, rows: [] };
  }
}

async function fetchSupabaseRest(env, path) {
  const result = await fetchSupabaseRestResult(env, path);
  return result.ok ? result.rows : null;
}

function getAnalystAccessError(access = {}) {
  if (access.peopleStatus === 'lookup_unavailable') return 'rights_lookup_unavailable';
  if (access.peopleStatus === 'no_membership') return 'no_analyst_membership';
  return 'no_analyst_rights';
}

function statusForAnalystAccessError(error) {
  return error === 'rights_lookup_unavailable' ? 503 : 403;
}

function formatAnalystAccessSummary(access = {}) {
  return Object.entries(getSafeAnalystAccessDiagnostics(access))
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function getSafeAnalystAccessDiagnostics(access = {}) {
  const diagnostics = {
    people_status: access.peopleStatus || 'unknown',
    service_key: access.serviceKeyPresent ? 'present' : 'missing',
    supabase_url: access.supabaseUrlPresent ? 'present' : 'missing',
    people: access.personCount || 0,
    memberships: access.membershipCount || 0,
    token_analyst_rights: access.tokenAnalystRightCount || 0,
    analyst_rights: access.analystRightCount || 0,
  };

  if (access.restStatus) diagnostics.rest_status = access.restStatus;
  if (access.restTable) diagnostics.rest_table = access.restTable;
  if (access.supabaseRef) diagnostics.supabase_ref = access.supabaseRef;
  if (access.serviceKeyRole) diagnostics.service_key_role = access.serviceKeyRole;
  if (access.serviceKeyRef) diagnostics.service_key_ref = access.serviceKeyRef;
  if (access.supabaseRef && access.serviceKeyRef) {
    diagnostics.service_ref_matches_url = access.supabaseRef === access.serviceKeyRef;
  }
  return diagnostics;
}

function getSupabaseProjectRef(supabaseUrl) {
  const match = String(supabaseUrl || '').match(/^https:\/\/([^.]+)\.supabase\.co\/?/);
  return match ? match[1] : null;
}

function getJwtPayloadValue(jwt, key) {
  try {
    const payloadB64 = String(jwt || '').split('.')[1];
    if (!payloadB64) return null;
    const payload = decodeVerifiedPayload(payloadB64);
    return payload?.[key] || null;
  } catch {
    return null;
  }
}

function hasAnyAnalystRight(rights, requiredRights) {
  const rightSet = new Set(rights.filter(right => right.startsWith('analyst.')));
  if (hasAliasedRight(rightSet, 'analyst.admin')) return true;
  return requiredRights.some(right => hasAliasedRight(rightSet, right));
}

function hasAliasedRight(rights, requiredRight) {
  const aliases = ANALYST_RIGHT_ALIASES[requiredRight] || [requiredRight];
  return aliases.some(right => rights.has(right));
}

function isAal2(aal) {
  return aal === 'aal2' || aal === 2 || aal === '2';
}

function parseCookie(cookieHeader, name) {
  const values = parseCookies(cookieHeader, name);
  return values.length ? values[values.length - 1] : null;
}

function parseCookies(cookieHeader, name) {
  return String(cookieHeader || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const index = part.indexOf('=');
      return index === -1 ? null : [part.slice(0, index), part.slice(index + 1)];
    })
    .filter(pair => pair && pair[0] === name)
    .map(pair => decodeURIComponent(pair[1]))
    .filter(Boolean);
}

function redirectToLogin(url, mfaRequired = false) {
  const next = encodeURIComponent(url.pathname + url.search);
  const mfaParam = mfaRequired ? '&mfa=required' : '';
  return Response.redirect(
    `${url.origin}/login.html?next=${next}${mfaParam}`,
    302
  );
}

function forbidden(message = 'Forbidden', status = 403) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function authUnavailable() {
  return new Response('Authentication is not configured', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/**
 * Verify a Supabase JWT using the HMAC-SHA256 secret, falling back to
 * Supabase Auth token introspection for projects using non-HS256 signing.
 * Returns the decoded payload, or null if invalid/expired.
 */
async function verifyJWT(token, secret, env) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    const headerJson = new TextDecoder().decode(base64UrlDecode(headerB64));
    const header = JSON.parse(headerJson);

    if (header.alg === 'HS256') {
      // Verify signature
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const signingInput = encoder.encode(`${headerB64}.${payloadB64}`);
      const signature = base64UrlDecode(signatureB64);

      const valid = await crypto.subtle.verify('HMAC', cryptoKey, signature, signingInput);
      if (valid) return decodeVerifiedPayload(payloadB64);
    }

    return validateSupabaseAccessToken(token, env);
  } catch (e) {
    console.error('[auth] JWT verification error:', e.message);
    return null;
  }
}

function decodeVerifiedPayload(payloadB64) {
  const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
  const payload = JSON.parse(payloadJson);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;
  return payload;
}

async function validateSupabaseAccessToken(token, env) {
  const supabaseUrl = env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const apiKey = env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !apiKey) return null;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;

    const user = await response.json();
    const payload = decodeVerifiedPayload(token.split('.')[1]);
    if (!payload) return null;

    payload.sub = payload.sub || user.id;
    payload.email = payload.email || user.email;
    payload.app_metadata = payload.app_metadata || user.app_metadata || {};
    payload.user_metadata = payload.user_metadata || user.user_metadata || {};
    return payload;
  } catch {
    return null;
  }
}

function base64UrlDecode(str) {
  // Convert base64url to base64
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─── Dossier Visibility Helpers ──────────────────────────────────────────

/**
 * Extract dossier slug from a root-level path like /womens-day-betrayal/
 * Returns null if the path isn't a dossier page.
 */
function extractDossierSlug(path) {
  // Skip known non-dossier paths
  if (path === '/' || path.startsWith('/api/') || path.startsWith('/auth/') ||
      path.startsWith('/admin') || path.startsWith('/js/') || path.startsWith('/images/') ||
      path.startsWith('/data/') || path.startsWith('/_')) {
    return null;
  }
  // Skip root-level files (login.html, profile.html, etc.)
  if (/^\/[^/]+\.(html|xml|json|txt|css|js|png|jpg|svg|ico|pdf|webp|woff2?)$/i.test(path)) {
    return null;
  }
  // Match: /slug or /slug/ or /slug/anything
  const match = path.match(/^\/([a-z0-9][a-z0-9-]+[a-z0-9])\b/);
  if (!match) return null;
  return match[1];
}

/**
 * Check the Worker's visibility endpoint to see if a dossier is hidden.
 * Uses Cloudflare Cache API for 60-second TTL to avoid hitting KV on every request.
 */
async function isDossierHidden(slug) {
  try {
    const checkUrl = `${WORKER_URL}/api/dossier/visibility/check?slug=${encodeURIComponent(slug)}`;

    // Fetch from Worker (KV read is fast — ~1-2ms on Cloudflare edge)
    const resp = await fetch(checkUrl, {
      headers: { 'User-Agent': 'analyst-middleware/1.0' },
      cf: { cacheTtl: 60 },  // Cloudflare edge cache for 60 seconds
    });

    if (!resp.ok) {
      // On error, fail open (allow access)
      console.warn('[visibility] Worker check failed:', resp.status);
      return false;
    }

    const data = await resp.json();
    return data.visible === false;
  } catch (e) {
    // On any error, fail open
    console.warn('[visibility] Check error:', e.message);
    return false;
  }
}

/**
 * Render a branded 404 page for hidden dossiers
 */
function buildHiddenPage(slug) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dossier Unavailable — analyst.rizrazak.com</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: #f8f8f5;
      color: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .container {
      max-width: 480px;
      text-align: center;
    }
    .border-top {
      width: 60px;
      height: 3px;
      background: #2d5016;
      margin: 0 auto 32px;
    }
    h1 {
      font-size: 28px;
      font-weight: 400;
      color: #111;
      margin-bottom: 16px;
    }
    p {
      font-size: 15px;
      line-height: 1.7;
      color: #555;
      margin-bottom: 24px;
    }
    .home-link {
      display: inline-block;
      padding: 10px 24px;
      background: #2d5016;
      color: #fff;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.05em;
      border-radius: 4px;
    }
    .home-link:hover { background: #1a3a0e; }
    .ref {
      margin-top: 32px;
      font-size: 11px;
      color: #aaa;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="border-top"></div>
    <h1>Dossier Unavailable</h1>
    <p>This dossier has been temporarily removed from public access by the editorial team. It may be undergoing review, revision, or has been withdrawn.</p>
    <a href="/" class="home-link">Return to analyst.rizrazak.com</a>
    <div class="ref">${slug}</div>
  </div>
</body>
</html>`;
}
