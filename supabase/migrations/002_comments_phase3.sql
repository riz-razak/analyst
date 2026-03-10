-- ============================================================================
-- Comments System Phase 3: Extended Features
-- - Threaded comments (levels 1-3)
-- - Comment users (separate from auth.users)
-- - Moderation workflow with audit log
-- - Notification system
-- - Like/edit tracking
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. COMMENT_USERS TABLE
-- Separate from auth.users to allow guest comments with tracked identity
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.comment_users (
  id              uuid default gen_random_uuid() primary key,
  email           text not null unique,
  display_name    text not null,
  avatar_initials char(2) not null,
  role            text not null default 'user' check (role in ('user', 'contributor', 'admin')),
  notification_opt_in boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_comment_users_email on public.comment_users(email);


-- ─────────────────────────────────────────────────────────────────────────
-- 2. ALTER COMMENTS TABLE (extend Phase 1)
-- Add threading, edit tracking, likes, moderation fields
-- ─────────────────────────────────────────────────────────────────────────

alter table if exists public.comments
add column if not exists comment_user_id uuid references public.comment_users(id) on delete set null;

alter table if exists public.comments
add column if not exists level integer not null default 1
  check (level >= 1 and level <= 3);

alter table if exists public.comments
add column if not exists edited_at timestamptz;

alter table if exists public.comments
add column if not exists edit_count integer not null default 0 check (edit_count >= 0);

alter table if exists public.comments
add column if not exists likes integer not null default 0 check (likes >= 0);

alter table if exists public.comments
add column if not exists moderation_note text;

alter table if exists public.comments
add column if not exists flagged_reason text;


-- ─────────────────────────────────────────────────────────────────────────
-- 3. MODERATION_LOG TABLE
-- Audit trail for all moderation actions
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.moderation_log (
  id              uuid default gen_random_uuid() primary key,
  comment_id      uuid not null references public.comments(id) on delete cascade,
  moderator_id    uuid not null references public.comment_users(id) on delete restrict,
  action          text not null check (action in ('approved', 'rejected', 'flagged', 'edited', 'restored')),
  reason          text,
  old_body        text,
  new_body        text,
  created_at      timestamptz not null default now()
);

create index idx_moderation_log_comment on public.moderation_log(comment_id);
create index idx_moderation_log_moderator on public.moderation_log(moderator_id);
create index idx_moderation_log_action on public.moderation_log(action, created_at desc);


-- ─────────────────────────────────────────────────────────────────────────
-- 4. COMMENT_NOTIFICATIONS TABLE
-- Track notifications for comment activity
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.comment_notifications (
  id              uuid default gen_random_uuid() primary key,
  recipient_id    uuid not null references public.comment_users(id) on delete cascade,
  comment_id      uuid not null references public.comments(id) on delete cascade,
  type            text not null check (type in ('reply', 'mention', 'moderation', 'admin')),
  sent            boolean not null default false,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_comment_notifications_recipient on public.comment_notifications(recipient_id, created_at desc);
create index idx_comment_notifications_comment on public.comment_notifications(comment_id);
create index idx_comment_notifications_sent on public.comment_notifications(sent, created_at asc);


-- ─────────────────────────────────────────────────────────────────────────
-- 5. UPDATED_AT TRIGGERS for new tables
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.handle_updated_at_comment_users()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_comment_users_updated_at
  before update on public.comment_users
  for each row execute function public.handle_updated_at_comment_users();


-- ─────────────────────────────────────────────────────────────────────────
-- 6. VIEWS for moderation workflow
-- ─────────────────────────────────────────────────────────────────────────

create or replace view public.pending_comments as
  select
    c.id,
    c.dossier_id,
    c.parent_id,
    c.body,
    c.author_email,
    cu.display_name,
    c.created_at,
    c.level,
    c.flagged,
    c.flagged_reason
  from public.comments c
  left join public.comment_users cu on c.comment_user_id = cu.id
  where c.approved = false and c.flagged = false
  order by c.created_at asc;

create or replace view public.flagged_comments as
  select
    c.id,
    c.dossier_id,
    c.parent_id,
    c.body,
    c.author_email,
    cu.display_name,
    c.created_at,
    c.level,
    c.flagged_reason,
    count(ml.id) as moderation_actions
  from public.comments c
  left join public.comment_users cu on c.comment_user_id = cu.id
  left join public.moderation_log ml on c.id = ml.comment_id
  where c.flagged = true
  group by c.id, c.dossier_id, c.parent_id, c.body, c.author_email, cu.display_name, c.created_at, c.level, c.flagged_reason
  order by c.created_at desc;


-- ─────────────────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY (extend from Phase 1)
-- ─────────────────────────────────────────────────────────────────────────

-- comment_users: all authenticated users can read, limited write
alter table public.comment_users enable row level security;

create policy "comment_users_public_read"
  on public.comment_users for select
  using (true);  -- Everyone can see comment user profiles

create policy "comment_users_self_update"
  on public.comment_users for update
  using (auth.uid()::text = id::text)
  with check (auth.uid()::text = id::text);

create policy "comment_users_self_insert"
  on public.comment_users for insert
  with check (true);  -- Anyone can create a comment user profile


-- moderation_log: read-only for admins
alter table public.moderation_log enable row level security;

create policy "moderation_log_admin_read"
  on public.moderation_log for select
  using (exists (
    select 1 from public.comment_users
    where id = auth.uid()::uuid and role = 'admin'
  ));

create policy "moderation_log_admin_insert"
  on public.moderation_log for insert
  with check (exists (
    select 1 from public.comment_users
    where id = auth.uid()::uuid and role = 'admin'
  ));


-- comment_notifications: only owner can read
alter table public.comment_notifications enable row level security;

create policy "comment_notifications_owner_read"
  on public.comment_notifications for select
  using (recipient_id = auth.uid()::uuid);

create policy "comment_notifications_admin_insert"
  on public.comment_notifications for insert
  with check (exists (
    select 1 from public.comment_users
    where id = auth.uid()::uuid and role = 'admin'
  ));
