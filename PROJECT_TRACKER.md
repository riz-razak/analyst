# analyst.rizrazak.com — Living Project Tracker
**Last updated:** 2026-03-09 (session 4)
**Managed by:** Claude (Cowork)
**Repo:** `riz-razak/analyst` → GitHub Pages → `analyst.rizrazak.com`

---

## 🔴 CRITICAL / IN PROGRESS

*(No critical items — all moved to completed or pending)*

---

## 🟡 PENDING / PLANNED

- [ ] **Admin CMS Dashboard** — full content management portal
  - Image swap via GitHub API (no more base64 gymnastics)
  - Inline text editing with real-time deploy
  - Password-protected, bilingual EN/Sinhala
  - No backend — GitHub API calls from browser using PAT
  - Cloudflare Worker available for API proxying if needed
  - Phases: (1) GitHub API read/write scaffold → (2) Image manager → (3) Text editor → (4) Deploy button

- [ ] **Women's Day Betrayal — Sinhala translations incomplete**
  - Most `lang-si` elements have `style="display:none"` and some are empty or missing

- [x] **Women's Day Betrayal — In-text S1–S11 source references** *(2026-03-09)*
  - Added inline `[SX]` markers throughout all body text sections
  - Added anchor IDs to evidence cards and source index rows
  - Bidirectional navigation: body text → evidence cards → source index → back

- [ ] **Narrative Timeline Positioning Bar** — subtle temporal position indicator
  - Shows reader's position in the narrative timeline as they scroll
  - Significance labels on key moments, hover cards for context
  - Toggle-off option in CMS (`data-cms-id` attribute for admin control)
  - Reusable component: `_shared/narrative-timeline.css` + `_shared/narrative-timeline.js`
  - Standard for all dossier storytelling

- [ ] **Platform Category System** — Miyazaki green palette
  - Categories (max 20, always consolidate): Policy & Law, Geopolitics & Breaking News, Philosophy, Social Commentary, AI & Tech, Anarchist Social-Capitalism, Corruption & Mismanagement, Not Too Serious, Social Change
  - Color palette derived from central Miyazaki green (`--forest`)
  - Category tags on dossier cards, section headers, navigation

- [ ] **Comments System Overhaul (Phase 3)** — Supabase backend
  - User accounts with email (required), display names, magic link auth
  - Threaded comments with collapse/expand (max 3 levels)
  - WhatsApp community prompt (placeholder link)
  - Admin moderation, rate limiting, email notifications
  - Deferred to dedicated session

- [ ] **Caravan Fresh — Pledge portal iframe embed on main page**
  - Portal deployed ✅ — verify it's correctly embedded in the Caravan Fresh index.html iframe with `?lang=` param passing

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
| Admin dashboard | 🔴 Not built | `admin-preview.html` is a mockup only |
| Email worker | ✅ Cloudflare Worker | Pledge confirmation emails |
| GitHub API write access | ❌ Not configured | Needed for CMS feature |

---

## 📋 PROCESS RULES (Claude standing instructions)

1. **This file must be updated at the end of every working session** — cross off completed items, add newly discovered issues
2. **Never deploy without verifying** on the live site after commit
3. **Evidence images approach**: base64-embed in HTML (GitHub Pages static constraint) — use browser canvas method to capture + encode
4. **Language**: all user-facing text must be bilingual EN + Sinhala (`.en` / `.si` spans or `lang-en` / `lang-si` attributes)
5. **Admin password**: `Pavurapledge@2026` (consistent across all admin overlays)
6. **Repo path**: `public/dossiers/[dossier-name]/index.html`
