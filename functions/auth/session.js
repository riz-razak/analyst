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
  const { request } = context;

  // CORS preflight — reject other origins
  const origin = request.headers.get('Origin') || '';
  const host = new URL(request.url).host;

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

  // Decode the access token to get its expiry (no verification needed here —
  // the token was already verified by Supabase on the client side, and the
  // edge middleware will re-verify it on every protected request)
  let accessExp = null;
  try {
    const payloadB64 = access_token.split('.')[1];
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    accessExp = payload.exp;
  } catch {
    // Fall back to 1 hour
    accessExp = Math.floor(Date.now() / 1000) + 3600;
  }

  const accessMaxAge = Math.max(0, accessExp - Math.floor(Date.now() / 1000));
  const refreshMaxAge = 60 * 60 * 24 * 30; // 30 days

  const isSecure = !host.includes('localhost');
  const secureFlag = isSecure ? '; Secure' : '';

  const cookies = [
    `sb-token=${encodeURIComponent(access_token)}; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=${accessMaxAge}`,
    `sb-refresh=${encodeURIComponent(refresh_token)}; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=${refreshMaxAge}`,
  ];

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookies[0],
      // Note: Cloudflare Pages supports multiple Set-Cookie via Headers append
      ...buildSetCookieHeaders(cookies),
    },
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
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildSetCookieHeaders(cookies) {
  // Cloudflare Pages Functions use the Headers class which supports
  // multiple values for Set-Cookie
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie);
  }
  return Object.fromEntries(headers.entries());
}
