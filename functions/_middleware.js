/**
 * Cloudflare Pages Middleware — Authentication Gate
 *
 * Verifies the Supabase JWT stored in a httpOnly cookie before serving
 * any protected path. Requires AAL2 (password + TOTP both satisfied).
 *
 * Environment variables required (set in Cloudflare Pages → Settings):
 *   SUPABASE_JWT_SECRET  — from Supabase: Project Settings → API → JWT Settings
 */

// Paths that require authentication (AAL2)
const PROTECTED_PATHS = [
  '/dossiers/sri-lanka-cricket-corruption/analytics.html',
  '/dossiers/sri-lanka-cricket-corruption/sources.html',
  '/dossiers/sri-lanka-cricket-corruption/kalathma-scandal.html',
  '/profile.html',
  '/admin-preview.html',
  '/admin-submissions.html',
];

// Prefix patterns that require authentication
const PROTECTED_PREFIXES = [
  '/admin/',
];

// Paths that are always public (never intercepted)
const PUBLIC_PATHS = [
  '/login.html',
  '/auth/',
];

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Never gate public paths or static assets
  if (isPublicPath(path)) {
    return next();
  }

  // Check if this path is protected
  if (!isProtectedPath(path)) {
    return next();
  }

  // Get the JWT from the httpOnly cookie
  const cookieHeader = request.headers.get('Cookie') || '';
  const token = parseCookie(cookieHeader, 'sb-token');

  if (!token) {
    return redirectToLogin(url);
  }

  // Verify the JWT and check AAL2
  const jwtSecret = env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    // Dev fallback: if no secret configured, let through with warning
    console.warn('[auth] SUPABASE_JWT_SECRET not set — skipping JWT verification');
    return next();
  }

  const payload = await verifyJWT(token, jwtSecret);

  if (!payload) {
    // Token invalid or expired
    return redirectToLogin(url);
  }

  // Check MFA assurance level — must be aal2 (password + TOTP verified)
  const aal = payload.aal || payload.amr_aal || 'aal1';
  if (aal !== 'aal2') {
    return redirectToLogin(url, true);
  }

  // All checks passed — serve the page
  return next();
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

function parseCookie(cookieHeader, name) {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function redirectToLogin(url, mfaRequired = false) {
  const next = encodeURIComponent(url.pathname + url.search);
  const mfaParam = mfaRequired ? '&mfa=required' : '';
  return Response.redirect(
    `${url.origin}/login.html?next=${next}${mfaParam}`,
    302
  );
}

/**
 * Verify a Supabase JWT using the HMAC-SHA256 secret.
 * Returns the decoded payload, or null if invalid/expired.
 */
async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

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
    if (!valid) return null;

    // Decode payload
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch (e) {
    console.error('[auth] JWT verification error:', e.message);
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
