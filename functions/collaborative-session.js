/**
 * Collaborative Editing Session Manager
 * Handles locks, autosave, handoff, and user awareness
 * Uses Cloudflare KV + GitHub as persistent storage
 */

// A3.1 (2026-06-22): committed Supabase fallbacks removed. URL from SUPABASE_URL var,
// anon/publishable key from the SUPABASE_ANON_KEY Worker secret. No key literal in source.
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
const PRIVATE_ANALYST_PAGES = new Set([
  '/sri-lanka-cricket-corruption/analytics.html',
  '/sri-lanka-cricket-corruption/sources.html',
]);
const UNIFIED_ATTEMPT_COOKIE = '__Host-analyst_auth_attempt';
const UNIFIED_SESSION_COOKIE = '__Host-analyst_session';
const UNIFIED_RETRY_COOKIE = '__Host-analyst_auth_retry';
const UNIFIED_REQUIRED_RIGHT = 'analyst.admin.access';
const UNIFIED_DEFAULT_NEXT = '/admin-preview.html';
const LEGACY_REAUTH_WINDOW_SECONDS = 15 * 60;
const encoder = new TextEncoder();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enable CORS for local development
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    try {
      if (path === '/auth/me') {
        return handleAuthMe(request, env);
      } else if (path === '/auth/session') {
        return handleAuthSession(request, env);
      } else if (path === '/auth/logout') {
        return handleAuthLogout(request);
      } else if (path === '/auth/login') {
        return handleAuthLogin(request, env);
      } else if (path === '/auth/signed-out') {
        return handleSignedOut(request, env);
      } else if (path === '/auth/unified/start') {
        return handleUnifiedStart(request, env);
      } else if (path === '/auth/unified/callback') {
        return handleUnifiedCallback(request, env);
      }

      // ── Dossier visibility gate (Worker Route on analyst.rizrazak.com/*) ──
      // Dossiers live at root: /womens-day-betrayal/, /caravan-fresh/, etc.
      // This checks the KV visibility map for hidden dossiers.
      // For any non-API request on the main site, check and pass through.
      const host = url.hostname;
      if (host !== 'analyst-collaborative-cms.riz-1cb.workers.dev' && !path.startsWith('/api/')) {
        if (path === '/login.html' && shouldRedirectLegacyLogin(url, env)) {
          return redirectToUnifiedStart(url, safeNext(url.searchParams.get('next'), UNIFIED_DEFAULT_NEXT));
        }
        if (path === '/profile.html' && !legacyAuthEnabled(env)) {
          return Response.redirect(centralAuthLoginUrl(env), 302);
        }

        let pageSession = null;
        const pageRights = getRequiredAnalystPageRights(path);
        if (pageRights.length > 0) {
          const authResult = await requireAnalystPageRights(request, env, pageRights);
          if (authResult instanceof Response) return authResult;
          pageSession = authResult;
        }

        // 301 redirect old /dossiers/* URLs to new root-level paths
        if (path.startsWith('/dossiers/')) {
          const newPath = path.replace('/dossiers/', '/');
          return Response.redirect(`${url.origin}${newPath}${url.search}`, 301);
        }

        // Extract potential dossier slug from root-level path: /slug/ or /slug/page.html
        const slug = extractDossierSlug(path);
        if (slug) {
          const visMap = await env.SESSION_STORE.get(VISIBILITY_KV_KEY, 'json') || {};
          const status = visMap[slug];
          if (status && status !== 'published') {
            return new Response(buildHiddenDossierPage(slug), {
              status: 404,
              headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
            });
          }
        }
        // Not a hidden dossier (or not a dossier at all) — pass through to origin
        return withSessionCookies(await fetch(request), pageSession);
      }

      let analystSession = null;
      const requiredRights = getRequiredAnalystRights(path, request.method);
      if (requiredRights.length > 0) {
        const authResult = await requireAnalystRights(request, env, requiredRights);
        if (authResult instanceof Response) return authResult;
        analystSession = authResult;
      }

      // Route handlers
      if (path === '/api/session/acquire-lock') {
        return handleAcquireLock(request, env);
      } else if (path === '/api/session/release-lock') {
        return handleReleaseLock(request, env);
      } else if (path === '/api/session/status') {
        return handleSessionStatus(request, env);
      } else if (path === '/api/session/autosave') {
        return handleAutosave(request, env);
      } else if (path === '/api/session/heartbeat') {
        return handleHeartbeat(request, env);
      } else if (path === '/api/session/handoff') {
        return handleHandoff(request, env);
      } else if (path === '/api/session/draft') {
        return handleDraft(request, env);
      } else if (path === '/api/session/publish') {
        return handlePublish(request, env, ctx);
      } else if (path === '/api/submissions/submit') {
        return handleSubmission(request, env, ctx);
      } else if (path === '/api/submissions/list') {
        return handleListSubmissions(request, env);
      } else if (path === '/api/submissions/review') {
        return handleReviewSubmission(request, env, ctx, analystSession);
      } else if (path === '/api/otp/send') {
        return handleOtpSend(request, env);
      } else if (path === '/api/otp/verify') {
        return handleOtpVerify(request, env);
      } else if (path === '/api/email-templates/preview') {
        return handleEmailTemplatePreview(request, env);
      } else if (path === '/api/email-templates/test') {
        return handleEmailTemplateTest(request, env);
      } else if (path === '/api/dossier/visibility') {
        return handleDossierVisibility(request, env);
      } else if (path === '/api/dossier/visibility/check') {
        return handleVisibilityCheck(request, env);
      } else if (path === '/api/analytics/live-visitors') {
        return handleLiveVisitors(request, env);
      } else if (path === '/api/analytics/page-visits') {
        return handlePageVisits(request, env);
      } else if (path === '/api/analytics/visit-ledger') {
        return handleVisitLedger(request, env);
      }

      // ── Evidence-safe public search ──
      else if (path === '/api/search') {
        return handleSearch(request, env);
      } else if (path === '/api/search/status') {
        return handleSearchStatus(request, env);
      } else if (path === '/api/search/capture') {
        return handleSearchCapture(request, env, ctx);
      } else if (path === '/api/search/reindex') {
        return handleSearchReindex(request, env, ctx);
      }

      // ── GitHub CMS endpoints ──
      else if (path === '/api/github/file') {
        if (request.method === 'GET') {
          return handleGitHubFileGet(request, env);
        } else if (request.method === 'PUT') {
          return handleGitHubFilePut(request, env, ctx);
        }
      }

      // ── Comments endpoints ──
      else if (path === '/api/comments/list') {
        return handleCommentsList(request, env);
      } else if (path === '/api/comments/create') {
        return handleCommentCreate(request, env);
      } else if (path === '/api/comments/moderate') {
        return handleCommentModerate(request, env);
      } else if (path === '/api/comments/pending') {
        return handleCommentsPending(request, env);
      }

      // ── Kanban API endpoints ──
      else if (path === '/api/projects') {
        return handleGetProjects(request, env);
      } else if (path.match(/^\/api\/projects\/[^\/]+$/)) {
        const slug = path.split('/')[3];
        return handleGetProject(request, env, slug);
      } else if (path.match(/^\/api\/boards\/[^\/]+$/)) {
        const id = path.split('/')[3];
        return handleGetBoard(request, env, id);
      } else if (path === '/api/tasks/create') {
        return handleCreateTask(request, env);
      } else if (path.match(/^\/api\/tasks\/[^\/]+$/) && request.method === 'PUT') {
        const id = path.split('/')[3];
        return handleUpdateTask(request, env, id);
      } else if (path.match(/^\/api\/tasks\/[^\/]+\/move$/)) {
        const id = path.split('/')[3];
        return handleMoveTask(request, env, id);
      } else if (path.match(/^\/api\/boards\/[^\/]+\/columns$/) && request.method === 'POST') {
        const boardId = path.split('/')[3];
        return handleAddColumn(request, env, boardId);
      }

      // ── Thumbnail generation endpoints ──
      else if (path === '/api/thumbnail/generate') {
        return handleThumbnailGenerate(request, env);
      } else if (path === '/api/thumbnail/upload') {
        return handleThumbnailUpload(request, env);
      }

      // ── Infrastructure monitoring endpoints ──
      else if (path === '/api/infra/health') {
        return handleInfraHealth(request, env);
      } else if (path === '/api/infra/proxy-check') {
        return handleInfraProxyCheck(request, env);
      }

      // ── Privacy / IP anonymisation ──
      else if (path === '/api/privacy/anonymise') {
        return handleAnonymiseIPs(request, env);
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Session error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },

  // ── Cloudflare Cron Trigger ──────────────────────────────
  // Runs daily to anonymise IPs older than 180 days
  // Configure in wrangler.toml: [triggers] crons = ["0 3 * * *"]
  async scheduled(event, env, ctx) {
    console.log('[cron] IP anonymisation triggered at', new Date().toISOString());
    try {
      const result = await runIPAnonymisation(env);
      console.log('[cron] Anonymised', result.affected, 'records');
    } catch (e) {
      console.error('[cron] Anonymisation failed:', e.message);
    }
  },
};

/**
 * ACQUIRE LOCK
 * Only one editor per dossier at a time
 */
async function handleAcquireLock(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { dossierId, userId, userEmail } = await request.json();

  if (!dossierId || !userId || !userEmail) {
    return new Response(
      JSON.stringify({ error: 'Missing dossierId, userId, or userEmail' }),
      { status: 400 }
    );
  }

  const lockKey = `lock:${dossierId}`;
  const existingLock = await env.SESSION_STORE.get(lockKey, 'json');

  // Check if lock exists and is still active
  if (existingLock) {
    const lockAge = Date.now() - existingLock.acquiredAt;
    const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    if (lockAge < LOCK_TIMEOUT) {
      // Lock is still active
      if (existingLock.userId === userId) {
        // Same user, refresh the lock
        const lock = {
          dossierId,
          userId,
          userEmail,
          acquiredAt: Date.now(),
          sessionId: existingLock.sessionId,
          heartbeatAt: Date.now(),
        };
        await env.SESSION_STORE.put(lockKey, JSON.stringify(lock), {
          expirationTtl: 60 * 60, // 1 hour in KV
        });
        return new Response(JSON.stringify({ success: true, lock }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        // Different user, return conflict
        return new Response(
          JSON.stringify({
            error: 'Lock held by another user',
            lock: existingLock,
            timeRemainingMs: LOCK_TIMEOUT - lockAge,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // No active lock, acquire it
  const sessionId = generateSessionId();
  const lock = {
    dossierId,
    userId,
    userEmail,
    acquiredAt: Date.now(),
    sessionId,
    heartbeatAt: Date.now(),
  };

  await env.SESSION_STORE.put(lockKey, JSON.stringify(lock), {
    expirationTtl: 60 * 60, // 1 hour
  });

  return new Response(JSON.stringify({ success: true, lock }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleAuthMe(request, env) {
  const url = new URL(request.url);
  const requiredRight = url.searchParams.get('right');
  const debug = url.searchParams.get('debug') === '1';

  const session = await getVerifiedAnalystSession(request, env);
  if (!session.ok) {
    const status = session.error === 'missing_secret' ? 503 : 200;
    const error = session.error === 'missing_secret' ? { error: 'auth_backend_not_configured' } : {};
    return authJson({ authenticated: false, admin: false, rights: [], ...error, ...(debug ? { auth_debug: safeAuthDebug(session) } : {}) }, status, debugAuthHeaders(session, debug));
  }

  const { payload, rights, access } = session;
  const aal = normalizeAal(payload.aal || payload.amr_aal || 'aal1');
  const user = payload.user_metadata || {};
  const admin = isAal2(aal) && hasYanAdminAccess({ rights, requiredRight });
  const rightsError = admin ? null : getAnalystAccessError(access);

  return authJson({
    authenticated: true,
    admin,
    aal,
    required_right: requiredRight,
    rights,
    ...(rightsError ? { rights_error: rightsError } : {}),
    ...(rightsError ? { rights_diagnostics: getSafeAnalystAccessDiagnostics(access) } : {}),
    user: {
      id: payload.sub || null,
      email: payload.email || user.email || null,
      name: user.full_name || user.name || payload.email || 'Yan member',
    },
    ...(debug ? { auth_debug: safeAuthDebug(session) } : {}),
  }, 200, debugAuthHeaders(session, debug), session.setCookies || []);
}

async function handleAuthSession(request, env) {
  if (request.method !== 'POST') return authJson({ ok: false, error: 'Method not allowed' }, 405);

  if (!legacyAuthEnabled(env)) {
    return authJson({ ok: false, error: 'legacy_auth_disabled' }, 410);
  }

  if (!hasSameOriginMutation(request)) {
    return authJson({ ok: false, error: 'Invalid request origin' }, 403);
  }

  if (!env.SUPABASE_JWT_SECRET) {
    console.error('[auth/session] SUPABASE_JWT_SECRET not set; refusing session creation');
    return authJson({ ok: false, error: 'Auth backend not configured' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return authJson({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const { access_token, refresh_token } = body;
  if (!access_token || !refresh_token) return authJson({ ok: false, error: 'access_token and refresh_token are required' }, 400);

  const payload = await verifySupabaseJWT(access_token, env.SUPABASE_JWT_SECRET, env);
  if (!payload) {
    return authJson({ ok: false, error: 'Invalid access token' }, 401);
  }

  const aal = payload.aal || payload.amr_aal || 'aal1';
  if (!isAal2(aal)) {
    return authJson({ ok: false, error: 'MFA verification required' }, 403);
  }

  const legacyReauthExpiresAt = legacyMfaFreshnessExpiresAt(payload, env);
  if (!Number.isFinite(legacyReauthExpiresAt) || legacyReauthExpiresAt <= Date.now()) {
    return authJson({ ok: false, error: 'MFA verification required' }, 403);
  }

  const access = await resolveAnalystAccess(payload, env);
  const rights = access.rights;
  logAnalystRightsResolution('auth/session', access);
  if (!hasYanAdminAccess({ rights })) {
    const error = getAnalystAccessError(access);
    console.warn(`[auth/session] Analyst session denied: ${error}; ${formatAnalystAccessSummary(access)}`);
    return authJson({ ok: false, error, diagnostics: getSafeAnalystAccessDiagnostics(access) }, statusForAnalystAccessError(error));
  }

  const url = new URL(request.url);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const accessMaxAge = Math.max(0, Math.min((payload.exp || nowSeconds + 3600) - nowSeconds, Math.floor((legacyReauthExpiresAt - Date.now()) / 1000)));
  const refreshMaxAge = accessMaxAge;
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  appendAuthSessionCookies(headers, url, access_token, refresh_token, accessMaxAge, refreshMaxAge);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

async function handleAuthLogout(request) {
  const url = new URL(request.url);
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  appendClearedAuthCookies(headers, url);
  headers.append('Set-Cookie', clearCookie(UNIFIED_ATTEMPT_COOKIE, url));
  headers.append('Set-Cookie', clearCookie(UNIFIED_SESSION_COOKIE, url));
  headers.append('Set-Cookie', clearCookie(UNIFIED_RETRY_COOKIE, url));
  headers.set('Location', '/auth/signed-out');
  return new Response(null, { status: 302, headers });
}

function handleAuthLogin(request, env) {
  const url = new URL(request.url);
  if (!unifiedAuthEnabled(env)) return Response.redirect(`${url.origin}/login.html?next=${encodeURIComponent(safeNext(url.searchParams.get('next'), UNIFIED_DEFAULT_NEXT))}`, 302);
  return redirectToUnifiedStart(url, safeNext(url.searchParams.get('next'), UNIFIED_DEFAULT_NEXT));
}

function centralAuthLoginUrl(env) {
  const issuer = String(env.AUTH_UNIFIED_ISSUER || 'https://auth.yan.lk').replace(/\/+$/, '');
  return `${issuer}/login`;
}

function handleSignedOut(request, env) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'), UNIFIED_DEFAULT_NEXT);
  const signInHref = unifiedAuthEnabled(env)
    ? `/auth/unified/start?next=${encodeURIComponent(next)}`
    : `/login.html?next=${encodeURIComponent(next)}`;
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Signed Out - Analyst</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #0f1412; color: #f5f2ea; }
    main { box-sizing: border-box; width: min(100% - 32px, 460px); padding: 32px; border: 1px solid rgba(245,242,234,0.14); border-radius: 28px; background: rgba(255,255,255,0.05); box-shadow: 0 24px 80px rgba(0,0,0,0.34); }
    h1 { margin: 0 0 12px; font-size: clamp(2rem, 8vw, 3.4rem); line-height: 0.98; letter-spacing: -0.06em; }
    p { margin: 0 0 24px; color: rgba(245,242,234,0.72); line-height: 1.55; }
    a { display: inline-flex; justify-content: center; width: 100%; box-sizing: border-box; padding: 14px 18px; border-radius: 999px; background: #bde65a; color: #13200d; font-weight: 800; text-decoration: none; }
  </style>
</head>
<body>
  <main>
    <h1>Signed out</h1>
    <p>Your Analyst session on this browser has been cleared. Central Yan sign-in may still be active for other products.</p>
    <a href="${signInHref}">Sign in again</a>
  </main>
</body>
</html>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function handleUnifiedStart(request, env) {
  const url = new URL(request.url);
  const fail = (error) => new Response(`Unified auth unavailable: ${safePublicAuthError(error)}\n`, { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

  try {
    const config = requireUnifiedConfig(env);
    const next = safeNext(url.searchParams.get('next'), UNIFIED_DEFAULT_NEXT);
    const attempt = await createUnifiedAttempt(env, next);
    const authorizeUrl = new URL(`${config.issuer}/authorize`);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', config.clientId);
    authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizeUrl.searchParams.set('scope', 'openid profile email rights');
    authorizeUrl.searchParams.set('state', attempt.state);
    authorizeUrl.searchParams.set('nonce', attempt.nonce);
    authorizeUrl.searchParams.set('code_challenge', attempt.codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('acr_values', 'urn:yan:aal:2');
    // Force a fresh step-up only when the callback retried a reauth_required failure.
    // NOTE: depends on auth.yan.lk honouring reauth=required / max_age=0. If unsupported it is
    // ignored upstream and the one-shot retry cookie caps us at a single attempt (graceful degrade).
    const forceReauth = url.searchParams.get('reauth') === 'required';
    authorizeUrl.searchParams.set('reauth', forceReauth ? 'required' : 'if_needed');
    if (forceReauth) authorizeUrl.searchParams.set('max_age', '0');
    authorizeUrl.searchParams.set('next', next);

    const headers = new Headers({ Location: authorizeUrl.toString(), 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', attempt.cookie);
    return new Response(null, { status: 302, headers });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'unified_auth_failed');
  }
}

async function handleUnifiedCallback(request, env) {
  const url = new URL(request.url);
  const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
  let fallbackNext = UNIFIED_DEFAULT_NEXT;
  const fail = (error) => {
    responseHeaders.append('Set-Cookie', clearCookie(UNIFIED_ATTEMPT_COOKIE, url));
    // A2A: reauth_required is now recoverable — retry once through a forced fresh step-up.
    const RETRYABLE = ['missing_auth_attempt', 'invalid_auth_attempt', 'invalid_state', 'reauth_required'];
    const alreadyRetried = parseCookie(request.headers.get('Cookie') || '', UNIFIED_RETRY_COOKIE) === '1';
    if (RETRYABLE.includes(error) && !alreadyRetried) {
      responseHeaders.append('Set-Cookie', `${UNIFIED_RETRY_COOKIE}=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=120`);
      const forceReauth = error === 'reauth_required' ? '&reauth=required' : '';
      responseHeaders.set('Location', `/auth/unified/start?next=${encodeURIComponent(fallbackNext)}${forceReauth}`);
      return new Response(null, { status: 302, headers: responseHeaders });
    }
    responseHeaders.append('Set-Cookie', clearCookie(UNIFIED_RETRY_COOKIE, url));
    if (!legacyAuthEnabled(env)) {
      // A2C: safe, branded, noindex/no-store failure page (replaces raw text/plain 400).
      return unifiedAuthFailureResponse(responseHeaders, error, fallbackNext);
    }
    responseHeaders.set('Location', `/login.html?legacy=1&error=${encodeURIComponent(error)}&next=${encodeURIComponent(fallbackNext)}`);
    return new Response(null, { status: 302, headers: responseHeaders });
  };

  try {
    const oauthError = url.searchParams.get('error');
    if (oauthError) return fail(oauthError);

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return fail('missing_code');

    const attempt = await readUnifiedAttempt(request, env);
    fallbackNext = safeNext(attempt.next, UNIFIED_DEFAULT_NEXT);
    if (state !== attempt.state) return fail('invalid_state');

    const token = await exchangeUnifiedCode(env, code, attempt.codeVerifier);
    const claims = await verifyUnifiedToken(env, token, attempt.nonce);
    const access = await resolveAnalystAccess(unifiedClaimsToPayload(claims), env);
    if (!access.rights.includes(UNIFIED_REQUIRED_RIGHT)) return fail(getAnalystAccessError(access));

    responseHeaders.append('Set-Cookie', clearCookie(UNIFIED_ATTEMPT_COOKIE, url));
    responseHeaders.append('Set-Cookie', clearCookie(UNIFIED_RETRY_COOKIE, url));
    appendClearedLegacyAuthCookies(responseHeaders, url);
    responseHeaders.append('Set-Cookie', await createUnifiedSessionCookie(env, claims, access.rights, url));
    responseHeaders.set('Location', safeNext(attempt.next, UNIFIED_DEFAULT_NEXT));
    return new Response(null, { status: 302, headers: responseHeaders });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'unified_auth_failed');
  }
}

function unifiedAuthFailureResponse(headers, error, next) {
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  const code = safePublicAuthError(error);
  const href = `/auth/unified/start?next=${encodeURIComponent(safeNext(next, UNIFIED_DEFAULT_NEXT))}`;
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="robots" content="noindex,nofollow">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>Sign-in needed — The Analyst</title>`
    + `<style>body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;`
    + `background:#faf9f6;color:#1a1a2e;display:flex;min-height:100vh;align-items:center;justify-content:center}`
    + `main{max-width:420px;padding:32px;text-align:center}h1{font-size:18px;margin:0 0 8px;color:#2d5a27}`
    + `p{font-size:14px;color:#4a4a5a;line-height:1.5}a.btn{display:inline-block;margin-top:16px;background:#2d5a27;`
    + `color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600}`
    + `code{background:#efede6;padding:1px 6px;border-radius:4px;font-size:12px}</style></head>`
    + `<body><main><h1>The Analyst</h1>`
    + `<p>We couldn't complete sign-in. Your session may need a fresh verification.</p>`
    + `<p><a class="btn" href="${href}">Sign in again</a></p>`
    + `<p style="margin-top:18px;font-size:12px;color:#6b7765">Reference: <code>${code}</code></p>`
    + `</main></body></html>`;
  return new Response(body, { status: 400, headers });
}

function appendClearedAuthCookies(headers, url) {
  buildClearedAuthCookies(url).forEach(cookie => headers.append('Set-Cookie', cookie));
}

function appendClearedLegacyAuthCookies(headers, url) {
  buildClearedAuthCookies(url, ['sb-token', 'sb-refresh']).forEach(cookie => headers.append('Set-Cookie', cookie));
}

function appendAuthSessionCookies(headers, url, accessToken, refreshToken, accessMaxAge, refreshMaxAge = 60 * 60 * 24 * 30) {
  buildAuthSessionCookies(url, accessToken, refreshToken, accessMaxAge, refreshMaxAge).forEach(cookie => headers.append('Set-Cookie', cookie));
}

function buildAuthSessionCookies(url, accessToken, refreshToken, accessMaxAge, refreshMaxAge = 60 * 60 * 24 * 30) {
  const secureFlag = url.host.includes('localhost') ? '' : '; Secure';
  return [
    ...buildClearedAuthCookies(url),
    `sb-token=${encodeURIComponent(accessToken)}; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=${accessMaxAge}`,
    `sb-refresh=${encodeURIComponent(refreshToken)}; HttpOnly${secureFlag}; SameSite=Strict; Path=/; Max-Age=${refreshMaxAge}`,
  ];
}

function buildClearedAuthCookies(url, names = ['sb-token', 'sb-refresh', UNIFIED_ATTEMPT_COOKIE, UNIFIED_SESSION_COOKIE, UNIFIED_RETRY_COOKIE]) {
  const secureFlag = url.host.includes('localhost') ? '' : '; Secure';
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

function shouldRedirectLegacyLogin(url, env) {
  if (!unifiedAuthEnabled(env)) return false;
  if (legacyAuthEnabled(env)) {
    if (url.searchParams.get('legacy') === '1') return false;
    if (url.searchParams.get('auth_callback') === '1') return false;
  }
  return true;
}

function redirectToUnifiedStart(url, next) {
  return Response.redirect(`${url.origin}/auth/unified/start?next=${encodeURIComponent(safeNext(next, UNIFIED_DEFAULT_NEXT))}`, 302);
}

function unifiedAuthEnabled(env) {
  return env.ANALYST_UNIFIED_AUTH_ENABLED === 'true';
}

function legacyAuthEnabled(env) {
  return env.ANALYST_LEGACY_AUTH_ENABLED === 'true';
}

function safePublicAuthError(error) {
  return /^[a-z0-9_]+$/i.test(String(error || '')) ? String(error) : 'unified_auth_failed';
}

function requireUnifiedConfig(env) {
  if (!unifiedAuthEnabled(env)) throw new Error('unified_auth_disabled');
  for (const key of ['AUTH_UNIFIED_ISSUER', 'AUTH_UNIFIED_CLIENT_ID', 'AUTH_UNIFIED_REDIRECT_URI', 'ANALYST_SESSION_SIGNING_SECRET']) {
    if (!env[key]) throw new Error('unified_auth_not_configured');
  }
  return {
    issuer: env.AUTH_UNIFIED_ISSUER.replace(/\/+$/, ''),
    clientId: env.AUTH_UNIFIED_CLIENT_ID,
    tokenAudience: env.AUTH_UNIFIED_TOKEN_AUDIENCE || env.AUTH_UNIFIED_CLIENT_ID,
    redirectUri: env.AUTH_UNIFIED_REDIRECT_URI,
  };
}

function safeNext(value, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  let decoded = value;
  for (let i = 0; i < 2; i += 1) {
    try { decoded = decodeURIComponent(decoded); } catch { return fallback; }
    if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\u0000-\u001f\u007f\\]/.test(decoded)) return fallback;
  }
  return value;
}

async function createUnifiedAttempt(env, next) {
  requireUnifiedConfig(env);
  const codeVerifier = randomToken(64);
  const state = randomToken(32);
  const nonce = randomToken(32);
  const codeChallenge = await pkceChallenge(codeVerifier);
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const value = await signUnifiedCookiePayload(env, { typ: 'analyst_auth_attempt', state, nonce, codeVerifier, next, expiresAt });
  return {
    state,
    nonce,
    codeChallenge,
    cookie: `${UNIFIED_ATTEMPT_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
  };
}

async function readUnifiedAttempt(request, env) {
  const value = parseCookie(request.headers.get('Cookie') || '', UNIFIED_ATTEMPT_COOKIE);
  if (!value) throw new Error('missing_auth_attempt');
  const payload = await verifyUnifiedCookiePayload(env, value);
  if (payload.typ !== 'analyst_auth_attempt' || Date.now() > payload.expiresAt) throw new Error('invalid_auth_attempt');
  return payload;
}

async function exchangeUnifiedCode(env, code, codeVerifier) {
  const config = requireUnifiedConfig(env);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
  const response = await fetch(`${config.issuer}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id_token) throw new Error('unified_token_exchange_failed');
  return String(data.id_token);
}

async function verifyUnifiedToken(env, token, expectedNonce) {
  const config = requireUnifiedConfig(env);
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('invalid_unified_token');
  const header = parseBase64UrlJson(encodedHeader);
  if (header.alg !== 'ES256' || !header.kid) throw new Error('invalid_unified_token');

  const jwksResponse = await fetch(`${config.issuer}/.well-known/jwks.json`);
  if (!jwksResponse.ok) throw new Error('unified_jwks_failed');
  const jwks = await jwksResponse.json().catch(() => ({}));
  const jwk = Array.isArray(jwks.keys) ? jwks.keys.find(key => key.kid === header.kid) : null;
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || jwk.use !== 'sig') throw new Error('invalid_unified_key');

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    base64UrlDecode(encodedSignature),
    encoder.encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!ok) throw new Error('invalid_unified_token');

  const claims = parseBase64UrlJson(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== config.issuer || claims.aud !== config.tokenAudience || claims.client_id !== config.clientId || claims.exp <= now) throw new Error('invalid_unified_token');
  if (!claims.iat || claims.iat > now + 60 || claims.exp - claims.iat > 600) throw new Error('invalid_unified_token');
  if (claims.nonce !== expectedNonce || claims.product !== 'analyst' || claims.membership_status !== 'active') throw new Error('invalid_unified_token');
  if (claims.token_use !== 'product_assertion' || !claims.sub || !claims.email) throw new Error('invalid_unified_token');
  if (!isAal2(claims.aal) || !Array.isArray(claims.rights) || !claims.rights.includes(UNIFIED_REQUIRED_RIGHT)) throw new Error('analyst_admin_access_required');
  if (!freshReauth(claims.reauth_expires_at)) throw new Error('reauth_required');
  return claims;
}

async function createUnifiedSessionCookie(env, claims, rights, url) {
  const reauthExpiresAt = Date.parse(String(claims.reauth_expires_at || ''));
  const maxAgeSeconds = Math.max(1, Math.min(30 * 60, Math.floor((reauthExpiresAt - Date.now()) / 1000)));
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  const value = await signUnifiedCookiePayload(env, {
    typ: 'analyst_session',
    personId: claims.sub,
    email: String(claims.email).toLowerCase(),
    product: 'analyst',
    aal: claims.aal,
    rights,
    name: claims.name || null,
    sourceJti: claims.jti || null,
    reauthExpiresAt: claims.reauth_expires_at || null,
    jti: crypto.randomUUID(),
    expiresAt,
  });
  const secureFlag = url.host.includes('localhost') ? '' : '; Secure';
  return `${UNIFIED_SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly${secureFlag}; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

async function getUnifiedAnalystSession(request, env) {
  if (!unifiedAuthEnabled(env) || !env.ANALYST_SESSION_SIGNING_SECRET) return null;
  const value = parseCookie(request.headers.get('Cookie') || '', UNIFIED_SESSION_COOKIE);
  if (!value) return null;
  const cookiePayload = await verifyUnifiedCookiePayload(env, value).catch(() => null);
  if (!cookiePayload || cookiePayload.typ !== 'analyst_session' || cookiePayload.product !== 'analyst' || Date.now() > cookiePayload.expiresAt) return null;
  if (!freshReauth(cookiePayload.reauthExpiresAt)) return null;

  const payload = unifiedCookieToPayload(cookiePayload);
  const access = await resolveAnalystAccess(payload, env);
  const rights = access.rights;
  return {
    ok: true,
    payload,
    rights,
    access,
    aal: payload.aal,
    tokenSource: 'unified_cookie',
    tokenIndex: 0,
    tokenCount: 1,
    tokenScore: scoreAnalystSession(payload, rights, payload.aal),
  };
}

function unifiedClaimsToPayload(claims) {
  return {
    sub: claims.sub,
    email: String(claims.email || '').toLowerCase(),
    aal: claims.aal,
    exp: claims.exp,
    rights: Array.isArray(claims.rights) ? claims.rights : [],
    user_metadata: { name: claims.name || claims.email },
  };
}

function unifiedCookieToPayload(cookiePayload) {
  return {
    sub: cookiePayload.personId,
    email: String(cookiePayload.email || '').toLowerCase(),
    aal: cookiePayload.aal,
    exp: Math.floor(cookiePayload.expiresAt / 1000),
    rights: Array.isArray(cookiePayload.rights) ? cookiePayload.rights : [],
    user_metadata: { name: cookiePayload.name || cookiePayload.email },
  };
}

async function signUnifiedCookiePayload(env, payload) {
  const encodedPayload = base64UrlBytes(encoder.encode(JSON.stringify(payload)));
  const signature = await unifiedHmac(env, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

async function verifyUnifiedCookiePayload(env, value) {
  const [encodedPayload, signature] = String(value).split('.');
  if (!encodedPayload || !signature) throw new Error('invalid_cookie');
  const expected = await unifiedHmac(env, encodedPayload);
  if (!timingSafeEqual(signature, expected)) throw new Error('invalid_cookie');
  return parseBase64UrlJson(encodedPayload);
}

async function unifiedHmac(env, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.ANALYST_SESSION_SIGNING_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return base64UrlBytes(new Uint8Array(signature));
}

async function pkceChallenge(verifier) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  return base64UrlBytes(new Uint8Array(hash));
}

function randomToken(bytes) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64UrlBytes(data);
}

function clearCookie(name, url) {
  const secureFlag = url.host.includes('localhost') ? '' : '; Secure';
  return `${name}=; Path=/; HttpOnly${secureFlag}; SameSite=Lax; Max-Age=0`;
}

function parseBase64UrlJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(value)));
}

function base64UrlBytes(value) {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

function collectYanRights(source = {}) {
  const rights = new Set();
  [source.rights, source.yan_rights, source.permissions, source.member_rights]
    .forEach(value => addRightsFromValue(rights, value));
  addRightsFromValue(rights, source.analyst_rights, 'analyst.');
  return [...rights];
}

async function resolveAnalystAccess(payload, env) {
  const rights = new Set([
    ...collectYanRights(payload),
    ...collectYanRights(payload.app_metadata || {}),
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
    Object.entries(value).forEach(([key, enabled]) => { if (enabled) rights.add(normalizeRightKey(key, prefix)); });
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
  const supabaseUrl = env.SUPABASE_URL;
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
  const supabaseUrl = env.SUPABASE_URL;
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
  if ((access.analystRightCount || 0) > 0) return 'missing_analyst_admin_access';
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
    const payload = decodeSupabasePayload(payloadB64);
    return payload?.[key] || null;
  } catch {
    return null;
  }
}

function logAnalystRightsResolution(scope, access = {}) {
  console.info(`[${scope}] Analyst rights resolved: ${formatAnalystAccessSummary(access)}`);
}

function hasYanAdminAccess({ rights }) {
  return hasAnalystAdminRight(rights);
}

function getRequiredAnalystRights(path, method) {
  const normalizedMethod = method.toUpperCase();
  const writeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod);

  if (path.startsWith('/api/session/')) {
    return writeMethod ? ['analyst.admin', 'analyst.cms.write'] : ['analyst.admin', 'analyst.cms.read', 'analyst.cms.write'];
  }
  if (path === '/api/github/file') {
    return writeMethod ? ['analyst.admin', 'analyst.cms.write'] : ['analyst.admin', 'analyst.cms.read', 'analyst.cms.write'];
  }
  if (path === '/api/dossier/visibility') {
    return writeMethod ? ['analyst.admin', 'analyst.cms.write'] : ['analyst.admin', 'analyst.cms.read', 'analyst.cms.write'];
  }
  if (path === '/api/search/status') {
    return ['analyst.admin', 'analyst.cms.read'];
  }
  if (path === '/api/search/capture' || path === '/api/search/reindex') {
    return ['analyst.admin', 'analyst.cms.write'];
  }
  if (path === '/api/analytics/visit-ledger' && !writeMethod) {
    return ['analyst.admin', 'analyst.cms.read'];
  }
  if (path === '/api/submissions/list') {
    return ['analyst.admin', 'analyst.submissions.read', 'analyst.submissions.review'];
  }
  if (path === '/api/submissions/review') {
    return ['analyst.admin', 'analyst.submissions.review'];
  }
  if (path === '/api/email-templates/preview' || path === '/api/email-templates/test') {
    return ['analyst.admin', 'analyst.cms.write'];
  }
  if (path === '/api/comments/moderate' || path === '/api/comments/pending') {
    return ['analyst.admin', 'analyst.comments.moderate'];
  }
  if (path === '/api/otp/send' || path === '/api/otp/verify') {
    return ['analyst.admin'];
  }
  if (path === '/api/thumbnail/generate' || path === '/api/thumbnail/upload') {
    return ['analyst.admin', 'analyst.cms.write', 'analyst.thumbnail.write'];
  }
  if (path === '/api/infra/health' || path === '/api/infra/proxy-check') {
    return ['analyst.admin', 'analyst.infra.admin'];
  }
  if (path === '/api/privacy/anonymise') {
    return ['analyst.admin', 'analyst.privacy.admin'];
  }
  if (path === '/api/projects' || /^\/api\/projects\/[^/]+$/.test(path)) {
    return writeMethod ? ['analyst.admin', 'analyst.projects.write'] : ['analyst.admin', 'analyst.projects.read', 'analyst.projects.write'];
  }
  if (/^\/api\/boards\/[^/]+(\/columns)?$/.test(path)) {
    return writeMethod ? ['analyst.admin', 'analyst.projects.write'] : ['analyst.admin', 'analyst.projects.read', 'analyst.projects.write'];
  }
  if (path === '/api/tasks/create' || /^\/api\/tasks\/[^/]+(\/move)?$/.test(path)) {
    return ['analyst.admin', 'analyst.projects.write'];
  }

  return [];
}

function getRequiredAnalystPageRights(path) {
  if (PRIVATE_ANALYST_PAGES.has(path)) return ['analyst.admin'];
  if (path === '/admin-preview.html') return ['analyst.admin'];
  if (path === '/admin-submissions.html') return ['analyst.admin', 'analyst.submissions.read', 'analyst.submissions.review'];
  if (path === '/admin-business-model.html') return ['analyst.admin', 'analyst.analytics.view'];
  if (path.startsWith('/admin/')) return ['analyst.admin'];
  return [];
}

async function requireAnalystPageRights(request, env, requiredRights) {
  const url = new URL(request.url);
  const session = await getVerifiedAnalystSession(request, env);
  if (!session.ok) {
    if (session.error === 'missing_secret') return authUnavailablePage();
    return redirectToLogin(url, env);
  }

  if (!isAal2(session.aal)) return redirectToLogin(url, env, true);

  if (!hasAnyAnalystRight(session.rights, requiredRights)) {
    const error = getAnalystAccessError(session.access);
    console.warn(`[auth] Analyst page denied: ${error}; ${formatAnalystAccessSummary(session.access)}`);
    return forbiddenPage(error, statusForAnalystAccessError(error));
  }

  return session;
}

function redirectToLogin(url, env, mfaRequired = false) {
  if (unifiedAuthEnabled(env)) return redirectToUnifiedStart(url, url.pathname + url.search + url.hash);
  const next = encodeURIComponent(url.pathname + url.search + url.hash);
  const mfaParam = mfaRequired ? '&mfa=required' : '';
  return Response.redirect(`${url.origin}/login.html?next=${next}${mfaParam}`, 302);
}

function authUnavailablePage() {
  return new Response('Analyst auth is not configured.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function forbiddenPage(error, status = 403) {
  return new Response(`Analyst admin access denied: ${error}`, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function requireAnalystRights(request, env, requiredRights) {
  const session = await getVerifiedAnalystSession(request, env);
  if (!session.ok) {
    const status = session.error === 'missing_secret' ? 503 : 401;
    return jsonResponse({ error: session.error === 'missing_secret' ? 'Auth backend not configured' : 'Unauthorized' }, status);
  }

  if (!isAal2(session.aal)) {
    return jsonResponse({ error: 'MFA verification required' }, 403);
  }

  if (isCookieBackedSession(session.tokenSource) && isUnsafeMethod(request.method) && !hasSameOriginMutation(request)) {
    return jsonResponse({ error: 'Invalid request origin' }, 403);
  }

  if (!hasAnyAnalystRight(session.rights, requiredRights)) {
    const error = getAnalystAccessError(session.access);
    console.warn(`[auth] Analyst API denied: ${error}; ${formatAnalystAccessSummary(session.access)}`);
    return jsonResponse({ error }, statusForAnalystAccessError(error));
  }

  return session;
}

async function getVerifiedAnalystSession(request, env) {
  const unifiedSession = await getUnifiedAnalystSession(request, env);
  if (unifiedSession) return unifiedSession;

  const tokenInfos = getSupabaseRequestTokens(request);
  const refreshTokenCount = parseCookies(request.headers.get('Cookie') || '', 'sb-refresh').length;
  if (!legacyAuthEnabled(env)) {
    return { ok: false, error: tokenInfos.length || refreshTokenCount ? 'legacy_auth_disabled' : 'missing_token', tokenCount: tokenInfos.length, refreshTokenCount };
  }

  if (!env.SUPABASE_JWT_SECRET) {
    if (tokenInfos.length === 0 && refreshTokenCount === 0) return { ok: false, error: 'missing_token', tokenCount: 0, refreshTokenCount: 0 };
    console.error('[auth] SUPABASE_JWT_SECRET not set; refusing protected request');
    return { ok: false, error: 'missing_secret', tokenCount: tokenInfos.length, refreshTokenCount };
  }

  const candidates = [];
  for (let index = 0; index < tokenInfos.length; index += 1) {
    const tokenInfo = tokenInfos[index];
    const payload = await verifySupabaseJWT(tokenInfo.token, env.SUPABASE_JWT_SECRET, env);
    if (!payload) continue;

    const access = await resolveAnalystAccess(payload, env);
    const rights = access.rights;
    const aal = payload.aal || payload.amr_aal || 'aal1';
    if (isAal2(aal) && !freshLegacyMfa(payload, env)) continue;
    candidates.push({
      ok: true,
      payload,
      rights,
      access,
      aal,
      tokenSource: tokenInfo.source,
      tokenIndex: index,
      tokenCount: tokenInfos.length,
      tokenScore: scoreAnalystSession(payload, rights, aal),
    });
  }

  if (candidates.length === 0) {
    const refreshed = await refreshSupabaseSessionFromCookie(request, env);
    if (!refreshed.ok) {
      return {
        ok: false,
        error: tokenInfos.length ? refreshed.error || 'invalid_token' : refreshed.error || 'missing_token',
        tokenCount: tokenInfos.length,
        refreshTokenCount: refreshed.refreshTokenCount || 0,
      };
    }

    const refreshedPayload = await verifySupabaseJWT(refreshed.accessToken, env.SUPABASE_JWT_SECRET, env);
    if (!refreshedPayload) {
      return {
        ok: false,
        error: 'refresh_invalid_token',
        tokenCount: tokenInfos.length,
        refreshTokenCount: refreshed.refreshTokenCount || 0,
      };
    }

    const access = await resolveAnalystAccess(refreshedPayload, env);
    const rights = access.rights;
    const aal = refreshedPayload.aal || refreshedPayload.amr_aal || 'aal1';
    const legacyReauthExpiresAt = legacyMfaFreshnessExpiresAt(refreshedPayload, env);
    if (isAal2(aal) && (!Number.isFinite(legacyReauthExpiresAt) || legacyReauthExpiresAt <= Date.now())) {
      return {
        ok: false,
        error: 'reauth_required',
        tokenCount: tokenInfos.length,
        refreshTokenCount: refreshed.refreshTokenCount || 0,
      };
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokenMaxAge = (refreshedPayload.exp || nowSeconds + 3600) - nowSeconds;
    const freshnessMaxAge = Number.isFinite(legacyReauthExpiresAt) ? Math.floor((legacyReauthExpiresAt - Date.now()) / 1000) : tokenMaxAge;
    const accessMaxAge = Math.max(0, Math.min(tokenMaxAge, freshnessMaxAge));
    return {
      ok: true,
      payload: refreshedPayload,
      rights,
      access,
      aal,
      tokenSource: 'refresh_cookie',
      tokenIndex: 0,
      tokenCount: tokenInfos.length,
      refreshTokenCount: refreshed.refreshTokenCount || 0,
      refreshed: true,
      setCookies: buildAuthSessionCookies(new URL(request.url), refreshed.accessToken, refreshed.refreshToken, accessMaxAge, accessMaxAge),
      tokenScore: scoreAnalystSession(refreshedPayload, rights, aal),
    };
  }

  candidates.sort((a, b) => b.tokenScore - a.tokenScore);
  const selected = candidates[0];
  if (tokenInfos.length > 1) {
    const rightsCount = selected.rights.filter(right => right.startsWith('analyst.')).length;
    console.info(`[auth] Multiple Analyst session cookies found: count=${tokenInfos.length}; selected_index=${selected.tokenIndex}; aal=${selected.aal}; rights=${rightsCount}`);
  }
  return selected;
}

async function refreshSupabaseSessionFromCookie(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const refreshTokens = parseCookies(cookieHeader, 'sb-refresh');
  if (refreshTokens.length === 0) return { ok: false, error: 'missing_token', refreshTokenCount: 0 };

  const supabaseUrl = env.SUPABASE_URL;
  const apiKey = env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !apiKey) return { ok: false, error: 'auth_backend_not_configured', refreshTokenCount: refreshTokens.length };

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
        return {
          ok: true,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          refreshTokenCount: refreshTokens.length,
        };
      }
    } catch {}
  }

  return { ok: false, error: 'refresh_failed', refreshTokenCount: refreshTokens.length };
}

function scoreAnalystSession(payload, rights, aal) {
  const analystRightCount = rights.filter(right => right.startsWith('analyst.')).length;
  let score = 0;
  if (isAal2(aal)) score += 1000000;
  if (hasAnalystAdminRight(rights)) score += 100000;
  score += analystRightCount * 100;
  score += Math.min(Number(payload.exp || 0), 9999999999) / 100000;
  return score;
}

function hasAnalystAdminRight(rights) {
  return rights.includes(UNIFIED_REQUIRED_RIGHT);
}

function getSupabaseRequestTokens(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return [{ token: bearerMatch[1].trim(), source: 'authorization' }];

  const cookieHeader = request.headers.get('Cookie') || '';
  return parseCookies(cookieHeader, 'sb-token')
    .map(token => ({ token, source: 'cookie' }));
}

function hasAnyAnalystRight(rights, requiredRights) {
  const analystRights = new Set(rights.filter(right => right.startsWith('analyst.')));
  if (requiredRights.includes('analyst.admin') || requiredRights.includes(UNIFIED_REQUIRED_RIGHT)) {
    return analystRights.has(UNIFIED_REQUIRED_RIGHT);
  }
  return requiredRights.some(right => hasAliasedRight(analystRights, right));
}

function hasAliasedRight(rights, requiredRight) {
  const aliases = ANALYST_RIGHT_ALIASES[requiredRight] || [requiredRight];
  return aliases.some(right => rights.has(right));
}

function isAal2(aal) {
  return aal === 'aal2' || aal === 2 || aal === '2';
}

function normalizeAal(aal) {
  return isAal2(aal) ? 'aal2' : 'aal1';
}

function freshReauth(value) {
  const expiresAt = value ? Date.parse(String(value)) : NaN;
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function freshLegacyMfa(payload, env) {
  const expiresAt = legacyMfaFreshnessExpiresAt(payload, env);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function legacyMfaFreshnessExpiresAt(payload, env) {
  const explicitExpiresAt = timestampMillis(payload?.reauth_expires_at);
  if (Number.isFinite(explicitExpiresAt)) return explicitExpiresAt;

  const verifiedAt = latestLegacyMfaVerifiedAt(payload);
  if (!Number.isFinite(verifiedAt)) return NaN;
  return verifiedAt + legacyReauthWindowSeconds(env) * 1000;
}

function latestLegacyMfaVerifiedAt(payload = {}) {
  const candidates = [timestampMillis(payload.aal2_verified_at), timestampMillis(payload.reauth_at)];
  if (Array.isArray(payload.amr)) {
    payload.amr.forEach(item => {
      const method = String(item?.method || '').toLowerCase();
      if (['totp', 'webauthn', 'mfa', 'otp'].includes(method)) {
        candidates.push(timestampMillis(item.timestamp ?? item.time ?? item.verified_at));
      }
    });
  }
  return Math.max(...candidates.filter(Number.isFinite));
}

function legacyReauthWindowSeconds(env) {
  const value = Number(env.ANALYST_LEGACY_REAUTH_WINDOW_SECONDS || LEGACY_REAUTH_WINDOW_SECONDS);
  if (!Number.isFinite(value)) return LEGACY_REAUTH_WINDOW_SECONDS;
  return Math.min(60 * 60, Math.max(60, Math.floor(value)));
}

function timestampMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value < 1000000000000 ? value * 1000 : value;
  if (typeof value !== 'string' || !value.trim()) return NaN;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric < 1000000000000 ? numeric * 1000 : numeric;
  return Date.parse(value);
}

function isUnsafeMethod(method) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function isCookieBackedSession(source) {
  return ['cookie', 'refresh_cookie', 'unified_cookie'].includes(source);
}

function hasSameOriginMutation(request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  if (origin) return origin === requestOrigin;

  const referer = request.headers.get('Referer');
  if (!referer) return false;

  try {
    return new URL(referer).origin === requestOrigin;
  } catch {
    return false;
  }
}

function getSessionEmail(session) {
  const payload = session?.payload || {};
  const user = payload.user_metadata || {};
  return payload.email || user.email || payload.sub || 'unknown';
}

async function verifySupabaseJWT(token, secret, env) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = decodeSupabasePayload(headerB64);

    if (header.alg === 'HS256') {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const valid = await crypto.subtle.verify('HMAC', cryptoKey, base64UrlDecode(signatureB64), encoder.encode(`${headerB64}.${payloadB64}`));
      if (valid) return decodeVerifiedSupabasePayload(payloadB64);
    }

    return validateSupabaseAccessToken(token, env);
  } catch {
    return null;
  }
}

function decodeVerifiedSupabasePayload(payloadB64) {
  const payload = decodeSupabasePayload(payloadB64);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;
  return payload;
}

async function validateSupabaseAccessToken(token, env) {
  const supabaseUrl = env.SUPABASE_URL;
  const apiKey = env.SUPABASE_ANON_KEY;
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
    const payload = decodeVerifiedSupabasePayload(token.split('.')[1]);
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

function decodeSupabasePayload(payloadB64) {
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

function authJson(data, status, extraHeaders = {}, setCookies = []) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  Object.entries(extraHeaders).forEach(([key, value]) => {
    if (value !== undefined && value !== null) headers.set(key, String(value));
  });
  setCookies.forEach(cookie => headers.append('Set-Cookie', cookie));
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
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

function debugAuthHeaders(session, enabled) {
  if (!enabled) return {};
  const headers = {
    'X-Analyst-Auth-Token-Count': session?.tokenCount || 0,
  };
  if (session?.refreshTokenCount !== undefined) headers['X-Analyst-Auth-Refresh-Token-Count'] = session.refreshTokenCount;
  if (!session?.ok) {
    headers['X-Analyst-Auth-Error'] = session?.error || 'unknown';
    return headers;
  }
  headers['X-Analyst-Auth-Selected-AAL'] = session.aal || 'unknown';
  headers['X-Analyst-Auth-Selected-Index'] = session.tokenIndex ?? 0;
  headers['X-Analyst-Auth-Rights-Count'] = session.rights.filter(right => right.startsWith('analyst.')).length;
  headers['X-Analyst-Auth-Admin'] = hasAnalystAdminRight(session.rights) ? 'true' : 'false';
  if (session.refreshed) headers['X-Analyst-Auth-Refreshed'] = 'true';
  return headers;
}

function safeAuthDebug(session) {
  const debug = {
    ok: Boolean(session?.ok),
    token_count: session?.tokenCount || 0,
    refresh_token_count: session?.refreshTokenCount || 0,
  };
  if (!session?.ok) {
    debug.error = session?.error || 'unknown';
    return debug;
  }
  debug.aal = session.aal || 'unknown';
  debug.selected_index = session.tokenIndex ?? 0;
  debug.analyst_rights_count = session.rights.filter(right => right.startsWith('analyst.')).length;
  debug.admin = hasAnalystAdminRight(session.rights);
  debug.refreshed = Boolean(session.refreshed);
  return debug;
}

/**
 * RELEASE LOCK
 * Editor is done, release lock for others
 */
async function handleReleaseLock(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { dossierId, sessionId } = await request.json();

  if (!dossierId || !sessionId) {
    return new Response(JSON.stringify({ error: 'Missing dossierId or sessionId' }), {
      status: 400,
    });
  }

  const lockKey = `lock:${dossierId}`;
  const lock = await env.SESSION_STORE.get(lockKey, 'json');

  if (!lock || lock.sessionId !== sessionId) {
    return new Response(JSON.stringify({ error: 'Invalid session or lock not found' }), {
      status: 401,
    });
  }

  await env.SESSION_STORE.delete(lockKey);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * SESSION STATUS
 * Get current lock and session info
 */
async function handleSessionStatus(request, env) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const url = new URL(request.url);
  const dossierId = url.searchParams.get('dossierId');

  if (!dossierId) {
    return new Response(JSON.stringify({ error: 'Missing dossierId' }), { status: 400 });
  }

  const lockKey = `lock:${dossierId}`;
  const lock = await env.SESSION_STORE.get(lockKey, 'json');

  if (!lock) {
    return new Response(JSON.stringify({ lock: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const lockAge = Date.now() - lock.acquiredAt;
  const LOCK_TIMEOUT = 5 * 60 * 1000;
  const timeRemaining = Math.max(0, LOCK_TIMEOUT - lockAge);

  return new Response(
    JSON.stringify({
      lock: {
        ...lock,
        timeRemainingMs: timeRemaining,
        isExpired: timeRemaining === 0,
      },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * HEARTBEAT
 * Keep lock alive while editing
 */
async function handleHeartbeat(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { dossierId, sessionId } = await request.json();

  if (!dossierId || !sessionId) {
    return new Response(JSON.stringify({ error: 'Missing dossierId or sessionId' }), {
      status: 400,
    });
  }

  const lockKey = `lock:${dossierId}`;
  const lock = await env.SESSION_STORE.get(lockKey, 'json');

  if (!lock || lock.sessionId !== sessionId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
  }

  // Update heartbeat
  lock.heartbeatAt = Date.now();
  await env.SESSION_STORE.put(lockKey, JSON.stringify(lock), {
    expirationTtl: 60 * 60,
  });

  return new Response(JSON.stringify({ success: true, heartbeatAt: lock.heartbeatAt }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * AUTOSAVE
 * Save draft to KV (not published)
 */
async function handleAutosave(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { dossierId, sessionId, content, metadata } = await request.json();

  if (!dossierId || !sessionId || !content) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
    });
  }

  const lockKey = `lock:${dossierId}`;
  const lock = await env.SESSION_STORE.get(lockKey, 'json');

  if (!lock || lock.sessionId !== sessionId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
  }

  const draftKey = `draft:${dossierId}`;
  const draft = {
    dossierId,
    userId: lock.userId,
    userEmail: lock.userEmail,
    content,
    metadata: metadata || {},
    savedAt: Date.now(),
    sessionId,
  };

  await env.DRAFT_STORE.put(draftKey, JSON.stringify(draft), {
    expirationTtl: 7 * 24 * 60 * 60, // 7 days
  });

  return new Response(JSON.stringify({ success: true, draft }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * DRAFT
 * Get current draft
 */
async function handleDraft(request, env) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const url = new URL(request.url);
  const dossierId = url.searchParams.get('dossierId');

  if (!dossierId) {
    return new Response(JSON.stringify({ error: 'Missing dossierId' }), { status: 400 });
  }

  const draftKey = `draft:${dossierId}`;
  const draft = await env.DRAFT_STORE.get(draftKey, 'json');

  return new Response(JSON.stringify({ draft: draft || null }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * HANDOFF
 * Allow another user to take over if current user inactive
 */
async function handleHandoff(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { dossierId, newUserId, newUserEmail } = await request.json();

  if (!dossierId || !newUserId || !newUserEmail) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
    });
  }

  const lockKey = `lock:${dossierId}`;
  const lock = await env.SESSION_STORE.get(lockKey, 'json');

  if (!lock) {
    return new Response(JSON.stringify({ error: 'No lock to handoff' }), { status: 404 });
  }

  const lockAge = Date.now() - lock.heartbeatAt;
  const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  if (lockAge < INACTIVITY_TIMEOUT) {
    return new Response(
      JSON.stringify({
        error: 'User is still active, cannot handoff',
        timeRemainingMs: INACTIVITY_TIMEOUT - lockAge,
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // User is inactive, transfer lock
  const newLock = {
    dossierId,
    userId: newUserId,
    userEmail: newUserEmail,
    acquiredAt: Date.now(),
    sessionId: generateSessionId(),
    heartbeatAt: Date.now(),
    previousUser: lock.userId,
    handoffAt: Date.now(),
  };

  await env.SESSION_STORE.put(lockKey, JSON.stringify(newLock), {
    expirationTtl: 60 * 60,
  });

  return new Response(JSON.stringify({ success: true, lock: newLock }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * PUBLISH
 * Commit draft to GitHub, merge to main
 */
async function handlePublish(request, env, ctx) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { dossierId, sessionId, message } = await request.json();

  if (!dossierId || !sessionId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
    });
  }

  const lockKey = `lock:${dossierId}`;
  const lock = await env.SESSION_STORE.get(lockKey, 'json');

  if (!lock || lock.sessionId !== sessionId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
  }

  const draftKey = `draft:${dossierId}`;
  const draft = await env.DRAFT_STORE.get(draftKey, 'json');

  if (!draft) {
    return new Response(JSON.stringify({ error: 'No draft to publish' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Commit to GitHub via Contents API
  const githubRepo = env.GITHUB_REPO || 'riz-razak/analyst';
  const githubBranch = env.GITHUB_BRANCH || 'main';
  const githubToken = env.GITHUB_TOKEN;

  if (!githubToken) {
    return new Response(
      JSON.stringify({ error: 'GITHUB_TOKEN secret not configured — cannot publish to GitHub' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Target file: public/{dossierId}/index.html (dossiers at root level)
  const filePath = `public/${dossierId}/index.html`;
  const apiBase = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;
  const commitMessage = message || `chore(cms): publish ${dossierId} by ${lock.userEmail}`;

  // Step 1 — fetch current file SHA (needed for updates, absent for new files)
  let currentSha = null;
  try {
    const getResp = await fetch(`${apiBase}?ref=${githubBranch}`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'analyst-cms-worker',
      },
    });
    if (getResp.ok) {
      const fileData = await getResp.json();
      currentSha = fileData.sha;
    }
    // 404 = new file — currentSha stays null, GitHub will create it
  } catch (_) {
    // network error — proceed; GitHub will reject on conflict if file exists
  }

  // Step 2 — base64-encode the HTML content (btoa + URI-encode for full Unicode safety)
  const contentBase64 = btoa(unescape(encodeURIComponent(draft.content)));

  // Step 3 — PUT to GitHub Contents API
  const putBody = {
    message: commitMessage,
    content: contentBase64,
    branch: githubBranch,
    committer: {
      name: 'Analyst CMS',
      email: 'cms@analyst.rizrazak.com',
    },
  };
  if (currentSha) putBody.sha = currentSha;

  const putResp = await fetch(apiBase, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'analyst-cms-worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(putBody),
  });

  if (!putResp.ok) {
    const errBody = await putResp.text();
    return new Response(
      JSON.stringify({ error: `GitHub API error (${putResp.status})`, detail: errBody }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const putData = await putResp.json();
  const commitUrl = putData.commit?.html_url || null;

  // Mark as published in KV for local status tracking
  const publishedKey = `published:${dossierId}`;
  const published = {
    ...draft,
    publishedAt: Date.now(),
    message: commitMessage,
    commitUrl,
    commitSha: putData.commit?.sha,
  };

  await env.DRAFT_STORE.put(publishedKey, JSON.stringify(published), {
    expirationTtl: 30 * 24 * 60 * 60, // 30 days
  });
  ctx?.waitUntil?.(capturePublishedDossier(env, {
    slug: dossierId,
    html: draft.content,
    commitSha: putData.commit?.sha,
    trigger: 'cms-publish',
  }));

  // Clear draft and release lock
  await env.DRAFT_STORE.delete(draftKey);
  await env.SESSION_STORE.delete(lockKey);

  return new Response(JSON.stringify({ success: true, published, commitUrl }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN OTP — Email one-time password for private notes section
// Uses Resend (same RESEND_API_KEY) — 6-digit code, 5-min TTL in KV
// ═══════════════════════════════════════════════════════════════════════════

const OTP_ADMIN_EMAIL = 'riz@dgtl.lk';
const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_COOLDOWN_SECONDS = 60; // 1 minute between sends
const OTP_KV_KEY = 'admin-otp:current';

/**
 * SEND OTP
 * POST /api/otp/send
 * No auth required — email is hardcoded to OTP_ADMIN_EMAIL.
 * Security is in the code itself (emailed to riz@dgtl.lk only).
 * Rate-limited by 60s cooldown in KV.
 */
async function handleOtpSend(request, env) {
  if (request.method !== 'POST') {
    return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405);
  }
  if (!hasSameOriginMutation(request)) {
    return corsResponse(JSON.stringify({ error: 'Invalid request origin' }), 403);
  }

  // Cooldown check — don't resend within 60s
  const existing = await env.SESSION_STORE.get(OTP_KV_KEY, 'json');
  if (existing) {
    const age = (Date.now() - existing.createdAt) / 1000;
    if (age < OTP_COOLDOWN_SECONDS) {
      const wait = Math.ceil(OTP_COOLDOWN_SECONDS - age);
      return corsResponse(
        JSON.stringify({ error: `Please wait ${wait}s before requesting a new code`, wait }),
        429
      );
    }
  }

  // Generate 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const record = { code, createdAt: Date.now() };

  await env.SESSION_STORE.put(OTP_KV_KEY, JSON.stringify(record), {
    expirationTtl: OTP_TTL_SECONDS,
  });

  // Send email via Resend
  if (!env.RESEND_API_KEY) {
    console.warn('[otp] RESEND_API_KEY not set — OTP email not sent');
    return corsResponse(JSON.stringify({ error: 'Email backend not configured' }), 503);
  }

  // Send directly via Resend API (bypasses FROM_ADDRESS which needs domain verification)
  // Use onboarding@resend.dev until analyst.rizrazak.com is verified in Resend
  const otpFrom = env.RESEND_FROM_ADDRESS || 'Analyst Admin <onboarding@resend.dev>';
  try {
    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: otpFrom,
        to: [OTP_ADMIN_EMAIL],
        subject: `Your Analyst admin code: ${code}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:400px;margin:0 auto;padding:32px 24px;">
            <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">Analyst Admin Panel</p>
            <h2 style="font-size:24px;margin:0 0 24px;color:#1a1a1a;">Your verification code</h2>
            <div style="background:#f0ece0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <span style="font-size:36px;font-weight:700;letter-spacing:0.2em;color:#1a1a1a;font-family:monospace;">${code}</span>
            </div>
            <p style="color:#6b7280;font-size:13px;">This code expires in 5 minutes. If you didn't request this, you can safely ignore it.</p>
          </div>`,
        text: `Your Analyst admin verification code is: ${code}\n\nThis code expires in 5 minutes.`,
      }),
    });

    if (!emailResp.ok) {
      const errBody = await emailResp.text();
      console.error('[otp] Resend API error:', emailResp.status, errBody);
      throw new Error(`Resend ${emailResp.status}: ${errBody}`);
    }

    const emailResult = await emailResp.json();
    console.log('[otp] Code sent to', OTP_ADMIN_EMAIL, '— email id:', emailResult.id);
  } catch (err) {
    console.error('[otp] Email send failed:', err.message);
    return corsResponse(JSON.stringify({ error: 'Failed to send code — email service error' }), 502);
  }

  return corsResponse(JSON.stringify({ success: true }), 200);
}

/**
 * VERIFY OTP
 * POST /api/otp/verify
 * Body: { code: "123456" }
 * No Bearer auth — the 6-digit code is the credential.
 * Returns { success: true } on match; deletes code after use (single-use).
 */
async function handleOtpVerify(request, env) {
  if (request.method !== 'POST') {
    return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405);
  }
  if (!hasSameOriginMutation(request)) {
    return corsResponse(JSON.stringify({ error: 'Invalid request origin' }), 403);
  }

  const body = await request.json();
  const { code } = body;

  if (!code || !/^\d{6}$/.test(code)) {
    return corsResponse(JSON.stringify({ error: 'Invalid code format' }), 400);
  }

  const record = await env.SESSION_STORE.get(OTP_KV_KEY, 'json');

  if (!record) {
    return corsResponse(JSON.stringify({ error: 'No active code — please request a new one' }), 404);
  }

  // Check expiry (belt-and-suspenders; KV TTL handles this too)
  const age = (Date.now() - record.createdAt) / 1000;
  if (age > OTP_TTL_SECONDS) {
    await env.SESSION_STORE.delete(OTP_KV_KEY);
    return corsResponse(JSON.stringify({ error: 'Code expired — please request a new one' }), 410);
  }

  if (record.code !== code) {
    return corsResponse(JSON.stringify({ error: 'Incorrect code' }), 401);
  }

  // Correct — delete so it can't be reused
  await env.SESSION_STORE.delete(OTP_KV_KEY);
  return corsResponse(JSON.stringify({ success: true }), 200);
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATE PREVIEW & TEST
// Admin panel can preview rendered HTML and send test emails
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/email-templates/preview?template=otp|confirmation|admin-notification|status-update
 * Returns { html: "..." } with sample data filled in
 */
async function handleEmailTemplatePreview(request, env) {
  if (request.method === 'OPTIONS') return corsResponse('', 204);

  const url = new URL(request.url);
  const tpl = url.searchParams.get('template');

  const sampleHtml = renderSampleTemplate(tpl);
  if (!sampleHtml) {
    return corsResponse(JSON.stringify({ error: 'Unknown template: ' + tpl }), 400);
  }

  return corsResponse(JSON.stringify({ html: sampleHtml }), 200);
}

/**
 * POST /api/email-templates/test
 * Body: { template: "otp"|"confirmation"|"admin-notification"|"status-update" }
 * Sends a real test email to OTP_ADMIN_EMAIL using the rendered sample template
 */
async function handleEmailTemplateTest(request, env) {
  if (request.method === 'OPTIONS') return corsResponse('', 204);
  if (request.method !== 'POST') {
    return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405);
  }

  const body = await request.json();
  const tpl = body.template;

  const sampleHtml = renderSampleTemplate(tpl);
  if (!sampleHtml) {
    return corsResponse(JSON.stringify({ error: 'Unknown template: ' + tpl }), 400);
  }

  if (!env.RESEND_API_KEY) {
    return corsResponse(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), 500);
  }

  const subjectMap = {
    'otp': '[TEST] Your Analyst admin code: 123456',
    'confirmation': '[TEST] Submission Received — analyst.rizrazak.com',
    'admin-notification': '[TEST] New Evidence Submission — Bamiyan',
    'status-update': '[TEST] Submission Update — analyst.rizrazak.com',
  };

  const fromAddr = env.RESEND_FROM_ADDRESS || 'Analyst Admin <onboarding@resend.dev>';

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [OTP_ADMIN_EMAIL],
        subject: subjectMap[tpl] || '[TEST] Email Template',
        html: sampleHtml,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[email-test] Resend error:', resp.status, errBody);
      return corsResponse(JSON.stringify({ error: 'Resend error: ' + resp.status }), 502);
    }

    const result = await resp.json();
    return corsResponse(JSON.stringify({ success: true, emailId: result.id }), 200);
  } catch (err) {
    console.error('[email-test] Send failed:', err.message);
    return corsResponse(JSON.stringify({ error: 'Failed to send — ' + err.message }), 502);
  }
}

/**
 * Renders a sample email template with placeholder data for preview/testing
 */
function renderSampleTemplate(tpl) {
  switch (tpl) {
    case 'otp':
      return `<div style="font-family:system-ui,sans-serif;max-width:400px;margin:0 auto;padding:32px 24px;">
        <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">Analyst Admin Panel</p>
        <h2 style="font-size:24px;margin:0 0 24px;color:#1a1a1a;">Your verification code</h2>
        <div style="background:#f0ece0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:36px;font-weight:700;letter-spacing:0.2em;color:#1a1a1a;font-family:monospace;">123456</span>
        </div>
        <p style="color:#6b7280;font-size:13px;">This code expires in 5 minutes. If you didn't request this, you can safely ignore it.</p>
        <p style="color:#d97706;font-size:11px;margin-top:16px;padding-top:12px;border-top:1px solid #eee;">⚠ This is a test email — no real OTP was generated.</p>
      </div>`;

    case 'confirmation':
      return buildConfirmationHtml(
        'Jane Doe',
        'SUB-TEST-20260310-ABCD',
        'anatta-bamiyan',
        { type: 'first-hand', description: 'Sample evidence description for preview purposes. This demonstrates how the submission confirmation email will appear to contributors who submit evidence through the public form.', file: { name: 'evidence-photo.jpg', sizeBytes: 245000, mimeType: 'image/jpeg' } },
        { contactForFollowUp: true, attributeName: false }
      );

    case 'admin-notification':
      return buildAdminNotificationHtml({
        id: 'SUB-TEST-20260310-ABCD',
        dossierId: 'anatta-bamiyan',
        submittedAt: new Date().toISOString(),
        submitter: { name: 'Jane Doe', email: 'jane@example.com', relation: 'Researcher' },
        evidence: { type: 'first-hand', description: 'Sample evidence description for testing the admin notification template. This shows how new submission alerts look.', url: 'https://example.com/evidence', file: { name: 'evidence-photo.jpg', sizeBytes: 245000, mimeType: 'image/jpeg' }, howToIntegrate: 'Could be referenced in the Cultural Heritage section.' },
        permissions: { contactForFollowUp: true, attributeName: false },
        submittedFromIp: '127.0.0.1',
      });

    case 'status-update':
      return buildStatusUpdateHtml(
        'Jane Doe',
        'SUB-TEST-20260310-ABCD',
        'anatta-bamiyan',
        'accepted',
        'Excellent first-hand account. Will be integrated into the Cultural Heritage section of the dossier.'
      );

    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DOSSIER VISIBILITY — KV-backed hide/publish for real access control
// The middleware calls /api/dossier/visibility/check?slug=X on every dossier
// page request to determine if the dossier should be blocked.
// ═══════════════════════════════════════════════════════════════════════════

const VISIBILITY_KV_KEY = 'dossier:visibility';
const SEARCH_INDEX_KV_KEY = 'search:index:v1';
const SEARCH_DOC_PREFIX = 'search:doc:v1:';
const SEARCH_MAX_QUERY_LENGTH = 160;
const SEARCH_MAX_RESULTS = 12;
const SEARCH_SOURCE_BASE = 'https://riz-razak.github.io/analyst';
const LIVE_VISITOR_PREFIX = 'analytics:live';
const LIVE_VISITOR_TTL_SECONDS = 120;
const PAGE_VISIT_PREFIX = 'analytics:page-visits';
const VISIT_LEDGER_PREFIX = 'analytics:visit-ledger';
const VISIT_LEDGER_TTL_SECONDS = 60 * 60 * 24 * 90;
const VISIT_LEDGER_MAX_RECENT = 300;
const VISIT_LEDGER_MAX_SESSION_IDS_PER_HOUR = 1200;

/**
 * GET  /api/dossier/visibility         → returns full visibility map
 * POST /api/dossier/visibility         → sets visibility for a dossier
 *   Body: { slug: "womens-day-betrayal", status: "hidden"|"published" }
 */
async function handleDossierVisibility(request, env) {
  if (request.method === 'OPTIONS') return corsResponse('', 204);

  if (request.method === 'GET') {
    const map = await env.SESSION_STORE.get(VISIBILITY_KV_KEY, 'json') || {};
    return corsResponse(JSON.stringify(map), 200);
  }

  if (request.method !== 'POST') {
    return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405);
  }

  const body = await request.json();
  const { slug, status } = body;

  if (!slug || !status) {
    return corsResponse(JSON.stringify({ error: 'slug and status required' }), 400);
  }
  if (!['published', 'hidden', 'draft'].includes(status)) {
    return corsResponse(JSON.stringify({ error: 'status must be published, hidden, or draft' }), 400);
  }

  // Read current map, update, write back
  const map = await env.SESSION_STORE.get(VISIBILITY_KV_KEY, 'json') || {};
  map[slug] = status;
  await env.SESSION_STORE.put(VISIBILITY_KV_KEY, JSON.stringify(map));

  console.log(`[visibility] ${slug} → ${status}`);
  return corsResponse(JSON.stringify({ success: true, slug, status }), 200);
}

/**
 * GET /api/dossier/visibility/check?slug=womens-day-betrayal
 * Fast endpoint for middleware to call. Returns:
 *   { visible: true }  or  { visible: false, status: "hidden" }
 */
async function handleVisibilityCheck(request, env) {
  if (request.method === 'OPTIONS') return corsResponse('', 204);

  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  if (!slug) {
    return corsResponse(JSON.stringify({ visible: true }), 200);
  }

  const map = await env.SESSION_STORE.get(VISIBILITY_KV_KEY, 'json') || {};
  const status = map[slug];

  // If not in the map or explicitly published, it's visible
  if (!status || status === 'published') {
    return corsResponse(JSON.stringify({ visible: true }), 200);
  }

  // Hidden or draft — not visible
  return corsResponse(JSON.stringify({ visible: false, status }), 200);
}

async function handleSearch(request, env) {
  if (request.method === 'OPTIONS') return corsResponse('', 204);
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const url = new URL(request.url);
  const query = normalizeSearchQuery(url.searchParams.get('q') || '');
  const mode = url.searchParams.get('mode') === 'answer' ? 'answer' : 'retrieve';
  const topic = normalizeSearchQuery(url.searchParams.get('topic') || '');
  const lang = normalizeSearchQuery(url.searchParams.get('lang') || '');
  const limit = Math.max(1, Math.min(SEARCH_MAX_RESULTS, Number(url.searchParams.get('limit')) || 8));

  if ((url.searchParams.get('q') || '').length > SEARCH_MAX_QUERY_LENGTH) {
    return jsonResponse({ error: `Query must be ${SEARCH_MAX_QUERY_LENGTH} characters or fewer` }, 400);
  }

  const documents = await loadSearchDocuments(env);
  const visibleDocuments = await filterVisibleSearchDocuments(env, documents);
  const results = rankSearchDocuments(visibleDocuments, query, { topic, lang }).slice(0, limit);

  const response = {
    query,
    mode,
    generated: false,
    policy: {
      defaultMode: 'retrieve',
      scope: 'approved public Analyst material only',
      answerMode: 'citation-gated and not enabled for unsupported queries',
    },
    results,
  };

  if (mode === 'answer') {
    response.answer = buildSearchAnswerStub(query, results);
  }

  return jsonResponse(response);
}

async function handleSearchStatus(request, env) {
  if (request.method === 'OPTIONS') return corsResponse('', 204);
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const url = new URL(request.url);
  const slug = safeSlug(url.searchParams.get('slug') || '');
  if (slug) {
    const doc = await env.SESSION_STORE.get(`${SEARCH_DOC_PREFIX}${slug}`, 'json');
    return jsonResponse({ slug, indexed: Boolean(doc), document: doc || null });
  }
  const index = await env.SESSION_STORE.get(SEARCH_INDEX_KV_KEY, 'json') || {};
  return jsonResponse({
    indexedCount: Array.isArray(index.slugs) ? index.slugs.length : 0,
    slugs: index.slugs || [],
    updatedAt: index.updatedAt || null,
  });
}

async function handleSearchCapture(request, env, ctx) {
  if (request.method === 'OPTIONS') return corsResponse('', 204);
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => null);
  const slug = safeSlug(body?.slug || '');
  if (!slug) return jsonResponse({ error: 'slug required' }, 400);

  const promise = capturePublishedDossier(env, {
    slug,
    html: typeof body?.html === 'string' ? body.html : null,
    commitSha: body?.commitSha || null,
    trigger: body?.trigger || 'manual-capture',
  });
  ctx?.waitUntil?.(promise);
  const captured = await promise;
  return jsonResponse({ success: true, captured });
}

async function handleSearchReindex(request, env, ctx) {
  if (request.method === 'OPTIONS') return corsResponse('', 204);
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const promise = reindexSearchDocuments(env);
  ctx?.waitUntil?.(promise);
  const result = await promise;
  return jsonResponse({ success: true, ...result });
}

async function loadSearchDocuments(env) {
  const index = await env.SESSION_STORE.get(SEARCH_INDEX_KV_KEY, 'json') || {};
  const slugs = Array.isArray(index.slugs) ? index.slugs : [];
  const docs = [];
  for (const slug of slugs) {
    const doc = await env.SESSION_STORE.get(`${SEARCH_DOC_PREFIX}${slug}`, 'json');
    if (doc) docs.push(doc);
  }
  if (docs.length > 0) return docs;
  return buildLiveSearchDocuments(env);
}

async function buildLiveSearchDocuments(env) {
  const registry = await fetchRegistryFromOrigin();
  const published = registry.dossiers.filter(item => item.status === 'published');
  return Promise.all(published.map(item => buildSearchDocumentFromRegistry(item)));
}

async function reindexSearchDocuments(env) {
  const registry = await fetchRegistryFromOrigin();
  const published = registry.dossiers.filter(item => item.status === 'published');
  const documents = [];
  for (const item of published) {
    try {
      const doc = await buildSearchDocumentFromRegistry(item);
      await putSearchDocument(env, doc);
      documents.push(doc.slug);
    } catch (error) {
      console.error('[search] reindex failed for', item.id, error.message);
    }
  }
  await env.SESSION_STORE.put(SEARCH_INDEX_KV_KEY, JSON.stringify({
    slugs: documents,
    updatedAt: new Date().toISOString(),
  }));
  return { indexedCount: documents.length, slugs: documents };
}

async function capturePublishedDossier(env, { slug, html, commitSha, trigger }) {
  const safe = safeSlug(slug);
  if (!safe) throw new Error('Invalid search capture slug');

  const registry = await fetchRegistryFromOrigin();
  const registryRecord = registry.dossiers.find(item => item.id === safe) || { id: safe, status: 'published' };
  const sourceHtml = html || await fetchDossierHtml(registryRecord);
  const document = buildSearchDocument(registryRecord, sourceHtml, { commitSha, trigger });
  await putSearchDocument(env, document);
  return { slug: document.slug, chunkCount: document.chunks.length, indexedAt: document.indexedAt, trigger };
}

async function putSearchDocument(env, document) {
  await env.SESSION_STORE.put(`${SEARCH_DOC_PREFIX}${document.slug}`, JSON.stringify(document));
  const index = await env.SESSION_STORE.get(SEARCH_INDEX_KV_KEY, 'json') || {};
  const slugs = new Set(Array.isArray(index.slugs) ? index.slugs : []);
  slugs.add(document.slug);
  await env.SESSION_STORE.put(SEARCH_INDEX_KV_KEY, JSON.stringify({
    slugs: [...slugs].sort(),
    updatedAt: new Date().toISOString(),
  }));
}

async function buildSearchDocumentFromRegistry(registryRecord) {
  const html = await fetchDossierHtml(registryRecord);
  return buildSearchDocument(registryRecord, html, { trigger: 'live-origin' });
}

async function fetchRegistryFromOrigin() {
  const response = await fetch(`${SEARCH_SOURCE_BASE}/data/dossiers.json`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Registry fetch failed: ${response.status}`);
  const data = await response.json();
  return { dossiers: Array.isArray(data.dossiers) ? data.dossiers : [] };
}

async function fetchDossierHtml(registryRecord) {
  const url = resolveDossierOriginUrl(registryRecord);
  const response = await fetch(url, { headers: { Accept: 'text/html' } });
  if (!response.ok) throw new Error(`Dossier fetch failed for ${registryRecord.id}: ${response.status}`);
  return response.text();
}

function resolveDossierOriginUrl(registryRecord) {
  const rawUrl = registryRecord.contentUrl || `/${registryRecord.id}/index.html`;
  const pathname = /^https?:\/\//.test(rawUrl) ? new URL(rawUrl).pathname : rawUrl;
  const normalized = pathname.endsWith('/index.html') ? pathname : `${pathname.replace(/\/$/, '')}/index.html`;
  return `${SEARCH_SOURCE_BASE}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

async function filterVisibleSearchDocuments(env, documents) {
  const map = await env.SESSION_STORE.get(VISIBILITY_KV_KEY, 'json') || {};
  return documents.filter(doc => {
    if (doc.status && doc.status !== 'published') return false;
    const visibility = map[doc.slug];
    return !visibility || visibility === 'published';
  });
}

function buildSearchDocument(registryRecord, html, options = {}) {
  const slug = safeSlug(registryRecord.id || '');
  const meta = extractHtmlMeta(html);
  const title = registryRecord.title || meta.title || titleCase(slug);
  const description = registryRecord.description || meta.description || '';
  const body = extractSearchableHtmlText(html);
  const chunks = buildSearchChunks(slug, title, description, body);
  const allText = [
    title,
    registryRecord.titleSi,
    description,
    registryRecord.descriptionSi,
    registryRecord.category,
    ...(registryRecord.tags || []),
    ...(registryRecord.tagsSi || []),
    chunks.map(chunk => chunk.text).join(' '),
  ].filter(Boolean).join(' ');
  return {
    slug,
    title,
    description,
    url: registryRecord.contentUrl || `/${slug}`,
    date: registryRecord.date || registryRecord.publishedAt || null,
    status: registryRecord.status || 'published',
    category: registryRecord.category || '',
    tags: Array.isArray(registryRecord.tags) ? registryRecord.tags : [],
    language: detectSearchLanguage(registryRecord, allText),
    evidenceStatus: inferEvidenceStatus(registryRecord, allText),
    commitSha: options.commitSha || null,
    trigger: options.trigger || 'unknown',
    htmlHash: stableTextHash(html),
    indexedAt: new Date().toISOString(),
    chunks,
    searchText: normalizeSearchText(allText),
  };
}

function extractHtmlMeta(html) {
  return {
    title: decodeHtmlEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ''),
    description: decodeHtmlEntities((html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || [])[1] || ''),
  };
}

function extractSearchableHtmlText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function buildSearchChunks(slug, title, description, body) {
  const chunks = [];
  if (description) {
    chunks.push({
      chunkId: `${slug}:summary`,
      kind: 'summary',
      heading: title,
      anchor: '',
      text: cleanSnippetText(description).slice(0, 1200),
      weight: 3,
    });
  }
  const sentences = cleanSnippetText(body).split(/(?<=[.!?])\s+/).filter(Boolean);
  let current = '';
  let count = 0;
  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > 900 && current) {
      chunks.push({
        chunkId: `${slug}:body:${count}`,
        kind: 'body',
        heading: title,
        anchor: '',
        text: current,
        weight: 1,
      });
      count += 1;
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
    if (count >= 8) break;
  }
  if (current && count < 9) {
    chunks.push({
      chunkId: `${slug}:body:${count}`,
      kind: 'body',
      heading: title,
      anchor: '',
      text: current,
      weight: 1,
    });
  }
  return chunks.map(chunk => ({ ...chunk, hash: stableTextHash(chunk.text) }));
}

function rankSearchDocuments(documents, query, filters = {}) {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const topic = filters.topic && filters.topic !== 'all' ? filters.topic : '';
  const lang = filters.lang && filters.lang !== 'all' ? filters.lang : '';
  return documents
    .filter(doc => !topic || normalizeSearchText([doc.category, ...(doc.tags || [])].join(' ')).includes(topic))
    .filter(doc => !lang || doc.language === lang || doc.language === 'mixed')
    .map(doc => scoreSearchDocument(doc, terms))
    .filter(hit => !terms.length || hit.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.date || 0) - new Date(a.date || 0));
}

function scoreSearchDocument(doc, terms) {
  if (!terms.length) {
    return searchHitFromDocument(doc, 1, doc.description || doc.chunks[0]?.text || '');
  }
  let score = 0;
  const titleText = normalizeSearchText(doc.title);
  const tagText = normalizeSearchText((doc.tags || []).join(' '));
  const bodyText = doc.searchText || '';
  for (const term of terms) {
    if (titleText.includes(term)) score += 10;
    if (tagText.includes(term)) score += 6;
    if (bodyText.includes(term)) score += 2;
  }
  const bestChunk = findBestSearchChunk(doc, terms);
  score += bestChunk.score;
  return searchHitFromDocument(doc, score, bestChunk.text || doc.description || '');
}

function findBestSearchChunk(doc, terms) {
  let best = { score: 0, text: '' };
  for (const chunk of doc.chunks || []) {
    const text = normalizeSearchText(chunk.text);
    const score = terms.reduce((sum, term) => sum + (text.includes(term) ? chunk.weight || 1 : 0), 0);
    if (score > best.score) best = { score, text: chunk.text };
  }
  return best;
}

function searchHitFromDocument(doc, score, snippetText) {
  return {
    slug: doc.slug,
    title: doc.title,
    url: normalizePublicDossierUrl(doc.url, doc.slug),
    date: doc.date,
    category: doc.category,
    tags: doc.tags || [],
    language: doc.language,
    evidenceStatus: doc.evidenceStatus,
    snippet: makeSearchSnippet(snippetText),
    score,
    indexedAt: doc.indexedAt || null,
  };
}

function buildSearchAnswerStub(query, results) {
  if (!query || results.length === 0) {
    return {
      status: 'refused',
      message: 'No supported answer in the approved Analyst archive for this query.',
      citations: [],
    };
  }
  return {
    status: 'retrieve_only',
    message: 'Answer mode is citation-gated. Open the cited search results while synthesis is being evaluated.',
    citations: results.slice(0, 3).map(result => ({ title: result.title, url: result.url })),
  };
}

function normalizeSearchQuery(value) {
  return String(value || '').trim().slice(0, SEARCH_MAX_QUERY_LENGTH);
}

function normalizeSearchText(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function cleanSnippetText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function makeSearchSnippet(value) {
  const text = cleanSnippetText(value);
  return text.length > 260 ? `${text.slice(0, 257).trim()}...` : text;
}

function normalizePublicDossierUrl(url, slug) {
  if (!url) return `/${slug}`;
  if (/^https?:\/\//.test(url)) return new URL(url).pathname.replace(/\/index\.html$/, '');
  return url.replace(/\/index\.html$/, '');
}

function safeSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) ? slug : '';
}

function detectSearchLanguage(registryRecord, text) {
  const hasSinhala = /[\u0D80-\u0DFF]/.test(text);
  const hasTamil = /[\u0B80-\u0BFF]/.test(text);
  if (hasSinhala && hasTamil) return 'mixed';
  if (hasSinhala || registryRecord.titleSi || registryRecord.descriptionSi) return 'mixed';
  if (hasTamil) return 'mixed';
  return 'en';
}

function inferEvidenceStatus(registryRecord, text) {
  const haystack = normalizeSearchText([registryRecord.category, registryRecord.kicker, text].filter(Boolean).join(' '));
  if (haystack.includes('allegation') || haystack.includes('alleged')) return 'allegation';
  if (haystack.includes('source') || haystack.includes('evidence') || haystack.includes('claim')) return 'source-gated';
  if (haystack.includes('opinion')) return 'opinion';
  return 'published';
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stableTextHash(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/**
 * POST /api/analytics/live-visitors
 * Lightweight privacy-preserving presence counter.
 *
 * Stores only an anonymous browser-generated visitor ID, normalized path, and
 * heartbeat timestamp in KV with a short TTL. It does not store IP addresses,
 * user agents, referrers, or personal identifiers.
 */
async function handleLiveVisitors(request, env) {
  if (request.method === 'OPTIONS') return corsResponse('', 204);

  if (!env.SESSION_STORE) {
    return liveVisitorResponse({ liveVisitors: null, unavailable: true }, 503);
  }

  const url = new URL(request.url);
  let pagePath = normalizeAnalyticsPath(url.searchParams.get('path') || '/');
  let visitorId = '';
  let recordedHeartbeat = false;

  if (request.method === 'POST') {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    pagePath = normalizeAnalyticsPath(body.path || pagePath);
    visitorId = normalizeVisitorId(body.visitorId);
    if (!visitorId) {
      return liveVisitorResponse({ error: 'visitorId required' }, 400);
    }

    const key = liveVisitorKey(pagePath, visitorId);
    await env.SESSION_STORE.put(key, JSON.stringify({
      path: pagePath,
      updatedAt: Date.now(),
    }), { expirationTtl: LIVE_VISITOR_TTL_SECONDS });
    recordedHeartbeat = true;
  } else if (request.method !== 'GET') {
    return liveVisitorResponse({ error: 'Method not allowed' }, 405);
  }

  let liveVisitors = await countLiveVisitors(env, pagePath);
  if (recordedHeartbeat && liveVisitors < 1) liveVisitors = 1;
  return liveVisitorResponse({
    success: true,
    path: pagePath,
    liveVisitors,
    windowSeconds: LIVE_VISITOR_TTL_SECONDS,
    sampledAt: new Date().toISOString(),
  });
}

function normalizeVisitorId(value) {
  const id = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{16,96}$/.test(id)) return '';
  return id;
}

function normalizeAnalyticsPath(value) {
  let path = String(value || '/').trim();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.split('#')[0].split('?')[0] || '/';
  if (path.length > 180) path = path.slice(0, 180);
  return path.replace(/\/{2,}/g, '/');
}

function analyticsPathKey(path) {
  return normalizeAnalyticsPath(path).replace(/[^a-zA-Z0-9/_-]/g, '_').replace(/\//g, '~');
}

function liveVisitorKey(path, visitorId) {
  return `${LIVE_VISITOR_PREFIX}:${analyticsPathKey(path)}:${visitorId}`;
}

async function countLiveVisitors(env, path) {
  const prefix = `${LIVE_VISITOR_PREFIX}:${analyticsPathKey(path)}:`;
  let count = 0;
  let cursor;
  do {
    const result = await env.SESSION_STORE.list({ prefix, cursor, limit: 1000 });
    count += result.keys.length;
    cursor = result.list_complete ? null : result.cursor;
  } while (cursor && count < 10000);
  return count;
}

function liveVisitorResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * GET  /api/analytics/page-visits?path=/some-page/
 * POST /api/analytics/page-visits
 * Lightweight public page-visit counter.
 *
 * Counts approximate recorded visits per normalized path. The client records at
 * most one visit per tab session, and the server stores only aggregate counts.
 * It does not store IP addresses, user agents, referrers, or personal IDs.
 */
async function handlePageVisits(request, env) {
  if (request.method === 'OPTIONS') return analyticsResponse('', 204);

  if (!env.SESSION_STORE) {
    return analyticsResponse({ pageVisits: null, unavailable: true }, 503);
  }

  const url = new URL(request.url);
  let pagePath = normalizeAnalyticsPath(url.searchParams.get('path') || '/');
  let recordedVisit = false;

  if (request.method === 'POST') {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    pagePath = normalizeAnalyticsPath(body.path || pagePath);
    recordedVisit = true;
  } else if (request.method !== 'GET') {
    return analyticsResponse({ error: 'Method not allowed' }, 405);
  }

  const pageVisits = recordedVisit
    ? await incrementPageVisits(env, pagePath)
    : await readPageVisits(env, pagePath);

  return analyticsResponse({
    success: true,
    path: pagePath,
    pageVisits,
    metric: 'approximate_recorded_page_visits',
    sampledAt: new Date().toISOString(),
  });
}

function pageVisitKey(path) {
  return `${PAGE_VISIT_PREFIX}:${analyticsPathKey(path)}:total`;
}

async function readPageVisits(env, path) {
  const raw = await env.SESSION_STORE.get(pageVisitKey(path));
  const count = Number.parseInt(raw || '0', 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

async function incrementPageVisits(env, path) {
  const key = pageVisitKey(path);
  const current = await readPageVisits(env, path);
  const next = current + 1;
  await env.SESSION_STORE.put(key, String(next));
  return next;
}

/**
 * POST /api/analytics/visit-ledger
 * GET  /api/analytics/visit-ledger?path=/mullivaikkal-40000-deaths/
 *
 * Private graph-ready traffic ledger for internal review. The public POST stores
 * sanitized aggregates only: no IP address, no raw user agent, and no raw
 * browser visitor ID. The GET route is protected by Analyst auth.
 */
async function handleVisitLedger(request, env) {
  if (request.method === 'OPTIONS') return analyticsResponse('', 204);

  if (!env.SESSION_STORE) {
    return analyticsResponse({ unavailable: true }, 503);
  }

  const url = new URL(request.url);
  if (request.method === 'GET') {
    const pagePath = normalizeAnalyticsPath(url.searchParams.get('path') || '/');
    const summary = await readVisitLedger(env, pagePath);
    return analyticsResponse({
      success: true,
      path: pagePath,
      generatedAt: new Date().toISOString(),
      ledger: publicVisitLedgerSummary(summary),
    });
  }

  if (request.method !== 'POST') {
    return analyticsResponse({ error: 'Method not allowed' }, 405);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const pagePath = normalizeAnalyticsPath(body.path || url.searchParams.get('path') || '/');
  const eventType = normalizeLedgerEventType(body.eventType);
  const now = Date.now();
  const sessionHash = await hashLedgerSessionId(pagePath, body.visitorId || body.sessionId || '');
  const event = {
    eventType,
    timestamp: now,
    iso: new Date(now).toISOString(),
    pagePath,
    sessionHash,
    referrer: sanitizeLedgerReferrer(body.referrer || '', url.origin),
    language: sanitizeLedgerToken(body.language || '', 24) || 'unknown',
    langMode: sanitizeLedgerToken(body.langMode || '', 12) || 'unknown',
    viewportClass: classifyLedgerViewport(body.viewport),
    deviceClass: classifyLedgerDevice(body.userAgent || '', body.viewport),
    sourceChannel: classifyLedgerSource(body.referrer || '', body.utm || {}),
    utm: sanitizeLedgerUtm(body.utm || {}),
    counterVisit: body.counterVisit === true,
    pageVisits: Number.isFinite(body.pageVisits) ? Math.max(0, Math.floor(body.pageVisits)) : null,
    liveVisitors: Number.isFinite(body.liveVisitors) ? Math.max(0, Math.floor(body.liveVisitors)) : null,
  };

  const summary = await recordVisitLedgerEvent(env, pagePath, event);
  return analyticsResponse({
    success: true,
    path: pagePath,
    eventType,
    recordedAt: event.iso,
    totals: summary.totals,
  });
}

function visitLedgerKey(path) {
  return `${VISIT_LEDGER_PREFIX}:${analyticsPathKey(path)}:summary`;
}

async function readVisitLedger(env, path) {
  const existing = await env.SESSION_STORE.get(visitLedgerKey(path), 'json');
  return normalizeVisitLedgerSummary(existing, path);
}

function normalizeVisitLedgerSummary(existing, path) {
  return {
    path: normalizeAnalyticsPath(existing?.path || path),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: existing?.updatedAt || null,
    totals: sanitizeCountMap(existing?.totals),
    hourly: sanitizeHourlyMap(existing?.hourly),
    dimensions: {
      referrers: sanitizeCountMap(existing?.dimensions?.referrers),
      sourceChannels: sanitizeCountMap(existing?.dimensions?.sourceChannels),
      languages: sanitizeCountMap(existing?.dimensions?.languages),
      langModes: sanitizeCountMap(existing?.dimensions?.langModes),
      viewportClasses: sanitizeCountMap(existing?.dimensions?.viewportClasses),
      deviceClasses: sanitizeCountMap(existing?.dimensions?.deviceClasses),
      utmSources: sanitizeCountMap(existing?.dimensions?.utmSources),
      utmCampaigns: sanitizeCountMap(existing?.dimensions?.utmCampaigns),
    },
    recent: Array.isArray(existing?.recent) ? existing.recent.slice(-VISIT_LEDGER_MAX_RECENT) : [],
  };
}

async function recordVisitLedgerEvent(env, path, event) {
  const summary = await readVisitLedger(env, path);
  const hour = hourBucketIso(event.timestamp);
  const bucket = summary.hourly[hour] || {
    page_view: 0,
    heartbeat: 0,
    page_exit: 0,
    other: 0,
    counterVisits: 0,
    sessions: [],
    referrers: {},
    sourceChannels: {},
    languages: {},
    viewportClasses: {},
    deviceClasses: {},
  };

  incrementMap(summary.totals, event.eventType);
  incrementMap(bucket, event.eventType);
  if (event.counterVisit) bucket.counterVisits = (bucket.counterVisits || 0) + 1;
  addSessionHash(bucket.sessions, event.sessionHash);

  incrementMap(summary.dimensions.referrers, event.referrer);
  incrementMap(summary.dimensions.sourceChannels, event.sourceChannel);
  incrementMap(summary.dimensions.languages, event.language);
  incrementMap(summary.dimensions.langModes, event.langMode);
  incrementMap(summary.dimensions.viewportClasses, event.viewportClass);
  incrementMap(summary.dimensions.deviceClasses, event.deviceClass);
  if (event.utm.source) incrementMap(summary.dimensions.utmSources, event.utm.source);
  if (event.utm.campaign) incrementMap(summary.dimensions.utmCampaigns, event.utm.campaign);

  incrementMap(bucket.referrers, event.referrer);
  incrementMap(bucket.sourceChannels, event.sourceChannel);
  incrementMap(bucket.languages, event.language);
  incrementMap(bucket.viewportClasses, event.viewportClass);
  incrementMap(bucket.deviceClasses, event.deviceClass);

  summary.hourly[hour] = bucket;
  summary.updatedAt = event.iso;
  summary.recent.push({
    timestamp: event.timestamp,
    iso: event.iso,
    eventType: event.eventType,
    referrer: event.referrer,
    sourceChannel: event.sourceChannel,
    language: event.language,
    langMode: event.langMode,
    viewportClass: event.viewportClass,
    deviceClass: event.deviceClass,
    utm: event.utm,
    counterVisit: event.counterVisit,
    pageVisits: event.pageVisits,
    liveVisitors: event.liveVisitors,
    session: event.sessionHash ? event.sessionHash.slice(0, 12) : 'unknown',
  });
  summary.recent = summary.recent.slice(-VISIT_LEDGER_MAX_RECENT);

  await env.SESSION_STORE.put(visitLedgerKey(path), JSON.stringify(summary), {
    expirationTtl: VISIT_LEDGER_TTL_SECONDS,
  });
  return summary;
}

function publicVisitLedgerSummary(summary) {
  const hourly = Object.fromEntries(Object.entries(summary.hourly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, bucket]) => [hour, {
      pageViews: bucket.page_view || 0,
      counterVisits: bucket.counterVisits || 0,
      heartbeats: bucket.heartbeat || 0,
      exits: bucket.page_exit || 0,
      uniqueSessions: Array.isArray(bucket.sessions) ? bucket.sessions.length : 0,
      referrers: bucket.referrers || {},
      sourceChannels: bucket.sourceChannels || {},
      languages: bucket.languages || {},
      viewportClasses: bucket.viewportClasses || {},
      deviceClasses: bucket.deviceClasses || {},
    }]));

  return {
    path: summary.path,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    totals: summary.totals,
    hourly,
    dimensions: summary.dimensions,
    recent: summary.recent,
    privacy: 'No raw IP addresses, raw user agents, or raw browser visitor IDs are stored.',
  };
}

function normalizeLedgerEventType(value) {
  const eventType = String(value || '').trim().toLowerCase().replace(/[^a-z_]/g, '');
  return ['page_view', 'heartbeat', 'page_exit'].includes(eventType) ? eventType : 'other';
}

async function hashLedgerSessionId(path, value) {
  const id = normalizeVisitorId(value);
  if (!id || !globalThis.crypto?.subtle) return '';
  const bytes = encoder.encode(`${normalizeAnalyticsPath(path)}:${id}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function sanitizeLedgerReferrer(value, origin) {
  const raw = String(value || '').trim();
  if (!raw) return 'direct';
  try {
    const ref = new URL(raw);
    const current = new URL(origin);
    const path = normalizeAnalyticsPath(ref.pathname || '/');
    if (ref.hostname === current.hostname) return `internal:${path}`;
    return `${ref.hostname}${path}`.slice(0, 180);
  } catch {
    return 'unknown';
  }
}

function sanitizeLedgerToken(value, maxLength = 80) {
  return String(value || '')
    .trim()
    .replace(/[^\p{L}\p{N}._:/ -]/gu, '')
    .slice(0, maxLength);
}

function sanitizeLedgerUtm(value) {
  const utm = value && typeof value === 'object' ? value : {};
  return {
    source: sanitizeLedgerToken(utm.source || utm.utm_source || '', 80),
    medium: sanitizeLedgerToken(utm.medium || utm.utm_medium || '', 80),
    campaign: sanitizeLedgerToken(utm.campaign || utm.utm_campaign || '', 100),
  };
}

function classifyLedgerViewport(viewport = {}) {
  const width = Number.parseInt(viewport.width, 10);
  if (!Number.isFinite(width) || width <= 0) return 'unknown';
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function classifyLedgerDevice(userAgent = '', viewport = {}) {
  const ua = String(userAgent || '').toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  const width = Number.parseInt(viewport.width, 10);
  if (Number.isFinite(width) && width > 0 && width < 700) return 'mobile';
  return 'desktop';
}

function classifyLedgerSource(referrer, utm = {}) {
  const source = sanitizeLedgerToken(utm.source || utm.utm_source || '', 80).toLowerCase();
  const medium = sanitizeLedgerToken(utm.medium || utm.utm_medium || '', 80).toLowerCase();
  const raw = String(referrer || '').toLowerCase();
  if (source || medium) return sanitizeLedgerToken(`${source || 'utm'}:${medium || 'unknown'}`, 80);
  if (!raw) return 'direct';
  if (/google|bing|duckduckgo|yahoo|search/.test(raw)) return 'search';
  if (/facebook|instagram|twitter|x\.com|tiktok|youtube|linkedin|reddit|slack|whatsapp/.test(raw)) return 'social';
  if (/analyst\.rizrazak\.com/.test(raw)) return 'internal';
  return 'referral';
}

function sanitizeCountMap(value) {
  const output = {};
  if (!value || typeof value !== 'object') return output;
  for (const [key, count] of Object.entries(value)) {
    const safeKey = sanitizeLedgerToken(key, 180);
    const safeCount = Number.parseInt(count, 10);
    if (safeKey && Number.isFinite(safeCount) && safeCount > 0) output[safeKey] = safeCount;
  }
  return output;
}

function sanitizeHourlyMap(value) {
  const output = {};
  if (!value || typeof value !== 'object') return output;
  for (const [hour, bucket] of Object.entries(value)) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/.test(hour) || !bucket || typeof bucket !== 'object') continue;
    output[hour] = {
      page_view: Number.parseInt(bucket.page_view || 0, 10) || 0,
      heartbeat: Number.parseInt(bucket.heartbeat || 0, 10) || 0,
      page_exit: Number.parseInt(bucket.page_exit || 0, 10) || 0,
      other: Number.parseInt(bucket.other || 0, 10) || 0,
      counterVisits: Number.parseInt(bucket.counterVisits || 0, 10) || 0,
      sessions: Array.isArray(bucket.sessions) ? bucket.sessions.slice(0, VISIT_LEDGER_MAX_SESSION_IDS_PER_HOUR) : [],
      referrers: sanitizeCountMap(bucket.referrers),
      sourceChannels: sanitizeCountMap(bucket.sourceChannels),
      languages: sanitizeCountMap(bucket.languages),
      viewportClasses: sanitizeCountMap(bucket.viewportClasses),
      deviceClasses: sanitizeCountMap(bucket.deviceClasses),
    };
  }
  return output;
}

function incrementMap(map, key) {
  const safeKey = sanitizeLedgerToken(key || 'unknown', 180) || 'unknown';
  map[safeKey] = (Number.parseInt(map[safeKey] || 0, 10) || 0) + 1;
}

function addSessionHash(sessions, sessionHash) {
  if (!sessionHash || !Array.isArray(sessions) || sessions.includes(sessionHash)) return;
  if (sessions.length < VISIT_LEDGER_MAX_SESSION_IDS_PER_HOUR) sessions.push(sessionHash);
}

function hourBucketIso(timestamp) {
  const date = new Date(timestamp);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function analyticsResponse(data, status = 200) {
  return new Response(typeof data === 'string' ? data : JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': typeof data === 'string' ? 'text/plain; charset=utf-8' : 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Extract dossier slug from a root-level path like /womens-day-betrayal/
 * Returns null for non-dossier paths or internal shared asset paths.
 */
function extractDossierSlug(path) {
  // Dossiers live at root: /slug/ or /slug/page.html
  // Skip known non-dossier paths (static files, admin pages, API, etc.)
  if (path === '/' || path.startsWith('/api/') || path.startsWith('/auth/') ||
      path.startsWith('/admin') || path.startsWith('/js/') || path.startsWith('/images/') ||
      path.startsWith('/data/') || path.startsWith('/_shared/') || path.startsWith('/_') ||
      path.startsWith('/architecture-census')) {
    return null;
  }
  // Skip files at root level (login.html, profile.html, etc.)
  if (/^\/[^/]+\.(html|xml|json|txt|css|js|png|jpg|svg|ico|pdf|webp|woff2?)$/i.test(path)) {
    return null;
  }
  // Match: /slug or /slug/ or /slug/anything
  const match = path.match(/^\/([a-z0-9][a-z0-9-]+[a-z0-9])\b/);
  if (!match) return null;
  return match[1];
}

/**
 * Branded 404 page for hidden dossiers (served at the edge)
 */
function buildHiddenDossierPage(slug) {
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
    .container { max-width: 480px; text-align: center; }
    .border-top { width: 60px; height: 3px; background: #2d5016; margin: 0 auto 32px; }
    h1 { font-size: 28px; font-weight: 400; color: #111; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.7; color: #555; margin-bottom: 24px; }
    .home-link {
      display: inline-block; padding: 10px 24px;
      background: #2d5016; color: #fff; text-decoration: none;
      font-size: 13px; font-weight: 600; letter-spacing: 0.05em; border-radius: 4px;
    }
    .home-link:hover { background: #1a3a0e; }
    .ref { margin-top: 32px; font-size: 11px; color: #aaa; font-family: monospace; }
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

// ═══════════════════════════════════════════════════════════════════════════
// EVIDENCE SUBMISSIONS — Public crowdsourced evidence intake
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SUBMIT EVIDENCE (Public — no auth required)
 * Accepts crowdsourced evidence submissions from the dossier front-end.
 * Rate-limited by IP (5 per hour).
 */
async function handleSubmission(request, env, ctx) {
  if (request.method !== 'POST') {
    return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405);
  }

  const body = await request.json();
  const {
    dossierId,
    submitterName,
    submitterEmail,
    submitterRelation,
    evidenceType,
    evidenceDescription,
    evidenceUrl,
    howToIntegrate,
    permissions,
    declaration,
    evidenceFile, // optional: { name, base64, size, mimeType }
  } = body;

  // Validate required fields
  if (!dossierId || !submitterName || !submitterEmail || !evidenceDescription || !declaration) {
    return corsResponse(
      JSON.stringify({ error: 'Missing required fields: name, email, description, and declaration are mandatory' }),
      400
    );
  }

  if (!permissions || !permissions.useInDossier) {
    return corsResponse(
      JSON.stringify({ error: 'You must grant permission for evidence to be used in the dossier' }),
      400
    );
  }

  // Rate limiting: 5 submissions per IP per hour
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateKey = `rate:submission:${ip}`;
  const rateData = await env.SESSION_STORE.get(rateKey, 'json');

  if (rateData && rateData.count >= 5) {
    return corsResponse(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      429
    );
  }

  // Update rate counter
  const newRate = { count: (rateData ? rateData.count : 0) + 1, firstAt: rateData ? rateData.firstAt : Date.now() };
  await env.SESSION_STORE.put(rateKey, JSON.stringify(newRate), { expirationTtl: 3600 });

  // Generate submission ID
  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const submission = {
    id: submissionId,
    dossierId,
    status: 'pending', // pending | under_review | accepted | rejected
    submittedAt: Date.now(),
    submittedFromIp: ip,

    // Submitter info (for accountability)
    submitter: {
      name: submitterName,
      email: submitterEmail,
      relation: submitterRelation || 'not specified',
    },

    // Evidence details
    evidence: {
      type: evidenceType || 'general',
      description: evidenceDescription,
      url: evidenceUrl || null,
      howToIntegrate: howToIntegrate || null,
      // Attached file (base64-encoded, max ~5MB after encoding)
      file: evidenceFile ? {
        name: String(evidenceFile.name || '').slice(0, 255),
        mimeType: String(evidenceFile.mimeType || 'application/octet-stream').slice(0, 100),
        sizeBytes: Number(evidenceFile.size) || 0,
        base64: typeof evidenceFile.base64 === 'string' ? evidenceFile.base64.slice(0, 7_000_000) : null,
      } : null,
    },

    // Permissions granted
    permissions: {
      useInDossier: !!permissions.useInDossier,
      attributeName: !!permissions.attributeName,
      contactForFollowUp: !!permissions.contactForFollowUp,
    },

    // Legal declaration
    declaration: declaration,

    // Review (filled in later by admin)
    review: null,
  };

  // Store in KV under submission: prefix
  const key = `submission:${dossierId}:${submissionId}`;
  await env.DRAFT_STORE.put(key, JSON.stringify(submission), {
    expirationTtl: 90 * 24 * 60 * 60, // 90 days
  });

  // Also maintain an index for listing
  const indexKey = `submission-index:${dossierId}`;
  const existingIndex = await env.DRAFT_STORE.get(indexKey, 'json') || [];
  existingIndex.push({
    id: submissionId,
    submittedAt: submission.submittedAt,
    status: 'pending',
    submitterName: submitterName,
    evidenceType: evidenceType || 'general',
  });
  await env.DRAFT_STORE.put(indexKey, JSON.stringify(existingIndex), {
    expirationTtl: 90 * 24 * 60 * 60,
  });

  // Fire emails in the background — does not block response
  ctx.waitUntil(
    sendSubmissionEmails(env, submission).catch(e =>
      console.error('Submission email failed:', e.message)
    )
  );

  return corsResponse(JSON.stringify({
    success: true,
    submissionId,
    message: 'Thank you. Your submission will be reviewed by the editorial team. A confirmation has been sent to your email.',
  }), 200);
}

/**
 * LIST SUBMISSIONS (Admin — requires auth check upstream via middleware)
 * Returns all submissions for a dossier
 */
async function handleListSubmissions(request, env) {
  if (request.method !== 'GET') {
    return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405);
  }

  const url = new URL(request.url);
  const dossierId = url.searchParams.get('dossierId');
  const status = url.searchParams.get('status'); // optional filter

  if (!dossierId) {
    return corsResponse(JSON.stringify({ error: 'Missing dossierId' }), 400);
  }

  const indexKey = `submission-index:${dossierId}`;
  const index = await env.DRAFT_STORE.get(indexKey, 'json') || [];

  // Filter by status if requested
  const filtered = status ? index.filter(s => s.status === status) : index;

  // For each entry, fetch the full submission
  const submissions = [];
  for (const entry of filtered.slice(-50)) { // Last 50
    const key = `submission:${dossierId}:${entry.id}`;
    const full = await env.DRAFT_STORE.get(key, 'json');
    if (full) submissions.push(full);
  }

  return corsResponse(JSON.stringify({
    total: index.length,
    filtered: submissions.length,
    submissions: submissions.reverse(), // Newest first
  }), 200);
}

/**
 * REVIEW SUBMISSION (Admin — requires auth)
 * Accept, reject, or mark as under review
 */
async function handleReviewSubmission(request, env, ctx, analystSession) {
  if (request.method !== 'POST') {
    return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405);
  }

  const { dossierId, submissionId, action, reviewNotes } = await request.json();
  const reviewerEmail = getSessionEmail(analystSession);

  if (!dossierId || !submissionId || !action) {
    return corsResponse(JSON.stringify({ error: 'Missing required fields' }), 400);
  }

  const validActions = ['under_review', 'accepted', 'rejected'];
  if (!validActions.includes(action)) {
    return corsResponse(
      JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }),
      400
    );
  }

  const key = `submission:${dossierId}:${submissionId}`;
  const submission = await env.DRAFT_STORE.get(key, 'json');

  if (!submission) {
    return corsResponse(JSON.stringify({ error: 'Submission not found' }), 404);
  }

  // Update status and review
  submission.status = action;
  submission.review = {
    action,
    notes: reviewNotes || '',
    reviewerEmail,
    reviewedAt: Date.now(),
  };

  await env.DRAFT_STORE.put(key, JSON.stringify(submission), {
    expirationTtl: 90 * 24 * 60 * 60,
  });

  // Update index
  const indexKey = `submission-index:${dossierId}`;
  const index = await env.DRAFT_STORE.get(indexKey, 'json') || [];
  const indexEntry = index.find(e => e.id === submissionId);
  if (indexEntry) {
    indexEntry.status = action;
    await env.DRAFT_STORE.put(indexKey, JSON.stringify(index), {
      expirationTtl: 90 * 24 * 60 * 60,
    });
  }

  // Notify submitter of decision (background, non-blocking)
  if (submission.submitter && submission.submitter.email) {
    ctx.waitUntil(
      sendReviewStatusEmail(env, submission).catch(e =>
        console.error('Review status email failed:', e.message)
      )
    );
  }

  return corsResponse(JSON.stringify({ success: true, submission }), 200);
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL — Automated confirmation and accountability flow
// Requires RESEND_API_KEY Cloudflare secret: `wrangler secret put RESEND_API_KEY`
// Free tier: 3,000 emails/month — https://resend.com
// ═══════════════════════════════════════════════════════════════════════════

const FROM_ADDRESS = 'Analyst Dossiers <submissions@analyst.rizrazak.com>';
const ADMIN_EMAIL = 'riz@dgtl.lk';
const SITE_URL = 'https://analyst.rizrazak.com';

/**
 * Send submission confirmation to submitter + admin notification
 */
async function sendSubmissionEmails(env, submission) {
  const { id: submissionId, dossierId, submitter, evidence, permissions } = submission;
  const { name, email, relation } = submitter;

  await Promise.all([
    // 1. Confirmation to submitter
    sendEmail(env, {
      to: email,
      subject: `Submission confirmed — ${submissionId}`,
      html: buildConfirmationHtml(name, submissionId, dossierId, evidence, permissions),
      text: buildConfirmationText(name, submissionId, dossierId, evidence, permissions),
    }),

    // 2. Alert to admin
    sendEmail(env, {
      to: ADMIN_EMAIL,
      subject: `[analyst] New submission — ${dossierId}`,
      html: buildAdminNotificationHtml(submission),
      text: buildAdminNotificationText(submission),
    }),
  ]);
}

/**
 * Send status update to submitter when their submission is reviewed
 */
async function sendReviewStatusEmail(env, submission) {
  const { id: submissionId, dossierId, submitter, review } = submission;
  const { name, email } = submitter;
  const { action, notes } = review;

  await sendEmail(env, {
    to: email,
    subject: `Update on your submission — ${submissionId}`,
    html: buildStatusUpdateHtml(name, submissionId, dossierId, action, notes),
    text: buildStatusUpdateText(name, submissionId, dossierId, action, notes),
  });
}

/**
 * Low-level email sender via Resend API
 */
async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — email not sent:', subject);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend API error ${response.status}: ${err}`);
  }

  const result = await response.json();
  console.log('[email] Sent:', subject, '→', to, '— id:', result.id);
}

// ─── Email template helpers ─────────────────────────────────────────────────

function dossierLabel(dossierId) {
  return dossierId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function evidenceTypeSummary(evidence) {
  const t = (evidence.type || 'general').replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ─── Submitter confirmation ──────────────────────────────────────────────────

function buildConfirmationHtml(name, submissionId, dossierId, evidence, permissions) {
  const dossierName = dossierLabel(dossierId);
  const dossierUrl = `${SITE_URL}/${dossierId}/`;
  const desc = String(evidence.description || '').slice(0, 300);
  const canContact = permissions.contactForFollowUp;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f8f5;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f5;">
<tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;max-width:600px;width:100%;">
  <tr><td style="border-top:3px solid #2d5016;padding:40px 40px 0;">
    <p style="margin:0 0 28px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">analyst.rizrazak.com</p>
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:400;color:#111;">Submission Received</h1>
    <p style="margin:0 0 32px;font-size:13px;color:#888;font-family:monospace;">Ref: ${submissionId}</p>

    <p style="margin:0 0 16px;color:#333;line-height:1.7;">Dear ${escHtml(name)},</p>
    <p style="margin:0 0 16px;color:#333;line-height:1.7;">
      Your evidence submission for the <strong>${escHtml(dossierName)}</strong> dossier has been logged
      and will be reviewed by the editorial team.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;border-left:3px solid #2d5016;margin:24px 0;">
      <tr><td style="padding:18px 22px;">
        <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Evidence submitted</p>
        <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111;">${escHtml(evidenceTypeSummary({ type: evidence.type }))}</p>
        <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">${escHtml(desc)}${desc.length >= 300 ? '…' : ''}</p>
      </td></tr>
    </table>

    <h2 style="font-size:15px;font-weight:700;color:#111;margin:32px 0 12px;">What happens next</h2>
    <ol style="margin:0 0 24px;padding-left:22px;color:#444;line-height:1.8;">
      <li>The editorial team will review your submission, typically within 48 hours.</li>
      <li>All evidence is assessed against the site's <a href="${SITE_URL}/evidence-protocol" style="color:#2d5016;">Evidence Protocol</a> before integration.</li>
      <li>${canContact
        ? 'You have indicated that we may contact you for follow-up or verification. We may reach you at this address.'
        : 'You have indicated you do not wish to be contacted for follow-up. If this changes, please email the editorial team directly.'}</li>
    </ol>

    ${evidence.file ? `<p style="font-size:13px;color:#555;margin:0 0 24px;">
      📎 Attached file logged: <strong>${escHtml(evidence.file.name)}</strong>
      (${Math.round((evidence.file.sizeBytes || 0) / 1024)} KB)
    </p>` : ''}

    <p style="font-size:13px;color:#333;line-height:1.7;margin:0 0 16px;">
      Your identity and contact details are handled in accordance with the site's source protection
      obligations and are not shared with third parties.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8e8e0;margin-top:32px;">
      <tr><td style="padding:24px 0 40px;">
        <p style="margin:0 0 6px;font-size:12px;color:#888;">Keep this reference number for any follow-up:</p>
        <p style="margin:0 0 16px;font-size:13px;font-family:monospace;color:#2d5016;font-weight:700;">${submissionId}</p>
        <p style="margin:0;font-size:12px;color:#aaa;">This is an automated message from analyst.rizrazak.com. Do not reply directly to this email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function buildConfirmationText(name, submissionId, dossierId, evidence, permissions) {
  const dossierName = dossierLabel(dossierId);
  const desc = String(evidence.description || '').slice(0, 300);
  return `SUBMISSION RECEIVED — analyst.rizrazak.com
Reference: ${submissionId}

Dear ${name},

Your evidence submission for the "${dossierName}" dossier has been logged and will be reviewed by the editorial team.

EVIDENCE SUBMITTED
Type: ${evidenceTypeSummary(evidence)}
Description: ${desc}${desc.length >= 300 ? '...' : ''}
${evidence.file ? `Attached file: ${evidence.file.name} (${Math.round((evidence.file.sizeBytes || 0) / 1024)} KB)` : ''}

WHAT HAPPENS NEXT
1. The editorial team will review your submission, typically within 48 hours.
2. All evidence is assessed against the Evidence Protocol before integration.
3. ${permissions.contactForFollowUp
    ? 'You have permitted us to contact you for follow-up or verification.'
    : 'You have indicated you do not wish to be contacted for follow-up.'}

Your identity and contact details are handled per the site's source protection obligations.

Keep this reference: ${submissionId}

analyst.rizrazak.com — This is an automated message. Do not reply.`;
}

// ─── Admin notification ──────────────────────────────────────────────────────

function buildAdminNotificationHtml(submission) {
  const { id, dossierId, submittedAt, submitter, evidence, permissions } = submission;
  const dossierName = dossierLabel(dossierId);
  const dateStr = new Date(submittedAt).toUTCString();

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f8f5;font-family:monospace;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f5;">
<tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;max-width:600px;width:100%;border-top:3px solid #c0392b;">
  <tr><td style="padding:32px 40px;">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#c0392b;">analyst — New Evidence Submission</p>
    <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111;">${escHtml(dossierName)}</h1>
    <p style="margin:0 0 28px;font-size:12px;color:#888;font-family:monospace;">${id}</p>

    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin-bottom:24px;">
      <tr style="background:#f5f5f0;"><td style="padding:10px 12px;color:#888;width:140px;">Submitted</td><td style="padding:10px 12px;">${dateStr}</td></tr>
      <tr><td style="padding:10px 12px;color:#888;border-top:1px solid #eee;">Name</td><td style="padding:10px 12px;border-top:1px solid #eee;"><strong>${escHtml(submitter.name)}</strong></td></tr>
      <tr style="background:#f5f5f0;"><td style="padding:10px 12px;color:#888;">Email</td><td style="padding:10px 12px;"><a href="mailto:${escHtml(submitter.email)}" style="color:#2d5016;">${escHtml(submitter.email)}</a></td></tr>
      <tr><td style="padding:10px 12px;color:#888;border-top:1px solid #eee;">Relation</td><td style="padding:10px 12px;border-top:1px solid #eee;">${escHtml(submitter.relation || 'not specified')}</td></tr>
      <tr style="background:#f5f5f0;"><td style="padding:10px 12px;color:#888;">Evidence type</td><td style="padding:10px 12px;">${escHtml(evidence.type || 'general')}</td></tr>
      <tr><td style="padding:10px 12px;color:#888;border-top:1px solid #eee;">File attached</td><td style="padding:10px 12px;border-top:1px solid #eee;">${evidence.file
        ? `✅ ${escHtml(evidence.file.name)} — ${Math.round((evidence.file.sizeBytes || 0) / 1024)} KB (${escHtml(evidence.file.mimeType || '')})`
        : '—'}</td></tr>
      <tr style="background:#f5f5f0;"><td style="padding:10px 12px;color:#888;">Can contact</td><td style="padding:10px 12px;">${permissions.contactForFollowUp ? '✅ Yes' : '❌ No'}</td></tr>
      <tr><td style="padding:10px 12px;color:#888;border-top:1px solid #eee;">Attribution</td><td style="padding:10px 12px;border-top:1px solid #eee;">${permissions.attributeName ? '✅ Name may be attributed' : '🔒 Anonymous'}</td></tr>
    </table>

    <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin:0 0 8px;">Description</p>
    <div style="background:#f8f8f5;border:1px solid #e0e0d8;padding:16px;font-size:14px;color:#222;line-height:1.7;margin-bottom:20px;white-space:pre-wrap;">${escHtml(evidence.description || '')}</div>

    ${evidence.url ? `<p style="font-size:13px;margin:0 0 16px;"><strong>URL provided:</strong> <a href="${escHtml(evidence.url)}" style="color:#2d5016;">${escHtml(evidence.url)}</a></p>` : ''}
    ${evidence.howToIntegrate ? `<p style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin:16px 0 8px;">Integration notes</p><p style="font-size:13px;color:#333;line-height:1.7;margin:0 0 20px;">${escHtml(evidence.howToIntegrate)}</p>` : ''}

    <p style="font-size:11px;color:#aaa;margin:24px 0 0;border-top:1px solid #eee;padding-top:16px;">
      Submission ID: ${id}<br>
      Dossier: ${dossierId}<br>
      IP: ${escHtml(submission.submittedFromIp || 'unknown')}
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function buildAdminNotificationText(submission) {
  const { id, dossierId, submittedAt, submitter, evidence, permissions } = submission;
  return `[analyst] NEW SUBMISSION — ${dossierId}
${id}
Submitted: ${new Date(submittedAt).toUTCString()}

SUBMITTER
Name:     ${submitter.name}
Email:    ${submitter.email}
Relation: ${submitter.relation || 'not specified'}
Contact:  ${permissions.contactForFollowUp ? 'Yes' : 'No'}
Attribute:${permissions.attributeName ? 'Yes' : 'No (anonymous)'}

EVIDENCE
Type: ${evidence.type || 'general'}
File: ${evidence.file ? `${evidence.file.name} (${Math.round((evidence.file.sizeBytes || 0) / 1024)} KB)` : 'none'}
URL:  ${evidence.url || 'none'}

Description:
${evidence.description || ''}

${evidence.howToIntegrate ? `Integration notes:\n${evidence.howToIntegrate}\n` : ''}
IP: ${submission.submittedFromIp || 'unknown'}`;
}

// ─── Status update (accepted / rejected) ────────────────────────────────────

function buildStatusUpdateHtml(name, submissionId, dossierId, action, notes) {
  const dossierName = dossierLabel(dossierId);
  const isAccepted = action === 'accepted';
  const statusColor = isAccepted ? '#2d5016' : '#888';
  const statusLabel = isAccepted ? 'Accepted' : action === 'rejected' ? 'Not accepted' : 'Under review';

  const bodyText = isAccepted
    ? `Your submission has been accepted for integration into the <strong>${escHtml(dossierName)}</strong> dossier. The editorial team thanks you for your contribution.`
    : action === 'rejected'
    ? `After review, your submission was not incorporated into the <strong>${escHtml(dossierName)}</strong> dossier at this time. This may be due to evidential standards, duplication with existing material, or editorial scope — it is not a reflection on the importance of what you shared.`
    : `Your submission is currently under active review by the editorial team.`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f8f5;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f5;">
<tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;max-width:600px;width:100%;border-top:3px solid ${statusColor};">
  <tr><td style="padding:40px 40px 32px;">
    <p style="margin:0 0 28px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">analyst.rizrazak.com</p>
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:400;color:#111;">Submission Update</h1>
    <p style="margin:0 0 28px;font-size:13px;color:#888;font-family:monospace;">Ref: ${submissionId}</p>

    <p style="margin:0 0 16px;color:#333;line-height:1.7;">Dear ${escHtml(name)},</p>
    <p style="margin:0 0 24px;color:#333;line-height:1.7;">${bodyText}</p>

    <div style="background:#f5f5f0;border-left:3px solid ${statusColor};padding:14px 20px;margin:0 0 24px;">
      <span style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Status: </span>
      <strong style="color:${statusColor};">${statusLabel}</strong>
    </div>

    ${notes ? `<p style="font-size:14px;color:#444;line-height:1.7;font-style:italic;margin:0 0 24px;">"${escHtml(notes)}"</p>` : ''}

    <p style="font-size:13px;color:#555;line-height:1.7;margin:0;">
      Thank you for contributing to independent accountability journalism.
    </p>

    <p style="font-size:12px;color:#aaa;margin:32px 0 0;border-top:1px solid #eee;padding-top:16px;">
      Reference: ${submissionId} — analyst.rizrazak.com<br>
      This is an automated message. Do not reply directly to this email.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function buildStatusUpdateText(name, submissionId, dossierId, action, notes) {
  const dossierName = dossierLabel(dossierId);
  const statusLabel = action === 'accepted' ? 'ACCEPTED' : action === 'rejected' ? 'NOT ACCEPTED' : 'UNDER REVIEW';
  const bodyText = action === 'accepted'
    ? `Your submission has been accepted for integration into the "${dossierName}" dossier.`
    : action === 'rejected'
    ? `After review, your submission was not incorporated into the "${dossierName}" dossier at this time.`
    : `Your submission is currently under active review by the editorial team.`;

  return `SUBMISSION UPDATE — analyst.rizrazak.com
Reference: ${submissionId}
Status: ${statusLabel}

Dear ${name},

${bodyText}
${notes ? `\nReviewer notes: "${notes}"` : ''}

Thank you for contributing to independent accountability journalism.

analyst.rizrazak.com`;
}

// ─── Utility: HTML entity escaping ──────────────────────────────────────────

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Helper: CORS-enabled JSON response
 */
function corsResponse(body, status) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * Utility: Generate unique session ID
 */
function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ══════════════════════════════════════════════════════════════
// INFRASTRUCTURE MONITORING ENDPOINTS
// ══════════════════════════════════════════════════════════════

/**
 * GET /api/infra/health
 * Server-side health check of critical services.
 * Returns aggregated status for all monitored services.
 */
async function handleInfraHealth(request, env) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const checks = {};
  const start = Date.now();

  // 1. Cloudflare KV (SESSION_STORE)
  try {
    const testKey = '_infra_ping';
    await env.SESSION_STORE.put(testKey, 'ok', { expirationTtl: 60 });
    const val = await env.SESSION_STORE.get(testKey);
    checks.kv_session = { status: val === 'ok' ? 'healthy' : 'degraded', latencyMs: Date.now() - start };
  } catch (e) {
    checks.kv_session = { status: 'down', error: e.message };
  }

  // 2. Cloudflare KV (DRAFT_STORE)
  const kvDraftStart = Date.now();
  try {
    const testKey = '_infra_ping';
    await env.DRAFT_STORE.put(testKey, 'ok', { expirationTtl: 60 });
    const val = await env.DRAFT_STORE.get(testKey);
    checks.kv_draft = { status: val === 'ok' ? 'healthy' : 'degraded', latencyMs: Date.now() - kvDraftStart };
  } catch (e) {
    checks.kv_draft = { status: 'down', error: e.message };
  }

  // 3. Supabase API
  const supaStart = Date.now();
  try {
    const resp = await fetch('https://ogunznqyfmxkmmwizpfy.supabase.co/rest/v1/', {
      headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndW56bnF5Zm14a21td2l6cGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjE0ODAsImV4cCI6MjA4ODYzNzQ4MH0.ElpiHO9FtaxBZlGTWDN6Us2VyWL-uyR2plnjYZ_KwAM' },
    });
    checks.supabase = {
      status: (resp.status === 200 || resp.status === 401) ? 'healthy' : 'degraded',
      httpStatus: resp.status,
      latencyMs: Date.now() - supaStart,
    };
  } catch (e) {
    checks.supabase = { status: 'down', error: e.message, latencyMs: Date.now() - supaStart };
  }

  // 4. GitHub Pages (origin)
  const ghStart = Date.now();
  try {
    const resp = await fetch('https://riz-razak.github.io/analyst/data/dossiers.json', {
      headers: { 'User-Agent': 'analyst-infra-monitor/1.0' },
    });
    checks.github_pages = {
      status: resp.status === 200 ? 'healthy' : 'degraded',
      httpStatus: resp.status,
      latencyMs: Date.now() - ghStart,
    };
  } catch (e) {
    checks.github_pages = { status: 'down', error: e.message, latencyMs: Date.now() - ghStart };
  }

  // 5. Resend (email) — check if API key is configured
  const hasResendKey = !!env.RESEND_API_KEY;
  checks.resend = {
    status: hasResendKey ? 'healthy' : 'not-configured',
    configured: hasResendKey,
  };

  // 6. GitHub Token — check if configured
  const hasGithubToken = !!env.GITHUB_TOKEN;
  checks.github_token = {
    status: hasGithubToken ? 'healthy' : 'not-configured',
    configured: hasGithubToken,
  };

  // Compute overall status
  const statuses = Object.values(checks).map(c => c.status);
  const overall = statuses.includes('down') ? 'degraded'
    : statuses.includes('degraded') ? 'degraded'
    : 'healthy';

  return jsonResponse({
    overall,
    checks,
    checkedAt: new Date().toISOString(),
    totalLatencyMs: Date.now() - start,
  });
}

/**
 * POST /api/infra/proxy-check
 * Proxy health check for services that can't be reached from the browser (CORS).
 * Body: { url, expectedStatus?, timeout? }
 */
async function handleInfraProxyCheck(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { url: targetUrl, expectedStatus, timeout } = await request.json();

    if (!targetUrl) {
      return jsonResponse({ error: 'url is required' }, 400);
    }

    // Allowlist: only check known service domains
    const allowed = [
      'supabase.co', 'supabase.com',
      'resend.com',
      'api.mapbox.com',
      'api.open-meteo.com',
      'rizrazak.com', 'www.rizrazak.com',
      'analyst.rizrazak.com',
      'github.com', 'api.github.com',
    ];

    const parsed = new URL(targetUrl);
    const isAllowed = allowed.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
    if (!isAllowed) {
      return jsonResponse({ error: 'Domain not in allowlist' }, 403);
    }

    const controller = new AbortController();
    const tm = setTimeout(() => controller.abort(), timeout || 8000);
    const start = Date.now();

    try {
      const resp = await fetch(targetUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': 'analyst-infra-monitor/1.0' },
      });

      clearTimeout(tm);
      const latencyMs = Date.now() - start;
      const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus || 200];
      const status = expected.includes(resp.status) ? 'healthy' : 'degraded';

      return jsonResponse({ status, httpStatus: resp.status, latencyMs });
    } catch (e) {
      clearTimeout(tm);
      return jsonResponse({
        status: 'down',
        error: e.name === 'AbortError' ? 'Timeout' : e.message,
        latencyMs: Date.now() - start,
      });
    }
  } catch (e) {
    return jsonResponse({ error: e.message }, 400);
  }
}

/**
 * GET /api/github/file?path=[path]
 * Fetch a file from GitHub repository
 * Uses the server-side GITHUB_TOKEN secret only.
 */
async function handleGitHubFileGet(request, env) {
  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return jsonResponse({ error: 'path parameter required' }, 400);
  }

  if (!isAllowedGitHubCMSPath(filePath)) {
    return jsonResponse({ error: 'path is not allowed for CMS reads' }, 400);
  }

  const token = env.GITHUB_TOKEN;
  if (!token) {
    return jsonResponse({ error: 'GitHub token not configured' }, 503);
  }

  const repo = env.GITHUB_REPO || 'riz-razak/analyst';
  const branch = env.GITHUB_BRANCH || 'main';

  try {
    const githubUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
    const response = await fetch(githubUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'Analyst-CMS',
      },
    });

    if (response.status === 404) {
      return jsonResponse({ error: 'File not found' }, 404);
    }

    if (!response.ok) {
      console.error(`GitHub API error: ${response.status}`);
      return jsonResponse({ error: `GitHub API error: ${response.status}` }, response.status);
    }

    const content = await response.text();

    // Get file metadata (need to fetch again with application/vnd.github.v3+json)
    const metaResponse = await fetch(githubUrl.replace('?ref=' + branch, ''), {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Analyst-CMS',
      },
    });

    let sha = '';
    let lastCommit = '';
    if (metaResponse.ok) {
      const metaData = await metaResponse.json();
      sha = metaData.sha || '';

      // Get last commit info
      const commitsUrl = `https://api.github.com/repos/${repo}/commits?path=${filePath}&per_page=1`;
      const commitsResponse = await fetch(commitsUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'Analyst-CMS',
        },
      });
      if (commitsResponse.ok) {
        const commits = await commitsResponse.json();
        if (commits.length > 0) {
          lastCommit = commits[0].commit.author.date;
        }
      }
    }

    return jsonResponse({
      content,
      sha,
      name: filePath.split('/').pop(),
      path: filePath,
      lastCommit,
    });
  } catch (error) {
    console.error('GitHub file fetch error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * PUT /api/github/file
 * Commit changes to a file in GitHub repository
 * Body: { path, content (base64), sha, message }
 */
async function handleGitHubFilePut(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { path, content, sha, message } = body;

  if (!path || !content || !message) {
    return jsonResponse({ error: 'path, content, and message are required' }, 400);
  }

  if (!isAllowedGitHubCMSPath(path)) {
    return jsonResponse({ error: 'path is not allowed for CMS writes' }, 400);
  }

  const token = env.GITHUB_TOKEN;
  if (!token) {
    return jsonResponse({ error: 'GitHub token not configured' }, 503);
  }

  const repo = env.GITHUB_REPO || 'riz-razak/analyst';
  const branch = env.GITHUB_BRANCH || 'main';

  try {
    const githubUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

    // Verify content is base64 encoded
    let decodedContent;
    try {
      decodedContent = atob(content);
    } catch (e) {
      return jsonResponse({ error: 'content must be base64 encoded' }, 400);
    }

    const response = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Analyst-CMS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content,
        ...(sha ? { sha } : {}),
        branch,
        committer: {
          name: 'Analyst CMS',
          email: 'cms@analyst.rizrazak.com',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('GitHub API error:', errorData);
      return jsonResponse({
        error: errorData.message || `GitHub API error: ${response.status}`,
      }, response.status);
    }

    const result = await response.json();
    if (/^public\/[^/]+\/index\.html$/.test(path)) {
      const slug = path.split('/')[1];
      ctx?.waitUntil?.(capturePublishedDossier(env, {
        slug,
        html: decodedContent,
        commitSha: result.commit?.sha,
        trigger: 'github-file-put',
      }));
    }

    return jsonResponse({
      success: true,
      commit: {
        sha: result.commit.sha,
        url: result.commit.html_url,
      },
    });
  } catch (error) {
    console.error('GitHub file put error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

function isAllowedGitHubCMSPath(path) {
  if (typeof path !== 'string') return false;
  if (path.includes('..') || path.startsWith('/') || path.includes('\\')) return false;
  if (path === 'public/data/dossiers.json') return true;
  if (/^public\/[^/]+\/index\.html$/.test(path)) return true;
  if (/^public\/images\/(thumbnails|heroes)\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(path)) return true;
  return false;
}

/**
 * KANBAN API HANDLERS
 * Supabase REST API calls for DGTL OS Phase 1
 */

const KANBAN_SUPABASE_URL = 'https://ogunznqyfmxkmmwizpfy.supabase.co';
const KANBAN_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndW56bnF5Zm14a21td2l6cGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjE0ODAsImV4cCI6MjA4ODYzNzQ4MH0.ElpiHO9FtaxBZlGTWDN6Us2VyWL-uyR2plnjYZ_KwAM';

async function handleGetProjects(request, env) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = KANBAN_SUPABASE_URL;
    const supabaseKey = KANBAN_SUPABASE_KEY;

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/projects?select=*,boards(*)&order=created_at`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!resp.ok) {
      return jsonResponse({ error: 'Failed to fetch projects' }, resp.status);
    }

    const data = await resp.json();
    return jsonResponse(data);
  } catch (error) {
    console.error('Get projects error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleGetProject(request, env, slug) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = KANBAN_SUPABASE_URL;
    const supabaseKey = KANBAN_SUPABASE_KEY;

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/projects?slug=eq.${slug}&select=*,boards(id,name,slug,position,description,board_columns(*,tasks(*)))`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!resp.ok) {
      return jsonResponse({ error: 'Failed to fetch project' }, resp.status);
    }

    const data = await resp.json();
    if (data.length === 0) {
      return jsonResponse({ error: 'Project not found' }, 404);
    }

    return jsonResponse(data[0]);
  } catch (error) {
    console.error('Get project error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleGetBoard(request, env, boardId) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = KANBAN_SUPABASE_URL;
    const supabaseKey = KANBAN_SUPABASE_KEY;

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/boards?id=eq.${boardId}&select=*,board_columns(id,name,color,position,wip_limit,tasks(id,title,description,priority,assignee_id,due_date,labels,position)),project_id(*,workspace_id)`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!resp.ok) {
      return jsonResponse({ error: 'Failed to fetch board' }, resp.status);
    }

    const data = await resp.json();
    if (data.length === 0) {
      return jsonResponse({ error: 'Board not found' }, 404);
    }

    return jsonResponse(data[0]);
  } catch (error) {
    console.error('Get board error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleCreateTask(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();
    const { board_id, column_id, title, description, priority, due_date, labels } = body;

    if (!board_id || !title) {
      return jsonResponse({ error: 'board_id and title are required' }, 400);
    }

    const supabaseUrl = KANBAN_SUPABASE_URL;
    const supabaseKey = KANBAN_SUPABASE_KEY;

    // Get max position in column
    let position = 0;
    if (column_id) {
      const posResp = await fetch(
        `${supabaseUrl}/rest/v1/tasks?column_id=eq.${column_id}&select=position&order=position.desc&limit=1`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );
      if (posResp.ok) {
        const tasks = await posResp.json();
        position = tasks.length > 0 ? tasks[0].position + 1 : 0;
      }
    }

    const resp = await fetch(`${supabaseUrl}/rest/v1/tasks`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        board_id,
        column_id: column_id || null,
        title,
        description: description || null,
        priority: priority || 'medium',
        due_date: due_date || null,
        labels: labels || [],
        position,
      }),
    });

    if (!resp.ok) {
      const error = await resp.json();
      return jsonResponse({ error: error.message || 'Failed to create task' }, resp.status);
    }

    const data = await resp.json();
    return jsonResponse(data[0] || data, 201);
  } catch (error) {
    console.error('Create task error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleUpdateTask(request, env, taskId) {
  if (request.method !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();

    const supabaseUrl = KANBAN_SUPABASE_URL;
    const supabaseKey = KANBAN_SUPABASE_KEY;

    const resp = await fetch(`${supabaseUrl}/rest/v1/tasks?id=eq.${taskId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const error = await resp.json();
      return jsonResponse({ error: error.message || 'Failed to update task' }, resp.status);
    }

    const data = await resp.json();
    return jsonResponse(data[0] || data);
  } catch (error) {
    console.error('Update task error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleMoveTask(request, env, taskId) {
  if (request.method !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();
    const { column_id, position } = body;

    if (column_id === undefined || position === undefined) {
      return jsonResponse({ error: 'column_id and position are required' }, 400);
    }

    const supabaseUrl = KANBAN_SUPABASE_URL;
    const supabaseKey = KANBAN_SUPABASE_KEY;

    const resp = await fetch(`${supabaseUrl}/rest/v1/tasks?id=eq.${taskId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        column_id,
        position,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!resp.ok) {
      const error = await resp.json();
      return jsonResponse({ error: error.message || 'Failed to move task' }, resp.status);
    }

    const data = await resp.json();
    return jsonResponse(data[0] || data);
  } catch (error) {
    console.error('Move task error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleAddColumn(request, env, boardId) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name) {
      return jsonResponse({ error: 'name is required' }, 400);
    }

    const supabaseUrl = KANBAN_SUPABASE_URL;
    const supabaseKey = KANBAN_SUPABASE_KEY;

    // Get max position
    const posResp = await fetch(
      `${supabaseUrl}/rest/v1/board_columns?board_id=eq.${boardId}&select=position&order=position.desc&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );

    let position = 0;
    if (posResp.ok) {
      const columns = await posResp.json();
      position = columns.length > 0 ? columns[0].position + 1 : 0;
    }

    const resp = await fetch(`${supabaseUrl}/rest/v1/board_columns`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        board_id: boardId,
        name,
        color: color || '#e5e7eb',
        position,
      }),
    });

    if (!resp.ok) {
      const error = await resp.json();
      return jsonResponse({ error: error.message || 'Failed to create column' }, resp.status);
    }

    const data = await resp.json();
    return jsonResponse(data[0] || data, 201);
  } catch (error) {
    console.error('Add column error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * COMMENTS: LIST
 * GET /api/comments/list?dossier=X
 * Fetch approved comments for a dossier
 */
async function handleCommentsList(request, env) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const dossierId = url.searchParams.get('dossier');

  if (!dossierId) {
    return jsonResponse({ error: 'Missing dossier parameter' }, 400);
  }

  const SUPABASE_URL = 'https://ogunznqyfmxkmmwizpfy.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndW56bnF5Zm14a21td2l6cGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjE0ODAsImV4cCI6MjA4ODYzNzQ4MH0.ElpiHO9FtaxBZlGTWDN6Us2VyWL-uyR2plnjYZ_KwAM';

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/comments?dossier_id=eq.${encodeURIComponent(dossierId)}&approved=eq.true&select=*&order=created_at.desc`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!resp.ok) {
      return jsonResponse({ error: `Supabase error: ${resp.status}` }, resp.status);
    }

    const comments = await resp.json();
    return jsonResponse({ success: true, comments });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

/**
 * SPAM FILTER: Configuration & Functions
 * Compact production-quality filter for comment moderation
 * No external dependencies — synchronous content, identity, and abuse checks only
 */

const SPAM_THRESHOLDS = {
  AUTO_APPROVE: 15,    // Score < 15: auto-approve
  AUTO_REJECT: 60,     // Score >= 60: auto-reject
};

const SPAM_KEYWORDS = [
  'viagra', 'cialis', 'casino', 'poker', 'betting', 'forex', 'bitcoin',
  'cryptocurrency', 'crypto', 'nft', 'defi', 'loan', 'mortgage', 'payday',
  'weight loss', 'diet pills', 'cbd', 'make money fast', 'work from home',
  'get rich quick', 'mlm', 'click here', 'act now', 'limited time',
];

const THREAT_KEYWORDS = [
  'kill', 'death', 'rape', 'bomb', 'gun', 'shoot', 'stab', 'harm',
  'destroy', 'attack', 'violence', 'terrorist',
];

const PROFANITY_WORDS = [
  'shit', 'fuck', 'fucking', 'motherfucker', 'asshole', 'bastard',
  'bitch', 'cunt', 'damn', 'hell', 'cock', 'dick', 'pussy', 'whore',
];

const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com', '10minutemail.com', 'throwaway.email', 'mailinator.com',
  'temp-mail.org', 'guerrillamail.com', 'maildrop.cc', 'yopmail.com',
  'fakeinbox.com', 'trashmail.com', 'minute-mail.com', 'mail.tm',
];

const SPAM_DOMAINS = [
  'bitly.com', 'tinyurl.com', 'bit.ly', 'ow.ly', 'goo.gl',
  'casino-online.bet', 'poker-site.cc', 'pharma-cheap.net',
];

/**
 * Extract URLs from text
 */
function extractURLs(text) {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  return (text.match(urlRegex) || []).map(url => url.toLowerCase());
}

/**
 * Check if text contains URLs
 */
function containsURLs(text) {
  return /(https?:\/\/|www\.)/i.test(text);
}

/**
 * Validate author identity
 */
function validateIdentity(authorName, authorEmail) {
  const signals = [];
  let score = 0;

  if (!authorName || authorName.length < 2) {
    signals.push({ type: 'invalid_name_too_short', score: 15 });
    score += 15;
  } else if (authorName.length > 100) {
    signals.push({ type: 'invalid_name_too_long', score: 15 });
    score += 15;
  }

  if (containsURLs(authorName)) {
    signals.push({ type: 'url_in_name', score: 25 });
    score += 25;
  }

  if (/^\d+$/.test(authorName.replace(/\s/g, ''))) {
    signals.push({ type: 'all_numbers_name', score: 20 });
    score += 20;
  }

  // Check email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(authorEmail)) {
    signals.push({ type: 'invalid_email_format', score: 20 });
    score += 20;
  } else {
    const emailDomain = authorEmail.split('@')[1]?.toLowerCase();
    if (DISPOSABLE_EMAIL_DOMAINS.includes(emailDomain)) {
      signals.push({ type: 'disposable_email', score: 25 });
      score += 25;
    }
  }

  return { signals, score };
}

/**
 * Analyze comment content for spam indicators
 */
function analyzeContent(commentText) {
  const signals = [];
  let score = 0;

  if (!commentText || commentText.length < 5) {
    signals.push({ type: 'empty_or_very_short', score: 15 });
    score += 15;
    return { signals, score };
  }

  // URL/link spam detection
  const urls = extractURLs(commentText);
  const uniqueUrls = [...new Set(urls)];

  if (uniqueUrls.length > 2) {
    const extraUrls = uniqueUrls.length - 2;
    const urlScore = extraUrls * 15;
    signals.push({ type: 'excessive_urls', details: { count: uniqueUrls.length }, score: urlScore });
    score += urlScore;
  }

  // Check for known spam domains
  const spamDomainMatches = uniqueUrls.filter(url => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : 'http://' + url);
      return SPAM_DOMAINS.some(spamDomain => urlObj.hostname.includes(spamDomain));
    } catch {
      return false;
    }
  });

  if (spamDomainMatches.length > 0) {
    signals.push({ type: 'spam_domain_detected', score: 35 });
    score += 35;
  }

  // Short comment with URLs
  if (uniqueUrls.length > 0 && commentText.length < 20) {
    signals.push({ type: 'short_comment_with_url', score: 20 });
    score += 20;
  }

  // Keyword-based spam detection
  const lowerText = commentText.toLowerCase();
  const foundSpamKeywords = SPAM_KEYWORDS.filter(keyword => lowerText.includes(keyword));

  if (foundSpamKeywords.length > 0) {
    const keywordScore = foundSpamKeywords.length > 1 ? 25 : 15;
    signals.push({ type: 'spam_keywords_detected', details: { keywords: foundSpamKeywords }, score: keywordScore });
    score += keywordScore;
  }

  // Repetitive character patterns
  const repetitiveMatch = commentText.match(/(.)\1{3,}/g);
  if (repetitiveMatch) {
    signals.push({ type: 'repetitive_characters', score: 15 });
    score += 15;
  }

  // ALL CAPS detection
  const alphaChars = commentText.match(/[a-zA-Z]/g) || [];
  const capsChars = commentText.match(/[A-Z]/g) || [];
  if (alphaChars.length > 10) {
    const capsRatio = capsChars.length / alphaChars.length;
    if (capsRatio > 0.7) {
      signals.push({ type: 'excessive_caps', score: 10 });
      score += 10;
    }
  }

  return { signals, score };
}

/**
 * Detect profanity, threats, and harassment
 */
function detectAbuse(commentText, authorName) {
  const signals = [];
  let score = 0;
  const lowerText = commentText.toLowerCase();

  // Profanity check
  const foundProfanity = PROFANITY_WORDS.filter(word =>
    new RegExp(`\\b${word}\\b`, 'i').test(lowerText)
  );

  if (foundProfanity.length > 0) {
    signals.push({ type: 'profanity_detected', score: 30 });
    score += 30;
  }

  // Threat/violence detection
  const foundThreats = THREAT_KEYWORDS.filter(keyword => lowerText.includes(keyword));

  if (foundThreats.length > 0) {
    signals.push({ type: 'threat_detected', score: 40 });
    score += 40;
  }

  // Harassment patterns
  const harassmentPatterns = [
    /you (are )?( a |an )?(idiot|moron|dumb|stupid|retard)/i,
    /you should (die|kill yourself|kys)/i,
  ];

  const hasHarassment = harassmentPatterns.some(pattern => pattern.test(commentText));
  if (hasHarassment) {
    signals.push({ type: 'harassment_detected', score: 35 });
    score += 35;
  }

  return { signals, score };
}

/**
 * Comprehensive spam analysis
 * @returns {Object} { score, signals, verdict }
 */
function analyzeComment(authorName, authorEmail, commentText) {
  const signals = [];
  let score = 0;

  // 1. Identity validation
  const identityChecks = validateIdentity(authorName, authorEmail);
  signals.push(...identityChecks.signals);
  score += identityChecks.score;

  // 2. Content analysis
  const contentChecks = analyzeContent(commentText);
  signals.push(...contentChecks.signals);
  score += contentChecks.score;

  // 3. Abuse detection
  const abuseChecks = detectAbuse(commentText, authorName);
  signals.push(...abuseChecks.signals);
  score += abuseChecks.score;

  // Cap score at 100
  score = Math.min(score, 100);

  // Determine verdict
  let verdict = 'moderate';
  if (score < SPAM_THRESHOLDS.AUTO_APPROVE) {
    verdict = 'approve';
  } else if (score >= SPAM_THRESHOLDS.AUTO_REJECT) {
    verdict = 'reject';
  }

  return { score, signals, verdict };
}

/**
 * COMMENTS: CREATE
 * POST /api/comments/create
 * Create a new comment
 */
async function handleCommentCreate(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { dossierId, parentId, authorName, authorEmail, commentText, level } = body;

  if (!dossierId || !authorName || !authorEmail || !commentText) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  const SUPABASE_URL = 'https://ogunznqyfmxkmmwizpfy.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndW56bnF5Zm14a21td2l6cGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjE0ODAsImV4cCI6MjA4ODYzNzQ4MH0.ElpiHO9FtaxBZlGTWDN6Us2VyWL-uyR2plnjYZ_KwAM';

  try {
    let commentUserId;

    // Get or create comment_user
    const userLookup = await fetch(
      `${SUPABASE_URL}/rest/v1/comment_users?email=eq.${encodeURIComponent(authorEmail)}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (userLookup.ok) {
      const users = await userLookup.json();
      if (users.length > 0) {
        commentUserId = users[0].id;
      } else {
        const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const createUserResp = await fetch(`${SUPABASE_URL}/rest/v1/comment_users`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            email: authorEmail,
            display_name: authorName,
            avatar_initials: initials,
            role: 'user',
          }),
        });

        if (createUserResp.ok) {
          const newUser = await createUserResp.json();
          commentUserId = newUser[0].id;
        }
      }
    }

    // ── RUN SPAM FILTER ──
    const spamAnalysis = analyzeComment(authorName, authorEmail, commentText);

    let createCommentData = {
      dossier_id: dossierId,
      parent_id: parentId || null,
      author_email: authorEmail,
      author_name: authorName,
      body: commentText,
      comment_user_id: commentUserId,
      level: level || 1,
      approved: false,
      flagged: false,
    };

    // Auto-reject if verdict is 'reject'
    if (spamAnalysis.verdict === 'reject') {
      return jsonResponse({
        error: 'Comment rejected',
        reason: 'spam',
        score: spamAnalysis.score,
      }, 403);
    }

    // Set approval status based on spam verdict
    if (spamAnalysis.verdict === 'approve') {
      createCommentData.approved = true;
    } else if (spamAnalysis.verdict === 'moderate') {
      createCommentData.approved = false;
    }

    // Store spam analysis in moderation_note as JSON
    createCommentData.moderation_note = JSON.stringify({
      spam_score: spamAnalysis.score,
      spam_signals: spamAnalysis.signals,
      spam_verdict: spamAnalysis.verdict,
      analyzed_at: new Date().toISOString(),
    });

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(createCommentData),
    });

    if (!resp.ok) {
      const error = await resp.text();
      return jsonResponse({ error: `Failed to create comment: ${error}` }, resp.status);
    }

    const created = await resp.json();
    return jsonResponse({ success: true, comment: created[0] }, 201);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

/**
 * COMMENTS: MODERATE
 * POST /api/comments/moderate
 * Approve/reject/flag comments (admin only)
 */
async function handleCommentModerate(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { commentId, action, reason } = body;

  if (!commentId || !action) {
    return jsonResponse({ error: 'Missing commentId or action' }, 400);
  }

  const SUPABASE_URL = 'https://ogunznqyfmxkmmwizpfy.supabase.co';
  const SUPABASE_KEY = getSupabaseServerKey(env);
  if (!SUPABASE_KEY) {
    return jsonResponse({ error: 'Supabase service key not configured' }, 503);
  }

  try {
    let updateData = {};
    let method = 'PATCH';

    if (action === 'approved') {
      updateData = { approved: true, flagged: false };
    } else if (action === 'rejected') {
      updateData = { approved: false, flagged: false };
    } else if (action === 'flagged') {
      updateData = { flagged: true, flagged_reason: reason };
    } else if (action === 'deleted') {
      method = 'DELETE';
    } else {
      return jsonResponse({ error: 'Invalid action' }, 400);
    }

    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/comments?id=eq.${encodeURIComponent(commentId)}`,
      {
        method,
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        ...(method === 'DELETE' ? {} : { body: JSON.stringify(updateData) }),
      }
    );

    if (!resp.ok) {
      return jsonResponse({ error: `Moderation failed: ${resp.status}` }, resp.status);
    }

    const updated = method === 'DELETE' ? [] : await resp.json();
    return jsonResponse({ success: true, comment: updated[0] || null });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

/**
 * COMMENTS: PENDING
 * GET /api/comments/pending
 * List pending comments (admin only)
 */
async function handleCommentsPending(request, env) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = 'https://ogunznqyfmxkmmwizpfy.supabase.co';
  const SUPABASE_KEY = getSupabaseServerKey(env);
  if (!SUPABASE_KEY) {
    return jsonResponse({ error: 'Supabase service key not configured' }, 503);
  }

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/comments?select=*&order=created_at.desc`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!resp.ok) {
      return jsonResponse({ error: `Supabase error: ${resp.status}` }, resp.status);
    }

    const comments = await resp.json();
    return jsonResponse({ success: true, comments });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

function getSupabaseServerKey(env) {
  return env.SUPABASE_SERVICE_KEY || '';
}

/**
 * IP ANONYMISATION
 * Calls Supabase RPC function to hash IPs older than 180 days
 */
const ANON_SUPABASE_URL = 'https://ogunznqyfmxkmmwizpfy.supabase.co';
const ANON_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndW56bnF5Zm14a21td2l6cGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjE0ODAsImV4cCI6MjA4ODYzNzQ4MH0.ElpiHO9FtaxBZlGTWDN6Us2VyWL-uyR2plnjYZ_KwAM';

async function runIPAnonymisation(env) {
  const resp = await fetch(`${ANON_SUPABASE_URL}/rest/v1/rpc/anonymise_old_ips`, {
    method: 'POST',
    headers: {
      'apikey': ANON_SUPABASE_KEY,
      'Authorization': `Bearer ${ANON_SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Supabase RPC error ${resp.status}: ${err}`);
  }

  const affected = await resp.json();
  return { affected: affected || 0 };
}

async function handleAnonymiseIPs(request, env) {
  // Only allow POST, and require a simple auth header to prevent abuse
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = request.headers.get('X-Cron-Key') || '';
  if (authHeader !== 'analyst-cron-2026' && !request.headers.get('CF-Worker')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const result = await runIPAnonymisation(env);
    return jsonResponse({
      success: true,
      message: `Anonymised ${result.affected} IP addresses older than 180 days`,
      affected: result.affected,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

// ════════════════════════════════════════════════════════════════
// THUMBNAIL GENERATION & UPLOAD
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/thumbnail/generate
 * Generates a thumbnail prompt and saves it to KV.
 * When GEMINI_API_KEY is available, will call Gemini Imagen directly.
 *
 * Body: { dossierId, prompt, negativePrompt, style, aspectRatio, category, title }
 * Returns: { promptSaved: true, prompt } or { imageUrl } when AI generation is active
 */
async function handleThumbnailGenerate(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json();
    const { dossierId, prompt, negativePrompt, style, aspectRatio, category, title } = body;
    if (!dossierId || !prompt) return jsonResponse({ error: 'dossierId and prompt required' }, 400);

    // Save prompt metadata to KV for reference
    const thumbMeta = {
      dossierId,
      prompt,
      negativePrompt: negativePrompt || '',
      style: style || 'investigative',
      aspectRatio: aspectRatio || '16:9',
      category: category || '',
      title: title || '',
      createdAt: new Date().toISOString(),
      status: 'prompt_ready'
    };

    await env.SESSION_STORE.put(
      `thumb:${dossierId}`,
      JSON.stringify(thumbMeta),
      { expirationTtl: 86400 * 90 } // 90 days
    );

    // ── Future: Gemini Imagen API integration ──
    // When GEMINI_API_KEY is set as a Worker secret, this section will
    // call the API and return { imageUrl: "..." } directly.
    //
    // To enable:
    //   wrangler secret put GEMINI_API_KEY --env production
    //
    // The endpoint will then:
    //   1. Call Gemini Imagen with the prompt
    //   2. Upload the result to GitHub at /images/thumbnails/{dossierId}.jpg
    //   3. Return { imageUrl: "/images/thumbnails/{dossierId}.jpg" }
    //
    if (env.GEMINI_API_KEY) {
      try {
        const imageUrl = await generateWithGemini(env, dossierId, prompt, negativePrompt, aspectRatio);
        if (imageUrl) {
          thumbMeta.status = 'generated';
          thumbMeta.imageUrl = imageUrl;
          await env.SESSION_STORE.put(`thumb:${dossierId}`, JSON.stringify(thumbMeta), { expirationTtl: 86400 * 90 });
          return jsonResponse({ imageUrl, prompt, style, aspectRatio });
        }
      } catch (genErr) {
        console.error('[Thumbnail] Gemini generation failed:', genErr);
        // Fall through to prompt-only response
      }
    }

    return jsonResponse({
      promptSaved: true,
      prompt,
      style,
      aspectRatio,
      message: 'Prompt saved. AI generation requires GEMINI_API_KEY secret. Use "Copy Prompt" to generate externally.'
    });

  } catch (err) {
    console.error('[Thumbnail] Generate error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}

/**
 * Generate thumbnail using Google Gemini Imagen API.
 * Uploads result to GitHub and returns the path.
 */
async function generateWithGemini(env, dossierId, prompt, negativePrompt, aspectRatio) {
  // Gemini Imagen API endpoint
  const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';

  const ratioMap = { '16:9': '16:9', '1:1': '1:1', '9:16': '9:16' };
  const imageParams = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: ratioMap[aspectRatio] || '16:9',
      ...(negativePrompt ? { negativePrompt } : {})
    }
  };

  const resp = await fetch(`${apiUrl}?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(imageParams)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error: ${resp.status} — ${errText}`);
  }

  const data = await resp.json();
  const imageBase64 = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!imageBase64) throw new Error('No image in Gemini response');

  // Upload to GitHub
  const githubPath = `public/images/thumbnails/${dossierId}.jpg`;
  const uploaded = await uploadToGitHub(env, githubPath, imageBase64, `Add AI-generated thumbnail for ${dossierId}`);
  if (!uploaded) throw new Error('GitHub upload failed');

  return `/images/thumbnails/${dossierId}.jpg`;
}

/**
 * POST /api/thumbnail/upload
 * Manually upload a thumbnail image to GitHub repository.
 *
 * Body: { dossierId, imageBase64, filename }
 * Returns: { success: true, url }
 */
async function handleThumbnailUpload(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json();
    const { dossierId, imageBase64, filename } = body;
    if (!dossierId || !imageBase64) return jsonResponse({ error: 'dossierId and imageBase64 required' }, 400);

    const fname = filename || `${dossierId}.jpg`;
    const githubPath = `public/images/thumbnails/${fname}`;

    const uploaded = await uploadToGitHub(env, githubPath, imageBase64, `Upload thumbnail for ${dossierId}`);
    if (!uploaded) return jsonResponse({ error: 'GitHub upload failed. Check GITHUB_TOKEN secret.' }, 500);

    const url = `/images/thumbnails/${fname}`;

    // Update thumbnail metadata in KV
    const existingMeta = await env.SESSION_STORE.get(`thumb:${dossierId}`, 'json') || {};
    existingMeta.imageUrl = url;
    existingMeta.status = 'uploaded';
    existingMeta.uploadedAt = new Date().toISOString();
    await env.SESSION_STORE.put(`thumb:${dossierId}`, JSON.stringify(existingMeta), { expirationTtl: 86400 * 90 });

    return jsonResponse({ success: true, url });

  } catch (err) {
    console.error('[Thumbnail] Upload error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
}

/**
 * Upload a base64-encoded file to GitHub via the Contents API.
 * Uses GITHUB_TOKEN from Worker secrets.
 */
async function uploadToGitHub(env, path, base64Content, commitMessage) {
  if (!env.GITHUB_TOKEN) {
    console.error('[GitHub] GITHUB_TOKEN not configured');
    return false;
  }

  const repo = env.GITHUB_REPO || 'riz-razak/analyst';
  const branch = env.GITHUB_BRANCH || 'main';
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

  try {
    // Check if file already exists (need SHA to update)
    let sha = null;
    const checkResp = await fetch(`${apiUrl}?ref=${branch}`, {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'User-Agent': 'analyst-cms-worker',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (checkResp.ok) {
      const existing = await checkResp.json();
      sha = existing.sha;
    }

    // Create or update file
    const body = {
      message: commitMessage,
      content: base64Content,
      branch,
      ...(sha ? { sha } : {})
    };

    const resp = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'User-Agent': 'analyst-cms-worker',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[GitHub] Upload failed: ${resp.status} — ${errText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[GitHub] Upload error:', err);
    return false;
  }
}


/**
 * Utility: return a JSON response with CORS headers.
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}
