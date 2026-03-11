/**
 * MIGRATION: localStorage comments → Supabase SQL inserts
 *
 * Run this in your browser console while on the cricket dossier page:
 *   1. Open https://analyst.rizrazak.com/sri-lanka-cricket-corruption/
 *   2. DevTools → Console
 *   3. Paste this entire script
 *   4. Copy the SQL output
 *   5. Run it in Supabase SQL Editor
 */

(function migrateComments() {
  const PAGE_KEY = 'slc_main_comments_v1';
  const raw = localStorage.getItem(PAGE_KEY);

  if (!raw) {
    console.log('No comments found in localStorage key:', PAGE_KEY);
    console.log('Also checking slc_comments_v1...');
    const alt = localStorage.getItem('slc_comments_v1');
    if (!alt) {
      console.log('No comments found. Nothing to migrate.');
      return;
    }
  }

  const comments = JSON.parse(raw || localStorage.getItem('slc_comments_v1') || '[]');

  if (comments.length === 0) {
    console.log('Comment array is empty. Nothing to migrate.');
    return;
  }

  console.log(`Found ${comments.length} comments. Generating SQL...`);

  // Simple SQL escape
  function esc(str) {
    if (!str) return 'NULL';
    return "'" + String(str).replace(/'/g, "''").slice(0, 2000) + "'";
  }

  // FNV-1a hash (matching the old hashStr function)
  function hashStr(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return 'sha:' + h.toString(16).padStart(8, '0');
  }

  const sql = comments.map(c => {
    const id = esc(c.id);
    const dossier = "'sri-lanka-cricket-corruption'";
    const parentId = c.parent_id ? esc(c.parent_id) : 'NULL';
    const body = esc(c.text || c.body || '');
    const ipHash = esc(c.ip_hash || (c.ip ? hashStr(c.ip + 'salt_slc_2026') : null));
    const geo = esc(c.geo);
    const ua = esc((c.ua || '').slice(0, 120));
    const status = esc(c.status || 'pending');
    const createdAt = c.ts
      ? `'${new Date(c.ts).toISOString()}'`
      : 'now()';

    return `INSERT INTO public.dossier_comments (id, dossier_id, parent_id, body, ip_hash, geo, user_agent, status, created_at)
VALUES (${id}, ${dossier}, ${parentId}, ${body}, ${ipHash}, ${geo}, ${ua}, ${status}, ${createdAt})
ON CONFLICT (id) DO NOTHING;`;
  }).join('\n\n');

  console.log('\n-- ════════════════════════════════════════');
  console.log('-- Migration: localStorage → Supabase');
  console.log('-- Comments found:', comments.length);
  console.log('-- Generated:', new Date().toISOString());
  console.log('-- ════════════════════════════════════════\n');
  console.log(sql);

  // Also copy to clipboard
  try {
    navigator.clipboard.writeText(sql).then(() => {
      console.log('\n✓ SQL copied to clipboard! Paste into Supabase SQL Editor.');
    });
  } catch (e) {
    console.log('\n(Could not copy to clipboard — select the SQL above and copy manually)');
  }

  // Summary
  console.log('\n-- Summary:');
  const pending = comments.filter(c => c.status === 'pending').length;
  const approved = comments.filter(c => c.status === 'approved').length;
  console.log(`--   Pending:  ${pending}`);
  console.log(`--   Approved: ${approved}`);
  console.log(`--   Total:    ${comments.length}`);
})();
