# Analyst Auth Rollout Runbook

Date: 2026-05-12

## Production Target

- Live Worker: `analyst-collaborative-cms`.
- Live route: `analyst.rizrazak.com/*`.
- Deploy production from the base Worker config only: `npx wrangler deploy --env=""`.
- Do not deploy production with `--env production` unless production secrets are intentionally replicated to that environment.

## Current State

- Central auth is the default path through `auth.yan.lk`.
- Analyst mints product-local `__Host-analyst_session` cookies from central product assertions.
- Legacy Supabase login/session code is disabled unless `ANALYST_LEGACY_AUTH_ENABLED=true` is deliberately set.
- `public/login.html` and `public/profile.html` remain in the repo only for emergency legacy rollback.

## Pre-Deploy Checks

Run from `/Users/rizrazak/Code/the-analyst`:

```bash
git status --short
npm run lint
npm run build
git diff --check
npx wrangler deploy --env="" --dry-run
```

## Deploy

```bash
npx wrangler deploy --env=""
```

Record the returned Worker version ID in `docs/central-auth-constituent-audit.md`.

## Smoke Tests

Use browser-like requests where needed and never print cookies, authorization codes, callback URLs with `code=`, tokens, or TOTP material.

Minimum unauthenticated checks:

- `/auth/logout` returns `302` to `/auth/signed-out` and clears local auth cookies.
- `/auth/signed-out` returns `200` with `Cache-Control: no-store`.
- `/auth/login?next=%2Fadmin-preview.html` redirects to `/auth/unified/start`.
- `/auth/unified/start?next=%2Fadmin-preview.html` redirects to `https://auth.yan.lk/authorize`.
- `/auth/session` returns `410 legacy_auth_disabled` while legacy auth is disabled.
- `/auth/me?right=analyst.admin.access` returns a safe unauthenticated state without a session.
- `/profile.html` redirects to `https://auth.yan.lk/login` while legacy auth is disabled.

Authenticated browser checks:

- Central login plus MFA returns to `/admin-preview.html` without a loop.
- `/auth/me?right=analyst.admin.access` returns `authenticated: true`, `admin: true`, AAL2, and `analyst.admin.access`.
- A protected same-origin admin mutation succeeds only after the central session is present.

## Rollback

Prefer feature rollback before version rollback:

1. If only legacy Supabase auth must be restored, set `ANALYST_LEGACY_AUTH_ENABLED=true` on the live base Worker and redeploy the base Worker. Confirm `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_KEY` are still present. Do not expose Google/Apple provider UI.
2. If the deployed Worker version itself is bad, list recent versions with `npx wrangler versions list --env=""`.
3. Rehearse the selected rollback version with `npx wrangler versions deploy <version-id>@100 --env="" --dry-run`.
4. Roll traffic back with `npx wrangler versions deploy <version-id>@100 --env="" --yes --message "Rollback Analyst auth"`.
5. Run the smoke tests again and record the rollback version ID.

Disable `ANALYST_LEGACY_AUTH_ENABLED` as soon as central auth is restored.
