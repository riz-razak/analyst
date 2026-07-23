# STAGING — 2026-al-cohort ("The Cohort That Paid the Bill")

Status: **STAGED, NOT PUBLISHED.** Built at production path, not committed, not deployed,
not in `public/data/dossiers.json`. Do not add a registry entry or link from the homepage
until every blocking item below closes.

Staged by RIDMA #44 (Creative Director) / SENEVI #5 (ops) — 22 July 2026.
Plan of record: `research/Political/2026/10. 2026 A-Level /04-output/design-narrative-plan.md`.
Article of record: `04-output/final/analyst-article-2026-al.md` (v3, post-dissection — supersedes plan quotes).

## What is staged

- `index.html` — full dossier: El Niño-generation shared modules (full include list, exact plan
  order, `dossier-disclaimer.js` restored per ISS-02), solid topbar with **no backdrop blur**
  (ISS-01 fix), typographic Bawa-Earth hero (no image), 14-event narrative-timeline JSON,
  spine-nav config, 11 sections (#stakes #calendar #arithmetic #mitigation #contradiction #pm
  #court #allegation #runway #what-now #evidence), v3 article text verbatim, evidence-status
  chips on key figures, single pull-quote (14 Dec), single petition CTA in #what-now with
  Analyst-support disclosure, footer with update pledge + helpline 1926.
- `vis/` — the four visualisation artifacts (al-drift-and-snap, al-two-rulers,
  al-what-others-did, al-repeat-runway), embedded as lazy same-origin iframes inside
  `<figure>`s with claim-ID figcaptions and static text fallbacks.
- `policy-paper.html` — "Who Owns the Calendar?" rendered from
  `04-output/final/policy-paper-exam-calendar-governance.md`, linked from #what-now and footer.

## Blocked / must close before publish

| # | Item | Ref |
|---|------|-----|
| 1 | **Gate 2 — right of reply** (Ministry) still open. No publish until closed. | handoff |
| 2 | **23 Jul Court of Appeal order** (leave to proceed) lands the day after staging. Revise #court and the lede against the order; timeline event 13 will need updating. | ISS-03 |
| 3 | **Hero + og:image asset** — no cleared assets; commission original to Bawa Earth canon. Typographic hero is the interim; TODO comments mark both slots. | ISS-07 |
| 4 | **Si/Ta translations** pending Google-MT workflow. Lang toggle staged disabled (EN only); trilingual dek, lang-notes, and petition-card translations to be added when APG review completes. | ISS-08 |
| 5 | **Registry entry NOT added** — `public/data/dossiers.json` untouched; homepage untouched. Add only at publish. | task |
| 6 | Helpline **1926 must be verified live** before ship. | ISS-09 |
| 7 | Petition-endorsement policy: founder sign-off on the CTA + disclosure line. | ISS-10 |
| 8 | Policy paper carries two **[TO VERIFY]** flags (Ofqual statutory basis; CBSE notice periods) — confirm or cut before publish. | paper §2 |
| 9 | Vis aria audit (fuller labels) and 375px QA for the three vis without explicit mobile breakpoints; fallback = static PNG + "open full artifact" link. | ISS-04/05 |

## Pre-publish QA checklist (per docs/qa-checklist.md)

Pre-deployment:
- [ ] Grep for stale path references (`../_shared/` depth is correct for this directory level)
- [ ] No hardcoded secrets
- [ ] No JS syntax errors (page ships no inline JS beyond JSON blocks)

Post-deployment (after eventual publish only):
- [ ] Screenshot of live page on `analyst.rizrazak.com` (URL bar visible), after hard-refresh
- [ ] Browser console clean on index.html and policy-paper.html
- [ ] All four iframes load same-origin and honour `prefers-reduced-motion`
- [ ] Mobile 375px pass: hero, timeline collapse, spine-nav bottom sheet, all four vis
- [ ] Old/new URL + sitemap checks; admin "Live URL"; visibility round-trip (Hidden → 404,
      Published → loads); KV state matches UI
- [ ] Petition link resolves; policy-paper link resolves; helpline number re-verified
- [ ] Registry entry added and homepage card verified — LAST step

## QA R10 — founder-ordered design/vis repair (22 Jul 2026, RIDMA #44 / NUWAN #42 / SENEVI #5)

Four vis rounds + four design rounds run against the founder's defect list. Article prose
untouched (frozen). Full round records: `research/Political/2026/10. 2026 A-Level /03-council/rounds/R10-design-qa.md`.

### Vis fix log (defect 5 — "all four visualisers broken")

Root causes found (V1):
1. **Step-gating on first paint.** All four artifacts ran `i=0` at load and hid every
   `[data-step]` element (`opacity:0`) until the reader clicked "Next" — inside a mid-page
   iframe the embed therefore rendered as an empty card. FIX (V3): initial state is now
   `i=max` (fully revealed); the step controls become an optional "Replay step by step".
   Reduced-motion path unchanged (static, fully revealed, no controls).
2. **Fixed 640px iframe height** vs artifact content heights of ~800–1000px clipped the
   bottom half of every embed. FIX: per-vis fallback heights (920/840/1000/800px inline)
   plus a same-origin auto-fit script at the end of `index.html` `<body>` that sets each
   frame to its exact content height on load and on resize (try/catch → falls back
   gracefully under file:// or cross-origin).
3. **`loading="lazy"` removed** (four small local files; eager load guarantees the fit
   script's `load` event and first-frame visibility for static review).
4. **Shared-shell hazard:** `dossier-base.css` ships `section{opacity:0;animation:fadeIn}`
   — under `prefers-reduced-motion` (page + base both set `animation:none`) sections stayed
   at opacity 0 forever. Page-local override forces `opacity:1;animation:none`.
   **Promote-to-shared candidate** — this bug affects every dossier using the base shell.
5. Research copies in `05-assets/html/` re-synced with the same fixes (V4). All page and
   vis scripts pass `node --check`; all JSON blocks parse.

### Topbar contract summary (defect 1 + 3) — for the later all-pages harmonisation pass

Extracted from the design standard (2026-06-19), Yan deep review §4, and the about-team
scaffolding spec §4 ("public-shell contract"):
- **Wordmark left, controls right**, one solid sticky bar (56px), 1px `--line` bottom border,
  **no backdrop blur** (light-only law), inner container centred and width-aligned with the
  body column (benchmark: mullivaikkal `topbar-inner width min(1320px, 100vw - 40px)`; this
  page uses the adopted 1080px wide tier).
- Controls: EN/SI/TA lang toggle only — **no theme toggle** (light-only), pill buttons,
  ≥36px hit target. **No bridging nav to admin**; admin reachable by direct URL only.
- **No extra nav rail** (spine-nav retired platform-wide); drawer/burger + "About us" group
  belong to the React homepage shell, not to dossier pages — dossier pages carry wordmark +
  Home + lang toggle plus the in-page section tab strip as the single secondary nav.
- The narrative timeline bar (fixed) sits **below** the topbar (`top: 56px`), solid
  background. Its shipped `top:0` buried it behind the topbar — page-local override here;
  promote-to-shared candidate.
- `dossier-base.css`'s global `#langToggle` rule flattens page pill buttons — pages must
  out-specify it (done here) until the shared rule is scoped.

### Width standard adopted (defect 2)

- `--measure: 800px` — centred text column (prose, standfirst, pull-quote, asks, petition,
  procedural/aside boxes, footer text).
- `--measure-wide: 1080px` — centred wide tier (hero content, topbar inner, vis figures,
  claim grid), matching the mullivaikkal `--content-measure: 1080px` benchmark within its
  640–1120px tier family.
- Left rail dead: `main{padding-left}`, hero/footer left offsets removed; everything centres
  in the viewport at 1440/1024/768/375 with no horizontal overflow.

### Hero + rhythm (defect 4)

- Hero viewport-stretch (`min-height:92svh`, `8vh` paddings, empty grid cell) removed;
  now `padding: (28px timeline + 44px) 24px 44px`, H1 `clamp(2.4rem,5.4vw,4.6rem)`,
  tightened dek/meta margins — standfirst lands inside one 1440×900 viewport.
- Section rhythm: 72px desktop / 48px mobile section padding; H2 and kicker centred on the
  text measure; figures `36px auto`; section tab strip sticky under topbar+timeline,
  centred when it fits, horizontally scrollable on mobile.

### Promote-to-shared later (page-local overrides for now)

1. Remove/fix `section{opacity:0;animation:fadeIn}` in `dossier-base.css` (reduced-motion blank-page bug).
2. Scope `#langToggle` styling in `dossier-base.css` to the legacy header.
3. `narrative-timeline.css`: default `top` should clear the topbar; drop backdrop blur (canon).
4. Retire `dossier-spine-nav.{css,js}` platform-wide (shell contract: no extra nav rail).
5. Vis reveal transitions are 0.28s (artifact-internal, pre-existing); canon caps page
   transitions at 0.15s — flag for the next canon review rather than silently re-timing
   council-passed artifacts.

## Plan deviations (v3 article wins over plan)

- Plan's post-VIS-2 line ("notice what is not in it: repair") contradicts v3, which documents
  partial repair across 2024–25 — dropped; fallback/caption text follows v3.
- Plan's G1 plant (300-day benchmark named in #stakes) and G5 plant (#mitigation aside) do not
  exist in v3 prose — not re-inserted; prose is verbatim v3.
- v3 has no standalone repeat-candidates prose; #runway section kept (plan structure) with a
  short bridging paragraph built strictly from v3/vis-agreed figures (132/178/198, "four months
  and ten days") housing VIS-4.
- Dek uses the v3 subtitle (the evolved form of standfirst option 1); OG description uses
  standfirst option 2 per plan.

## Translation (SI / TA)

Instrumented 22 July 2026 by ELUBAAS (Linguistic Intelligence) / SENEVI #5. No Sinhala or
Tamil copy has been generated: policy forbids LLM-written SI/TA public text, and the Google
key was not available in the instrumentation environment.

### Markup now in place

97 translatable elements carry `lang-en data-lang="en" data-cms-id="al-<section>-NN-en"`, each
followed by empty `lang-si` / `lang-ta` siblings with matching `-si` / `-ta` CMS ids.
`data-lang` drives `_shared/dossier-base.css` + `_shared/dossier-lang.js`; the bare
`lang-en` / `lang-si` markers are what `scripts/translate-*.py` key off. Not marked, by design:
topbar brand, toggle labels, evidence status chips, claim-id spans, numeric dates, URLs.
String set: `i18n-strings.en.json` (97 strings, 4,246 words).

### 1. Set credentials

Billing moved to the new GCP project **`yan-news-503217`** ("Yan News", billed to Yan Rides,
org dgtl.lk) with Cloud Translation API enabled and a Translation-API-restricted key named
"Yan News". The old `warenyan` project is retired — its billing account is closed, which is
why the pipeline had stopped working.

The key is supplied **via env var only**. It is never hardcoded in the script and never
committed to the repo.

```bash
export GOOGLE_TRANSLATE_API_KEY="…"          # "Yan News" key; do not commit
export GOOGLE_CLOUD_PROJECT="yan-news-503217"
export GOOGLE_CLOUD_LOCATION="us-central1"   # optional; script default
```

`yan-news-503217` is also the script's built-in `--project` default, so the second export is
belt-and-braces.

### 2. Dry run (no API call, confirms 97 elements are seen)

```bash
cd /Users/rizrazak/Code/the-analyst
python3 scripts/translate-dossier.py translate public/2026-al-cohort/index.html --dry-run
python3 scripts/translate-dossier.py translate public/2026-al-cohort/index.html --dry-run --target-lang ta
```

### 3. Sinhala

```bash
cd /Users/rizrazak/Code/the-analyst
python3 scripts/translate-dossier.py translate public/2026-al-cohort/index.html --target-lang si
```

Writes SI into the `lang-si` siblings, emits `2026-al-cohort-translations.json`, and
auto-generates `translation-review.html`. (`--target-lang si` is the default and may be
omitted; the SI output filenames are unchanged.)

### 4. Tamil

```bash
cd /Users/rizrazak/Code/the-analyst
python3 scripts/translate-dossier.py translate public/2026-al-cohort/index.html --target-lang ta
```

Writes TA into the `lang-ta` siblings, emits `2026-al-cohort-translations-ta.json`, and
auto-generates `translation-review-ta.html`. Buddhist/Pali term substitution and the Sinhala
register fixes are applied to SI only.

Do not hand-translate Tamil as a workaround, and do not substitute another provider —
Yan-Analyst.md: "If Google translation access is unavailable, stop and ask."

### 5. Review and QA (no API key needed)

```bash
cd /Users/rizrazak/Code/the-analyst
python3 scripts/translate-dossier.py review public/2026-al-cohort/index.html                  # EN|SI side-by-side
python3 scripts/translate-dossier.py review public/2026-al-cohort/index.html --target-lang ta # EN|TA side-by-side
python3 scripts/translate-dossier.py test   public/2026-al-cohort/index.html                  # SI QA checks
python3 scripts/translate-dossier.py test   public/2026-al-cohort/index.html --target-lang ta # TA QA checks
```

### 6. Enable the toggle (only after human review signs off)

In `index.html`, drop `disabled` and the `title` from `#langToggle` and set
`data-lang-options="en,si,ta"`.

### Notes and open items

- **`vis/` needs a second pass.** `al-drift-and-snap.html`, `al-two-rulers.html`,
  `al-repeat-runway.html` and `al-what-others-did.html` are separate documents with their own
  labels, captions and axis text. They carry no `lang-en` markers and are untouched here.
- **Human review is mandatory before publish**, per Yan-Analyst.md Translation Policy. Machine
  output is a draft, not publishable copy.
- Glossary: this dossier's domain terms were appended to `SINGLISH_KEEP` in
  `scripts/translate-dossier.py` (~90-10 SI/EN and TA/EN mix). Term protection is now
  word-boundary matched, so `writ` no longer clobbers `written`/`writing`/`writes` and `app`
  no longer clobbers `applied`/`approved`/`appears`; punctuated terms (`A/L`, `G.C.E.`) are
  handled with lookarounds rather than `\b`.
- The `#court` section and lede must be revised against the 23 July Court of Appeal order
  (ISS-03) **before** translation is run, or the SI/TA text will be stale on arrival.
