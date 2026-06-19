---
title: "Analyst About / Team Scaffolding Spec"
date: "2026-06-19"
owner: "claude (Ridma UI/UX + Priya governance lens)"
status: "design-only — DO NOT BUILD yet (per Riz)"
tags: ["about", "team", "public-shell", "navigation", "scaffolding", "analyst"]
---

# Analyst About / Team Scaffolding Spec

**Design only.** Per Riz: prepare the scaffolding spec now, **do not execute the page build yet** —
the rest of the team joins as support staff soon, so the Team section is specced but built later.

## 1. Where it lives in the shell

Per the accepted public-shell contract, the drawer has an **About us** group. About/Team are public
reader surfaces (not admin). They are also prerequisites for **Google News eligibility**
(seo-strategy.md P2 wants a clear `/about` with editorial mission + authorship) and give the funding
ask an ethos-credible home (business model §7).

> Current state: the React homepage menu exposes **"About Riz"** (personal) and "Accountability",
> but there is **no About us → Team** structure and no `/about` route. This spec defines it.

## 2. About us — section structure (scaffold)

Five blocks, matching the handoff's "Why, Mission/Vision, Promise, Standards, Team":

1. **Why** — the problem (extractive system; awareness without alternatives burns out — strategy.md).
2. **Mission / Vision** — liberation journalism + dual power; Phase 1 → 2 → 3 theory of change.
3. **Promise** — the five credibility pillars: accuracy, independence (no corporate sponsorship,
   community-funded), courage, transparency, community.
4. **Standards** — evidence labels (VERIFIED / PARTIAL / UNVERIFIED / ALLEGED), two-source rule,
   corrections policy, translation policy (never Sinhala/Tamil from LLM memory). Link to
   `docs/evidence-protocol.md` / `ethics-protocol.md` derivatives.
5. **Team** — see §3.

## 3. Team — scaffold (content placeholders only, build later)

| Field per member | Notes |
|---|---|
| Name | — |
| Role | e.g. Founder, Co-founder, Support staff |
| Short bio | 1–2 sentences |
| Photo / avatar | thumbnail + hero discipline applies |
| Public contact | optional; no private data |

Seed entries (placeholders — confirm public bios/photos before build):

- **Riz Razak** — Founder & Lead Investigator.
- **Sunera Bandara** — Co-founder.
- **Support staff** — *"Joining soon"* placeholder block; add as people are onboarded with
  `analyst.*` rights (see member-management plan).

> Keep "Riz Razak / The Analyst" as the salient public brand. Per Yan-Analyst.md, **do not expose Yan
> / Yan-Vada project language, working names, or old project names** on the public Team/About pages.

## 4. Visual + technical rules (Ridma)

- Lighter **Bawa-inspired** visual language; **no** yellow glow, **no** glassmorphism, **no** extra
  nav rail — consistent with the shell contract.
- Reuse `_shared/dossier-base.css` variables and typography; **do not** override inline (the review
  found inline overrides shadowing the shell on several pages — don't repeat that here).
- Bilingual EN/SI (Tamil where applicable); Sinhala/Tamil text must be in the DOM for indexing, and
  **never written from LLM memory** — use the Google-baseline translation workflow.
- Accessibility: real text labels on toggles, single `<h1>`, adequate contrast.

## 5. Build trigger (when Riz says go)

1. Confirm final public bios + photos for Riz and Sunera; confirm support-staff list.
2. Build `/about` (and Team within it) as a shell-compliant public page (static HTML or a React
   route consistent with the unified shell).
3. Add to drawer **About us** group; wire `menuAbout` to `/about` (replacing/expanding "About Riz").
4. Add `Organization` + `Person` JSON-LD for Google News eligibility.
5. QA against the shell-compliance checklist (assets loaded, no inline override, bilingual, a11y).

## 6. Explicitly NOT done this session

- No page built, no route added, no menu rewired. Spec only.
