# Mullivaikkal Dossier Stocktake And Next Pass Prep

Date: 2026-05-24
Live URL: https://analyst.rizrazak.com/mullivaikkal-40000-deaths/
Spoke URL: https://analyst.rizrazak.com/mullivaikkal-40000-who-decides-genocide/

## Yan Agent-Suite Naming

Use Yan council names for future ownership labels instead of generic subagent labels:

- Elubaas: Sinhala/Tamil/French language layer, public readability, term discipline.
- Aether: build integrity, routing, analytics, deployment, regression checks.
- Nuwan: SEO/GEO structure, metadata, sitemap, crawl/search surfaces.
- Ridma: Analyst visual language, responsive UI, thumbnail/social preview quality.
- Ravana: narrative force, Sri Lankan civic posture, anti-propaganda argument clarity.
- Mara: source gate, claim risk, overclaim blocks, legal/factual stress test.
- Vidura: evidence packaging, data registers, replication methods.
- Priya: civic ethics, audience harm, accountability without denial.

## Achievements

The live article is now a public Analyst dossier at `/mullivaikkal-40000-deaths/`, listed in `public/data/dossiers.json`, visible on the homepage feed, and using the Sinhala horizontal pinned-board thumbnail as its unfurl image.

The main article has a restrained Analyst dossier structure: title, tagline, core claim card, narrative argument, SEO source-trace map, source-chain repair section, language/translation section, number-family section, civic test, research-bounds section, and reference table.

The evidence package exists inside the public dossier folder:

- `README.md`
- `data/`
- `methods/`
- `visualisation/seo-power-network-demo.html`

The data layer includes source registers, claim registers, casualty estimate rows, reference sources/URLs/claims/numbers, SEO inspected URL register, top-100 capture, authority heatmap, power distribution summaries, source traces, viral post sheet, and UN report inventory.

The SEO visualisation is integrated in the article via `/visualisation/seo-power-network-demo.html`. The visualiser supports node selection, pathway comparison, source trails, reference links on labels, and compact evidence inspection.

The analytics surface is wired at the page level through the shared dossier analytics script. The UI shows page visits and live-now counts without exposing private analytics details publicly.

The Sinhala layer exists as a first pass through `data-i18n` attributes, with the current lesson that mixed Sinhala/English must preserve SEO terms only where they are structurally useful. Sinhala quality is usable but still requires a final Elubaas review before treating it as polished.

The legal-language spoke exists at `/mullivaikkal-40000-who-decides-genocide/` and now shares the Mullivaikkal social thumbnail, RSS alternate link, article metadata, and Article/Breadcrumb JSON-LD.

## Remaining Blockers

The sitemap has been updated with the homepage lastmod, the main Mullivaikkal dossier, the legal-language spoke, and the feed lastmod.

The RSS/feed surface now carries the Mullivaikkal dossier as the newest item.

Structured data has been added for the main article: `NewsArticle`, `BreadcrumbList`, and `FAQPage`. The legal-language spoke has `Article` and `BreadcrumbList`. `ClaimReview` remains intentionally held because the wording should not imply a formal fact-check adjudication until Mara signs off.

Multilingual metadata is not ready. The page currently has only `html lang="en"` and a Sinhala toggle; it does not have Tamil/French metadata, alternate-language URLs, or `hreflang` structure.

The Tamil and French layers do not exist yet. A current extraction/review sheet now exists at `artifacts/translations/mullivaikkal-40000-deaths-i18n-review.json`, with 182 translatable entries from the current article. Tamil should be built after a Google/TLLM pass plus Elubaas/Mara review. French should come after Tamil because French has lower local comprehension risk but stronger international search usefulness.

The public footer still says publication remains source-gated until final legal, citation, and Sinhala-language QA are complete. If this remains accurate, keep it. If the article is now considered fully launched, revise it after the next source/translation gate.

The `1,000`-link layer remains an accounting/workqueue ambition, not a completed live crawl. Keep that caveat live unless a full URL-level mapping/crawl is actually completed.

## Translation Prep: Two Rounds

Round 1, Elubaas + Ravana:

- Extract every `data-en` and `data-si` string from `public/mullivaikkal-40000-deaths/index.html`.
- Mark each sentence as one of: translate fully, keep English SEO term, explain term in Tamil, avoid transliteration, or legal term requiring source check.
- Carry Sinhala lessons forward:
  - preserve important SEO terms only when they clarify;
  - avoid unnecessary English clutter;
  - when exact legal/political meaning is at stake, prefer explanation over a forced one-word equivalent;
  - keep quoted technical phrases where the concept is coined by the article, such as source-route compression or claim hardening.

Round 2, Elubaas + Priya + Mara:

- Translate hero/core claim first, then SEO section, then the full article.
- Stress-test Tamil for three risks: denial reading, ethnic contempt reading, and legal overclaim.
- Keep the Tamil register average-reader friendly, not academic Tamil.
- Produce a bilingual review artifact before wiring it into the live toggle.
- French follows the same extraction pipeline after Tamil is approved.

## Tech Prep: One Round

Aether + Nuwan:

- Expand the language toggle to support `en`, `si`, `ta`, and later `fr`.
- Replace hard-coded `data-si` only logic with a language-key loop that can read `data-ta` and `data-fr`.
- Keep English as canonical/default.
- Avoid separate language URLs until the Tamil/French layer is approved; once approved, decide between single-page toggle only versus language-specific paths.
- Run visual QA at desktop, tablet, and mobile because Tamil line lengths will change card/table height.

## SEO/GEO Metadata Pass

Main URL target:

- `/mullivaikkal-40000-deaths/`

Spoke URL target:

- `/mullivaikkal-40000-who-decides-genocide/`

Metadata to add or review:

- `article:published_time`
- `article:modified_time`
- `article:author`
- `article:section`
- `article:tag`
- `og:locale`
- future `og:locale:alternate` for Sinhala/Tamil/French if separate language surfaces are created
- `twitter:creator`
- stronger `og:image:alt` in English plus localized thumbnail alt if relevant
- JSON-LD `Article` or `NewsArticle`
- JSON-LD `BreadcrumbList`
- carefully scoped `ClaimReview` only if the wording can meet fact-check schema requirements without overclaiming

Sitemap and discovery updates:

- Add `https://analyst.rizrazak.com/mullivaikkal-40000-deaths/`.
- Add `https://analyst.rizrazak.com/mullivaikkal-40000-who-decides-genocide/`.
- Update homepage `lastmod`.
- Update feed if this dossier should be distributed through RSS.
- Submit or ping sitemap through Google Search Console after deploy.

GEO / AI-search structure:

- Add a compact, source-safe summary block near the article head.
- Add FAQ-style sections only where they genuinely answer search queries:
  - Did 40,000 die in Mullivaikkal alone?
  - Where does the 40,000 number come from?
  - Does OISL prove the 40,000 death toll?
  - Who decides genocide?
  - What is the difference between deaths, missing, disappeared, and unaccounted?
- Keep every FAQ answer source-linked to the reference table.

## Immediate Next Steps

1. Run Google/TLLM Tamil draft once `GOOGLE_TRANSLATE_API_KEY` and `GOOGLE_CLOUD_PROJECT` are available in the shell.
2. Review Tamil hero/core claim, SEO section, words-before-numbers, numbers table, and civic test before injecting `data-ta`.
3. Keep the public language toggle at English/Sinhala until Tamil clears Elubaas/Mara review.
4. Run French only after Tamil confirms the structure.
5. Keep `ClaimReview` held until Mara signs off.
6. Submit or inspect the updated sitemap through Google Search Console after deploy.
7. Run visual QA and link checks after each language injection.
