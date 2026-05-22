---
title: "Basic Design Instructions"
owner: "Research desk"
status: "ready"
---

# Basic Design Instructions

Use this when turning the dataset into page-level editorial assets.

## Visual language

- Keep tone restrained and civic-first, no dramatic gradients, low decorative burden.
- Layout should be single-pass readable: one clear narrative spine + one evidence rail.
- Use compact cards with predictable structure:
  1) claim as seen
  2) what is actually supported
  3) status label
  4) key source IDs
- Keep section margins low and spacing consistent to reduce visual fatigue.
- Use color only as state (good/needs-check/weak/unsupported) and minimal fill.

## Information architecture

- Build in this order:
  - Opening: claim context + stakes + one-line safe conclusion.
  - Words before numbers section (terminology and authority lanes).
  - Claims table with labels.
  - Evidence map or SEO heatmap section.
  - Number family clarification.
  - Counter-route and accountability section.
- Keep `Evidence` visible before navigation links and side widgets.
- Sortable tables and claim cards must stay scannable on first screen.

## Design-for-agent rules

- Do not redesign structure while drafting content.
- Keep this file as the source of truth for visual intent.
- Do not introduce new layout patterns unless the architecture breaks mobile usability.
- For any new component, include:
  - one purpose,
  - one status label,
  - one source anchor.

## Copy and labels

- Keep source-safe wording and safe-label taxonomy visible:
  - Source supports this
  - Needs qualifier
  - Repeated source
  - Mixed categories
  - Not supported as written
  - Needs checking
  - Broken or missing link
- Use short phrases for lay comprehension first; place legal qualifiers in one line of context.
- Never let tables become legal arguments by themselves; each high-risk sentence needs a short plain-language summary.
- Avoid absolute legal labels unless directly sourced.

## Lanes and status

- For every major term use a lane marker:
  - Memory lane
  - Numbers lane
  - Conduct lane
  - Legal lane
- Add status labels to all lanes:
  - `Source supports this`
  - `Needs qualifier`
  - `Mixed categories`
  - `Not supported as stated`

## Source trace behavior for LLM/agent handoff

- Keep each claim card linked to at least one source ID and one claim ID.
- Ensure every external sentence maps to `source wording` and `public-safe wording`.
- Add a compact “What changes next?” block after each claim sequence.
- Preserve the distinction between high-authority memory pages, political recognition pages, and legal determinations.
