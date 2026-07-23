---
title: "Yan News Rename Reset Session Handoff"
date: "2026-07-23"
package: "YAN-NEWS-RENAME-RESET-STOCKTAKE-01"
status: "handoff for next Codex or Claude session"
---

# Yan News Rename Reset Session Handoff

## Mission

Continue the Yan News rename/reset programme from current main:

`/Users/rizrazak/Code/the-analyst`

Yan News is the locked future public/product name and direction. The current production/runtime surface
remains The Analyst at `analyst.rizrazak.com` until separate gates approve migration.

## Read First

1. `/Users/rizrazak/Code/yan/SESSION_LEDGER.md`
2. `/Users/rizrazak/Code/yan/FOUNDER_LOCK.md`
3. `/Users/rizrazak/Code/yan/YAN.md`
4. `/Users/rizrazak/Code/yan/COUNCIL_MANIFEST.md`
5. `/Users/rizrazak/Code/yan/COUNCIL_OPERATING_MODEL.md`
6. `/Users/rizrazak/Code/the-analyst/Yan-Analyst.md`
7. `/Users/rizrazak/Code/the-analyst/CODEX_ENVIRONMENT.md`
8. This package:
   - `current-source-and-worktree-authority.md`
   - `yan-news-identifier-and-surface-register.csv`
   - `yan-news-dependency-graph.json`
   - `analyst-to-yan-news-lineage-register.csv`
   - `yan-news-workstream-and-gate-register.csv`
   - `yan-news-founder-decision-brief.md`
   - `yan-news-session-handoff.md`
   - `yan-news-r1-review.html`

## Current Baseline

Current main at package creation:

- branch: `main`
- HEAD: `a850a97d485dd3e5ad19d3ee726638d3056a0df5`
- dirty paths at final package QA: `package-lock.json`, `scripts/publish.sh`,
  `public/2026-al-cohort/index.html`

Older 2dee worktree:

- path: `/Users/rizrazak/.codex/worktrees/2dee/the-analyst`
- detached HEAD: `74287013a65a0f9074bfe44cfb0b0559abd3433a`
- dirty entries: 56
- disposition: evidence/archive only

## Current Locks

- Future name/direction: `Yan News`
- Public runtime: still `analyst.rizrazak.com`
- Repo: still `riz-razak/analyst`
- Auth issuer: `auth.yan.lk`
- Auth client: still `analyst`
- Rights: still `analyst.*`
- Admin right: still `analyst.admin.access`
- Local cookie: still `__Host-analyst_session`
- Worker route: still `analyst.rizrazak.com/*`

## Cross-DGTL Correction

Task `019e3d6c-5c56-7c80-b793-9f4615ecebab` is golab, not The Analyst. It can provide shared
`auth.yan.lk` and company-policy evidence only. It grants no Yan News product, rename, UI, data,
runtime, or migration authority.

## Next Recommended Package

Prepare a display-only candidate plan from current main.

Do not implement until the candidate has an exact file allowlist. The expected allowlist should be
limited to public brand and review surfaces. It must not include:

- `wrangler.toml`
- `functions/**`
- `.github/workflows/**`
- `public/CNAME`
- `public/data/dossiers.json` unless a registry label-only change is explicitly approved
- dossier slugs or IDs
- auth docs except as constraints
- generated `dist/**`

## Validation When Implementation Starts

After any later code or public-surface change:

```bash
git diff --check
npm run lint
npm run build
bash scripts/codex/validate.sh
```

For auth/domain/Worker packages, add the runbook smoke tests and `npx wrangler deploy --env="" --dry-run`.

## Do Not

- Do not self-assign a session number without `SESSION_LEDGER.md` and Priya/founder gate.
- Do not use special agents. Use Yan Agent Council (the Suite) seats only.
- Do not merge or reset 2dee.
- Do not deploy.
- Do not change auth/domain/CMS/data/service IDs in a display-only package.
- Do not write Sinhala/Tamil from LLM memory.
- Do not expose unreleased Yan project details publicly.
