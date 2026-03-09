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

  // TODO: Commit to GitHub (requires GitHub API token)
  // This will be handled by GitHub Actions workflow

  // For now, mark as published in KV
  const publishedKey = `published:${dossierId}`;
  const published = {
    ...draft,
    publishedAt: Date.now(),
    message: message || `Publish by ${lock.userEmail}`,
  };

  await env.DRAFT_STORE.put(publishedKey, JSON.stringify(published), {
    expirationTtl: 30 * 24 * 60 * 60, // 30 days
  });

  // Clear draft
  await env.DRAFT_STORE.delete(draftKey);

  // Release lock after publish
  await env.SESSION_STORE.delete(lockKey);

  return new Response(JSON.stringify({ success: true, published }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Utility: Generate unique session ID
 */
function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
