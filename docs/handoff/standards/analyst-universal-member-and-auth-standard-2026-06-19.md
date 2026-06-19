---
title: "Standard — Universal Yan Member Flow & Analyst Admin Sign-In"
date: "2026-06-19"
owner: "Standards: Bala #2 (lead), Priya #9, Vinita #47, Senevi #5 · reviewed by Tech Review"
status: "spec — implementation gated behind Tech Review + founder go (no code/deploy this session)"
source: "yan/YAN_PEOPLE_IDENTITY_MODEL.md (Ring 0), functions/collaborative-session.js, Yan-Analyst.md"
tags: ["auth","members","people-model","sso","standards","analyst","sister-brands"]
---

# Universal Yan Member Flow & Admin Sign-In — Standard

Implementation-ready standard from the 4-round standards work. Authoritative model is
`yan/YAN_PEOPLE_IDENTITY_MODEL.md`. No parallel member store (BRAND/AUTH LOCK).

## 1. Universal Yan member (one Person → many product memberships)

- **A "Yan member" = a Person record at `auth.yan.lk`** with one or more `product_memberships` rows —
  not a separate table. Same human across all sister brands (Analyst, Yan-Vada, Yan-Tuk, …) via
  `identity_emails` (Google/Apple/alternate) unified to one Person.
- **Two orthogonal status axes:** `people.person_status` (invited/active/suspended/archived) and
  per-product `product_memberships.membership_status` (invited/active/paused/revoked). `member_kind`
  (founder/admin/team/guest/sponsor/contributor/viewer) seeds the default bundle.
- **Authorization invariant (Priya):** access = **active product membership AND explicit
  product-prefixed right**. Labels, `member_kind`, email domain, primary product, and UI route **never
  authorize** (People-model DATA LOCK).
- **Rights vocabulary** `<product>.<resource>.<action>` via `access_bundles` + per-person
  `right_overrides`. Analyst set: `analyst.admin.access`, `analyst.cms.publish`,
  `analyst.comments.moderate`, `analyst.evidence.review`, `analyst.analytics.view`, `analyst.assets.manage`.
- **Sister-brand labels = metadata only**, controlled vocab (`label_taxonomy`): global bare
  (`founder`, `partner`, `internal`), product-prefixed (`analyst.editorial`, `yan_vada.sponsor_contact`).
  Permission-like labels (`admin`, `verified`, `blocked`) require special review. Product UIs keep brand
  boundaries (Analyst shows "The Analyst"; never expose Yan-Vada project language).

## 2. SSO / session model (the universal contract)

- **Authority:** `auth.yan.lk` only (OIDC auth-code + PKCE S256, `acr_values=urn:yan:aal:2`, ES256
  id_token, nonce/iss/aud/exp checks). Token is a `product_assertion` carrying `product`,
  `membership_status`, `aal`, `rights`, `reauth_expires_at` — **same claim shape every brand consumes.**
- **Session:** per-product `__Host-<product>_session` (Analyst: `__Host-analyst_session`), HMAC-signed,
  HttpOnly/Secure/SameSite=Lax, capped to the reauth window (≤30 min). Central SSO stays at
  `auth.yan.lk`; product sessions stay local. Sign-out clears only the product cookie.
- **Journey states:** guest (no membership) → registered (Person exists, no/invited membership) →
  member (active + non-admin rights) → admin (active + AAL2 + fresh reauth + `analyst.admin.access`).
- **Reauth defaults (all brands):** admin idle 30 min, absolute 8–12 h, refresh ≤7 days, high-risk
  window 5–15 min. High-risk (needs fresh reauth): rights/membership changes, publish, file/GitHub
  writes, visibility, evidence export, moderation.

## 3. Admin sign-in fix (root cause + the change)

**Root cause (confirmed in code):** `handleUnifiedCallback.fail()` only auto-retries
`missing_auth_attempt | invalid_auth_attempt | invalid_state`. When `verifyUnifiedToken` throws
`reauth_required` (stale `reauth_expires_at`, line ~724) it falls through to a raw `text/plain` 400.

- **A2A [GO]** add `reauth_required` to the one-shot retry set (guarded by `__Host-analyst_auth_retry`
  so it fires at most once).
- **A2B [NO-GO until verified]** on retry, `handleUnifiedStart` sends `reauth=required` + `max_age=0`
  to force fresh step-up — **blocked until we confirm `auth.yan.lk` honours `max_age=0`/`reauth=required`
  (vs standard `prompt=login`).**
- **A2C [GO]** replace the raw 400 with a branded **noindex/no-store HTML** page (reuse
  `safePublicAuthError` allowlist; do not echo raw error).
- Note: `reauth_required` also surfaces in `getUnifiedAnalystSession` (~755 → unauthenticated) and the
  legacy refresh path (~1289 → JSON error); both degrade gracefully. Phase-0 fixes the callback only.

## 4. Hardening (before widening CMS/admin)

1. **[GO — priority]** Remove committed `FALLBACK_SUPABASE_URL/ANON_KEY` (lines 7–8) → fail closed
   (503 `rights_lookup_unavailable`) if env missing. *Pre-flight (read-only): confirm `SUPABASE_URL` +
   service key are set as Worker secrets before removing the fallback.*
2. **[conditional GO]** CSRF token on state-changing admin routes — first verify whether
   `tokenSource:'unified_cookie'` is classified cookie-backed (else unified admin writes have no CSRF).
3. **[GO]** Same-origin CORS on writes (global OPTIONS returns `*`).
4. **[GO later]** `security_audit_events` (append-only; log denies; ip/ua hashed) — depends on #1's service key.
5. **[GO later]** Stop using `analyst.admin` as a skeleton key — enforce granular rights so support staff
   get least-privilege (e.g. `analytics.view` only).

## 5. PDPA / consent (Vinita)

Capture lawful basis per product membership (not global); audit logs never store raw tokens/IP/PII
(ip_hash/ua_hash only); one canonical Person makes access/erasure/portability tractable; members enrol
their own AAL2 factor (never transmit OTP/secret material).

## 6. Sunera & support staff (provisioning, when approved — in Yan-Vada, not Analyst)

Sunera = analyst product membership (active) + `analyst.admin.access` + `analyst.admin`, AAL2; record in
`security_audit_events`. Support staff get split least-privilege rights.

## Open questions (to Tech Team) — see tech-review doc
auth.yan.lk param contract (blocks A2B); unified-cookie CSRF classification; Worker secrets present;
token-vs-People precedence (People additive, overrides subtractive — confirmed); audit sink (Supabase vs CF).
