# The Analyst UI Update Session 1.1 Stocktake

Date: 2026-05-19
Scope: organization audit, homepage UI/image stocktake, CMS/template direction
Status: active todo source for Session 1.1

## Revised Homepage Direction

The Session 1.1 homepage target is no longer a literal continuation of the May 7 magazine/FYP split.

The new target:

- one main ranked feed;
- a masonry design wall for visual browsing;
- topic tabs with clear demarcation;
- each topic tab connects to a wall of pieces for that topic;
- topic walls should support both topic articles and breaking-news pieces;
- the structure should be easy, clear, visually coded, and sharply demarcated;
- the palette should stay inspired by the recent Analyst/Yan language, but feel fresher and less dark.

The May 7 handoff remains useful as design evidence and implementation history, but Session 1.1 should prototype the ranked-feed/topic-wall model.

Accepted dossier-card title standard, 2026-05-25:

- Use the Quiet News Index treatment for individual dossier/card titles.
- Card titles should use the body font, restrained weight, no title box, no yellow/warm glow, no topic rail, and no background highlight.
- Topic/priority contrast should come from the card top border, topic tabs, kicker chips, metadata rhythm, and article imagery rather than the title itself.
- Reserve display serif typography for the site masthead, section headings, and future true featured-article modules, not the dense ranked wall cards.

Accepted wall-sort standard, updated 2026-05-26:

- Keep one wall, not separate Ranked and Latest feeds.
- Add a compact wall-level sort control: `Ranked | Latest`; do not show a separate `Order` label.
- `Latest` is the default homepage order for everyone.
- `Ranked` remains available as the editorial-priority order.
- `Latest` reorders the currently selected topic wall by publication date descending.
- Topic tabs continue to filter the same wall in either order mode.
- The top topic chip should read `All`, not `Ranked`.

- Do not create a second feed, duplicate topic tabs, or reintroduce date-filter clutter.

Accepted agentic-search direction, 2026-05-25:

- Treat AI search as an evidence interface, not a chatbot.
- Keep normal search/retrieval as the default mode; answer mode must be opt-in and citation-gated.
- The Worker should own search, indexing, source gating, rate limits, and answer policy.
- Do not publish a static full-body search index before hidden/published visibility is unified.
- Every new article publish should automatically create or update a search artifact and index job.
- Searchable status and answerable status must be separate; not every searchable chunk is safe for generated answers.
- Use approved public dossier content only. Raw research, private notes, source-protection material, and auth/security internals must never enter the public index.
- Detailed implementation note: `docs/audits/2026-05-25-agentic-ai-search-research.md`.

## Operating Constraints

- Work only in `/Users/rizrazak/Code/the-analyst`.
- Do not move raw research into Analyst; publication inputs must arrive through approved public derivatives.
- Do not redesign central auth locally. Analyst admin access stays behind central `auth.yan.lk`, `__Host-analyst_session`, AAL2, and `analyst.admin.access`.
- Do not deploy unless explicitly instructed.
- Do not revive stale browser PAT or localStorage-token CMS patterns.

## Older Todos Recovered

- May 7 homepage handoff remains the current homepage source of truth:
  - `docs/handoff/homepage/analyst-homepage-handoff/HANDOFF.md`
  - `docs/handoff/homepage/analyst-homepage-handoff/BUILD_PLAN.md`
  - `docs/handoff/homepage/analyst-homepage-handoff/COMPONENT_SPEC.md`
  - `docs/handoff/homepage/analyst-homepage-handoff/mockups/magazine-v7-full.html`
- May 7 cleanup audit says the React magazine/FYP homepage was implemented, but the handoff still expects exact production behavior and data wiring.
- May 14 auth handoff leaves two UI/auth cleanup items:
  - apply UI debts from the Yan design-team audit when the Analyst UI/auth cleanup session opens;
  - decide whether to remove or demote the legacy OTP modal from `admin-preview.html`.
- Stale March CMS docs are reference-only. They contain old assumptions about Supabase auth, browser PAT fallback, and Pages-middleware-only auth that are no longer acceptable.
- SEO todo still calls out image work: article thumbnails should be dedicated and compressed, with missing OG image coverage fixed.

## Organization Audit

| Area | Current Shape | Session 1.1 Judgment |
|---|---|---|
| Root app | React 19 + Vite 7 in `src/` | Active homepage/app source. |
| Homepage | `src/pages/HomePage.jsx`, `src/styles/magazine.css`, `src/App.jsx` | Partially implemented from the May 7 handoff. Needs fidelity, accessibility, image, and data contract hardening. |
| Static dossiers | `public/<slug>/index.html` | Publication surface. Each dossier currently keeps unique design and inline structure. |
| Dossier registry | `public/data/dossiers.json` | Main public content index. Too sparse for predictable CMS and homepage rendering. |
| Shared dossier modules | `public/_shared/` | Reusable infrastructure exists, but adoption varies by dossier. |
| Admin/CMS UI | `public/admin-preview.html` | Large monolith. Needs hardening around image/template workflows and removal/demotion of legacy auth UI. |
| Worker/API | `functions/collaborative-session.js`, `functions/_middleware.js` | Server-side CMS and auth gate surface. Must remain server-token based. |
| Docs | `docs/` | Mixed current, archived, and stale. Current docs are marked; stale CMS architecture should not be implemented directly. |
| Brand/design | `brand/`, `docs/design-system.md` | Warm Bawa direction is consistent, but current homepage still has global design conflicts. |

## Homepage UI Stocktake

Confirmed in local browser at `http://127.0.0.1:5173/`.

- No homepage image URLs 404 locally.
- The visual break is that every visible published homepage image is the same generic `/images/og-card.png`.
- Current homepage renders 10 images; all visible published cards use the generic OG card.
- `public/data/dossiers.json` has only one dedicated thumbnail, and that dossier is hidden: `/images/thumbnails/iran-us-israel-war.jpg`.
- The homepage already includes nameplate, menu, accountability ticker, hero, rotating strip, body columns, sidebar, FYP view, and footer.
- Current implementation remains short of the handoff:
  - rotating strip is not exact departure-board behavior;
  - ticker does not rotate multiple alerts;
  - pagination is visual only;
  - FYP is dossier-only;
  - trending uses read time, not trend metrics;
  - article cards are clickable `<article>` elements without full keyboard semantics;
  - image alt text is empty;
  - dark-mode toggle exists despite design-system tension and incomplete Bawa dark tokens;
  - site-wide ML disclaimer visually clashes with the magazine handoff.
- Because the revised direction moves to a ranked feed plus topic masonry walls, these gaps should be treated as lessons from the current implementation rather than a mandate to finish the magazine/FYP surface exactly.

## CMS Stocktake

- CMS backend exists in `functions/collaborative-session.js`: locks, autosave, draft fetch, handoff, publish, GitHub file read/write, visibility, submissions, comments, and thumbnail upload/generation stubs.
- Current CMS must use server-side `GITHUB_TOKEN`; browser-held PAT fallback must stay retired.
- `admin-preview.html` is too large and mixes dashboard, CMS, image, auth, and portal concerns in one static file.
- Article editing predictability is blocked by inconsistent dossier HTML structures and inconsistent `data-cms-id` coverage.
- `_cms-overrides.json` exists for some dossiers but is not a complete template contract.
- Image workflow exists at the Worker level but the registry still lacks dedicated public thumbnail/hero coverage for most articles.

## Article Template Standardization Direction

The compromise should standardize structure, not flatten editorial identity.

Each article type should share:

- registry metadata contract;
- hero/header contract;
- evidence/provenance contract;
- section/navigation contract;
- CMS field IDs;
- image/thumbnail contract;
- status/approval contract.

Each article may vary:

- visual motif;
- opening layout emphasis;
- section rhythm;
- featured media treatment;
- accent category styling;
- superficial article-specific design elements.

## Proposed Article Families

| Family | Use For | Standard Modules |
|---|---|---|
| Breaking News | fast updates, developing stories | concise hero, update log, source status, correction strip |
| Featured Investigation | major accountability dossiers | evidence index, source cards, timeline, corrections, deep nav |
| Reporting | original reported articles | source register, quotes, chronology, rights-sensitive notes |
| Opinion | argued positions | author note, thesis, counterarguments, disclosure |
| History / Philosophy | essays, interpretive pieces | reading path, references, context cards |
| Industry Analysis | finance, tech, economics, politics, culture, global, geopolitics, art, local, fashion, design, architecture | sector taxonomy, data notes, trend cards |
| Explainer | evergreen public education | definitions, key facts, FAQ, update date |
| Tool / Model | dashboards, forecasts, monitors | model card, last update, methodology, limitations |

## Industry Taxonomy Draft

Keep top-level complete but uncluttered. Use a primary vertical plus optional secondary beats.

- Power & Governance
- Law & Rights
- Economy & Trade
- Finance & Markets
- Technology & AI
- Energy & Climate
- Geopolitics & Global
- Local & Municipal
- Culture & Society
- Media & Information
- Art & Literature
- Design & Architecture
- Fashion & Lifestyle
- Sport & Institutions
- History & Philosophy

## Session 1.1 Todo

1. Redesign homepage information architecture around one ranked feed plus masonry topic walls. Initial prototype implemented; continue refining wall density and topic routing.
2. Define the simple ranking algorithm inputs: freshness, editorial priority, publication type, topic fit, evidence status, and manual pin/boost.
3. Define topic tabs and topic-wall routing so each tab/page maps to a clear wall of articles and breaking-news pieces. Current prototype keeps the topic wall in-page; route-level topic pages remain for the CMS/navigation phase.
4. Create the fresh, less-dark palette inspired by current Analyst/Yan language. Current prototype removes the warm/yellow wall glow in favor of cleaner paper/card contrast.
5. Urgent homepage image fix: stop generic OG card repetition on the front page; use article-specific editorial visuals or safe fallbacks.
6. Create a registry metadata v3 prototype that supports article family, topic/industry vertical, CMS schema, evidence status, visual identity, ranking fields, and publication approval state.
7. Prototype one standardized article template that preserves a featured-article skin layer.
8. Audit `admin-preview.html` CMS flows against central-auth constraints and remove/demote unsafe legacy UI surfaces.
9. Split CMS UI concerns into predictable modules or at least clear sections before major feature work.
10. Harden homepage accessibility: keyboardable cards, meaningful image labels or decorative fallbacks, tab semantics, order-control semantics, and masonry reading order. Card links are now anchor elements; continue validating reading order as wall behavior changes.
11. Remove false pagination affordances from the old surface unless the new feed actually paginates.
12. Reconcile dark-mode toggle with the fresh light-first palette. Homepage menu no longer exposes the old dark-mode toggle; verify remaining app-level theme paths before removal.
13. Add image validation to `scripts/codex/validate.sh` or a dedicated CMS validation script.
14. Add agentic AI search as a Worker-backed evidence search surface: extractor/backfill, D1 search documents/chunks/jobs/audit tables, publish-time capture, public `/api/search`, admin reindex/status, and later semantic/answer mode.
15. Run `npm run lint`, `npm run build`, and `git diff --check` after each runtime change.

## Implementation Notes

2026-05-26 agentic search MVP:

- Implemented public `/search` route in the React app.
- Implemented Worker `GET /api/search` retrieval over approved public dossiers.
- Implemented KV search artifact capture and admin reindex/status endpoints as a bridge before D1/Vectorize.
- Wired capture to CMS publish and root-level dossier HTML writes.
- Preserved visibility gating so KV-hidden dossiers do not appear in Worker search results.
- Kept generated answer mode disabled; current answer mode returns retrieval/citation status only.

## First Prototype Recommendation

Start with a metadata-first homepage prototype, not a full CMS rewrite:

- Add a normalized article schema document with ranking and topic fields.
- Adapt homepage rendering to consume that schema progressively.
- Build the ranked feed and one topic masonry wall first.
- Build one template shell for a Featured Investigation and one News/Bulletin variant.
- Keep existing dossier HTML intact until the CMS can prove it can edit the standardized fields safely.
