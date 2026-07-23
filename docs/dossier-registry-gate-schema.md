---
title: "Dossier Registry Gate Schema"
date: "2026-06-27"
status: "active"
owner: "Priya #9 · Vidura #32 · Nuwan #42"
tags: ["dossiers", "registry", "publication-gate", "source-register", "claim-register"]
---

# Dossier Registry Gate Schema

`public/data/dossiers.json` is a public catalogue, not the source of truth. Active research, source registers,
claim registers, language reviews, and gate decisions remain in `/Users/rizrazak/Code/research`.

The registry now carries enough gate metadata for the Analyst shell and future QA to avoid treating a public
page as equivalent to a fully open research gate.

Required per-dossier fields:

| Field | Meaning |
|---|---|
| `sourceState` | Human-readable source posture. |
| `gateState` | `hold`, `hidden-hold`, `safe-surface`, `publish-ready`, or `legacy-needs-manifest`. |
| `gateArtifact` | Path to the gate/release decision when mapped. |
| `sourceRegister` | Path to the canonical source register when mapped. |
| `claimRegister` | Path to the canonical claim register when mapped. |
| `languageState` | Language-gate status for public text. |
| `lastSourceRefresh` | Last known source refresh date, or `null` if unmapped. |
| `blockedClaimsSummary` | Public-safe summary of claims intentionally not promoted. |

`status` still controls public shell visibility. The React shell should list only `status: "published"`.
Hidden, held, or internal entries must stay accessible only through explicit admin/review paths.

