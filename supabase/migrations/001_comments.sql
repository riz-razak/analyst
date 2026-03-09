-- ============================================================================
-- Comments system for analyst.rizrazak.com dossiers
-- Requires: Supabase project with Magic Link auth enabled
-- ============================================================================

-- 1. Comments table
create table if not exists public.comments (
  id          uuid default gen_random_uuid() primary key,
  dossier_id  text not null,
  parent_id   uuid references public.comments(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  author_email text not null,
  body        text not null check (char_length(body) between 1 and 5000),
  lang        text not null default 'en' check (lang in ('en', 'si')),
  approved    boolean not null default false,
  flagged     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Indexes for efficient queries
create index idx_comments_dossier on public.comments(dossier_id, created_at desc);
create index idx_comments_author on public.comments(author_id);
create index idx_comments_parent on public.comments(parent_id);
create index idx_comments_approved on public.comments(dossier_id, approved);

-- 2. Row Level Security
alter table public.comments enable row level security;

-- Anyone (including anonymous) can read approved comments
create policy "approved_comments_public_read"
  on public.comments for select
  using (approved = true);

-- Authenticated users can read their own comments (even unapproved)
create policy "own_comments_read"
  on public.comments for select
  using (auth.uid() = author_id);

-- Authenticated users can insert comments
create policy "authenticated_insert"
  on public.comments for insert
  with check (
    auth.uid() = author_id
    and auth.uid() is not null
  );

-- Users can update only their own unapproved comments (edit window)
create policy "own_unapproved_update"
  on public.comments for update
  using (auth.uid() = author_id and approved = false)
  with check (auth.uid() = author_id);

-- Admin: full access (riz@dgtl.lk)
-- NOTE: Also add via Supabase dashboard → Authentication → Roles
-- For now, admin operations go through the service_role key on the server side

-- 3. Auto-approve for trusted emails (optional — uncomment to enable)
-- create or replace function public.auto_approve_trusted()
-- returns trigger as $$
-- begin
--   if new.author_email in ('riz@dgtl.lk') then
--     new.approved := true;
--   end if;
--   return new;
-- end;
-- $$ language plpgsql security definer;
--
-- create trigger trg_auto_approve
--   before insert on public.comments
--   for each row execute function public.auto_approve_trusted();

-- 4. Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_comments_updated_at
  before update on public.comments
  for each row execute function public.handle_updated_at();

-- 5. Comment count view (for display)
create or replace view public.comment_counts as
  select
    dossier_id,
    count(*) filter (where approved) as approved_count,
    count(*) filter (where not approved and not flagged) as pending_count,
    count(*) filter (where flagged) as flagged_count
  from public.comments
  group by dossier_id;
