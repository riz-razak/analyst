-- ============================================================================
-- Anonymous Dossier Comments
-- Purpose-built for the public-facing comment FAB on dossier pages.
-- Visitors submit anonymously → comments go to 'pending' → admin approves
-- via analytics dashboard → approved comments render publicly.
--
-- All DB operations go through Cloudflare Pages Functions using
-- the service_role key (server-side only). No RLS needed because
-- the edge functions handle auth and access control themselves.
-- ============================================================================

create table if not exists public.dossier_comments (
  id              text primary key,                     -- short ID generated client-side (e.g. "A3BX9K")
  dossier_id      text not null,                        -- e.g. "sri-lanka-cricket-corruption"
  parent_id       text references public.dossier_comments(id) on delete cascade,  -- for threaded replies
  body            text not null check (char_length(body) between 10 and 2000),
  ip_hash         text,                                 -- SHA-256 hash of IP (never store raw IP)
  geo             text,                                 -- "Colombo, Sri Lanka" (coarse, from IP lookup)
  user_agent      text,                                 -- first 120 chars of UA string
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected', 'flagged')),
  flagged_reason  text,
  moderation_note text,
  created_at      timestamptz not null default now(),
  moderated_at    timestamptz,
  moderated_by    text                                  -- email of admin who moderated
);

-- Fast lookups for public reads (approved only, newest first)
create index idx_dc_dossier_approved
  on public.dossier_comments(dossier_id, created_at desc)
  where status = 'approved';

-- Fast lookups for admin moderation queue
create index idx_dc_dossier_status
  on public.dossier_comments(dossier_id, status, created_at asc);

-- Parent lookup for threading
create index idx_dc_parent
  on public.dossier_comments(parent_id)
  where parent_id is not null;

-- Convenience view: counts per dossier
create or replace view public.dossier_comment_counts as
  select
    dossier_id,
    count(*) filter (where status = 'approved')  as approved_count,
    count(*) filter (where status = 'pending')   as pending_count,
    count(*) filter (where status = 'flagged')   as flagged_count,
    count(*) filter (where status = 'rejected')  as rejected_count,
    count(*)                                     as total_count
  from public.dossier_comments
  group by dossier_id;

-- No RLS — all access is through edge functions with service_role key.
-- This is deliberate: anonymous visitors don't have Supabase auth tokens,
-- and admin operations are gated by JWT cookie verification in the middleware.
