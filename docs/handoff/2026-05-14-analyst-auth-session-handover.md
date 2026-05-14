# 2026-05-14 Analyst Auth Session Handover

## Status

Analyst central auth is live and should remain the default path for admin/private access.

This handover keeps Analyst product state separate from Yan central-auth architecture. Use Yan docs for broker contracts and this file for Analyst-specific rollout, QA, rollback, and next checks.

## Current Production State

| Area | State |
| --- | --- |
| Live Worker | `analyst-collaborative-cms` on `analyst.rizrazak.com/*`. |
| Deploy target | Base Worker only: `npx wrangler deploy --env=""`. |
| Central broker | `auth.yan.lk`. |
| Local session | `__Host-analyst_session`. |
| Required right | `analyst.admin.access`. |
| Required assurance | AAL2 for admin/private surfaces. |
| Legacy auth | Disabled by default unless `ANALYST_LEGACY_AUTH_ENABLED=true`. |
| Legacy login/profile UI | Retained only for emergency rollback. |
| Private cricket pages | Gated by central Analyst admin session. |

Related Yan design debt audit: `/Users/rizrazak/Code/yan/synthesis/S14.2_UI_DEBT_DESIGN_TEAM_2ROUNDS.md`.

## Scope Boundary

- Analyst repo owns product-specific auth rollout state, deploy steps, smoke checks, and rollback notes.
- Yan repo owns the central `auth.yan.lk` broker, People/product rights model, OTP/Magic Link policy, and product adapter contract.
- Do not copy central secrets, callback URLs with `code=`, cookies, OTPs, Magic Links, `state`, or `nonce` into Analyst docs.

## Round 1: Steering Inventory

Steering question: is Analyst current enough to hand over without reopening central auth work?

### Accepted Current State

- Analyst uses central auth by default.
- `/auth/login` and `/auth/unified/start` redirect to `auth.yan.lk`.
- `/auth/unified/callback` verifies the central assertion before minting `__Host-analyst_session`.
- `/auth/me?right=analyst.admin.access` is the safe status endpoint for admin shell checks.
- `/auth/logout` clears local Analyst auth and returns to `/auth/signed-out`.
- `/profile.html` redirects to central Yan account/security by default.
- `POST /auth/session` returns `410 legacy_auth_disabled` while legacy auth is disabled.
- Anonymous legacy OTP endpoints deny access.

### Steering Holds

- Do not remove emergency legacy rollback code until the rollback window closes.
- Do not show Google/Apple UI until central provider QA passes in Yan.
- Do not move CMS/GitHub privileged writes into browser-held credentials.

### Steering Verdict

Analyst is handover-ready for central auth operations. Future work should be stabilization, regression response, or cleanup of legacy surfaces, not new auth design.

## Round 2: Tech And Security Audit

Tech question: does Analyst fail closed and preserve the central adapter contract?

| Check | Result | Notes |
| --- | --- | --- |
| Start route | Pass | Creates a broker redirect through `/auth/unified/start`. |
| Callback | Pass | Verifies state, nonce, PKCE, JWKS assertion, product, membership, AAL2, and `analyst.admin.access`. |
| Cookie | Pass | Product session is local to `analyst.rizrazak.com` as `__Host-analyst_session`. |
| Admin gate | Pass | Admin/private pages require central Analyst admin session. |
| Legacy fallback | Controlled | Disabled by default and available only by deliberate env flag rollback. |
| Deployment | Pass with rule | Use Wrangler base deploy; raw script API deploy can drop vars and break unified auth. |
| Private cricket pages | Pass | Analytics/source-log pages are gated; public case-file remains public. |
| Redaction | Pass | QA and docs should record only safe statuses, never auth artifacts. |

### Security Stop Gates

- Do not deploy with `--env production` unless production secrets are intentionally replicated there.
- Do not use raw script API upload for production Worker deployment.
- Do not expose legacy login/profile UI as normal navigation.
- Do not collect screenshots containing codes, callback URLs, cookies, tokens, TOTP setup material, `state`, or `nonce`.
- Do not enable provider buttons until central provider QA and Apple relay policy pass.

## Round 3: Records Consolidation

### Analyst Canonical Files

| File | Purpose |
| --- | --- |
| `docs/central-auth-constituent-audit.md` | Analyst central-auth rollout status and adapter audit. |
| `docs/analyst-auth-rollout-runbook.md` | Deploy, smoke, and rollback procedure. |
| `docs/central-auth-profile-plan.md` | Historical product-auth/profile direction; use as background, not latest rollout record. |
| `docs/handoff/2026-05-14-analyst-auth-session-handover.md` | This current session handover. |

### Yan References To Read Only When Needed

| Yan file | Use |
| --- | --- |
| `/Users/rizrazak/Code/yan/apps/auth/README.md` | Broker operations and route behavior. |
| `/Users/rizrazak/Code/yan/apps/auth/EMAIL_MIGRATION_RUNBOOK.md` | OTP and Magic Link migration state. |
| `/Users/rizrazak/Code/yan/02-architecture/CENTRAL_AUTH_PRODUCT_ADAPTER_REVIEW_PACK.md` | Product adapter contract. |
| `/Users/rizrazak/Code/yan/synthesis/S14.2_AUTH_OPS_CLOSEOUT_HANDOVER.md` | Session closeout and future-reference boundary. |

### Records Verdict

Analyst product state is current enough for a future agent to pick up without reading the entire Yan auth history first. Start with this file, then the runbook, then the central-auth audit.

## Round 4: Prep And Acceptance

### Next Analyst Checks

1. Complete browser-only sign-out click check from an authenticated desktop session.
2. Revisit `/admin-preview.html` after sign-out and confirm it returns to central auth instead of loading the dashboard.
3. Continue observing production during the emergency rollback window.
4. After the rollback window closes, remove or demote old Supabase login/profile surfaces and related product cookie fallback code.
5. Decide whether to remove or demote the legacy OTP modal from `admin-preview.html` now that server auth gates the page.
6. Keep private cricket analytics/source-log pages behind the same central admin session.
7. Apply the UI debts from the Yan design-team audit when the next Analyst UI/auth cleanup session opens.

### Verification Commands For Analyst Repo

Run from `/Users/rizrazak/Code/the-analyst`:

```bash
npm run lint
npm run build
git diff --check
```

### Acceptance Criteria

- Authenticated central login/MFA returns to `/admin-preview.html` without a loop.
- `/auth/me?right=analyst.admin.access` returns authenticated admin state with AAL2 and the Analyst admin right.
- Product logout clears local Analyst session and lands on `/auth/signed-out` with `Cache-Control: no-store`.
- Fresh unauthenticated admin/private visits redirect to central auth.
- Legacy paths fail closed unless rollback is deliberately enabled.

## Final Handover Verdict

Analyst auth handover is current. Future Analyst work should treat central auth as live infrastructure and avoid redesigning the login system unless Yan central-auth contracts change.
