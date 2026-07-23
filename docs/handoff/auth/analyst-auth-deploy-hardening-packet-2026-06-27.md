---
title: "Analyst Auth Deploy Hardening Packet"
date: "2026-06-27"
owner: "Bala #2 + Senevi #5"
status: "ready for predeploy review"
tags: ["auth", "deploy", "worker", "yan-people", "analyst"]
---

# Analyst Auth Deploy Hardening Packet

Scope: base Analyst Worker only. Do not deploy with a named Cloudflare environment unless a newer runbook explicitly says so.

## Source Boundary

- Codebase: `/Users/rizrazak/Code/the-analyst`
- Worker: `functions/collaborative-session.js`
- Canonical auth authority: `auth.yan.lk`
- Product-local session cookie: `__Host-analyst_session`
- Authorization rule: active `analyst` product membership plus explicit `analyst.*` rights.

## Required Predeploy Checks

```bash
node --check functions/collaborative-session.js
npm run build
bash scripts/codex/validate.sh
git diff --check
```

Confirm Worker secrets without printing values:

```bash
npx wrangler secret list
```

Expected minimum:

- `AUTH_UNIFIED_ISSUER`
- `AUTH_UNIFIED_CLIENT_ID`
- `AUTH_UNIFIED_REDIRECT_URI`
- `ANALYST_SESSION_SIGNING_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- service-role key under the currently supported Worker name

## Adapter Contract

`/auth/me` must keep the old fields and expose these additive fields:

- `product`
- `membership.product`
- `membership.status`
- `right.requested`
- `right.allowed`
- `reauth.fresh`
- `reauth.expires_at`

`/auth/logout` clears local Analyst cookies and returns to `/auth/signed-out`.

`/auth/logout-global` clears local Analyst cookies and redirects through the central auth logout endpoint when unified auth is enabled. Override with `AUTH_UNIFIED_LOGOUT_URL` and, if needed, `AUTH_UNIFIED_LOGOUT_REDIRECT_PARAM`.

## Manual Smoke

1. Start unified sign-in with `next=/admin-preview.html`.
2. Complete AAL2 and fresh reauth at `auth.yan.lk`.
3. Confirm `/auth/me?right=analyst.admin.access` returns `authenticated: true`, `membership.status: active`, `right.allowed: true`, and `reauth.fresh: true`.
4. Confirm missing or stale reauth fails closed.
5. Confirm `/auth/logout` clears local access.
6. Confirm `/auth/logout-global` clears local access and returns through the central logout flow.
7. Confirm hidden dossiers do not appear in the React public list and hidden live URLs still return the Worker 404 surface.

## Deploy Guardrails

- Base Worker only.
- No secrets in terminal output, docs, or diffs.
- No Analyst-only member store.
- No browser-side PAT fallback.
- No public navigation to admin monitors or unreleased Yan project portals.
- No deploy while the dirty worktree ledger has unresolved high-deploy-relevance paths in the deploy set.

