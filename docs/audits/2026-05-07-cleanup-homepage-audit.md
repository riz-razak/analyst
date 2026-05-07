# 2026-05-07 Cleanup And Homepage Audit

## Scope

- Cleaned the Analyst repo root so handoffs, archived mockups, stale docs, translations, patches, and maintenance scripts are grouped under stable directories.
- Preserved the Analyst magazine homepage handoff zip and extracted source under `docs/handoff/homepage/`.
- Archived the old React search/list homepage as reference only.
- Implemented the new magazine/FYP homepage in `src/pages/HomePage.jsx` with styles in `src/styles/magazine.css`.
- Updated the repo instruction file to match the current React/Vite app and domain split.

## Preserved References

- Homepage handoff zip: `docs/handoff/homepage/analyst-homepage-handoff.zip`
- Extracted handoff: `docs/handoff/homepage/analyst-homepage-handoff/`
- Definitive mockup: `docs/handoff/homepage/analyst-homepage-handoff/mockups/magazine-v7-full.html`
- Old homepage reference: `docs/archive/old-homepage/HomePage.search-list.jsx`
- Archived root mockups: `docs/archive/mockups/root-mockups-2026-05-07/`

## Verification

- Ran `npm ci` in `/Users/rizrazak/Code/the-analyst` because `vite` was not installed locally.
- Ran `npm run build` in `/Users/rizrazak/Code/the-analyst`: passed.
- Ran `npm ci` in `/Users/rizrazak/Code/rizrazak-site` because `vite` was not installed locally.
- Ran `npm run build` in `/Users/rizrazak/Code/rizrazak-site`: passed.
- Added ESLint 9 flat config files to both repos so `npm run lint` can execute.
- Ran `npm run lint` in `/Users/rizrazak/Code/the-analyst`: passed with no warnings.
- Ran `npm run lint` in `/Users/rizrazak/Code/rizrazak-site`: passed with no warnings.

## Legacy Harness Artifact Check

- Renamed the root assistant instruction file to `Yan-Analyst.md`.
- Confirmed no hidden legacy assistant harness directory exists in the Analyst repo.
- Confirmed no provider-specific assistant SDK package/artifact filenames exist in the Analyst repo.
- Removed operational legacy assistant references from `public/admin-preview.html`.
- Repointed translation policy references to `Yan-Analyst.md`.
- Replaced provider-specific public AI disclosure in `public/iran-us-israel-war/index.html` with provider-neutral wording. Sinhala replacement came from Google Translate endpoint.
- Relabelled legacy cached Sinhala translation comments in the Galanguru dossier as requiring Google translation audit, without editing the cached Sinhala strings.
- Rebuilt `dist/` after artifact cleanup and confirmed the targeted source and generated assets are clean.

## Notes

- `npm ci` reported 5 dependency vulnerabilities in each repo: 2 moderate and 3 high. No audit fix was applied.
- Analyst lint is clean after small warning fixes in `src/components/SessionManager.jsx`, `src/hooks/useInfiniteScroll.js`, and `src/pages/DossierPage.jsx`.
- The Galanguru cached Sinhala strings remain a translation provenance risk until audited against Google output.
- `Yan-Analyst.md` now records provider-neutral, merit-ranked model cascade guidance, a monthly Sinhala translation efficacy review mandate, and queues https://huggingface.co/papers/2508.09115 for later testing.
- Superseded by `docs/handoff/2026-05-07-final-handover.md` for final commit and push status.
- `www.rizrazak.com` changes belong in `/Users/rizrazak/Code/rizrazak-site`, not this repo.
