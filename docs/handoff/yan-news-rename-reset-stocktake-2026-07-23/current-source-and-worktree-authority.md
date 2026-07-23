---
title: "Yan News Rename Reset Stocktake - Current Source And Worktree Authority"
date: "2026-07-23"
package: "YAN-NEWS-RENAME-RESET-STOCKTAKE-01"
status: "R0 baseline and R1 authority packet"
owner: "Priya #9 with Vidura #14, Ridma #11, Nuwan #12, Senevi #5"
---

# Current Source And Worktree Authority

## Founder Direction

`Yan News` is locked as the accepted future public/product name and direction.

This lock authorizes R0/R1 stocktake and planning only. It does not authorize repo rename, domain/DNS
change, auth/client/right/cookie migration, Worker/service identity change, CMS/data migration, dossier
slug/ID change, deployment, public promotion, feed movement, legal/publisher conclusion, or cleanup.

Immediate priority: Yan News rename stocktake.

## Source Authority

| Surface | Path | State | Authority |
|---|---|---|---|
| Current product checkout | `/Users/rizrazak/Code/the-analyst` | branch `main`, HEAD `a850a97d485dd3e5ad19d3ee726638d3056a0df5` | canonical current source |
| Older Codex worktree | `/Users/rizrazak/.codex/worktrees/2dee/the-analyst` | detached HEAD `74287013a65a0f9074bfe44cfb0b0559abd3433a` | evidence/archive only |
| Research workspace | `/Users/rizrazak/Code/research` | canonical research/provenance workspace | source authority for claims and numbers |
| Yan control plane | `/Users/rizrazak/Code/yan` | read-only context for this package | shared governance/auth policy only |

Current main is 123 commits ahead of the 2dee base commit.

## Current Main Dirty Paths

Current main had two dirty paths at initial R0 capture, and three dirty paths at final package QA:

| Path | State | Owner | Treatment |
|---|---|---|---|
| `package-lock.json` | modified | pre-existing/unowned in this package | do not touch in R0/R1 |
| `scripts/publish.sh` | modified | pre-existing/unowned in this package | do not touch in R0/R1 |
| `public/2026-al-cohort/index.html` | modified | observed dirty at final QA; unowned in this package | do not touch in R0/R1 |

No R0/R1 file in this package depends on these dirty paths.

## Key Hashes

| Path | SHA-256 | Meaning |
|---|---|---|
| `/Users/rizrazak/Code/the-analyst/Yan-Analyst.md` | `3f7c118960e648fb62e9b8963f04a70193f66f3124ee7ce9e7ad964989590726` | current Analyst instruction authority |
| `/Users/rizrazak/Code/the-analyst/CODEX_ENVIRONMENT.md` | `962c024cc143067fc40b0c13ec1f91192a9b5ad1518e24739ddfdfd602ad6f90` | current Codex environment authority |
| `/Users/rizrazak/.codex/worktrees/2dee/the-analyst/Yan-Analyst.md` | `ce2423fa9a674fe4e24c355e31ae9444b37ceddff6479e32d31930b633fd40d8` | stale 2dee instruction file |

## 2dee Dirty Inventory

The 2dee worktree is not disposable, but it is not current authority.

| Count | State |
|---:|---|
| 41 | modified |
| 2 | deleted |
| 13 | untracked |
| 56 | total dirty entries |

Notable 2dee evidence categories:

- public reader shell and dossier page UI changes
- Session 1.1 homepage/feed/wall work
- Mullivaikkal Option 1 shell/menu/evidence UI lineage
- preview/mockup registers and approval packets
- business/dashboard planning artifacts
- admin/CMS/auth hardening notes
- deleted `src/components/Header.jsx` and `src/components/Footer.jsx` in the stale tree

## Current Runtime Contracts To Preserve By Default

| Contract | Current value | R1 treatment |
|---|---|---|
| Public domain | `analyst.rizrazak.com` | retain until domain gate |
| GitHub repo | `riz-razak/analyst` | retain until repo gate |
| Worker route | `analyst.rizrazak.com/*` | retain until Worker/domain gate |
| Auth issuer | `https://auth.yan.lk` | retain |
| Auth client | `analyst` | retain until central-auth gate |
| Local session cookie | `__Host-analyst_session` | retain until central-auth gate |
| Required admin right | `analyst.admin.access` | retain until central-auth gate |
| Dossier registry | `public/data/dossiers.json` | retain IDs/slugs until corpus gate |
| Translation project label | `yan-news-503217` | infrastructure lineage only; not public rename proof |

## Cross-DGTL Correction

Task `019e3d6c-5c56-7c80-b793-9f4615ecebab` is `golab`, not The Analyst. It may supply shared
`auth.yan.lk` and company-policy dependency evidence only. It grants no Yan News product, rename, UI,
data, runtime, or migration authority.

## Reconciliation Recommendation

Recommendation: archive-reference 2dee and selectively extract concepts into current-main registers.

Do not:

- merge 2dee into current main
- reset or clean 2dee
- copy current main over 2dee
- cherry-pick broad stale UI/auth/admin changes
- run a global search-and-replace from Analyst to Yan News

Allowed after explicit package approval:

- cite 2dee preview and UI documents as lineage
- map useful ideas into the Yan News lineage register
- build a clean current-main display-only candidate with explicit allowlisted files
- leave all runtime/auth/domain/CMS/data identifiers unchanged in the first candidate

## R0/R1 Package Boundary

R0 captured source authority, current dirty state, stale worktree state, runtime contracts, hard stops,
and rollback requirements.

R1 defines identifier surfaces, dependency graph, lineage disposition, workstream gates, and founder
decisions for a display-only candidate.

No implementation package is authorized by this file.
