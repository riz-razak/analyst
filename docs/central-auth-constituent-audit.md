# Central Auth Constituent Audit And Adapter Contract

Date: 2026-05-11
Status: implementation audit and migration contract draft

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
| Analyst | `__Host-analyst_session` | Not implemented yet. Current production uses `sb-token` and `sb-refresh`. |
| Braincentre | `__Host-braincentre_session` | Not implemented. Product/auth direction must be locked before build. |

## Round 1: Current State

### Analyst

Current routes and surfaces:

| Surface | File/path | Current behavior |
| --- | --- | --- |
| Login UI | `public/login.html` | Password, magic link fallback, MFA step, Google/Apple hidden. Posts AAL2 tokens to `/auth/session`. |
| Session creation | `functions/collaborative-session.js` `/auth/session` | Same-origin POST, verifies Supabase JWT and AAL2, checks Analyst People rights, sets `sb-token` and `sb-refresh`. |
| Session state | `functions/collaborative-session.js` `/auth/me` | Checks cookies/bearer token, refreshes from `sb-refresh`, returns safe account/right state and optional safe debug diagnostics. |
| Logout | `/auth/logout` | Clears `sb-token` and `sb-refresh` variants, redirects to login. |
| Homepage account menu | `src/pages/HomePage.jsx` | Account section at top. Shows sign in, signed-in email, admin dashboard, profile/MFA, sign out. |
| Profile/security | `public/profile.html` | Supabase browser session is still needed for MFA enrollment/password change. Server cookie is synced via `/auth/session`. |
| Admin shell badge | `public/admin-preview.html` | Calls `/auth/me?right=analyst.admin.access`, shows email/AAL/right count, keeps private route state aligned with server auth. |
| Protected admin pages | Worker route | `/admin-preview.html`, `/admin-submissions.html`, and `/admin/` are gated server-side before static fetch. |

Confirmed Analyst fixes now in place:

- Admin static pages are protected server-side in the active Worker path.
- Duplicate/stale `sb-token` cookies are scored so AAL2/admin/fresh sessions win.
- Expired access cookies refresh from `sb-refresh` and rotate both cookies.
- Login no longer calls Supabase `signOut` after setting server cookies.
- Profile MFA setup now also clears only tab-local preauth state after server cookie sync, avoiding refresh-token revocation.

Analyst gaps before central migration:

- Product cookie still uses `sb-token` and `sb-refresh`, not `__Host-analyst_session`.
- No `/auth/unified/start` or `/auth/unified/callback` adapter yet.
- `profile.html` security actions still depend on a temporary Supabase browser session.
- Legacy route OTP UI still exists in `admin-preview.html` even though server auth now gates the page.
- GitHub/CMS privileged writes must continue moving to server-held credentials and explicit `analyst.*` rights.
- Active deploy uses `functions/collaborative-session.js`; `wrangler.toml` still points at a different entry, so deployment source drift remains.

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
| Worker | `/Users/rizrazak/Code/yan/apps/auth/src/index.ts` | Dark Worker with `/authorize`, `/token`, `/userinfo`, `/introspect`, `/logout`, OIDC config, JWKS. |
| Session cookie | `__Host-yan_auth` | Read by `/authorize`, revoked by `/logout`. |
| Code flow | `/authorize` and `/token` | Validates client, redirect URI, state, nonce, PKCE, local next path, product membership, and rights snapshot. |
| Assertion | ES256 JWT | `token_use=product_assertion`, product, membership, rights, AAL, nonce, issuer, audience, client id. |
| Data source | Yan People tables | Reads `people`, `product_memberships`, `access_bundles`, `right_overrides`, audit table. |

`auth.yan.lk` gaps:

- `/login` returns `login_not_enabled`; the central user-facing login/MFA UI is not live.
- Auth session creation is not visible in the dark Worker reference yet.
- Client registry and People tables must exist in the target Supabase project before real product traffic.
- Introspection requires a configured server token.
- Provider linking, recovery, Apple relay handling, and central profile UI are not implemented yet.

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
2. Resolve the Analyst Worker deploy-source drift so the active Worker entry is unambiguous.
3. Finish `auth.yan.lk` dark login/session creation and client registry.
4. Smoke-test `auth.yan.lk` authorize/token/JWKS/userinfo with a non-production client.
5. Enable Yan-Vada unified adapter behind `AUTH_UNIFIED_ENABLED=true` in a controlled environment.
6. Add Analyst `/auth/unified/start` and `/auth/unified/callback` behind `ANALYST_UNIFIED_AUTH_ENABLED=false`.
7. Migrate Analyst from `sb-token`/`sb-refresh` to `__Host-analyst_session` after parallel soak.
8. Make Braincentre a first-class `braincentre` product in Yan People before any Braincentre admin build goes live.
9. Enable Google centrally only after smoke tests pass.
10. Enable Apple later only after relay email and account-linking policy tests pass.

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

- Browser QA: enroll MFA from Analyst `profile.html?setup_mfa=1` and confirm the session survives access-token expiry without a login loop.
- Analyst code: decide whether to remove or demote the legacy OTP modal from `admin-preview.html` now that server auth gates the page.
- Analyst deploy: align `wrangler.toml` with the deploy workflow's active `functions/collaborative-session.js` entry.
- Yan auth: implement central login/session creation for the dark Worker.
- Yan docs: canonicalize Braincentre architecture source and mark old client-side PIN/admin-role auth as superseded by Yan People rights.
