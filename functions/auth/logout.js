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

  const headers = new Headers();
  ['sb-token', 'sb-refresh'].forEach(name => {
    ['', '; Domain=rizrazak.com', '; Domain=.rizrazak.com'].forEach(domain => {
      headers.append('Set-Cookie', `${name}=; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=0${domain}`);
    });
  });
  headers.set('Location', '/login.html?logged_out=1');
  headers.set('Cache-Control', 'no-store');

  return new Response(null, { status: 302, headers });
}
