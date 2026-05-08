/**
 * POST /auth/session
 *
 * Called by login.html after Supabase email+password + TOTP verification.
 * Accepts { access_token, refresh_token } in the request body and
 * stores both as httpOnly Secure SameSite=Strict cookies.
 *
 * This keeps JWTs out of localStorage (XSS-resistant).
 */
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

  const payload = await verifyJWT(access_token, jwtSecret);
  if (!payload) {
    return jsonError(401, 'Invalid access token');
  }

  const aal = payload.aal || payload.amr_aal || 'aal1';
  if (aal !== 'aal2') {
    return jsonError(403, 'MFA verification required');
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

function jsonError(status, message) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
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

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = decodePayload(headerB64);
    if (header.alg !== 'HS256') return null;

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
    const payload = decodePayload(payloadB64);
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
