/**
 * GET /auth/me
 *
 * Lightweight Yan-compatible session introspection for public apps that need
 * to hide admin controls. Authorization still belongs server-side; this only
 * exposes safe user/session state derived from the signed httpOnly JWT cookie.
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

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const requiredRight = url.searchParams.get('right');
  const cookieHeader = request.headers.get('Cookie') || '';
  const token = parseCookie(cookieHeader, 'sb-token');

  if (!token) {
    return json({ authenticated: false, admin: false, rights: [] }, 200);
  }

  const jwtSecret = env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    console.error('[auth/me] SUPABASE_JWT_SECRET not set; refusing session introspection');
    return json({ authenticated: false, admin: false, rights: [], error: 'auth_backend_not_configured' }, 503);
  }

  const payload = await verifyJWT(token, jwtSecret, env);

  if (!payload) {
    return json({ authenticated: false, admin: false, rights: [] }, 200);
  }

  const aal = payload.aal || payload.amr_aal || 'aal1';
  const user = payload.user_metadata || {};
  const rights = await resolveAnalystRights(payload, env);
  const admin = isAal2(aal) && hasAdminAccess({ rights, requiredRight });

  return json({
    authenticated: true,
    admin,
    aal,
    required_right: requiredRight,
    rights,
    user: {
      id: payload.sub || null,
      email: payload.email || user.email || null,
      name: user.full_name || user.name || payload.email || 'Yan member'
    }
  }, 200);
}

function collectRights(source = {}) {
  const rights = new Set();
  [source.rights, source.yan_rights, source.permissions, source.member_rights]
    .forEach(value => addRightsFromValue(rights, value));
  addRightsFromValue(rights, source.analyst_rights, 'analyst.');
  return [...rights];
}

async function resolveAnalystRights(payload, env) {
  const rights = new Set([
    ...collectRights(payload),
    ...collectRights(payload.app_metadata || {}),
  ]);

  if (![...rights].some(right => right.startsWith('analyst.'))) {
    const peopleRights = await fetchPeopleAnalystRights(payload, env);
    peopleRights.forEach(right => rights.add(right));
  }

  return [...rights].sort();
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
  if (!right || !prefix || right.includes('.')) return right;
  return `${prefix}${right}`;
}

function addBundleFallbackRights(rights, bundleKey) {
  const normalized = normalizeRightKey(bundleKey, 'analyst.');
  (ANALYST_BUNDLE_RIGHTS[normalized] || []).forEach(right => rights.add(right));
}

async function fetchPeopleAnalystRights(payload, env) {
  const email = getPayloadEmail(payload);
  const serviceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  if (!email || !serviceKey || !supabaseUrl) return [];

  const personIds = new Set();
  const people = await fetchSupabaseRest(env, `people?primary_email=eq.${encodeURIComponent(email)}&person_status=eq.active&select=id`);
  (people || []).forEach(person => personIds.add(person.id));

  const identities = await fetchSupabaseRest(env, `identity_emails?normalized_email=eq.${encodeURIComponent(email.toLowerCase())}&select=person_id`);
  for (const identity of identities || []) {
    const rows = await fetchSupabaseRest(env, `people?id=eq.${encodeURIComponent(identity.person_id)}&person_status=eq.active&select=id`);
    if (rows?.[0]?.id) personIds.add(rows[0].id);
  }

  const rights = new Set();
  for (const personId of personIds) {
    const memberships = await fetchSupabaseRest(
      env,
      `product_memberships?person_id=eq.${encodeURIComponent(personId)}&product_key=eq.analyst&membership_status=eq.active&select=id,access_bundle_key`
    );
    const membership = memberships?.[0];
    if (!membership) continue;

    if (membership.access_bundle_key) {
      const bundles = await fetchSupabaseRest(
        env,
        `access_bundles?product_key=eq.analyst&bundle_key=eq.${encodeURIComponent(membership.access_bundle_key)}&select=rights`
      );
      addRightsFromValue(rights, bundles?.[0]?.rights, 'analyst.');
      addBundleFallbackRights(rights, membership.access_bundle_key);
    }

    const overrides = await fetchSupabaseRest(env, `right_overrides?membership_id=eq.${encodeURIComponent(membership.id)}&select=right_key,value`);
    (overrides || []).forEach(override => {
      const right = normalizeRightKey(override.right_key, 'analyst.');
      if (override.value) rights.add(right);
      else rights.delete(right);
    });
  }

  return [...rights].filter(right => right.startsWith('analyst.'));
}

function getPayloadEmail(payload) {
  return String(payload.email || payload.user_metadata?.email || payload.app_metadata?.email || '').trim().toLowerCase();
}

async function fetchSupabaseRest(env, path) {
  const supabaseUrl = env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) return null;
  return response.json();
}

function hasAdminAccess({ rights, requiredRight }) {
  const analystRights = new Set(rights.filter(right => right.startsWith('analyst.')));
  if (hasAliasedRight(analystRights, 'analyst.admin')) return true;
  if (requiredRight) return requiredRight.startsWith('analyst.') && hasAliasedRight(analystRights, requiredRight);
  return analystRights.size > 0;
}

function hasAliasedRight(rights, requiredRight) {
  const aliases = ANALYST_RIGHT_ALIASES[requiredRight] || [requiredRight];
  return aliases.some(right => rights.has(right));
}

function isAal2(aal) {
  return aal === 'aal2' || aal === 2 || aal === '2';
}

function parseCookie(cookieHeader, name) {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
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
  const apiKey = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY || FALLBACK_SUPABASE_ANON_KEY;
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

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
