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
  const payload = jwtSecret ? await verifyJWT(token, jwtSecret) : decodeJWT(token);

  if (!payload) {
    return json({ authenticated: false, admin: false, rights: [] }, 200);
  }

  const aal = payload.aal || payload.amr_aal || 'aal1';
  const app = payload.app_metadata || {};
  const user = payload.user_metadata || {};
  const rights = collectRights(app);
  const role = app.role || app.yan_role || user.role || null;
  const admin = aal === 'aal2' && hasAdminAccess({ rights, role, app, requiredRight });

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

function hasAdminAccess({ rights, role, app, requiredRight }) {
  const adminRoles = new Set(['owner', 'founder', 'admin', 'super_admin', 'yan_admin']);
  if (role && adminRoles.has(String(role))) return true;
  if (app.is_admin === true || app.admin === true || app.yan_admin === true) return true;
  if (requiredRight && rights.includes(requiredRight)) return true;
  return rights.some(right => [
    'yan.admin',
    'yan.people.admin',
    'analyst.admin',
    'analyst.oracle.admin',
    'oracle.admin'
  ].includes(right));
}

function parseCookie(cookieHeader, name) {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      base64UrlDecode(signatureB64),
      encoder.encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) return null;
    return decodePayload(payloadB64);
  } catch {
    return null;
  }
}

function decodeJWT(token) {
  try {
    const payload = decodePayload(token.split('.')[1]);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
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
