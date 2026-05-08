/**
 * POST /auth/session
 *
 * Called by login.html after Supabase email+password + TOTP verification.
 * Accepts { access_token, refresh_token } in the request body and
 * stores both as httpOnly Secure SameSite=Strict cookies.
 *
 * This keeps JWTs out of localStorage (XSS-resistant).
 */
const FALLBACK_SUPABASE_URL = 'https://ogunznqyfmxkmmwizpfy.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndW56bnF5Zm14a21td2l6cGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjE0ODAsImV4cCI6MjA4ODYzNzQ4MH0.ElpiHO9FtaxBZlGTWDN6Us2VyWL-uyR2plnjYZ_KwAM';
const ANALYST_ADMIN_RIGHTS = ['analyst.admin', 'analyst.admin.access'];
const ANALYST_BUNDLE_RIGHTS = {
  'analyst.admin': ['analyst.admin.access'],
  'analyst.editor': ['analyst.cms.edit', 'analyst.cms.publish', 'analyst.assets.manage', 'analyst.evidence.review'],
  'analyst.moderator': ['analyst.comments.moderate'],
};

export async function onRequestPost(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const host = url.host;

  if (!hasSameOriginMutation(request, url)) {
    return jsonError(403, 'Invalid request origin');
  }

  const jwtSecret = env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    console.error('[auth/session] SUPABASE_JWT_SECRET not set; refusing session creation');
    return jsonError(503, 'Auth backend not configured');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const { access_token, refresh_token } = body;
  if (!access_token || !refresh_token) {
    return jsonError(400, 'access_token and refresh_token are required');
  }

  const payload = await verifyJWT(access_token, jwtSecret, env);
  if (!payload) {
    return jsonError(401, 'Invalid access token');
  }

  const aal = payload.aal || payload.amr_aal || 'aal1';
  if (!isAal2(aal)) {
    return jsonError(403, 'MFA verification required');
  }

  const access = await resolveAnalystAccess(payload, env);
  const rights = access.rights;
  logAnalystRightsResolution('auth/session', access);
  if (!hasAnyAnalystRight(rights)) {
    const error = getAnalystAccessError(access);
    console.warn(`[auth/session] Analyst session denied: ${error}; ${formatAnalystAccessSummary(access)}`);
    return jsonError(statusForAnalystAccessError(error), error, getSafeAnalystAccessDiagnostics(access));
  }

  const accessExp = payload.exp || Math.floor(Date.now() / 1000) + 3600;

  const accessMaxAge = Math.max(0, accessExp - Math.floor(Date.now() / 1000));
  const refreshMaxAge = 60 * 60 * 24 * 30; // 30 days

  const isSecure = !host.includes('localhost');
  const secureFlag = isSecure ? '; Secure' : '';

  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  headers.append('Set-Cookie', `sb-token=${encodeURIComponent(access_token)}; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=${accessMaxAge}`);
  headers.append('Set-Cookie', `sb-refresh=${encodeURIComponent(refresh_token)}; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=${refreshMaxAge}`);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers,
  });
}

// Handle OPTIONS preflight
export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonError(status, message, diagnostics = null) {
  return new Response(JSON.stringify({
    ok: false,
    error: message,
    ...(diagnostics ? { diagnostics } : {}),
  }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function hasSameOriginMutation(request, url) {
  const origin = request.headers.get('Origin');
  if (origin) return origin === url.origin;

  const referer = request.headers.get('Referer');
  if (!referer) return false;

  try {
    return new URL(referer).origin === url.origin;
  } catch {
    return false;
  }
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
    const payload = decodePayload(payloadB64);
    return payload?.[key] || null;
  } catch {
    return null;
  }
}

function logAnalystRightsResolution(scope, access = {}) {
  console.info(`[${scope}] Analyst rights resolved: ${formatAnalystAccessSummary(access)}`);
}

function hasAnyAnalystRight(rights) {
  const analystRights = new Set(rights.filter(right => right.startsWith('analyst.')));
  if (ANALYST_ADMIN_RIGHTS.some(right => analystRights.has(right))) return true;
  return analystRights.size > 0;
}

function isAal2(aal) {
  return aal === 'aal2' || aal === 2 || aal === '2';
}

async function verifyJWT(token, secret, env) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = decodePayload(headerB64);

    if (header.alg === 'HS256') {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const valid = await crypto.subtle.verify(
        'HMAC',
        cryptoKey,
        base64UrlDecode(signatureB64),
        encoder.encode(`${headerB64}.${payloadB64}`)
      );
      if (valid) return decodeVerifiedPayload(payloadB64);
    }

    return validateSupabaseAccessToken(token, env);
  } catch {
    return null;
  }
}

function decodeVerifiedPayload(payloadB64) {
  const payload = decodePayload(payloadB64);
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

function decodePayload(payloadB64) {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
}

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
