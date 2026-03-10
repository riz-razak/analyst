# analyst.rizrazak.com — Living Project Tracker
**Last updated:** 2026-03-11 (session 5)
**Managed by:** Claude (Cowork)
**Repo:** `riz-razak/analyst` → GitHub Pages → `analyst.rizrazak.com`

---

## 🔴 CRITICAL / IN PROGRESS

*(No critical items — all moved to completed or pending)*

---

## 🟡 PENDING / PLANNED

- [x] **Admin CMS Dashboard — Phase 0 deployed** *(2026-03-11)*
  - CMS Overview: GitHub connection + token input (localStorage), feature cards
  - Dossier Manager: 8 dossier cards with status badges, Edit / View Live actions
  - Dossier edit view: smart `[data-cms-id]` section parser, raw HTML fallback, save+commit, visibility toggle
  - Worker endpoints: `GET /api/github/file`, `PUT /api/github/file`
  - Routing fix: CMS sub-views (`#/cms/dossiers`, `#/cms/dossiers/:id`) now render via `navigateToRoute`
  - Commits: `f4b59a1` (initial), `f7665b9` (routing fix)
  - ⚠️ **One-time setup required**: Add `GITHUB_TOKEN` to Cloudflare Worker secrets (Cloudflare Dashboard → Workers & Pages → `analyst-collaborative-cms` → Settings → Variables & Secrets → Add `GITHUB_TOKEN` as Secret). Without this, the CMS uses localStorage PAT fallback only.
  - Remaining phases: (2) Image manager → (3) Deploy button

- [x] **Women's Day Betrayal — Sinhala translations complete** *(2026-03-11)*
  - All 96 `lang-si` elements translated: hero, timeline, cast, Q&A, source index, evidence sections

- [x] **Women's Day Betrayal — In-text S1–S11 source references** *(2026-03-09)*
  - Added inline `[SX]` markers throughout all body text sections
  - Added anchor IDs to evidence cards and source index rows
  - Bidirectional navigation: body text → evidence cards → source index → back

- [x] **Narrative Timeline Positioning Bar — deployed to all dossiers** *(2026-03-11)*
  - Reusable component: `_shared/narrative-timeline.css` + `_shared/narrative-timeline.js`
  - Integrated into all 9 dossier pages with custom timeline events (6-9 events each)
  - Features: scroll-position tracking, significance markers (critical/important/context), hover cards, keyboard toggle (T key), localStorage preference
  - CMS toggle via `data-cms-id="narrative-timeline-toggle"`

- [x] **Platform Category System — deployed** *(2026-03-11)*
  - 9 core categories + 6 reserved slots in `_shared/category-system.css` (Miyazaki green palette)
  - Categories assigned: social-commentary, geopolitics, corruption, philosophy, ai-tech
  - Category badges in admin panel: grid view, table view, CMS dossier manager
  - `dossiers.json` updated with `category` field for all dossiers

- [x] **Comments System v3 — deployed** *(2026-03-11)*
  - SQL: `comment_users`, `moderation_log`, `comment_notifications` tables + RLS + views
  - Worker: `/api/comments/list`, `/create`, `/moderate`, `/pending` endpoints
  - Frontend: `_shared/comments-v3.js` (487 lines) + `comments-v3.css` — FAB + slide-out panel
  - Admin: moderation queue view `#/comments-mod` with approve/reject/flag
  - Threading: 3 levels, collapse/expand, rate limiting (3 per 15min)
  - Integrated on `sri-lanka-cricket-corruption` — remaining dossiers need rollout
  - ⚠️ Requires: run `supabase/migrations/002_comments_phase3.sql` on Supabase

- [ ] **DGTL OS Phase 1 — Kanban boards** *(2026-03-11, code complete)*
  - SQL: `workspaces`, `projects`, `boards`, `board_columns`, `tasks`, `members`, `activity_log` tables
  - Seed data: DGTL workspace, 3 projects (Analyst/WarenYan/Kunatu), 4 boards, default columns
  - Worker: 7 endpoints — projects list/detail, boards detail, tasks CRUD, task move, add column
  - Admin: Boards list `#/boards` + Kanban detail `#/boards/:id` with HTML5 drag-drop
  - ⚠️ Requires: run `supabase/migrations/003_dgtl_os_phase1.sql` on Supabase

- [x] **Caravan Fresh — Pledge portal iframe embed verified** *(2026-03-11)*
  - iframe loads `pledge-portal.html?lang=` with bilingual param passing ✅

- [ ] **Caravan Fresh — Evidence 37 review**
  - Confirmed not present on live page — no action needed unless new evidence surfaces

---

## ✅ COMPLETED

- [x] **Caravan Fresh — Evidence 36 commenter name censored** *(2026-03-09)*
  - Censored "Rasheed Ramlan" name + profile photo via browser canvas
  - Committed: `"Censor commenter name in Evidence 36 screenshot"`

- [x] **Caravan Fresh — Pledge portal deployed with new features** *(2026-03-09)*
  - Added: `.embedded .lang-toggle{display:none}`, `?lang=` URL param inheritance, live pledges feed (`renderPledgeFeed`, `getTimeAgo`)
  - Committed: `"Update pledge portal: inherit language from parent, add live pledges feed"`

- [x] **Caravan Fresh — CTA button bilingual text** *(earlier session)*
  - Fixed CTA button with `data-lang` EN/Sinhala spans

- [x] **Caravan Fresh — Pledge portal initial build** *(earlier session)*
  - Admin password overlay, PledgeDB localStorage, currency/type toggle, email confirmation worker

- [x] **Women's Day Betrayal — Evidence cards now always-visible inline** *(2026-03-09)*
  - 4 evidence cards (S1, S2, S3, S8/S9) permanently visible below each source link
  - Cards include: source badge, source name, key quote, metadata, colored category tag
  - Sage-mist background with forest-green left border accent
  - Committed: `"Make evidence source cards always visible inline"`

- [x] **Evidence chain architecture + bidirectional linking** *(2026-03-09)*
  - S3 reclassified from TESTIMONY to COMMENTARY (Prabha Manuratne's article is analytical, not personal testimony)
  - Inline `[SX]` reference markers throughout all body sections
  - Anchor IDs on evidence cards (`ev-S1`, `ev-S2`, etc.) and source index rows (`src-S1`, etc.)
  - Verdict badges (VERIFIED/DOCUMENTED) on all evidence cards
  - Bidirectional navigation links (markers → cards → index ↔ back)
  - New CSS: `.ec-tag.commentary`, `.ref-marker`, `.ev-verdict`, `.ev-nav-link`
  - Committed: `"Evidence chain architecture + ethics protocol"`

- [x] **Ethics & Source Protection Protocol created** *(2026-03-09)*
  - Source protection, victim-centered reporting, censoring protocol, digital security
  - Comment moderation ethics, legal compliance checklist, corrections policy
  - File: `ETHICS_PROTOCOL.md` in repo root

- [x] **Shared evidence system modules created** *(2026-03-09)*
  - `public/dossiers/_shared/evidence-system.css` — all evidence card styles, tags, badges
  - `public/dossiers/_shared/evidence-system.js` — smooth scroll, highlight, hash navigation

- [x] **Evidence Pipeline Protocol document created** *(2026-03-09)*
  - Full 10-stage pipeline: Capture → Verify → Classify → Format → Embed → Cite → Deploy
  - HTML/CSS templates, category tag system, naming conventions, checklists
  - Updated: COMMENTARY tag, verdict system, shared module docs, cross-references
  - File: `EVIDENCE_PROTOCOL.md` in repo root

- [x] **Women's Day Betrayal — Evidence hover preview cards (original, superseded)** *(2026-03-09)*
  - Originally deployed as hover-only cards, then fixed to always-visible inline (see above)
  - Committed: `"Add evidence hover previews and comments system"` + `"Fix hover preview CSS: use sibling selectors"`

- [x] **Women's Day Betrayal — Comments system deployed** *(2026-03-09)*
  - Full custom comments system ported from cricket dossier and adapted to warm green theme
  - Features: FAB button, sliding panel, TOS liability modal, localStorage-backed, rate limiting, reply threading, anonymous avatars
  - Formspree ID placeholder (`YOUR_FORMSPREE_ID`) — email notifications not yet active
  - Committed with the evidence hover previews above

- [x] **Women's Day Betrayal — Initial dossier page built** *(earlier session)*
  - Full bilingual structure, timeline, cast, voices, Q&A, source table
  - Hover preview CSS/JS infrastructure in place

---

## 🏗️ INFRASTRUCTURE NOTES

| Item | Status | Notes |
|------|--------|-------|
| GitHub Pages | ✅ Live | `main` branch → instant deploy |
| Domain | ✅ `analyst.rizrazak.com` | |
| Caravan Fresh dossier | ✅ Live | `/dossiers/caravan-fresh/` |
| Pledge portal | ✅ Live | `/dossiers/caravan-fresh/pledge-portal.html` |
| Women's Day dossier | ✅ Live | `/dossiers/womens-day-betrayal/` — inline evidence cards + comments system |
| Evidence Protocol | ✅ Created | `EVIDENCE_PROTOCOL.md` — full pipeline reference with verdict system |
| Ethics Protocol | ✅ Created | `ETHICS_PROTOCOL.md` — source protection, victim-centered reporting |
| Shared Evidence System | ✅ Created | `_shared/evidence-system.css` + `_shared/evidence-system.js` |
| Admin dashboard | ✅ Phase 0 live | CMS Overview + Dossier Manager at `#/cms` |
| Infrastructure Monitor | ✅ Live | `/architecture-census/` — all 9 services healthy |
| Email worker | ✅ Cloudflare Worker | Pledge confirmation emails |
| GitHub API write access | ⚠️ PAT via localStorage | `GITHUB_TOKEN` Worker secret not yet set |

---

## 📋 PROCESS RULES (Claude standing instructions)

1. **This file must be updated at the end of every working session** — cross off completed items, add newly discovered issues
2. **Never deploy without verifying** on the live site after commit
3. **Evidence images approach**: base64-embed in HTML (GitHub Pages static constraint) — use browser canvas method to capture + encode
4. **Language**: all user-facing text must be bilingual EN + Sinhala (`.en` / `.si` spans or `lang-en` / `lang-si` attributes)
5. **Admin password**: `Pavurapledge@2026` (consistent across all admin overlays)
6. **Repo path**: `public/dossiers/[dossier-name]/index.html`
