---
title: "Standard — Analyst Platform Design System & Dashboard-in-Admin"
date: "2026-06-19"
owner: "Standards: Ridma #44 (lead), Nuwan #42, Aether #3 · reviewed by Tech Review"
status: "spec — implementation gated behind Tech Review + founder go"
source: "docs/design-system.md, _shared/dossier-base.css, public/admin-preview.html, the media-model dashboard"
tags: ["design-system","tokens","admin","dashboard","plotly","standards","analyst"]
---

# Platform Design System & Dashboard-in-Admin — Standard

## A. Platform design standard

**Problem found:** four greens (`#2D6A4F`, `#1B4D2E`, `#2d5a27`, gold-era `#a88700`) and three
off-whites across reader shell / admin / dashboard; the reader shell (`dossier-base.css`) **violates
design-system.md law** (ships dark mode, `backdrop-filter` blur, FAB, animations). `design-system.md`
is the law; nothing fully obeys it.

**Token architecture — shared core + thin surface overrides:**
- **`_shared/yan-core.css` (canonical = design-system.md made real):** `--bg #FAFAF8`, `--surface #FFF`,
  `--border #E5E1DA`, `--text #1A1A2E`, `--text-secondary #4A4A5A`, **`--accent #2D6A4F`** (the one
  green; `#1B4D2E` only as hover), **`--earth #C4A35A`** (the one gold), status colors + subtle fills;
  fonts Inter (body) / Playfair (display only) / Noto SI+TA; 8pt space scale; sm/md radius; subtle shadows.
- **`reader.css` overrides:** body 16px, serif H1/H2 (the one sanctioned 48px exception), generous
  rhythm. **Strip:** `[data-theme=dark]`, `backdrop-filter`, `.floating-pledge` FAB, fadeIn/slideIn.
- **`admin.css` overrides:** body 13px, sans only, dense spacing, tables-first; warm-map the sidebar grey.
- **Components (shared, themed by layer):** card (no gradients), button (primary/secondary/text), table
  (default for data), status pill (subtle fill, no glow/pulse), badge, nav-item, form input (focus ring
  no glow), KPI tile. **Masthead/nav contract:** public reader shell ≠ admin shell; **no bridging nav**;
  admin reachable only via direct URL → forced `/auth/unified/start`; shared tokens/components, never
  shared navigation/session. Remove the reader theme toggle (light-only law); keep EN/SI/TA toggle.
- **Alignment:** React app + static dossiers + admin all `<link>` `yan-core.css` first; migrate (alias
  old token names → new) rather than rewrite. **a11y:** WCAG AA contrast, visible focus rings,
  `prefers-reduced-motion`, Plotly charts need an `sr-only` data table + `aria-label`.
- **Sister-brand look:** Bawa Earth palette + Inter + warm off-white is the Yan family signature; per-brand
  expression only in density + type personality (Analyst reader = serif-display; ops tools = sans-dense).

## B. Dashboard-in-admin integration spec

- **Route:** add `'/business-model': {view:'business-model', private:true, right:'analyst.analytics.view'}`
  to admin's routes map; container `<div class="view" id="view-business-model">`; sidebar entry under a
  new "Business" group.
- **Auth gate:** current SPA gate is coarse (`private && admin && mfa`) and ignores per-route rights —
  add right-level gating: store `appState.rights` from `/auth/me`, and in `navigateToRoute` deny if
  `routeInfo.right` not in rights (in-app "right denied" panel). **Server-side is the real gate** — fine
  to ship client-only **v1 because the dashboard is data-less/read-only**, but register
  `analyst.analytics.view` in the People model and add a server route-gate **stub** in the same PR so it
  can't be forgotten if it ever pulls live data.
- **Load strategy — EMBED (recommended):** inline the dashboard body + script into the view; Plotly loaded
  **once** from CDN (`plotly.js 2.35.2`, **SRI-pinned**); namespace the dashboard globals (`BM.*`) to
  avoid collisions; call `renderBusinessModel()` on view-activate (re-`react()` so charts size after
  un-hide). **Keep the standalone file** for offline presenting; treat standalone as source, admin view
  as a generated include (tiny build step) to avoid drift.
- **Styling:** drop dashboard's own greens/gold → map to core tokens; no colored header (use admin
  topbar title); red banner → `--red-subtle` note.
- **Data boundary:** model assumptions only — **zero PII, zero member data, read-only.** "Membership"
  appears only as an excluded revenue-stream label. If a future version pulls live numbers → move behind
  a Worker endpoint enforcing `analyst.analytics.view` server-side + Hasib sign-off (SD-COMMS-COMPLIANCE-2).

## Tech Review verdict (summary)
B5 dashboard embed = **GO** (ship server-gate stub + SRI). B4 token migration = **GO as its own
screenshot-diffed pass — never bundle with the auth fix** (single 6.5k-line admin file, high visual-
regression surface). Reader-shell law violations = separate compliance ticket.
