---
title: "Analyst Member Management & Sunera Access Plan"
date: "2026-06-19"
owner: "claude (Bala security + Priya governance lens)"
status: "plan-only — no live provisioning this session"
tags: ["auth", "member-management", "rights", "sunera", "people-model", "analyst"]
---

# Analyst Member Management & Sunera Access Plan

Plan-only. **No live provisioning, no migrations, no deploy this session.** This specifies how
Analyst member management should work under the Yan People model, and how co-founder **Sunera
Bandara** is granted access — for founder approval before anything is provisioned.

## 1. The lock (non-negotiable, from Yan-Analyst.md)

- Analyst must **not** create a parallel member / admin store.
- Access = an **`analyst` product membership** on the shared Yan People model, **plus explicit
  `analyst.*` rights**. Labels and "primary product" are metadata only — **never authorization**.
- Admin requires **AAL2 + fresh reauth + `analyst.admin.access`**.
- Canonical auth authority: **`auth.yan.lk`**. Local session cookie: **`__Host-analyst_session`**.
- Implementation reference for current member management: **Yan-Vada Supabase migrations**
  (project-local), not browser allowlists, not Analyst-only state.

## 2. What the code already enforces (verified this session)

The live Worker (`functions/collaborative-session.js`) already honours the lock:

- Unified OIDC against `auth.yan.lk` (issuer/client/redirect in `wrangler.toml`), PKCE + ES256 JWT
  verification, `acr_values=urn:yan:aal:2`.
- Token claims are checked for `product='analyst'`, `membership_status='active'`, AAL2, and
  `rights` including **`analyst.admin.access`** (`UNIFIED_REQUIRED_RIGHT`), plus fresh-reauth
  (`freshReauth(claims.reauth_expires_at)`).
- Session cookie is `__Host-analyst_session`; legacy Supabase login is retired by default.

So Analyst is **already a rights-gated product consumer of central auth** — no parallel store exists.
Good. The remaining work is (a) define the rights vocabulary cleanly, (b) provision people in Yan-Vada,
(c) harden the Worker (see §5).

## 3. Proposed `analyst.*` rights vocabulary

| Right | Grants | Typical holder |
|---|---|---|
| `analyst.admin.access` | Enter the admin/dashboard surface at all (gate right) | Riz, Sunera |
| `analyst.admin` | Full admin (settings, member-adjacent ops) | Riz, Sunera |
| `analyst.cms.edit` | Edit/publish dossiers via CMS | founders, trusted editors |
| `analyst.comments.moderate` | Moderation queue | founders, moderators |
| `analyst.analytics.view` | Analytics dashboards | founders, support staff |
| `analyst.submissions.review` | Evidence intake queue | founders, editors |

> Code today collapses much of this into `analyst.admin` / `analyst.admin.access`. Splitting rights
> lets support staff (joining soon) get **least-privilege** access (e.g. `analytics.view` only)
> without admin. Recommend introducing the finer rights in the Yan People model before onboarding
> support staff.

## 4. Sunera Bandara — co-founder access (for approval)

| Field | Value |
|---|---|
| Person | Sunera Bandara |
| Role | Co-founder, The Analyst (a Yan service) |
| Product membership | `analyst`, status `active` |
| Rights | `analyst.admin.access`, `analyst.admin` (full, as co-founder) |
| Assurance | **AAL2** (TOTP) + fresh reauth required for admin |
| Labels (metadata only) | `analyst.cofounder` (display/role only — not authorization) |
| Provisioning path | Yan-Vada Supabase member record + People-model rights grant |
| Identity hygiene | Sunera enrols her own TOTP; **do not** transmit OTP/TOTP/secret material in chat/docs |

**Provisioning steps (when founders approve — to run in Yan-Vada, not Analyst):**
1. Create/locate Sunera's Person in the Yan People model.
2. Add `analyst` product membership (`active`).
3. Grant `analyst.admin.access` + `analyst.admin`.
4. Sunera signs in via `auth.yan.lk`, enrols TOTP (AAL2), completes fresh reauth.
5. Verify she reaches `https://analyst.rizrazak.com/admin-preview.html` after fresh sign-in.
6. Record the grant in an audit log (see §5).

## 5. Hardening recommended before expanding CMS/admin (Bala)

From the security review — do these before widening editing features or onboarding support staff:

1. **Remove fallback Supabase keys; fail closed** if env vars are missing (don't silently route).
2. **CSRF tokens** on state-changing admin routes (publish, moderate, visibility, handoff) — current
   protection is Origin/Referer + CORS only.
3. **Structured audit logging** (`admin_audit_log`): who/what/when for publish, moderation,
   visibility, member-rights changes. Required for transparency posture and to log grants like §4.
4. **Tighten CORS** to same-origin on POST/PUT/DELETE (several endpoints return `*`).
5. **Split rights** (§3) so support staff get least-privilege, not blanket admin.

## 6. Explicitly NOT done this session

- No Supabase migration written or run; no member created; no rights granted; no deploy.
- No parallel Analyst member store (and none should ever be created).
- Support-staff onboarding deferred until the finer `analyst.*` rights exist and About/Team is ready.
