/**
 * GET /auth/me
 *
 * Lightweight Yan-compatible session introspection for public apps that need
 * to hide admin controls. Authorization still belongs server-side; this only
 * exposes safe user/session state derived from the signed httpOnly JWT cookie.
 */
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
  const app = payload.app_metadata || {};
  const user = payload.user_metadata || {};
  const rights = collectRights(app);
  const admin = aal === 'aal2' && hasAdminAccess({ rights, requiredRight });

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

function collectRights(app) {
  const raw = [
    app.rights,
    app.yan_rights,
    app.analyst_rights,
    app.permissions,
    app.member_rights,
  ];

  const rights = new Set();
  for (const value of raw) {
    if (Array.isArray(value)) value.forEach(item => rights.add(String(item)));
    else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, enabled]) => {
        if (enabled) rights.add(key);
      });
    }
    else if (typeof value === 'string') rights.add(value);
  }
  return [...rights];
}

function hasAdminAccess({ rights, requiredRight }) {
  const analystRights = rights.filter(right => right.startsWith('analyst.'));
  if (analystRights.includes('analyst.admin')) return true;
  if (requiredRight) return requiredRight.startsWith('analyst.') && analystRights.includes(requiredRight);
  return analystRights.some(right => [
    'analyst.cms.read',
    'analyst.cms.write',
    'analyst.comments.moderate',
    'analyst.infra.admin',
    'analyst.oracle.admin',
    'analyst.privacy.admin',
    'analyst.projects.read',
    'analyst.projects.write',
    'analyst.submissions.read',
    'analyst.submissions.review',
    'analyst.thumbnail.write',
  ].includes(right));
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
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return null;

  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
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
