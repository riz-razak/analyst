/**
 * GET /auth/logout
 *
 * Clears the sb-token and sb-refresh cookies and redirects to /login.html.
 * Safe to call from a plain <a href="/auth/logout"> link.
 */
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const host = url.host;
  const isSecure = !host.includes('localhost');
  const secureFlag = isSecure ? '; Secure' : '';

  // Clear both cookies by setting Max-Age=0
  const clearToken   = `sb-token=; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=0`;
  const clearRefresh = `sb-refresh=; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=0`;

  const headers = new Headers();
  headers.append('Set-Cookie', clearToken);
  headers.append('Set-Cookie', clearRefresh);
  headers.set('Location', '/login.html?logged_out=1');
  headers.set('Cache-Control', 'no-store');

  return new Response(null, { status: 302, headers });
}
