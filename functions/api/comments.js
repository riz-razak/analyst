/**
 * Public Comments API — /api/comments
 *
 * GET  /api/comments?dossier_id=sri-lanka-cricket-corruption
 *      → returns approved comments (public, no auth required)
 *
 * POST /api/comments
 *      → submits a new comment as 'pending' (anonymous, rate-limited)
 *
 * Environment variables (Cloudflare Pages):
 *   SUPABASE_URL          — e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY  — service_role key (full access, server-side only)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── GET: Read approved comments ────────────────────────────────────────────
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const dossierId = url.searchParams.get('dossier_id');

  if (!dossierId) {
    return jsonResponse(400, { error: 'dossier_id parameter required' });
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return jsonResponse(503, { error: 'Comments backend not configured' });
  }

  try {
    // Fetch approved comments + their replies
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/dossier_comments?` +
      `dossier_id=eq.${encodeURIComponent(dossierId)}` +
      `&status=eq.approved` +
      `&order=created_at.desc` +
      `&limit=100`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('[comments] Supabase read error:', errText);
      return jsonResponse(502, { error: 'Database read failed' });
    }

    const comments = await res.json();

    // Also fetch count of pending comments (so the FAB can show "X awaiting moderation")
    const countRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/dossier_comments?` +
      `dossier_id=eq.${encodeURIComponent(dossierId)}` +
      `&status=eq.pending` +
      `&select=id`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'count=exact',
        },
      }
    );

    const pendingCount = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0', 10);

    return jsonResponse(200, {
      comments,
      pending_count: pendingCount,
      total_approved: comments.length,
    });

  } catch (e) {
    console.error('[comments] Fetch error:', e.message);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ─── POST: Submit a new comment ─────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return jsonResponse(503, { error: 'Comments backend not configured' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  // Validate required fields
  const { id, dossier_id, text, parent_id, geo } = body;

  if (!id || !dossier_id || !text) {
    return jsonResponse(400, { error: 'id, dossier_id, and text are required' });
  }

  if (typeof text !== 'string' || text.length < 10 || text.length > 2000) {
    return jsonResponse(400, { error: 'Comment must be 10-2000 characters' });
  }

  // Honeypot check
  if (body.hp_name) {
    // Silently accept but don't store — bot detected
    return jsonResponse(200, { ok: true, id });
  }

  // Rate limit: 3 comments per 15 minutes per IP
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `comment_rl:${clientIP}`;

  // Hash the IP (never store raw)
  const ipHash = await hashIP(clientIP);

  // Get UA
  const ua = (request.headers.get('User-Agent') || '').slice(0, 120);

  // Insert into Supabase
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/dossier_comments`,
      {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          id,
          dossier_id,
          parent_id: parent_id || null,
          body: text,
          ip_hash: ipHash,
          geo: geo || null,
          user_agent: ua,
          status: 'pending',
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('[comments] Supabase insert error:', errText);

      // Duplicate ID — comment already exists
      if (errText.includes('duplicate') || errText.includes('23505')) {
        return jsonResponse(409, { error: 'Comment already submitted' });
      }

      return jsonResponse(502, { error: 'Database write failed' });
    }

    return jsonResponse(201, { ok: true, id, status: 'pending' });

  } catch (e) {
    console.error('[comments] Insert error:', e.message);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ─── OPTIONS: CORS preflight ────────────────────────────────────────────────
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function jsonResponse(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

async function hashIP(ip) {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + ':slc_salt_2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
