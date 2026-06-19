---
title: "Analyst — Session Handoff & Next Steps (auth + first dashboard push)"
date: "2026-06-20"
owner: "Priya #9 (sequencing) · Bala #2 (security) · Senevi #5 (ops)"
status: "stocktake — implementation gated on founder go; nothing committed/deployed"
tags: ["handoff", "next-steps", "auth", "dashboard", "quick-wins", "analyst"]
---

# Analyst — Session Handoff & Next Steps

Stocktake after this session's build round. **Nothing is committed or deployed** — all changes are in
the working tree, gated on founder go (and a checkout-source decision, below).

## 1. Where we are (built this session, uncommitted)

Code (the-analyst, branch `main`):
- `functions/collaborative-session.js` — sign-in fix (reauth_required one-shot retry + forced step-up
  forwarding + branded noindex failure page) **and** `/admin-business-model.html` page-rights gate
  (`analyst.admin` / `analyst.analytics.view`). Passes `node --check`.
- `public/admin-preview.html` — "Business Model" nav link.
- `public/admin-business-model.html` — the media-model dashboard, served behind admin auth.
- `public/_shared/yan-core.css` — shared Bawa-Earth token layer (new).
- `supabase/migrations/006_…sql` — **tombstoned** (wrong location/schema; superseded by yan 017).

Central auth (yan repo, uncommitted): `apps/auth/supabase/migrations/017_seed_analyst_admin_sunera.sql`
— **founder ACCEPTED**; grants Sunera (`sunera@dgtl.lk`, linked to her existing Person) Analyst admin.

Docs delivered: financial/business plan v1 + proposition v0.1–0.3, media-company plan, dashboards,
verification-spine spec, member/auth + design standards, tech-review/build sequence, deploy runbook.

## 2. Gated items (need founder go)

| Item | State | Gate |
|---|---|---|
| Deploy Worker (sign-in fix + dashboard gate) | ready, validated | base Worker only; **confirm checkout source first** |
| Apply migration 017 (Sunera admin) | accepted | run on People Supabase; pre-check query in runbook |
| A3.1 — remove committed Supabase fallback keys | held | rotate anon key + confirm secrets FIRST, then remove + redeploy |
| Git commit/push | not done | founder ask + **checkout-source decision** (mounted `main` vs codex worktree) |

## 3. Quick wins (ranked — low effort, high value)

1. **Deploy the sign-in fix** → unblocks admin access immediately (the original production pain). Safe;
   only adds behaviour. Do the read-only `wrangler secret list` pre-flight first.
2. **Apply migration 017** → Sunera gets admin (she signs in at auth.yan.lk, AAL2 + fresh reauth).
   Additive; does not touch Yan-Vada (verified by the before/after count query in the runbook).
3. **Ship the first dashboard** → it's already wired behind admin (`/admin-business-model.html`);
   it goes live the moment the Worker deploys. No extra work.
4. **Submit Google Search Console** (still undone per seo-strategy P0) → free organic traffic; zero code.

## 4. The push — auth + first dashboard (sequence)

Follow `docs/handoff/auth/analyst-deploy-grant-runbook-2026-06-19.md`:
- **Step 0** confirm deploy source (mounted `main` vs `~/.codex/worktrees/2dee/the-analyst`).
- **Step 1** read-only secret pre-flight.
- **Step 2** deploy sign-in fix + gated dashboard (`wrangler deploy --env=""`). Verify fresh sign-in +
  `/admin-business-model.html` requires auth + the Business Model nav link works.
- **Step 3** apply 017; verify Sunera resolves admin; confirm Yan-Vada count unchanged.
- **Step 4** A3.1: rotate key → set secret → remove fallbacks (4 files) → redeploy.
- Then hardening backlog: CSRF on state-changing admin routes, same-origin CORS on writes,
  `security_audit_events` (log denies, hashed ip/ua), split `analyst.*` least-privilege.

## 5. Bala — security caveats (extra-careful)

- **Do not deploy from the wrong checkout.** Confirm which checkout serves production before any push.
- **A3.1 ordering is load-bearing:** rotate + set the secret BEFORE removing the fallback, or the Worker
  fails closed = prod lockout. The committed anon key in git history should be rotated regardless.
- **Dashboard data boundary:** `/admin-business-model.html` is model-only, read-only, no PII — keep it so;
  if it ever pulls live numbers it must move behind a Worker endpoint enforcing `analyst.analytics.view`
  server-side + Hasib sign-off.
- **No OTP/TOTP/secret material** in docs/chat/logs. Sunera enrols her own factor.
- The SPA-native `#/business-model` embed (vs the gated page) and the design-token migration are separate
  screenshot-diffed passes — do not bundle with the auth deploy.

## 6. Still parked
- Yan macro architecture review (the deferred deep review) — read-only, on request.
- Verification spine build (precondition for any ML-drafted volume) — spec ready, Phase 0 first.
- Live analytics dashboard (admin currently shows mock data — Nuwan) — bigger task than the model dashboard.
