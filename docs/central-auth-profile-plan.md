# Central Yan/DGTL Auth And Profile Plan

Date: 2026-05-10
Status: steering/tech alignment draft

## Immediate Analyst Finding

Analyst sessions are not IP- or device-identified today. They are browser-profile cookies on `analyst.rizrazak.com`.

The current breakdown was product-local session hygiene:

- Login writes an HttpOnly `sb-token` access cookie and `sb-refresh` refresh cookie.
- `/auth/me`, the homepage menu, and login auto-redirect only trusted `sb-token`.
- When `sb-token` expired but `sb-refresh` still existed, an already-open admin tab could appear active while new tabs fell back to login.
- `login.html` also called Supabase `signOut({ scope: 'local' })` after setting server cookies, which can revoke the refresh token that the server cookie needs.
- The correct short-term fix is to refresh the server session from `sb-refresh`, rotate both cookies, and then continue without forcing a new sign-in.

## Direction

Use `auth.yan.lk` as the standard identity broker for Yan and DGTL platforms. Product UIs can keep local visual treatment, but sign-in, MFA, account profile, provider linking, and access labels should flow through one central account model.

Product domains should still mint local, product-scoped sessions after central auth completes. Do not rely on cross-domain cookie sharing between `yan.lk`, `rizrazak.com`, and DGTL properties.

## Source Of Truth

Central account service:

- Owns identity, MFA enrollment, provider linking, recovery, and profile data.
- Owns canonical user id, emails, phone numbers, display name, avatar, locale, security settings, and audit labels.
- Owns platform access labels such as `yan.member`, `analyst.admin.access`, `vada.publisher`, and future Braincentre labels.

Product services:

- Request central sign-in with `app`, `scope`, `next`, and `nonce`.
- Receive a signed central assertion from `auth.yan.lk`.
- Verify assertion server-side.
- Mint a local `__Host-<product>_session` cookie scoped only to that product domain.
- Fetch profile/access labels from central APIs as needed, with cache and fail-closed behavior for protected admin paths.

## Target Flow

1. User clicks Sign in inside Analyst, Vada, or another DGTL/Yan app.
2. Product redirects to `https://auth.yan.lk/login?app=<app>&next=<callback>&scope=<scope>&nonce=<nonce>`.
3. `auth.yan.lk` handles passwordless/password/provider/MFA according to central policy.
4. `auth.yan.lk` returns a signed assertion to the product callback.
5. Product verifies issuer, audience, expiry, nonce, AAL, and rights.
6. Product creates a local HttpOnly Secure SameSite session cookie.
7. Product UI asks its local `/auth/me` for account state and renders account/profile controls.

## Product UI Standard

- Account controls must be near the top of every menu/drawer.
- Logged out state: show Sign in and explain what it unlocks.
- Logged in state: show account identity, Profile, Security/MFA, product admin/tools if authorized, and Sign out.
- Sign out must clear only the local product session by default.
- Sign out everywhere must call central auth revocation and then clear all reachable local sessions.

## Review Rounds

Round 1, audit:

- Tech: inventory every app login, callback, cookie, `/auth/me`, logout, MFA, and profile path.
- Design/Priya/Nuwan: inventory account UI placement and copy across product menus.
- Steering: confirm `auth.yan.lk` as broker and central profile as source of truth.

Round 2, plan:

- Tech: define assertion schema, local session schema, refresh/revocation behavior, and migration path.
- Design/Priya/Nuwan: define shared account drawer/profile modules with product-specific skins.
- Steering: approve rollout order and policy for Google/Apple central provider enablement.

Round 3, alignment:

- Tech and steering: lock acceptance criteria, monitoring, rollback, and incident procedure.
- Product/design: lock final user copy for sign-in, account, MFA, and sign-out flows.

## Stress Tests

Stress test 1, session continuity:

- Sign in to one product, open another tab, refresh after access token expiry, verify no login loop.
- Test expired access cookie with valid refresh cookie.
- Test duplicate stale cookies.
- Test product callback replay and nonce mismatch.
- Test browser refresh, hard reload, and mobile WebView behavior.

Stress test 2, cross-platform identity and profile:

- Sign in via `auth.yan.lk`, then enter Analyst, Vada, and one DGTL app without re-entering credentials unless AAL/scopes require it.
- Update central profile and verify product UIs reflect the same identity.
- Add/remove access labels centrally and verify product sessions re-check rights safely.
- Test sign out locally and sign out everywhere.
- Test Google/Apple hidden until central provider QA passes.

## Major Todo

Build the central Yan/DGTL account and profile service before onboarding more sub-platform logins. Product-level auth forms should become visual wrappers around the central flow, not independent auth systems.
