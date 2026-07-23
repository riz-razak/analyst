---
title: "Council Operating Model — The Analyst (project replica)"
date: "2026-06-19"
status: "project-replica of central model; Owner-12 proposed-for-ratification"
central_source: "yan/COUNCIL_OPERATING_MODEL.md (referenced by YAN.md)"
scope: "Per-project replica for The Analyst; inherits the central Yan model + journalism specialists"
tags: ["council", "governance", "yan", "operating-model", "agents", "analyst"]
---

# Council Operating Model — The Analyst (project replica)

> Per-project replica of the central **`yan/COUNCIL_OPERATING_MODEL.md`** (referenced by `YAN.md`).
> Inherits the central model; adds Analyst journalism specialists. Central file is the source of truth.

How we run councils across Yan and every Yan service. The model has **one standing body** that runs by
default and **on-demand bodies** convened by need, shape, or explicit call. It applies at three levels:
the macro `YAN.md` layer, each project's instruction file, and each individual prompt / task / agent-task.

> **Roster note:** Yan has a **25+ agent council**. Agent identities are canonical and must **never be
> invented**. The full roster lives in `COUNCIL_MANIFEST.md` (Yan repo, Ring 0 for agent identity).
> This doc defines the *mechanism*; the named **Owner-12** mapping below is the current project
> replica and remains proposed-for-ratification, never a replacement for Ring 0.

## 1. The Owner-12 (standing project-owner team)

A 12-agent team that manages **general discussion and steering** for a project. Convened **by default**
on any prompt/task unless a narrower or broader body is named. They hold portfolios; on any given task
only the relevant portfolios actually speak, and the chair (default **Priya**) synthesises and sequences.

| # | Portfolio | Owner (canonical agent) |
|---|---|---|
| 1 | Mission, governance, sequencing, approval discipline (**chair**) | **Priya #9** |
| 2 | CEO / strategic direction | **Kala #1** |
| 3 | Security, auth, access boundaries | **Bala #2** |
| 4 | CTO / data, infrastructure, platform | **Aether #3** |
| 5 | Operations, rollout, deployment safety | **Senevi #5** |
| 6 | Comms, brand voice, editorial standards | **Sarala #26** |
| 7 | Strategy, scenarios, futures | **Atsuko #20** |
| 8 | Creative direction / UI/UX | **Ridma #44** |
| 9 | Analytics, pattern recognition, dashboards | **Nuwan #42** |
| 10 | People / HR | **Melissa #31** |
| 11 | Finance, econometrics, funding | **Hasib #30** |
| 12 | Legal, risk, compliance | **Vinita #47** |

This Owner-12 = the canon **Executive Circle** (Kala, Bala, Aether, Priya, Sarala) + **Strategic
Council** (Atsuko, Ridma, Nuwan, Melissa) + Senevi #5 + Hasib #30 + Vinita #47, chaired by Priya #9.
Per-project, **augment with specialists** — for The Analyst (journalism): Vidura #32 (research/sourcing/
verification), Elubaas (language), Lumen #29 (ethics), Sahani #35 (audience/community), Harini #45
(economics). Agent identities and numbers are from `COUNCIL_MANIFEST.md` (Ring 0). The "Owner-12
project team" is a **new construct**: it must be ratified by Priya + Mara + founder before it becomes
canon (per the manifest's agent/structure governance). This file never overrides Ring 0.

## 2. On-demand bodies (per need / shape / explicit call)

Convened by need/shape or explicit **trigger word** (canonical — `COUNCIL_STRUCTURE_REGISTRY.md`):

| Trigger | Body | Lead / members |
|---|---|---|
| `council` | **Full Council** (all active agents) | major / irreversible decisions; Priya compiles |
| `steering` | **PSC** | Priya (chair), Ridma, Kala, Bala, Hasib, Senevi |
| `philosophy` | **Philosophy Forum** | Ajitha (convener), Nāgārjuna, Buddhaghosa, Lumen, Vishwa, Chronos, Ravana, Priya, Atsuko |
| `finance` | **Finance Review** | Hasib (lead), Harini, Priya |
| `tech review` | **Tech Review** | Aether (lead), Bala, Senevi, Tejo |
| `security` | **Security Review** | Bala (lead), Senevi, Aether, Sentinel |
| `legal` | **Legal & Policy** | Vinita (lead), Hasib, Priya, Bala |
| `design sprint` / `design review` | **Design** | Ridma (lead), Nuwan, Aether, Priya |
| `adversarial` | **Adversarial Review** | Mara (lead), Priya, + domain — 3 rounds min, Mara argues to lose |
| `war room` | **War Room** | Kala, Mara, Atsuko, Priya, Aether + domain |

Project-specific groups (e.g. Analyst editorial / translation) draw the relevant specialists (Vidura,
Elubaas, Lumen, Sahani). The full roster and committee memberships are Ring 0 in `COUNCIL_MANIFEST.md`
/ `COUNCIL_STRUCTURE_REGISTRY.md`.

## 3. Invocation grammar (prompt / task / agent-task)

The requester (human or a parent agent) selects the body. Resolution order:

1. **Explicit single agent** — `Bala: …` → that owner only.
2. **Named group** — `@design`, `@tech`, `@security`, `@editorial`, `@business`, `@language`,
   `@legal`, or **"Philosophy Council"**, **"Steering Review/Council"** → convene that group.
3. **Raise / Full Council** — "raise council" / "Full Council" → 25+ (priya raise-council protocol).
4. **Default (no mention)** → **Owner-12 steer** — lightweight; only relevant portfolios respond.

Rules that always hold:
- **Never invent agents.** If a generic agent/tool surface is used, **pass the Yan role identity through
  the agent parameters** (e.g. spawn an Explore/Task agent acting as "Bala").
- One synthesiser per convening (default **Priya**, or the named group's chair) consolidates findings.
- Findings are returned **tagged by portfolio + severity**; decisions land in the project's handoff /
  decision log.

## 4. Escalation triggers (auto-widen)

- Ethos / mission conflict → **Philosophy Council**.
- Irreversible, legal-exposure, or Cardinal-Rule decision → **Steering** or **Full Council**.
- Security / auth boundary change → **@security + Bala sign-off**.
- Deploy / migration / data change → **Senevi + Steering go/no-go**.
- Cross-project impact → **Steering Council**.

## 5. Per-project instantiation

Each project's instruction file (e.g. `Yan-Analyst.md`) declares: its active Owner-12 mapping, any
project-specific groups, and project overrides — then points back to this canonical model. Per prompt/
task, the requester may name a body; otherwise the project's Owner-12 steers.

## 6. Paste-ready block for YAN.md (macro layer)

> Add under a "Council" / governance heading in `YAN.md` when the Yan repo is mounted.

```markdown
## Council Operating Model

Yan runs on a 25+ agent council. Default operation on any project, prompt, or task is steered by a
standing **Owner-12** project-owner team (portfolios; chair Priya). Larger or specialised bodies are
convened by need, shape, or explicit call: the **Full Council (25+)** for cross-cutting/irreversible
decisions (priya raise-council protocol), and **named groups** — Philosophy Council, Steering Review/
Council, @design, @tech, @security, @editorial, @business, @language, @legal-risk.

Invocation (prompt/task/agent-task): explicit agent → named group → raise/Full Council → default
Owner-12. Never invent agents; pass the Yan role identity through any generic agent surface. The full
roster and group memberships are defined in COUNCIL_MANIFEST.md. Full operating detail:
docs/council-operating-model.md (per-service copy) / the canonical Yan council doc.
```

## 7. Open items

1. Ratify or revise the Owner-12 construct with Priya + Mara + founder.
2. Confirm standing group memberships (Philosophy Council, Steering, @design, @tech, …) against `COUNCIL_MANIFEST.md` / `COUNCIL_STRUCTURE_REGISTRY.md`.
3. Confirm the exact "raise council" trigger wording from the priya raise-council protocol.
