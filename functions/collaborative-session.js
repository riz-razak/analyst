/**
 * Collaborative Editing Session Manager
 * Handles locks, autosave, handoff, and user awareness
 * Uses Cloudflare KV + GitHub as persistent storage
 */

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
      // ── Dossier visibility gate (Worker Route on analyst.rizrazak.com/*) ──
      // Dossiers live at root: /womens-day-betrayal/, /caravan-fresh/, etc.
      // This checks the KV visibility map for hidden dossiers.
      // For any non-API request on the main site, check and pass through.
      const host = url.hostname;
      if (host !== 'analyst-collaborative-cms.riz-1cb.workers.dev' && !path.startsWith('/api/')) {
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
        return fetch(request);
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
        return handleReviewSubmission(request, env, ctx);
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
      }

      // ── GitHub CMS endpoints ──
      else if (path === '/api/github/file') {
        if (request.method === 'GET') {
          return handleGitHubFileGet(request, env);
        } else if (request.method === 'PUT') {
          return handleGitHubFilePut(request, env);
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

      // ── Infrastructure monitoring endpoints ──
      else if (path === '/api/infra/health') {
        return handleInfraHealth(request, env);
      } else if (path === '/api/infra/proxy-check') {
        return handleInfraProxyCheck(request, env);
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
    console.warn('[otp] RESEND_API_KEY not set — OTP code:', code);
    // Dev fallback: still return success so UI works even without email
    return corsResponse(JSON.stringify({ success: true, dev: true }), 200);
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
async function handleReviewSubmission(request, env, ctx) {
  if (request.method !== 'POST') {
    return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405);
  }

  const { dossierId, submissionId, action, reviewNotes, reviewerEmail } = await request.json();

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
    reviewerEmail: reviewerEmail || 'admin',
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
 * Uses env.GITHUB_TOKEN or X-GitHub-Token header
 */
async function handleGitHubFileGet(request, env) {
  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return jsonResponse({ error: 'path parameter required' }, 400);
  }

  // Get GitHub token from env or request header
  const token = env.GITHUB_TOKEN || request.headers.get('X-GitHub-Token');
  if (!token) {
    return jsonResponse({ error: 'GitHub token not configured' }, 401);
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
async function handleGitHubFilePut(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { path, content, sha, message } = body;

  if (!path || !content || !sha || !message) {
    return jsonResponse({ error: 'path, content, sha, and message are required' }, 400);
  }

  // Get GitHub token from env or request header
  const token = env.GITHUB_TOKEN || request.headers.get('X-GitHub-Token');
  if (!token) {
    return jsonResponse({ error: 'GitHub token not configured' }, 401);
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
        sha,
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

/**
 * KANBAN API HANDLERS
 * Supabase REST API calls for DGTL OS Phase 1
 */

async function handleGetProjects(request, env) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

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
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

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
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

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

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

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

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

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

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

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

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

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

    const createCommentData = {
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

  const { commentId, action, reason, adminToken } = body;

  if (!commentId || !action) {
    return jsonResponse({ error: 'Missing commentId or action' }, 400);
  }

  const ADMIN_TOKEN = 'admin-token-placeholder';
  if (adminToken !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const SUPABASE_URL = 'https://ogunznqyfmxkmmwizpfy.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndW56bnF5Zm14a21td2l6cGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjE0ODAsImV4cCI6MjA4ODYzNzQ4MH0.ElpiHO9FtaxBZlGTWDN6Us2VyWL-uyR2plnjYZ_KwAM';

  try {
    let updateData = {};

    if (action === 'approved') {
      updateData = { approved: true, flagged: false };
    } else if (action === 'rejected') {
      updateData = { approved: false, flagged: false };
    } else if (action === 'flagged') {
      updateData = { flagged: true, flagged_reason: reason };
    }

    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/comments?id=eq.${encodeURIComponent(commentId)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(updateData),
      }
    );

    if (!resp.ok) {
      return jsonResponse({ error: `Moderation failed: ${resp.status}` }, resp.status);
    }

    const updated = await resp.json();
    return jsonResponse({ success: true, comment: updated[0] });
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

  const url = new URL(request.url);
  const adminToken = url.searchParams.get('adminToken');

  const ADMIN_TOKEN = 'admin-token-placeholder';
  if (adminToken !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const SUPABASE_URL = 'https://ogunznqyfmxkmmwizpfy.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndW56bnF5Zm14a21td2l6cGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjE0ODAsImV4cCI6MjA4ODYzNzQ4MH0.ElpiHO9FtaxBZlGTWDN6Us2VyWL-uyR2plnjYZ_KwAM';

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/pending_comments?select=*&order=created_at.asc`,
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
