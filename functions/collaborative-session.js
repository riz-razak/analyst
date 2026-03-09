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
      } else if (path === '/api/translate') {
        return handleTranslate(request, env);
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

  // Target file: public/dossiers/{dossierId}/index.html
  const filePath = `public/dossiers/${dossierId}/index.html`;
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

// ═══════════════════════════════════════════════════════════════════════════
// AI TRANSLATION — Sinhala paragraph translation via Claude API
// Requires ANTHROPIC_API_KEY Cloudflare secret:
//   wrangler secret put ANTHROPIC_API_KEY --env production
// ═══════════════════════════════════════════════════════════════════════════

/**
 * TRANSLATE PARAGRAPHS TO SINHALA
 * POST /api/translate
 * Body: { dossierId, paragraphs: [{ id: "si-N", enText: "..." }] }
 * Returns: { translations: [{ id: "si-N", siText: "..." }] }
 *
 * Requires admin auth: Authorization: Bearer <supabase-jwt>
 * Rate: processes up to 30 paragraphs per call (Claude handles batching via prompt)
 */
async function handleTranslate(request, env) {
  if (request.method !== 'POST') {
    return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405);
  }

  // Auth guard — require Bearer token (same Supabase JWT the admin panel uses)
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ') || authHeader.length < 20) {
    return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  }

  if (!env.ANTHROPIC_API_KEY) {
    console.error('[translate] ANTHROPIC_API_KEY not configured');
    return corsResponse(
      JSON.stringify({ error: 'Translation service not configured' }),
      503
    );
  }

  const body = await request.json();
  const { dossierId, paragraphs } = body;

  if (!dossierId || !Array.isArray(paragraphs) || paragraphs.length === 0) {
    return corsResponse(
      JSON.stringify({ error: 'Missing dossierId or paragraphs array' }),
      400
    );
  }

  // Build the translation prompt
  const paragraphList = paragraphs
    .map(p => `[${p.id}]\n${p.enText.trim()}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are a precise literary translator from English to Sinhala (සිංහල).
You are translating philosophical and journalistic prose for a bilingual dossier platform.

Rules:
- Translate faithfully and elegantly. Preserve the register and tone of each paragraph.
- Use modern, literary Sinhala script (Unicode). Do not transliterate.
- Preserve proper nouns in English (e.g. "Bamiyan", "Buddha", "anatta", "Taliban").
- Buddhist technical terms: use standard Pali/Sinhala equivalents where established (e.g. "anatta" → "අනාත්ම", "dukkha" → "දුක්ඛ").
- Return ONLY a JSON object. No prose. No explanation. No markdown.
- The JSON must have exactly one key: "translations", an array of objects with "id" and "siText".`;

  const userPrompt = `Translate each paragraph below to Sinhala.
Return as JSON: {"translations":[{"id":"si-N","siText":"..."},...]}.

${paragraphList}`;

  // Call Claude API
  let claudeData;
  try {
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      console.error('[translate] Claude API error:', claudeResp.status, errText);
      return corsResponse(
        JSON.stringify({ error: `Translation API error (${claudeResp.status})` }),
        502
      );
    }

    claudeData = await claudeResp.json();
  } catch (err) {
    console.error('[translate] Fetch failed:', err.message);
    return corsResponse(
      JSON.stringify({ error: 'Translation service unreachable' }),
      502
    );
  }

  // Extract JSON from Claude's response
  const rawContent = claudeData?.content?.[0]?.text || '';
  let translations;
  try {
    // Claude should return pure JSON; strip any accidental markdown fences
    const cleaned = rawContent.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    translations = parsed.translations;
    if (!Array.isArray(translations)) throw new Error('translations is not an array');
  } catch (err) {
    console.error('[translate] Failed to parse Claude response:', err.message, rawContent.slice(0, 300));
    return corsResponse(
      JSON.stringify({ error: 'Translation response could not be parsed', raw: rawContent.slice(0, 500) }),
      500
    );
  }

  console.log(`[translate] ${dossierId}: translated ${translations.length}/${paragraphs.length} paragraphs`);
  return corsResponse(JSON.stringify({ success: true, translations }), 200);
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
  const dossierUrl = `${SITE_URL}/dossiers/${dossierId}/`;
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
