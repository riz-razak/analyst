---
title: "Tech Review & Build Sequence — Sign-in, Memberflow, Design, Dashboard"
date: "2026-06-19"
owner: "Tech Review: Aether #3 (lead), Bala #2, Senevi #5, Tejo #46"
status: "review complete — implementation gated behind founder go (no code/deploy this session)"
tags: ["tech-review","go-no-go","build-sequence","auth","standards","analyst"]
inputs:
  - "analyst-universal-member-and-auth-standard-2026-06-19.md"
  - "analyst-design-and-dashboard-integration-standard-2026-06-19.md"
---

# Tech Review & Build Sequence (2 rounds)

Validated the standards specs against live code. **No files modified.** Founder gate + base-Worker-only
deploy rule apply.

## Go/No-Go

| # | Item | Verdict | Gate |
|---|---|---|---|
| A2A | Add `reauth_required` to one-shot retry | **GO** | reuse `__Host-analyst_auth_retry` guard |
| A2B | Force `reauth=required`+`max_age=0` on retry | **NO-GO (blocked)** | auth.yan.lk param contract unverified |
| A2C | Branded noindex/no-store HTML 400 | **GO** | reuse `safePublicAuthError` allowlist |
| A3.1 | Remove fallback Supabase keys (fail closed) | **GO — priority** | confirm Worker secrets set first (read-only) |
| A3.2 | CSRF on state-changing admin routes | **CONDITIONAL** | verify unified-cookie is cookie-backed |
| A3.3 | Same-origin CORS on writes | **GO** | ship with A3.2 |
| A3.4 | security_audit_events | **GO (later)** | depends on A3.1 service key |
| A3.5 | Split `analyst.*` least-privilege | **GO (later)** | stop using `analyst.admin` as skeleton key |
| A1 | Universal member flow / SSO | **design GO; build later** | already implemented; nothing net-new before sign-in fixed |
| B4 | `yan-core.css` token migration | **GO — isolated pass** | never bundle with auth; screenshot-diff |
| B5 | Dashboard embed `#/business-model` | **GO** | ship server-gate stub + SRI-pin Plotly |

## Phased build sequence

- **Phase 0 — resolve admin sign-in NOW (safe shortlist):** A2A + A2C + A3.1. Self-contained, no external
  contract, removes a committed credential, converts the raw-400 dead-end into one clean retry + branded
  failure. *Senevi pre-flight (read-only `wrangler secret list`): confirm `SUPABASE_URL` + service key
  exist before removing the fallback, else prod fails closed. Base Worker only; no `--env production`;
  no commit/deploy without founder.*
- **Phase 1 — hardening:** A3.2 + A3.3 (after confirming unified-cookie CSRF classification), then A3.4
  audit log, then A3.5 least-privilege split.
- **Phase 2 — blocked:** A2B once Tejo confirms auth.yan.lk's `max_age=0`/`reauth=required` (or switch to
  `prompt=login`). Phase 0's retry handles the common case meanwhile.
- **Phase 3 — design + dashboard (parallel, independent of auth):** B4 token migration (own diffed pass);
  B5 dashboard embed with server-gate stub + SRI.

## Blocking dependencies / open questions

1. **[blocks A2B]** Does `auth.yan.lk` honour `max_age=0` and/or custom `reauth=required` (vs standard
   `prompt=login`)? What `reauth_expires_at`/`auth_time` does it return?
2. **[gates A3.2]** Is `tokenSource:'unified_cookie'` treated as cookie-backed by `isCookieBackedSession`?
   If not, unified admin writes currently have no CSRF.
3. **[gates A3.1 deploy]** Are `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` set as base-Worker secrets?
4. `reauth_required` surfaces in 3 paths (callback 724, unified-cookie session 755, legacy refresh 1289);
   Phase 0 fixes the callback; confirm the other two degrade gracefully (they appear to).

## "Safe to implement first" (minimum to resolve admin sign-in)
**A2A + A2C + A3.1** — contingent only on the read-only secret check. Everything else sequenced behind it.
Founder gate required before Phase 0 ships.
