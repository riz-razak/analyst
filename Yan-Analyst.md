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
- Codex setup lives in `CODEX_ENVIRONMENT.md` and `scripts/codex/`; use `/Users/rizrazak/Code/the-analyst` as the Codex project base.

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

## Analyst Research Artifact Protocol

Active research belongs in `/Users/rizrazak/Code/research`. Analyst consumes research through the three-layer artifact system.

| Layer | Location | Rule |
|---|---|---|
| Markdown audit trail | research repo | canonical provenance, claims, caveats |
| CSV/JSON data bridge | research repo or approved export | canonical numbers |
| HTML dossier | Analyst repo | derivative public interface |

Do not publish orphan numbers. Every public number must trace to a source ID, claim ID, or model field. Public dossiers require publication approval and should preserve visible evidence status where uncertainty remains.

## Translation Policy

Never write Sinhala or Tamil public text from LLM knowledge alone.

Use Google-backed machine translation as the baseline workflow, preserving common internet, platform, SEO, source-route, and legal terms in English when that is the natural Sinhala/Tamil online usage or when translation would blur precision. If Google translation access is unavailable, stop and ask before substituting any method.

For Tamil dossier drafts, keep the same mixed-language discipline established for Sinhala: preserve terms such as `claim`, `source trail`, `source route`, `source-gated dossier`, `stated`, `verify`, `evidence`, `online`, `harden`, `correction`, `denial`, `SEO`, `final phase`, `exact count`, `Mullivaikkal-only`, `category`, `geography`, `legal intent`, `accountability`, `war crimes`, `genocide`, `ethnic cleansing`, and `massacre` when those terms carry the publication's source, legal, or search logic. Use Tamil for connective explanation and average-reader clarity.

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

## Editorial And Admin Direction

- Every published article must have a thumbnail and a hero image. The hero image may be derived from the main image until the asset pipeline is formalized.
- Do not add public navigation to internal monitors, admin analytics, or unreleased project portals.
- The admin panel is the near-term control plane for article text/copy and image/thumbnail updates, but those editing surfaces must require login.
- Prioritize mapping the backend and unifying admin access with the current Yan-Vada member login flow.
- Do not expose unreleased Yan project details, working names, or old project names in public pages. Keep Riz Razak / The Analyst as the salient public brand until the migration is decided.

## Member Management Boundary

**BRAND/AUTH LOCK:** Analyst must not expose Yan-Vada project language or create a parallel member store. Analyst access becomes an `analyst` product membership plus `analyst.*` rights under the Yan People model.

- `/Users/rizrazak/Code/yan/YAN.md` is the central Yan instruction/control layer. Keep it high-level; do not add Analyst/Yan-Vada member schema, rights, invite, or migration details there.
- `/Users/rizrazak/Code/yan/YAN_PEOPLE_IDENTITY_MODEL.md` is the central model for People, products, memberships, labels, rights, reauth, and Yan as the eventual ultimate database authority.
- Analyst must not create a parallel member/admin store. Reuse the current Yan-Vada member/auth/profile model when centralizing admin access.
- Analyst access should become a product membership on the shared People model, with `analyst.*` rights and optional `analyst.*` labels. Labels and primary product are metadata only, never authorization.
- Platform-specific implementation details belong inside the relevant project repo. For current member management, use `/Users/rizrazak/Code/Yan-Vada` as the implementation reference.
- Known partner/admin preapprovals should be handled by project-local Yan-Vada Supabase migrations, not by browser allowlists or Analyst-only state.
- Before expanding CMS/admin capability, harden the Analyst Worker: server-side shared auth/rights, no browser PAT fallback, explicit route allowlist, same-origin CORS, CSRF on state-changing admin routes, and audit logging.

## Council Operating Model

Analyst runs councils per the canonical Yan model — see `docs/council-operating-model.md`.

- **Default:** the standing **Owner-12** project team steers any prompt/task (chair: Priya). Only the
  relevant portfolios respond.
- **On demand / explicit call:** the **Full Council (25+)** (priya raise-council protocol) or a named
  group — **Philosophy Council**, **Steering Review/Council**, `@design`, `@tech`, `@security`,
  `@editorial`, `@business`, `@language`, `@legal-risk`.
- **Invocation order:** explicit agent → named group → raise/Full Council → default Owner-12.
- **Never invent agents.** Use only canonical agents from `COUNCIL_MANIFEST.md`; if a generic agent/tool
  surface is used, pass the Yan role identity through the agent parameters.
- Confirmed Analyst owners so far: Priya (governance), Bala (security/auth), Nuwan (evidence/analytics/
  dashboards), Ridma (UI/UX), Senevi (ops/deploy), Elubaas (language). Remaining Owner-12 portfolios
  (editorial, business/finance, legal/risk, research/sourcing, community, data/infra) to be assigned
  from `COUNCIL_MANIFEST.md`.

## Working Rules

- Prefer small, direct changes.
- Do not move research back into this repo.
- Do not use Yan-Vada assets or archived mockups as homepage source of truth unless the user explicitly asks.
- Run `npm run build` after React/Vite changes when feasible.
- Do not commit unless the user explicitly asks.
