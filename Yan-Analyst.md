# Yan-Analyst.md - AI Assistant Instructions for analyst.rizrazak.com

Read this before changing the Analyst repo.

## Project Overview

`/Users/rizrazak/Code/the-analyst` is the publication/app repo for `analyst.rizrazak.com`.

The homepage is a React/Vite single page app. Published dossiers are mostly standalone HTML documents under `public/<slug>/index.html`, with shared dossier assets in `public/_shared/` and a registry at `public/data/dossiers.json`.

`www.rizrazak.com` is not served from this repo. Use `/Users/rizrazak/Code/rizrazak-site` for the personal homepage.

## Current Stack

- React 19 + Vite 7 for the root app in `src/`.
- `src/App.jsx` routes `/` to `src/pages/HomePage.jsx` and `/:id` to `src/pages/DossierPage.jsx`.
- Static dossier pages live in `public/` and are copied into `dist/` by Vite.
- Build command: `npm run build`.
- Deployment target: GitHub Pages at `analyst.rizrazak.com`.

## Homepage Handoff

The current magazine homepage handoff is preserved at:

- `docs/handoff/homepage/analyst-homepage-handoff.zip`
- `docs/handoff/homepage/analyst-homepage-handoff/`

The definitive mockup is:

- `docs/handoff/homepage/analyst-homepage-handoff/mockups/magazine-v7-full.html`

The previous search/list homepage is archived at:

- `docs/archive/old-homepage/HomePage.search-list.jsx`

## Research Boundary

Do not store active research packages in this app repo. Use `/Users/rizrazak/Code/research` as the canonical research workspace.

Use this repo for publication code, static dossier pages, shared publication assets, handoff docs, and deployment artifacts.

## Translation Policy

Never write Sinhala text from LLM knowledge.

Use Google-backed machine translation as the baseline workflow, preserving common internet and platform terms in English when that is the natural Sinhala usage. If Google translation access is unavailable, stop and ask before substituting any method.

Do not use any LLM provider as a default translation fallback. For non-translation research, synthesis, coding, or test tasks, use a provider-neutral cascade selected by current merit: benchmark performance, task fit, latency, cost, context limits, reliability, safety, and available tooling.

Current model cascade, reviewed monthly:

1. GPT family for general reasoning, code, synthesis, and tool-use reliability.
2. Z.AI for strong reasoning/coding alternates where it outperforms GPT on current tests.
3. Claude family for long-context editorial review, critique, and prose analysis when it is measurably better for the task.
4. Mistral for fast, cost-effective structured work and European/open model coverage.
5. DeepSeek for coding/math-heavy checks when current benchmarks and local tests support it.
6. Open-weight/local models for privacy-sensitive, offline, or reproducibility-focused tasks.
7. Specialist models only when a task-specific benchmark or production test justifies them.

Monthly mandate: rerun a small Sinhala translation and editorial-quality evaluation across available providers. Keep Google-backed translation as the production baseline until one provider consistently meets or exceeds expected Sinhala quality, preserves Singlish terms correctly, handles domain vocabulary, and passes human review. If that happens for at least two consecutive monthly reviews, this cascade can be simplified and a single default can be proposed.

Track candidates for later model-cascade tests here:

- https://huggingface.co/papers/2508.09115

Relevant scripts include:

- `scripts/translate-dossier.py`
- `scripts/translate-extract.py`
- `scripts/translate-inject.py`
- `scripts/translate-review.py`

## Shared Dossier Modules

Shared dossier CSS/JS lives in `public/_shared/`. Existing dossier pages may still reference older and newer navigation modules. Read the specific dossier before changing shared assets.

Important shared systems include:

- `spine-nav.css` / `spine-nav.js`
- `dossier-spine-nav.css` / `dossier-spine-nav.js`
- `comments-v3.css` / `comments-v3.js`
- `privacy-banner.css` / `privacy-banner.js`
- `dossier-theme.js`, `dossier-lang.js`, `dossier-analytics.js`

## Working Rules

- Prefer small, direct changes.
- Do not move research back into this repo.
- Do not use Yan-Vada assets or archived mockups as homepage source of truth unless the user explicitly asks.
- Run `npm run build` after React/Vite changes when feasible.
- Do not commit unless the user explicitly asks.
