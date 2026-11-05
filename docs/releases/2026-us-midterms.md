# 2026 US midterms article release

Objective: publish the reviewed 3,106-word report on analyst.rizrazak.com under the requested headline, with a real-image thumbnail. Base: c0b50e1. Branch: codex/us-midterms-2026-publish. Scope: new static article/assets, dossier registry, sitemap and feed. Existing dirty work in the primary checkout is excluded.

Evidence: source report at `/Users/rizrazak/Code/research/Political/2026/11. 2026 US Midterms/04-output/report.md`; two final fact checks and two design/browser checks there. The photograph is credited to Jonathon Arms / National Park Service via US Fish and Wildlife Service, explicitly public domain. Election figures retain their 4 November snapshot and status.

Five bounded lenses: evidence — preserve the reviewed report and dates; product — show article in the dossier feed and direct route; creative — use the real Capitol photograph for card, page and social preview; technical — copy self-contained HTML, CSS and raster assets; adversarial/accessibility — verify source links, alternate text, mobile width, image loading, and no missing local resources.

QA: `npm run build`; local desktop/mobile browser checks; homepage card present; XML parsed. Rollback: revert the release commit on main to remove the new article, registry entry and feed/sitemap links. Production verification: check direct URL, homepage card, thumbnail, and social image after Pages deployment.
