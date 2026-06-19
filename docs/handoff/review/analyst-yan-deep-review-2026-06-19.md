---
title: "Deep Review — The Analyst (and Yan boundary), Angel Council"
date: "2026-06-19"
owner: "claude — Yan agent council role identities (Priya, Nuwan, Ridma, Senevi, Bala) — 6 of 25+; full roster in COUNCIL_MANIFEST.md (unmounted)"
status: "review-complete (Analyst) · Yan-macro PENDING mount"
tags: ["review", "architecture", "council", "analyst", "yan", "auth", "dashboards", "financials"]
companions:
  - "../business/analyst-business-model-v0.1-2026-06-19.md"
  - "../business/analyst-business-model-v0.1.xlsx"
  - "../auth/analyst-member-management-and-sunera-access-plan-2026-06-19.md"
  - "../navigation/analyst-about-team-scaffolding-spec-2026-06-19.md"
---

# Deep Review — The Analyst (and the Yan boundary)

Conducted with the **canonical Yan agent council** role identities (Priya, Nuwan, Ridma, Senevi,
Bala) — **6 of the 25+ council agents**, being the only identities named in the handoff. The full
roster lives in `COUNCIL_MANIFEST.md` in the unmounted Yan repo; once mounted, this review should be
re-mapped to the correct full council and any additional owner agents. No parallel council invented;
generic review agents carried the Yan role identity per the council protocol. Read-only review; **no
code changed, nothing committed or deployed.**

## 0. Scope & two important context flags

- **Mounted repo is a *different checkout* than the handoff's codex worktree.** The session folder is
  `/Users/rizrazak/Code/the-analyst`; the handoff was authored against
  `/Users/rizrazak/.codex/worktrees/2dee/the-analyst`. Effects in this checkout:
  - `docs/handoff/auth/`, `docs/handoff/business/`, `docs/handoff/ui-polish/` referenced by the
    handoff **did not exist here** (created now for this packet).
  - `supabase/migrations/` is **empty** here (only `SETUP.md`) — consistent with publication-only.
  - The **auth reauth quick fix is NOT in this checkout** (see §Bala / §Fixes). It lives in the worktree.
- **Yan macro repo not mounted.** `/Users/rizrazak/Code/yan` (YAN.md, COUNCIL_MANIFEST.md,
  YAN_PEOPLE_IDENTITY_MODEL.md) and the **founder ethos / vidura protocol / priya raise-council
  protocol** docs are unreachable this session. The Yan-macro half of the review (Task #2) is
  **deferred until you mount the folder.** All Yan facts below are marked *(from handoff — unverified)*.

## 1. Priya — governance, mission, sequencing (synthesis)

- **Ethos integrity is strong.** `strategy.md` (anarchist-socialist dual-power, no corporate
  sponsorship, transparency) is a real operating theory, and the code/auth honour the Yan People
  boundary. The biggest governance risk is *drift*, not direction.
- **Sequencing call for this session:** Financials first (done — v0.1), with the auth fix prepared
  in parallel (done — patch below). Member management and About/Team are **plan/spec only** as you
  directed.
- **Cross-cutting governance gaps:** (1) no audit logging of admin/member actions — needed for the
  transparency posture; (2) documentation contradictions (deploy target; checkout vs worktree;
  stale architecture.md) erode the single source of truth; (3) the "media kit" framing in the
  business stocktake contradicts the no-sponsorship ethos — reframed to a Supporter Prospectus.
- **Co-founder:** Sunera Bandara recorded as co-founder; access is planned (Bala) and she appears in
  the About/Team scaffold (Ridma), no live provisioning.

## 2. Bala — auth / security / access boundaries

**Verdict:** the live Worker **honours the BRAND/AUTH LOCK** — unified OIDC vs `auth.yan.lk`, PKCE,
ES256 verification, `product=analyst` + `membership_status=active` + AAL2 + `analyst.admin.access` +
fresh reauth, cookie `__Host-analyst_session`, legacy login retired. No parallel member store.

Findings:

- **[HIGH] Fallback Supabase URL/anon-key constants** in `functions/collaborative-session.js`,
  `_middleware.js`, `auth/session.js`, `auth/me.js` — silently route if env vars are missing. Fail closed.
- **[HIGH] Overly permissive CORS (`*`)** on multiple endpoints incl. email-template preview/test.
- **[HIGH] No CSRF tokens** on state-changing admin routes (publish/moderate/visibility/handoff);
  only Origin/Referer + CORS today.
- **[MED] No structured audit logging** for admin actions (a `moderation_log` table exists in the
  schema but isn't wired into handlers in this checkout).
- **[MED] Legacy reauth-freshness fallback** is complex; prefer the unified `reauth_expires_at` path
  and add explicit reject-on-missing.
- **[LOW]** localStorage admin state; route allowlist is piecemeal; legacy cookies lack `__Host-`.

Top 5: remove fallback keys (fail closed) → CSRF on admin mutations → audit log table → tighten CORS
on writes → split `analyst.*` rights for least-privilege (support staff).

## 3. Nuwan — dashboards, analytics, data integrity

- **[HIGH] Dashboard shows mock/placeholder analytics.** `admin-preview.html` carries a hardcoded
  `analyticsData` object; GA4 connect UI exists but property ID is a placeholder; Clarity has no
  visible ID; Umami has a real ID. There is **no clear LIVE-vs-MOCK indicator** — decision-makers can
  mistake synthetic numbers for truth.
- **[HIGH] Dashboard KPIs are generic web metrics**, not the **mission-mapped metrics** strategy.md
  demands (deep-read rate, 5-min readers, source-link clicks, Sinhala-toggle rate, cross-dossier nav,
  returning-visitor cohorts, diaspora geo clusters). The custom events exist in `_analytics_events.js`
  but aren't surfaced as KPIs.
- **[HIGH] Evidence protocol is documented but not enforced in the CMS** — no evidence-status fields,
  no pre-publish "orphan number / orphan quote" check.
- **[MED]** 8.7K-line monolith couples read-only dashboard with full CMS; **[MED]** three analytics
  systems, none canonical; **[MED]** moderation lacks an audit trail.

Top 5: split **Strategic Metrics vs Traffic Health** and surface custom events; replace mock with
live data + a LIVE/MOCK badge; add an **Evidence tab** enforcing labels pre-publish; pick **one**
canonical analytics source; add moderation audit fields.

## 4. Ridma — UI/UX, public shell, reader clarity

- **[HIGH] Shell adopted but inconsistent.** Core dossiers (iran, super-el-nino, easter) adopt the
  shell but then **override `dossier-base.css` with inline styles**, hollowing out the "centered
  masthead + RHS nav" contract. Older custom pages (anatta-bamiyan, caravan-fresh, mullivaikkal) keep
  bespoke headers. Admin surfaces (login, profile, admin-preview, admin-submissions,
  architecture-census) are a **separate design system**.
- **[HIGH] `dossier-lang.js` / `dossier-theme.js` carry dirty edits** (also in `git status`) — review
  and freeze their APIs.
- **[MED] React app and static shell are not unified** — `DossierPage.jsx` is an iframe stub with its
  own topbar; `Header.jsx`/`Footer.jsx` reportedly removed.
- **[MED] privacy-banner / comments-v3 are selectively integrated**, not site-wide.
- **About/Team:** no `/about` route; homepage menu shows "About Riz" only. Spec written (build later).

Top 5: freeze shell contract + lint it (`shell-manifest.json`); stop inline overrides; unify React +
static shell; stabilise lang/theme modules; add About/Team per spec.

## 5. Senevi — ops, build, deployment safety

- **[HIGH] Deploy-target contradiction:** `Yan-Analyst.md` says "GitHub Pages"; architecture/handoff
  say Cloudflare Pages/Workers. Reality = **GitHub Pages (static SPA) + base Cloudflare Worker**
  (`analyst-collaborative-cms` on `analyst.rizrazak.com/*`) + KV + Supabase + Resend. Fix the docs.
- **[HIGH] `dist/` is committed** (not in `.gitignore`) — stale-build and bloat risk.
- **[MED] CI has no lint step** before the Pages build; **[MED] `.venv-translation/` committed**
  (non-portable virtualenv); **[MED]** secrets setup not verified in CI.
- Deploy rule confirmed in `wrangler.toml`: base Worker only, `npx wrangler deploy --env=""`; never
  `--env production`; never raw script-API upload.

Deployment-safety: build/lint configs are sound; dirty worktree is **doc/data only** (safe to build).
Top 5: fix deploy-target docs; `.gitignore` + untrack `dist/`; add lint to CI; ignore `.venv*` +
add `requirements-translation.txt`; write a pre-deploy secrets checklist.

## 6. Fixes — auth `reauth_required` (diagnosis + ready patch)

**Symptom (production, from handoff):** `/auth/unified/callback` fails with `reauth_required` and
returns to `/admin-preview.html`.

**Root cause confirmed in THIS checkout:** in `functions/collaborative-session.js`,
`handleUnifiedCallback`'s `fail()` only auto-retries for `missing_auth_attempt`,
`invalid_auth_attempt`, `invalid_state`. When `verifyUnifiedToken` throws **`reauth_required`** (it
requires `freshReauth(claims.reauth_expires_at)`), it falls through to a raw `text/plain` 400 — no
retry, no safe HTML. The handoff's quick fix (retry once via
`/auth/unified/start?next=…&reauth=required`, send `max_age=0`, safe noindex/no-store fallback) is in
the **codex worktree, not here**.

**Immediate operational workaround (no deploy):** fresh sign-in URL
`https://analyst.rizrazak.com/auth/unified/start?next=%2Fadmin-preview.html&reauth=required`.

**Ready-to-apply patch (NOT applied — confirm checkout first):**
1. In `handleUnifiedCallback` `fail()`, add `reauth_required` to the one-shot retry set, and when
   retrying set `authorizeUrl` params `reauth=required` + `max_age=0` (force fresh AAL2) instead of
   `reauth=if_needed`.
2. Replace the `text/plain` terminal failure with **noindex/no-store HTML**.
3. Mirror the worktree doc `analyst-auth-reauth-quickfix-2026-06-19.md`.

> **Decision needed:** the fix already exists in the codex worktree. Do you want it applied **here**
> too (this checkout), or is this checkout not the deployment source? I did **not** edit code to avoid
> divergent changes across two checkouts.

**Public-shell QA:** rerun **Wave 3T** from the correct Vite/public serving path (not a repo-root
static server — `/_shared/...` 404s there) and reconcile the rollout map vs the Wave-3T QA doc
(both live in the worktree).

## 7. Yan macro — PENDING (Task #2)

Deferred until `/Users/rizrazak/Code/yan` is mounted. On mount, review (read-only): founder ethos,
vidura protocol, priya raise-council protocol, `YAN.md`, `COUNCIL_MANIFEST.md`,
`YAN_PEOPLE_IDENTITY_MODEL.md` — and reconcile against the handoff facts (auth authority `auth.yan.lk`;
product-local sessions; membership + product-prefixed rights; council manifest identities).

## 8. Consolidated priority queue

| # | Item | Owner | Sev |
|---|---|---|---|
| 1 | Decide + (if approved) apply auth `reauth_required` fix; rerun Wave 3T QA | Bala/Senevi | HIGH |
| 2 | Founders fill real figures into Business Model v0.1; set stipend/runway posture | Priya | HIGH |
| 3 | Remove fallback Supabase keys; add CSRF on admin writes; audit log | Bala | HIGH |
| 4 | Dashboard: LIVE/MOCK badge + mission-mapped KPIs + Evidence tab | Nuwan | HIGH |
| 5 | Fix deploy-target docs; untrack dist/; add CI lint; ignore .venv* | Senevi | MED |
| 6 | Stop inline shell overrides; freeze lang/theme; unify React+static shell | Ridma | MED |
| 7 | Provision Sunera (Yan-Vada) + split analyst.* rights for support staff | Bala | MED |
| 8 | Build About/Team per spec; aids Google News + funding ask | Ridma/Priya | MED |
| 9 | Mount Yan repo → complete macro review (Task #2) | Priya | — |
