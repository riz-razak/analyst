---
title: "Runbook — Deploy sign-in fix, grant Sunera admin (017), A3.1 key removal"
date: "2026-06-19"
owner: "Senevi #5 (ops) + Bala #2 (security)"
status: "ready to execute on the deploy machine — needs Cloudflare + Supabase access"
tags: ["runbook","deploy","auth","migration","supabase","analyst"]
---

# Runbook — Deploy + Sunera grant + A3.1

Run on the machine with Cloudflare + Supabase access (cannot run from the Cowork sandbox: no wrangler
auth there). **Base Worker only. Founder-gated.**

## Step 0 — Confirm the deploy source (do this first)

This work was edited in `/Users/rizrazak/Code/the-analyst` (branch `main`). The original handoff
referenced a separate **codex worktree** (`~/.codex/worktrees/2dee/the-analyst`). Deploy from your
canonical source of truth. If the worktree is canonical, port these edits there first:
- `functions/collaborative-session.js` (sign-in fix A2A/A2C + start-side reauth + admin-business-model page gate)
- `public/admin-preview.html` (Business Model nav link)
- `public/admin-business-model.html` (gated dashboard, new) + `public/_shared/yan-core.css` (new)

## Step 1 — Read-only secret pre-flight (gates A3.1, good before deploy)

```bash
cd <repo>
npx wrangler secret list            # base Worker (no --env)
```
Expect: `SUPABASE_SERVICE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`), `SUPABASE_ANON_KEY`,
`SUPABASE_JWT_SECRET`, `GITHUB_TOKEN`, `RESEND_API_KEY`, `ANALYST_SESSION_SIGNING_SECRET`.
- If `SUPABASE_ANON_KEY` / service key are present → safe to proceed (and A3.1 fallback removal is safe later).
- If missing → set them before A3.1 (else removing the fallback fails closed = lockout).

## Step 2 — Deploy the sign-in fix (safe now)

The current working tree only ADDS behaviour (reauth retry + branded failure page + a gated page +
nav link); it removes nothing, so it deploys safely once secrets exist.

```bash
npx wrangler deploy --env=""        # base Worker ONLY. Never --env production. Never raw script-API upload.
```
Verify:
- Fresh sign-in: `https://analyst.rizrazak.com/auth/unified/start?next=%2Fadmin-preview.html&reauth=required`
- A previously-failing `reauth_required` should now retry once, then (if still failing) show the branded
  "Sign in again" page instead of a raw 400.
- Admin sidebar shows **Business Model**; `/admin-business-model.html` requires admin/`analyst.analytics.view`.

## Step 3 — Grant Sunera admin (migration 017)

File: `yan/apps/auth/supabase/migrations/017_seed_analyst_admin_sunera.sql`.
**Pre-apply check** (does her Person exist? decides primary path vs fallback):
```sql
select p.id, p.primary_email
from identity_emails ie join people p on p.id = ie.person_id
where ie.normalized_email = 'sunerab@gmail.com';
```
- Row returned → apply 017 as-is (primary path links sunera@dgtl.lk + grants analyst admin).
- Empty → uncomment the **FALLBACK** block in 017 first (creates a Person keyed on sunera@dgtl.lk).

**Baseline (to prove vada is untouched) — run before AND after 017, compare:**
```sql
select count(*) active_vada from product_memberships where product_key='yan_vada' and membership_status='active';
```
Apply (Supabase SQL editor, or `supabase db push` in the auth app, per your migration flow).

**Post-apply verification:**
```sql
select p.primary_email, pm.product_key, pm.membership_status, pm.member_kind, pm.access_bundle_key, ab.rights
from people p
join product_memberships pm on pm.person_id = p.id and pm.product_key = 'analyst'
left join access_bundles ab on ab.product_key='analyst' and ab.bundle_key = pm.access_bundle_key
where p.id in (select person_id from identity_emails where normalized_email in ('sunerab@gmail.com','sunera@dgtl.lk'));
-- Expect: analyst | active | admin | admin | {"analyst.admin.access": true, ...}
```
Then Sunera signs in at `auth.yan.lk` with AAL2 (TOTP) + fresh reauth and reaches `/admin-preview.html`.
**Yan-Vada is unaffected** — 017 only writes the `(person,'analyst')` membership + her `analyst` bundle +
one new identity email; it never touches the `yan_vada` membership, the gmail identity, `people`, or RLS.

## Step 4 — A3.1: remove committed Supabase fallback keys (after Step 1 confirms secrets)

The exposed anon key is low-privilege (these People tables `revoke all ... from anon`), but rotate anyway.
1. **Rotate** the anon key in the Supabase dashboard (Project → API keys) and update the Worker secret:
   `npx wrangler secret put SUPABASE_ANON_KEY` (and `SUPABASE_SERVICE_KEY` if affected).
2. **Remove the fallbacks** in all four files (they each define + use `FALLBACK_SUPABASE_URL/ANON_KEY`):
   `functions/collaborative-session.js`, `functions/auth/session.js`, `functions/auth/me.js`,
   `functions/_middleware.js`. Delete the two top-of-file constants and change
   `env.SUPABASE_URL || FALLBACK_SUPABASE_URL` → `env.SUPABASE_URL` and
   `env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY` → `env.SUPABASE_ANON_KEY`.
3. `node --check` each file, then redeploy (`npx wrangler deploy --env=""`).
> Order matters: rotate + set secret BEFORE removing the fallback, or the Worker fails closed in prod.
> (I left A3.1 OUT of the current working tree on purpose so Step 2 stays safe to deploy first.)

## Rollback
Cloudflare keeps prior Worker versions — `wrangler rollback` reverts the deploy. Migration 017 is additive
and idempotent; to undo, `delete from product_memberships where person_id=<sunera> and product_key='analyst';`
(leaves vada intact).
