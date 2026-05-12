# Central Auth Constituent Audit And Adapter Contract

Date: 2026-05-12
Status: Analyst unified-auth adapter deployed; desktop and mobile authenticated browser QA passed; legacy fallback and stale Pages auth are disabled by default

Canonical upstream docs:

- `/Users/rizrazak/Code/yan/YAN_PEOPLE_IDENTITY_MODEL.md`
- `/Users/rizrazak/Code/yan/YAN_AUTH_CROSS_PLATFORM_ARCHITECTURE.md`
- `/Users/rizrazak/Code/yan/AUTH_YAN_LK_IMPLEMENTATION_PREP.md`

This document records the current Analyst, Yan-Vada, Yan auth, and Braincentre state found during the follow-up audit. It is not a replacement for the Yan canonical docs. It is the working bridge for product UI harmonisation and adapter implementation.

## Decision Lock

Use `auth.yan.lk` as the central identity broker. Products must not depend on cross-domain cookies. Each product receives a signed central assertion and mints its own product-local session cookie.

Target local cookies:

| Product | Target cookie | Current state |
| --- | --- | --- |
| `auth.yan.lk` | `__Host-yan_auth` | Implemented in dark Worker reference. Login UI/session creation is not live. |
| Yan-Vada | `__Host-yan_vada_session` | Implemented in unified adapter behind flags. Legacy Supabase cookie flow still exists. |
| Analyst | `__Host-analyst_session` | Deployed on the live base Worker. Legacy `sb-token` and `sb-refresh` remain only behind emergency `ANALYST_LEGACY_AUTH_ENABLED=true`. |
| Braincentre | `__Host-braincentre_session` | Not implemented. Product/auth direction must be locked before build. |

## Round 1: Current State

### Analyst

Current routes and surfaces:

| Surface | File/path | Current behavior |
| --- | --- | --- |
| Login UI | `/auth/login` and `/auth/unified/start` | Default sign-in redirects to `auth.yan.lk`; `public/login.html` is legacy rollback-only. |
| Session creation | `functions/collaborative-session.js` `/auth/unified/callback` | Verifies central state, nonce, PKCE, JWKS assertion, product, membership, AAL2, and `analyst.admin.access`, then sets `__Host-analyst_session`. `/auth/session` returns `410 legacy_auth_disabled` unless rollback is enabled. |
| Session state | `functions/collaborative-session.js` `/auth/me` | Checks the local unified session first and returns safe account/right state. Legacy Supabase cookie fallback is gated behind `ANALYST_LEGACY_AUTH_ENABLED=true`. |
| Logout | `/auth/logout` | Clears unified and legacy cookie variants, then redirects to `/auth/signed-out`. |
| Homepage account menu | `src/pages/HomePage.jsx` | Account section at top. Shows sign in, signed-in email, admin dashboard, profile/MFA, sign out. |
| Profile/security | `https://auth.yan.lk/login` | Product account links now point to central Yan. `public/profile.html` is retained only for emergency legacy rollback and redirects centrally by default. |
| Admin shell badge | `public/admin-preview.html` | Calls `/auth/me?right=analyst.admin.access`, shows email/AAL/right count, keeps private route state aligned with server auth. |
| Protected admin pages | Worker route | `/admin-preview.html`, `/admin-submissions.html`, and `/admin/` are gated server-side before static fetch. |

Confirmed Analyst fixes now in place:

- Admin static pages are protected server-side in the active Worker path.
- Duplicate/stale `sb-token` cookies are scored so AAL2/admin/fresh sessions win.
- Expired access cookies refresh from `sb-refresh` and rotate both cookies.
- Login no longer calls Supabase `signOut` after setting server cookies.
- Profile MFA setup now also clears only tab-local preauth state after server cookie sync, avoiding refresh-token revocation.

Analyst central migration status:

- `/auth/unified/start` and `/auth/unified/callback` are deployed on `analyst-collaborative-cms`.
- `https://analyst.rizrazak.com/login.html` and `?legacy=1` redirect to the unified start path unless emergency `ANALYST_LEGACY_AUTH_ENABLED=true` is set.
- The unified callback verifies state, nonce, PKCE token exchange, JWKS assertion, product, active membership, AAL2, and `analyst.admin.access` before minting `__Host-analyst_session`.
- Analyst admin pages/APIs require AAL2 and explicit `analyst.admin.access`; narrower scoped Analyst rights do not satisfy the admin gate.
- The live Worker uses the base script, not `--env production`; deploy with `npx wrangler deploy --env=""` unless production secrets are replicated into an env-suffixed Worker.

Analyst remaining gaps:

- Legacy product cookie fallback still exists behind emergency `ANALYST_LEGACY_AUTH_ENABLED=true`; remove the old Supabase login/profile UI after the emergency rollback window closes.
- Central Yan still needs a dedicated profile/security page beyond the current login/account-card surface.
- Legacy route OTP UI still exists in `admin-preview.html` even though server auth now gates the page.
- GitHub/CMS privileged writes must continue moving to server-held credentials and explicit `analyst.*` rights.

### Yan-Vada

Current routes and surfaces:

| Surface | File/path | Current behavior |
| --- | --- | --- |
| Sign-in UI | `web/src/pages/SignInPage.tsx` | Product-branded email magic link form. Google/Apple hidden. Central sign-in errors already named. |
| Client auth state | `web/src/contexts/AuthContext.tsx` | Calls `/api/auth/me`, stores only safe state in React. Some legal/NDA UI state remains in localStorage. |
| Legacy start | `web/functions/api/auth/start.js` | Magic link via Supabase. Legacy OAuth is gated by env flags and hidden by UI. |
| Legacy callback/confirm | `web/functions/_auth-complete.js` and related routes | Syncs/creates local `yan_vada_members`; pending users denied. |
| Local auth state | `web/functions/api/auth/me.js` | Checks unified session first, then legacy Supabase session. Returns safe member state and rights. |
| Logout | `web/functions/api/auth/logout.js` | Same-origin POST, signs out legacy Supabase session and clears unified cookie. |
| Unified start | `web/functions/api/auth/unified/start.js` | Behind `AUTH_UNIFIED_ENABLED=true`; creates signed attempt cookie with state/nonce/PKCE and redirects to `auth.yan.lk/authorize`. |
| Unified callback | `web/functions/api/auth/unified/callback.js` | Exchanges code, verifies JWKS assertion, requires active local member, creates `__Host-yan_vada_session`. |

Yan-Vada strengths:

- The unified adapter shape is close to the target product pattern.
- `__Host-yan_vada_session` is already used for the central flow.
- State, nonce, PKCE, issuer, audience, product, membership, and token use are validated.
- Product sign-in UI already hides Google/Apple and names central auth failure states.

Yan-Vada gaps before wider rollout:

- Unified adapter still depends on local `yan_vada_members` until People migration is complete.
- Unified session TTL is 30 minutes with no clear refresh/rotation model in the product adapter.
- AAL2 and fresh reauth are not yet enforced for high-risk Yan-Vada actions.
- Some tier/gate UI state remains in localStorage; backend rights must remain authoritative.
- Existing repo worktree has unrelated uncommitted changes, so any adapter edits should be isolated carefully.

### `auth.yan.lk`

Current implementation reference:

| Surface | File/path | Current behavior |
| --- | --- | --- |
| Worker | `/Users/rizrazak/Code/yan/apps/auth/src/index.ts` | Live Worker with `/login`, `/authorize`, `/token`, `/userinfo`, `/introspect`, `/logout`, OIDC config, JWKS, central MFA, and account cards. |
| Session cookie | `__Host-yan_auth` | Read by `/authorize`, revoked by `/logout`. |
| Code flow | `/authorize` and `/token` | Validates client, redirect URI, state, nonce, PKCE, local next path, product membership, and rights snapshot. |
| Assertion | ES256 JWT | `token_use=product_assertion`, product, membership, rights, AAL, nonce, issuer, audience, client id. |
| Data source | Yan People tables | Reads `people`, `product_memberships`, `access_bundles`, `right_overrides`, audit table. |

`auth.yan.lk` remaining gaps:

- Authenticated Analyst product-card QA is still pending after the Analyst card mapping deploy.
- Introspection requires a configured server token.
- Google/Apple provider linking, recovery, and Apple relay handling remain dark until central provider QA passes.

### Braincentre

Evidence from old Yan docs:

- The old `public/braincentre/index.html` monolith is treated as dead, not a refactor target.
- S14.1 says Braincentre v0.1 has zero active code and is blocked on component-level design, especially Chat, Kinnara Dashboard, and Decision Browser.
- There are two divergent Braincentre architecture docs. S14.1 recommends canonicalising the `02-architecture/` copy.
- Old Braincentre auth language mentions `role='admin'` plus a client-side PIN escape hatch. That is not compatible with the new People/rights model as a normal access strategy.

Braincentre auth/profile decision:

- Product key: `braincentre`.
- Required central rights should be product-prefixed, starting with `braincentre.admin.access`.
- Braincentre must use `auth.yan.lk` from the start, not a separate admin login or client-side PIN gate.
- Emergency override can exist only as a high-risk server-side action requiring AAL2/fresh reauth, audit logging, and an explicit `braincentre.emergency.override` right.
- Braincentre central UI should become the internal account/profile/People control surface, but product public UIs must still preserve their own brand boundaries.

## Round 2: Product Adapter Contract

Every product should converge on this local adapter contract. Existing paths can remain during migration if response semantics match.

| Endpoint | Method | Product responsibility |
| --- | --- | --- |
| `/auth/login?next=...` or product equivalent | GET | Create an auth attempt and redirect to `auth.yan.lk/authorize`. |
| `/auth/unified/start?next=...` | GET | Transitional explicit unified-auth start path where needed. |
| `/auth/callback?code=...&state=...` | GET | Verify attempt cookie, exchange code, verify assertion, mint product session, redirect to safe `next`. |
| `/auth/me` | GET | Return safe local account/session state. No secrets or raw tokens. |
| `/auth/me?right=<product.right>` | GET | Return whether the requested right is currently allowed. Fail closed for protected/admin surfaces. |
| `/auth/logout` | POST preferred, GET allowed for static compatibility | Clear local product session only. |
| `/auth/logout-global` | POST | Clear local session and redirect/call central `auth.yan.lk/logout`. |

Start flow requirements:

- Generate `state`, `nonce`, PKCE `code_verifier`, and `code_challenge` server-side.
- Store attempt data in an HttpOnly Secure SameSite=Lax cookie with a short TTL, or in server storage keyed by an opaque cookie.
- Allow only safe local `next` paths. Reject `//`, encoded external URLs, control characters, and backslashes.
- Redirect only to a registered `auth.yan.lk` client id and redirect URI.

Callback requirements:

- Require matching `state` and attempt cookie.
- Exchange the one-time code server-side with PKCE verifier.
- Verify JWKS signature, issuer, audience, expiry, `token_use`, nonce, product, membership status, AAL, and required rights.
- Reject replayed, expired, malformed, wrong-audience, wrong-product, or missing-nonce assertions.
- Create a product-local HttpOnly Secure SameSite=Lax `__Host-<product>_session` cookie with `Path=/` and no `Domain` attribute.
- Clear the auth attempt cookie on success and failure.

Product session payload requirements:

```json
{
  "typ": "product_session",
  "iss": "<product-origin>",
  "sub": "person_id",
  "email": "user@example.com",
  "product": "analyst",
  "membershipStatus": "active",
  "rights": ["analyst.admin.access"],
  "aal": 2,
  "reauthExpiresAt": "2026-05-11T12:15:00Z",
  "iat": 1778490000,
  "exp": 1778491800,
  "jti": "opaque-random-id"
}
```

Cookie rules:

- Use `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- Use `__Host-` cookies with no `Domain` attribute.
- Admin sessions should be short-lived and refresh/rotate server-side.
- Products must not expect `yan.lk` cookies to work on `rizrazak.com`, `dgtl.lk`, or vice versa.

`/auth/me` target response:

```json
{
  "authenticated": true,
  "user": {
    "id": "person_123",
    "email": "riz@dgtl.lk",
    "name": "Riz Razak"
  },
  "product": "analyst",
  "membership": {
    "status": "active",
    "memberKind": "admin"
  },
  "rights": ["analyst.admin.access"],
  "right": {
    "requested": "analyst.admin.access",
    "allowed": true
  },
  "aal": 2,
  "reauth": {
    "fresh": true,
    "expiresAt": "2026-05-11T12:15:00Z"
  }
}
```

Safe debug diagnostics may include counts, status, selected source, and failure reason. They must not include access tokens, refresh tokens, product session cookie values, OAuth tokens, TOTP secrets, GitHub tokens, service keys, or raw evidence content.

## Round 3: UI Harmonisation Contract

Shared behavior, product-specific visual skin:

| UI surface | Required behavior | Product-specific skin |
| --- | --- | --- |
| Sign-in entry | One clear sign-in action, safe `next`, central auth copy once enabled. | Analyst can stay editorial/minimal. Yan-Vada can stay neon/dark. Braincentre should use Bawa Earth/internal OS language. |
| Login card | Email/password or magic link only while central providers are dark. Google/Apple hidden until central QA passes. | Copy should name the product and what access unlocks. |
| Account menu/drawer | Near top of navigation. Logged out shows Sign in. Logged in shows email/name, product tools, profile/security, sign out. | Preserve product brand and avoid cross-product jargon in public surfaces. |
| Profile/security | Central profile and MFA should live at `auth.yan.lk` or Braincentre People UI. Product pages may link there. | Product account pages show only product-relevant membership/settings by default. |
| Admin/session badge | Protected admin shells show signed-in email, AAL, right count/status, and sign-out action. | Keep concise; no raw diagnostics in normal UI. |
| Logout | Product logout clears only local product session. Global logout revokes central auth and clears reachable local sessions. | Copy must make the distinction clear. |

Provider UI policy:

- Google and Apple buttons stay hidden until `auth.yan.lk` provider flows pass backend smoke tests.
- Apple Hide My Email relay addresses must not auto-map to invited accounts.
- Relay email sign-ins should become pending unless the relay address is explicitly linked or approved.

Braincentre central UI direction:

- Braincentre should host internal People/profile/rights/audit work over time.
- Product public account drawers should not expose every cross-product detail.
- Braincentre can show cross-product memberships, labels, rights, provider links, audit, and reauth state because it is the internal control surface.

## Rollout Order

1. Keep Analyst stabilization in place and verify the profile MFA setup fix in browser.
2. Complete authenticated Analyst browser QA for central login/MFA and local session handoff.
3. Keep emergency legacy auth disabled unless a rollback is needed.
4. Finish central provider QA before showing Google or Apple.
5. Make Braincentre a first-class `braincentre` product in Yan People before any Braincentre admin build goes live.
6. Enable Google centrally only after smoke tests pass.
7. Enable Apple later only after relay email and account-linking policy tests pass.

## Analyst Rollout Record

Completed through 2026-05-12:

- Deployed Analyst Worker `cdc63471-62e1-410b-bf6a-d8ad9d16de32` to `analyst-collaborative-cms`.
- Set `ANALYST_SESSION_SIGNING_SECRET` on the live base Worker without storing the value in repo.
- Applied Supabase migration `005_activate_analyst_auth_client.sql` to activate the `analyst` broker client.
- Deployed `yan-auth` Worker `9f58eb77-6b17-4d2c-8003-456941f974d8` with Analyst product-card routing to `/auth/unified/start?next=%2Fadmin-preview.html`.
- Verified `auth.yan.lk` health and deep health return `200`.
- Verified Analyst anonymous `/auth/me`, legacy fallback login, login/admin redirects into unified auth, start redirect to broker authorize, broker authorize redirect to central login, invalid callback fallback, and anonymous protected API denial.
- Deployed Analyst Worker `6627a375-8974-4348-838b-74156b82aa49` with fresh-reauth-capped product sessions, numeric/string AAL2 normalization, legacy cookie cleanup on unified callback, and preserved `next` fallback on callback errors.
- Deployed `yan-auth` Worker `f723c0a3-2357-4a1d-9d6b-2845f4867cb5` with QR-first MFA setup, non-blocking QR rendering, six-digit auto-submit, guarded enrollment/verification submits, token reauth freshness checks, and `max_age=0` loop prevention after MFA.
- Re-ran unauthenticated production smoke for auth health, deep health, OIDC metadata, JWKS, Analyst anonymous `/auth/me`, legacy fallback login, unified redirects, invalid callback fallback, and anonymous protected API denial.
- Completed desktop Chrome authenticated browser QA: central login/MFA returned to `/admin-preview.html` without a loop, `/auth/me?right=analyst.admin.access` returned `authenticated: true`, `admin: true`, `aal: "aal2"`, and `rights: ["analyst.admin.access"]`, and a same-origin protected session-lock mutation returned `200` for acquire and release.
- Deployed Analyst Worker `664854b9-0f39-4ef1-b816-3f6d96416993` to remove admin-preview console noise from missing Facebook panel handlers and invalid sparkline SVG coordinates; post-deploy unauthenticated smoke still passed.
- Deployed Analyst Worker `f807571d-65c4-4571-95bd-6e82e6b5c69c` so mobile callbacks that lose the short Analyst attempt cookie retry unified start once instead of falling into legacy login; post-deploy smoke confirmed missing-attempt callbacks redirect to `/auth/unified/start`.
- Completed mobile browser QA: central login/MFA returned to `/admin-preview.html`, the admin shell showed `AAL2` and the Analyst right, and `/auth/me?right=analyst.admin.access` returned `authenticated: true`, `admin: true`, `aal: "aal2"`, and `rights: ["analyst.admin.access"]`.
- Completed short safe production watch: 5 synthetic rounds across auth health, deep health, Analyst anonymous auth state, unified redirects, missing-attempt retry, and protected API denial passed with zero failures.
- Deployed Analyst Worker `1f3a810c-1efa-484e-8008-dd2043464163` to retire legacy login by default; `login.html?legacy=1` and `login.html?auth_callback=1` now redirect to unified start unless `ANALYST_LEGACY_AUTH_ENABLED=true` is explicitly set. Post-deploy smoke passed and exhausted missing-attempt retry now returns a no-store `400` error response instead of looping through legacy.
- Deployed Analyst Worker `0bc24eab-2614-484d-b3f8-e897a10e0a94` to remove the legacy OTP dev fallback that logged one-time codes when `RESEND_API_KEY` was missing; post-deploy smoke passed.
- Deployed Analyst Worker `10b63324-75b7-48ef-b98e-aab435205c6e` to route `/auth/logout` to `/auth/signed-out`, add `/auth/login`, clear unified retry cookies, return `410 legacy_auth_disabled` from `/auth/session`, and remove legacy fallback from unified-start failure. Post-deploy smoke passed.
- Deployed Analyst Worker `a574be31-68f7-43ee-af08-6ccd44710c0d` to redirect `/profile.html` to central Yan account by default while leaving it available only for emergency legacy rollback. Guarded dormant Pages Function auth files so accidental Pages-style deploys fail closed unless `ANALYST_LEGACY_AUTH_ENABLED=true` is deliberately set. Added `docs/analyst-auth-rollout-runbook.md` for deploy, smoke, and rollback steps, then dry-ran `wrangler versions deploy <version-id>@100 --env="" --dry-run` successfully.
- Deployed Analyst Worker `7d0387cc-e599-43a3-bff5-4532d9e0dadd` after the raw script-API GitHub workflow stripped Worker vars and disabled unified auth. The remediation replaced that workflow with `npx wrangler deploy --env=""`, restored central auth vars, gated cricket analytics/source-log pages behind central Analyst admin, and required central admin auth plus same-origin for legacy OTP endpoints. Post-deploy smoke confirmed unified redirects, legacy login redirect, private page gates, public case-file access, `410 legacy_auth_disabled`, and anonymous OTP denial.
- Deployed `yan-auth` Worker `7f2680b4-a6b3-4d91-8b21-3576edc4152b` to recover misplaced Analyst admin paths on the broker host by redirecting them to the Analyst unified start path.
- Deployed Analyst Worker `f389260d-daea-4db3-be4f-5ceaabbbf02c` to retry stale or missing Analyst auth callbacks once through `/auth/unified/start` while still failing closed after the retry guard is exhausted.
- Completed post-remediation desktop browser QA: central login/MFA returned to `/admin-preview.html`, the admin shell showed `riz@dgtl.lk`, `AAL2`, and the Analyst admin right, and authenticated `analytics.html` plus `sources.html` loaded after central auth.
- Verified the sign-out/re-entry path at HTTP level: `/auth/logout` redirects to `/auth/signed-out`, clears Analyst local auth cookies, `/auth/signed-out` is `200` with `Cache-Control: no-store`, and a fresh unauthenticated `/admin-preview.html` visit redirects to `/auth/unified/start?next=%2Fadmin-preview.html`.
- Completed a corrected 5-round sanitized production watch across `auth.yan.lk/healthz`, deep health, OIDC metadata, JWKS, Analyst logout, signed-out page, auth login/unified redirects, legacy login/profile redirects, private page gates, public case-file access, anonymous auth state, `POST /auth/session` legacy-disable response, and anonymous OTP denial with zero failures.
- Applied Supabase migration `006_auth_login_rate_limits.sql` to project `ogunznqyfmxkmmwizpfy` and deployed `yan-auth` Worker `1d1369ed-96ca-442e-a2a6-5c96bf53af23` with broker-side Magic Link send limits by hashed email, hashed IP, and hashed client/IP bucket. RPC smoke verified the second disposable attempt blocked with `Retry-After`, then cleanup verified zero disposable rows remained. Post-deploy broker/Analyst smoke and a 5-round production watch passed with zero failures.

Pending:

- Observe production for auth regressions during the emergency rollback window, then remove the old Supabase login/profile UI and related product cookie fallback code.
- Complete the browser-only sign-out click check from an authenticated desktop session, then revisit `/admin-preview.html` and confirm it returns to central auth rather than loading the dashboard.

## Stress Test Checklist

Required before central auth is considered ready:

- Expired product access session with valid refresh path does not loop.
- Duplicate/stale product cookies select the best valid admin/AAL2 session or fail closed.
- Product callback rejects replay, wrong state, wrong nonce, wrong audience, wrong product, and expired assertions.
- Logout clears only local product session.
- Global logout revokes central auth and forces products to renew or deny.
- Analyst password + MFA, magic link, profile MFA setup, and sign-out flows work in desktop and mobile browsers.
- Yan-Vada magic link and unified adapter work for approved users while pending/blocked users are denied cleanly.
- Rights removed centrally stop protected product access within the agreed SLA.
- Google/Apple UI remains hidden until central provider QA passes.
- Apple relay email cannot auto-claim an invited non-relay email account.
- Privileged Analyst CMS/GitHub writes use server-held credentials and explicit `analyst.*` rights.
- Braincentre emergency override requires `braincentre.emergency.override`, AAL2, fresh reauth, CSRF/same-origin protection, and audit logging.

## Immediate Follow-Ups

- Browser QA: complete the authenticated desktop sign-out/re-entry click check and confirm central Yan account/profile/security coverage before deleting legacy `profile.html`.
- Analyst code: decide whether to remove or demote the legacy OTP modal from `admin-preview.html` now that server auth gates the page.
- Analyst deploy: keep using the base Worker target (`npx wrangler deploy --env=""`) unless all production secrets are intentionally moved to an env-suffixed Worker.
- Yan auth: complete authenticated product-card QA for Analyst.
- Yan docs: canonicalize Braincentre architecture source and mark old client-side PIN/admin-role auth as superseded by Yan People rights.
