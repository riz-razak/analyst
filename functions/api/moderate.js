/**
 * Admin Moderation API — /api/moderate
 *
 * Protected by JWT cookie verification (same as _middleware.js).
 * Only authenticated users with AAL2 (2FA verified) can access.
 *
 * GET  /api/moderate?dossier_id=sri-lanka-cricket-corruption[&status=pending]
 *      → returns ALL comments (or filtered by status) for admin view
 *
 * PATCH /api/moderate
 *      → update a comment's status (approve, reject, flag)
 *        body: { id, status, moderation_note?, flagged_reason? }
 *
 * Environment variables:
 *   SUPABASE_URL          — e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY  — service_role key
 *   SUPABASE_JWT_SECRET   — for verifying the auth cookie
 */

// ─── Auth check ─────────────────────────────────────────────────────────────
async function requireAuth(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)sb-token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : null;

  if (!token) return false;
  if (!env.SUPABASE_JWT_SECRET) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(env.SUPABASE_JWT_SECRET);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    const signingInput = encoder.encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);
    const valid = await crypto.subtle.verify('HMAC', cryptoKey, signature, signingInput);
    if (!valid) return false;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false;
    if ((payload.aal || 'aal1') !== 'aal2') return false;

    return payload; // Return the decoded payload (contains email, sub, etc.)
  } catch {
    return false;
  }
}

// ─── GET: Read all comments for admin ───────────────────────────────────────
export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await requireAuth(request, env);
  if (!auth) {
    return jsonResponse(401, { error: 'Authentication required (AAL2)' });
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return jsonResponse(503, { error: 'Backend not configured' });
  }

  const url = new URL(request.url);
  const dossierId = url.searchParams.get('dossier_id');
  const statusFilter = url.searchParams.get('status'); // optional: pending, approved, rejected, flagged

  if (!dossierId) {
    return jsonResponse(400, { error: 'dossier_id parameter required' });
  }

  try {
    let queryUrl = `${env.SUPABASE_URL}/rest/v1/dossier_comments?` +
      `dossier_id=eq.${encodeURIComponent(dossierId)}` +
      `&order=created_at.desc` +
      `&limit=500`;

    if (statusFilter) {
      queryUrl += `&status=eq.${encodeURIComponent(statusFilter)}`;
    }

    const res = await fetch(queryUrl, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[moderate] Supabase read error:', err);
      return jsonResponse(502, { error: 'Database read failed' });
    }

    const comments = await res.json();

    // Compute stats
    const stats = {
      total: comments.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      flagged: 0,
    };
    // If we didn't filter, compute from results; otherwise fetch full counts
    if (!statusFilter) {
      comments.forEach(c => { stats[c.status] = (stats[c.status] || 0) + 1; });
    } else {
      // Fetch counts separately
      const countRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/dossier_comment_counts?dossier_id=eq.${encodeURIComponent(dossierId)}`,
        {
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
        }
      );
      if (countRes.ok) {
        const counts = await countRes.json();
        if (counts[0]) {
          stats.pending = counts[0].pending_count || 0;
          stats.approved = counts[0].approved_count || 0;
          stats.flagged = counts[0].flagged_count || 0;
          stats.rejected = counts[0].rejected_count || 0;
          stats.total = counts[0].total_count || 0;
        }
      }
    }

    return jsonResponse(200, { comments, stats });

  } catch (e) {
    console.error('[moderate] Error:', e.message);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ─── PATCH: Update comment status ───────────────────────────────────────────
export async function onRequestPatch(context) {
  const { request, env } = context;

  const auth = await requireAuth(request, env);
  if (!auth) {
    return jsonResponse(401, { error: 'Authentication required (AAL2)' });
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return jsonResponse(503, { error: 'Backend not configured' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const { id, status, moderation_note, flagged_reason } = body;

  if (!id || !status) {
    return jsonResponse(400, { error: 'id and status are required' });
  }

  const validStatuses = ['approved', 'rejected', 'flagged', 'pending'];
  if (!validStatuses.includes(status)) {
    return jsonResponse(400, { error: 'Invalid status. Must be: ' + validStatuses.join(', ') });
  }

  // Build the update object
  const update = {
    status,
    moderated_at: new Date().toISOString(),
    moderated_by: auth.email || auth.sub || 'admin',
  };

  if (moderation_note !== undefined) update.moderation_note = moderation_note;
  if (flagged_reason !== undefined) update.flagged_reason = flagged_reason;

  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/dossier_comments?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(update),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[moderate] Supabase update error:', err);
      return jsonResponse(502, { error: 'Database update failed' });
    }

    const updated = await res.json();

    return jsonResponse(200, {
      ok: true,
      comment: updated[0] || null,
    });

  } catch (e) {
    console.error('[moderate] Update error:', e.message);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ─── OPTIONS: CORS preflight ────────────────────────────────────────────────
export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function jsonResponse(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
