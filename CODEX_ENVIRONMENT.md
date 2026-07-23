---
title: "The Analyst Codex Environment"
owner: "Riz Razak"
status: active
created: "2026-05-18"
tags: [codex, environment, setup, validation, analyst]
---

# The Analyst Codex Environment

## Purpose

Use this when creating a Codex environment for `/Users/rizrazak/Code/the-analyst`, the publication/app repo for `analyst.rizrazak.com`.

This is separate from the Yan full-codebase environment and separate from the research workspace.

## Required Codex UI Settings

| Setting | Value | Reason |
|---|---|---|
| Project path | `/Users/rizrazak/Code/the-analyst` | This repo has a valid `main` branch. |
| Approval policy | `On request` | Safe default for edits and commands. |
| Sandbox settings | `Workspace write` | Required because setup runs `npm ci` and validation writes `dist/`. |
| Codex dependencies | Enabled | Lets Codex expose bundled Node.js/Python tools if needed. |

Do not use `Read only` for normal Analyst work. It is only useful for pure review sessions.

## Setup Script

Paste this into the Codex `Setup script` field.

```bash
set -euo pipefail

cd "${CODEX_WORKTREE_PATH:-$PWD}"
bash scripts/codex/setup.sh
```

## Cleanup Script

Paste this into the Codex `Cleanup script` field.

```bash
set -euo pipefail

cd "${CODEX_WORKTREE_PATH:-$PWD}"
bash scripts/codex/cleanup.sh
```

## Recommended Actions

| Action | Command |
|---|---|
| Validate Analyst | `bash scripts/codex/validate.sh` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Diff Check | `git diff --check` |

## Safety Rules

| Rule | Reason |
|---|---|
| Active research stays in `/Users/rizrazak/Code/research` | Analyst is publication/deployment repo. |
| Do not publish orphan numbers | Public numbers need source ID, claim ID, or model field. |
| Do not expose unreleased Yan project details | Analyst is public-facing. |
| Never print `.env` or `.env.local` | They are ignored secrets. |
| Never deploy from setup | Deployment requires explicit user instruction. |

## Validation Scope

Default validation runs:

```text
npm run lint
npm run build
git diff --check
```
