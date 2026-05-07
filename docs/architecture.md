# analyst.rizrazak.com — Platform Architecture Document
**Version:** 1.0 | **Date:** 2026-03-11 | **Purpose:** Inform homepage redesign (Magazine + Command Centre)

---

## 1. Platform Overview

**analyst.rizrazak.com** is a Sri Lankan investigative journalism platform built on a serverless stack. Each dossier is a standalone, bilingual (EN/SI) HTML page deployed via GitHub Pages, with backend services on Cloudflare Workers and Supabase.

### Stack Summary

| Layer | Technology | Role |
|-------|-----------|------|
| Hosting | GitHub Pages (Cloudflare DNS/CDN) | Static file serving, edge caching |
| Compute | Cloudflare Workers (Pages Functions) | API endpoints, auth, publishing |
| State | Cloudflare KV (2 namespaces) | Session locks, drafts, OTP, submissions |
| Database | Supabase PostgreSQL | Comments, moderation, kanban, users |
| Auth | Supabase Auth + JWT cookies | MFA (TOTP), magic-link, AAL2 enforcement |
| Email | Resend API | OTP, submission confirmations, status updates |
| CMS | GitHub Contents API | Commit-based publishing from admin panel |
| Analytics | GA4 + Microsoft Clarity | Page views, engagement, heatmaps |

### Domain Architecture

```
analyst.rizrazak.com (Cloudflare Pages)
├── /<dossier-slug>/index.html     → Standalone dossier pages (7 published, 2 hidden)
├── /admin-preview.html            → Admin dashboard (8.5K lines, hash-routed SPA)
├── /admin-submissions.html        → Evidence submission queue
├── /login.html                    → Supabase auth (email + TOTP)
├── /profile.html                  → User security settings
├── /architecture-census/          → Infrastructure health monitor
├── /waren-yan/                    → WarenYan document portal (internal)
├── /data/dossiers.json            → Dossier registry (v2.0)
├── /_shared/                      → 22 shared CSS/JS components
└── /js/infra/                     → Infrastructure monitoring modules
```

---

## 2. Dossier Lifecycle

### Creation → Publication Flow

```
1. AUTHOR (Riz) writes HTML locally or in admin CMS editor
2. CMS acquires edit lock (KV, 5-min TTL with heartbeat)
3. Autosave to KV DRAFT_STORE (7-day TTL)
4. Publish: Base64-encode → GitHub Contents API PUT → commit to main
5. GitHub Pages auto-deploys (instant)
6. Middleware checks visibility status before serving
```

### Content Structure Per Dossier

Each dossier is a **self-contained HTML file** (1,100–3,400 lines) containing:
- All CSS inline (no build step)
- Bilingual content via `lang-en` / `lang-si` attributes
- CMS-editable sections via `data-cms-id` attributes
- Navigation auto-discovery via `data-nav-label` on `<section>` elements

### Shared Component Loading Order (end of body)

```html
<!-- 1. Narrative Timeline -->
<link rel="stylesheet" href="../_shared/narrative-timeline.css">
<script src="../_shared/narrative-timeline.js" defer></script>

<!-- 2. Category System -->
<link rel="stylesheet" href="../_shared/category-system.css">

<!-- 3. Privacy Banner (GDPR/PDPA) -->
<link rel="stylesheet" href="../_shared/privacy-banner.css">
<script src="../_shared/privacy-banner.js" defer></script>

<!-- 4. Comments v3 (Supabase) -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script>window.ANALYST_COMMENTS_CONFIG = { ... }</script>
<link rel="stylesheet" href="../_shared/comments-v3.css">
<script src="../_shared/comments-v3.js"></script>

<!-- 5. Sidenav (already linked in <head>) -->
<script src="../_shared/dossier-sidenav.js"></script>
```

---

## 3. Shared Component Library (`_shared/`)

### Core Layout (3 files, ~2,800 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `dossier-base.css` | 892 | Typography, colors, layout, dark mode, print styles. 30+ CSS custom properties. |
| `dossier-components.css` | 1,036 | Cards, timelines, tables, badges, callouts, accordions, scenario cards. |
| `dossier-interactive.css` | 861 | D3.js network maps, escalation ladders, game theory matrices, dashboards. |

### Navigation (5 files)

| File | Lines | Purpose | Global API |
|------|-------|---------|------------|
| `dossier-sidenav.js` | 257 | Desktop sidebar (220px) + mobile FAB + overlay drawer | `DossierSideNav.{open,close,toggle,update}` |
| `dossier-sidenav.css` | 262 | Sidenav styling, CSS custom properties for theming | — |
| `dossier-nav.js` | 251 | Horizontal section nav (auto-discovers `data-nav-label`) | — |
| `dossier-lang.js` | 105 | EN/SI toggle with localStorage persistence | — |
| `dossier-theme.js` | 173 | Dark/light toggle, system preference detection, iframe sync | — |

### Evidence System (5 files)

| File | Lines | Purpose |
|------|-------|---------|
| `evidence-system.css` | 186 | Evidence cards, ref-markers, category tags, verdict badges |
| `evidence-system.js` | 86 | Smooth scroll between ref-markers ↔ cards ↔ source index |
| `hover-preview.js` | 196 | Floating source preview panel on hover/focus |
| `video-evidence.js` | 84 | Play-on-demand video player for cached evidence |
| `video-evidence.css` | 109 | Video player overlay styling |

### Engagement (4 files)

| File | Lines | Purpose | Global API |
|------|-------|---------|------------|
| `comments-v3.js` | 696 | Supabase-powered threaded comments, FAB + slide-out panel | Auto-injects CSS |
| `comments-v3.css` | 502 | Comment panel styling (400px slide-out, responsive) | — |
| `privacy-banner.js` | 152 | GDPR/PDPA consent, IP fetch, 180-day retention | `AnalystPrivacy.{consented,ip,geo,hashIP}` |
| `privacy-banner.css` | 105 | Fixed bottom banner styling | — |

### Other (4 files)

| File | Lines | Purpose | Global API |
|------|-------|---------|------------|
| `dossier-disclaimer.js` | 137 | Blocking modal disclaimer with acceptance persistence | `DossierDisclaimer.reset()` |
| `dossier-analytics.js` | 265 | GA4 + Clarity event tracking, DNT-aware | `DossierAnalytics.{trackEvent,isEnabled}` |
| `narrative-timeline.css` | 328 | Scroll-position temporal bar with significance markers | — |
| `category-system.css` | 19 | 15-category color palette (Miyazaki green theme) | — |

**Total:** 22 files, ~5,400 lines of shared code

---

## 4. Backend Architecture

### Cloudflare Workers (collaborative-session.js + Pages Functions)

**Worker:** `analyst-collaborative-cms.riz-1cb.workers.dev`

#### API Endpoints (30+)

**Authentication & Sessions:**
- `POST /auth/session` — Store JWT cookies (httpOnly, Secure, SameSite=Strict)
- `GET /auth/logout` — Clear cookies, redirect to login
- `_middleware.js` — JWT verification + AAL2 enforcement on protected paths

**Comments (Public):**
- `GET /api/comments?dossier_id=` — Approved comments (limit 100)
- `POST /api/comments` — Submit (rate-limited: 3/15min/IP, honeypot, SHA-256 IP hash)

**Moderation (Admin, AAL2):**
- `GET /api/moderate?dossier_id=&status=` — Comments + stats
- `PATCH /api/moderate` — Approve/reject/flag with notes

**Collaborative Editing:**
- `POST /api/session/acquire-lock` — 5-min TTL edit lock
- `POST /api/session/release-lock` — Release lock
- `POST /api/session/heartbeat` — Keep lock alive
- `GET /api/session/status` — Lock state
- `POST /api/session/autosave` — Save draft to KV (7-day TTL)
- `GET /api/session/draft` — Retrieve draft
- `POST /api/session/handoff` — Transfer lock between editors
- `POST /api/session/publish` — Commit to GitHub + clear draft

**Evidence Submissions:**
- `POST /api/submissions/submit` — Public evidence intake (90-day KV TTL)
- `GET /api/submissions/list` — Admin view
- `POST /api/submissions/review` — Accept/reject with email notification

**CMS:**
- `GET /api/github/file?path=` — Fetch from repo
- `PUT /api/github/file` — Commit changes
- `POST /api/dossier/visibility` — Publish/hide dossier
- `GET /api/dossier/visibility/check` — Middleware gating (60s edge cache)

**OTP:**
- `POST /api/otp/send` — 6-digit code to admin (5-min TTL, 60s cooldown)
- `POST /api/otp/verify` — Single-use verification

**Email Templates:**
- `GET /api/email-templates/preview` — HTML preview with sample data
- `POST /api/email-templates/test` — Send test to admin

**Kanban (DGTL OS Phase 1):**
- `GET /api/projects` — List projects
- `GET /api/projects/:slug` — Project detail + boards
- `GET /api/boards/:id` — Board columns + tasks
- `POST /api/tasks/create` — Create task
- `PUT /api/tasks/:id` — Update task
- `PUT /api/tasks/:id/move` — Move between columns
- `POST /api/boards/:id/columns` — Add column

**Infrastructure:**
- `GET /api/infra/health` — System health
- `POST /api/privacy/anonymise` — IP anonymisation (cron: daily 3am UTC)

### KV Namespaces

| Namespace | ID | Purpose | Key TTLs |
|-----------|-----|---------|----------|
| SESSION_STORE | `edcba0db...` | Edit locks, OTP, visibility | Locks: 5min, OTP: 5min |
| DRAFT_STORE | `11fe938b...` | Drafts, submissions, published records | Drafts: 7d, Submissions: 90d, Published: 30d |

### Supabase Database (5 migrations)

**Tables:**
- `dossier_comments` — Anonymous public comments (id, dossier_id, parent_id, body, ip_hash, geo, status)
- `comments` — Authenticated comments (legacy, linked to auth.users)
- `comment_users` — User profiles (email, display_name, role, notification prefs)
- `moderation_log` — Audit trail (action, reason, old/new body)
- `comment_notifications` — Notification queue (type, sent status)
- `workspaces` — DGTL OS workspaces
- `projects` — Projects within workspaces
- `boards` — Kanban boards per project
- `board_columns` — Columns with WIP limits
- `tasks` — Cards with priority, labels, assignment
- `members` — Workspace members (Slack/Google integration fields)
- `activity_log` — Task activity audit

**Views:**
- `comment_counts` — Per-dossier comment stats
- `dossier_comment_counts` — Extended stats (approved/pending/flagged/rejected)

**Functions:**
- `anonymise_old_ips()` — SHA-256 hash IPs older than 180 days

### Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `GITHUB_REPO` | Yes | `riz-razak/analyst` |
| `GITHUB_BRANCH` | Yes | `main` (prod) |
| `GITHUB_TOKEN` | Yes (secret) | ⚠️ Not yet set — using localStorage PAT fallback |
| `RESEND_API_KEY` | Yes (secret) | Set in Worker |
| `SUPABASE_URL` | Yes | Project REST endpoint |
| `SUPABASE_SERVICE_KEY` | Yes (secret) | Server-side full access |
| `SUPABASE_JWT_SECRET` | Yes (secret) | JWT verification |

---

## 5. Admin Dashboard Architecture

**File:** `admin-preview.html` (8,572 lines, 427KB — single vanilla JS SPA)

### Views (hash-routed)

| Route | View | Data Source |
|-------|------|------------|
| `#/` | Analytics Dashboard | GA4 + Umami APIs |
| `#/cms` | CMS Overview | Feature cards, GitHub token config |
| `#/cms/dossiers` | Dossier Manager | `dossiers.json` + GitHub API |
| `#/cms/dossiers/:id` | Dossier Editor | GitHub file API + `data-cms-id` parser |
| `#/comments-mod` | Moderation Queue | Supabase via Worker `/api/moderate` |
| `#/boards` | Kanban Boards | Supabase via Worker `/api/boards` |
| `#/boards/:id` | Board Detail | Drag-drop columns + tasks |
| `#/infra` | Infrastructure Monitor | `/js/infra/` modules |
| `#/email` | Email Templates | Worker `/api/email-templates` |
| `#/submissions` | Evidence Queue | Worker `/api/submissions` |

### Infrastructure Monitor Modules (`/js/infra/`)

| File | Purpose |
|------|---------|
| `index.js` | Orchestrator (5-min polling, summary API) |
| `registry.js` | 13 services catalog (health configs, quotas, expiry dates) |
| `health-checker.js` | HTTP/DNS/script-presence health checks |
| `expiry-tracker.js` | Cert/token/domain expiry alerts (7d/30d/90d) |
| `notification-engine.js` | Toast + drawer notifications with localStorage persistence |

---

## 6. Dossier Inventory

### Published (7)

| ID | Title | Sections | Category | Unique Features |
|----|-------|----------|----------|----------------|
| `happy-womaniser-day` | Happy Womaniser Day! | 9 | social-commentary | Victim testimony, evidence cards |
| `caravan-fresh` | Caravan Fresh Chicken Cheese Bomb | 10 | corruption | 69-outlet map, pledge portal, disclaimer modal |
| `sri-lanka-cricket-corruption` | Death of Sri Lankan Cricket | 15 | corruption | D3.js conspiracy board, power network, analytics bar |
| `anatta-bamiyan` | The Form Was Empty — Anatta & Bamiyan | 8 | philosophy | Quantum physics parallels, objection cards |
| `sri-lanka-hormuz-crisis` | Sri Lanka & the Hormuz Crisis | 19 | geopolitics | Trilingual (EN/SI/TA), energy modelling |
| `iran-us-israel-war` | The War That Changed Everything | 14 | geopolitics | Political Jenga (D3.js), escalation ladder, decline scorecard |
| `easter-sunday-attacks-suresh-sallay` | The Sallay Arrest & Easter Sunday | 14 | geopolitics | Conspiracy board, game theory, scenario modelling |

### Hidden (2)

| ID | Status | Notes |
|----|--------|-------|
| `iran-us-israel-war` | hidden | Visibility-gated via Worker middleware |
| `easter-sunday-attacks-suresh-sallay` | hidden | Visibility-gated via Worker middleware |

### Internal (2)

| ID | Purpose |
|----|---------|
| `architecture-census` | Infrastructure health dashboard |
| `waren-yan` | WarenYan document portal |

### Pending (1)

| ID | Status |
|----|--------|
| `mp-accountability` | Directory exists, no index.html yet |

---

## 7. Design System Inventory

### Color Palette (Miyazaki Green Theme)

```
Primary:    #2d5a27 (Forest Green)
Secondary:  #4a7c59 (Sage)
Accent:     #d4a373 (Gold/Amber)
Alert:      #dc2626 (Red)
Warning:    #d97706 (Amber)
Background: #faf9f6 (Warm White — light)
            #0a0c10 (Near Black — dark)
```

### Category Colors (9 core + 6 reserved)

```
social-commentary, geopolitics, corruption, philosophy, ai-tech
(4 reserved slots for future categories)
```

### Typography

```
Serif:    Georgia, 'Noto Serif Sinhala'
Sans:     system-ui, 'Noto Sans Sinhala'
Mono:     'Source Code Pro', monospace
Sinhala:  'Noto Serif Sinhala', 'Noto Sans Sinhala'
```

### Z-Index Scale

```
Header:     100
Nav:        200
Sidenav:    800
Timeline:   900
FAB:        999
Panel:      1000
Modal:      5000
Tooltip:    9000
Privacy:    9000
```

---

## 8. Security Architecture

### Authentication Layers

```
Layer 1: Supabase Auth (email + password)
Layer 2: TOTP MFA (authenticator app)
Layer 3: JWT cookies (httpOnly, Secure, SameSite=Strict)
Layer 4: Middleware AAL2 verification on protected paths
Layer 5: Dossier visibility gating (Worker check + 60s edge cache)
```

### Data Protection

- IP addresses: Never stored raw. SHA-256 hashed on submission, auto-anonymised after 180 days.
- Comment moderation: All public comments require admin approval.
- Rate limiting: 3 comments per 15 minutes per IP.
- Honeypot: Hidden form field rejects bots.
- Spam filter: 30+ signals, auto-approve/moderate/reject scoring (0–100).
- Protected paths: Admin pages, analytics, source files require AAL2 JWT.

---

## 9. Deployment Pipeline

```
Author writes/edits HTML
    ↓
Admin CMS Editor (acquires lock → autosave → publish)
    ↓
GitHub Contents API PUT (commit to main)
    ↓
GitHub Pages auto-deploy (instant)
    ↓
Cloudflare edge cache serves
    ↓
Middleware: visibility check (published → serve, hidden → 404)
```

**No build step.** HTML is deployed as-is. This is both a strength (zero-config deploys, full control) and a constraint (no component compilation, no CSS extraction, no tree-shaking).

---

## 10. Redesign Considerations

### What the Homepage Must Do

1. **Serve as a magazine front page** — visually showcase dossiers with compelling imagery, category badges, and excerpt text
2. **Serve as a command centre** — provide at-a-glance status of all dossiers, comments, infrastructure health
3. **Target Sri Lankan users** — bilingual (EN/SI), culturally relevant design, mobile-first (majority mobile users), respect for conservative design expectations while being modern
4. **Data source:** `dossiers.json` (v2.0) — 7 published dossiers, 2 internal tools

### Current Homepage State

There is **no dedicated homepage SPA**. The current `index.html` (if it exists) likely redirects or serves a basic listing. The admin dashboard (`admin-preview.html`) is the only SPA in the codebase — it's a 427KB monolith.

### Architecture Constraints for Redesign

1. **No build step** — any homepage must work as static HTML/JS deployed to GitHub Pages
2. **Dossiers are standalone** — each is a self-contained HTML file, not generated from templates
3. **Shared components exist** — `_shared/` library can be extended for homepage-specific components
4. **API endpoints exist** — comment counts, dossier visibility, analytics can feed homepage widgets
5. **Category system deployed** — 9 categories with color codes ready for badges/filters
6. **Bilingual required** — all user-facing text needs EN + SI
7. **Mobile-first** — Sri Lankan audience predominantly mobile
8. **Dark mode expected** — system already supports it across all dossiers

### Recommended Approach

The homepage should be a **new static HTML file** (`/index.html`) that:
- Fetches `dossiers.json` on load
- Renders dossier cards in a magazine grid layout
- Includes category filters, search, and sort
- Shows live comment counts and status indicators
- Supports both "Magazine View" (visual, imagery-heavy) and "Command Centre View" (list, data-dense)
- Reuses shared CSS variables and typography from `_shared/dossier-base.css`
- Is bilingual with the existing language toggle pattern

---

## 11. File Tree (Key Files Only)

```
analyst-site/
├── public/
│   ├── index.html                        ← HOMEPAGE (to be redesigned)
│   ├── admin-preview.html                ← Admin SPA (8.5K lines)
│   ├── admin-submissions.html            ← Evidence queue
│   ├── login.html                        ← Supabase MFA auth
│   ├── profile.html                      ← User security
│   ├── _analytics_events.js              ← GA4 custom events
│   ├── _shared/
│   │   ├── dossier-base.css              ← Core layout (892 lines)
│   │   ├── dossier-components.css        ← Reusable components (1,036 lines)
│   │   ├── dossier-interactive.css       ← Viz components (861 lines)
│   │   ├── dossier-sidenav.{css,js}      ← FAB + sidebar nav
│   │   ├── dossier-nav.js                ← Horizontal nav
│   │   ├── dossier-lang.js               ← Language toggle
│   │   ├── dossier-theme.js              ← Dark mode
│   │   ├── dossier-disclaimer.js         ← Modal disclaimer
│   │   ├── dossier-analytics.js          ← GA4 + Clarity
│   │   ├── narrative-timeline.css        ← Timeline bar
│   │   ├── category-system.css           ← Category colors
│   │   ├── evidence-system.{css,js}      ← Evidence cards
│   │   ├── hover-preview.js              ← Source preview
│   │   ├── video-evidence.{css,js}       ← Video player
│   │   ├── comments-v3.{css,js}          ← Supabase comments
│   │   ├── privacy-banner.{css,js}       ← GDPR/PDPA banner
│   │   └── SIDENAV-PROTOCOL.md           ← Integration docs
│   ├── data/
│   │   └── dossiers.json                 ← Dossier registry (v2.0)
│   ├── js/infra/
│   │   ├── index.js                      ← Infra orchestrator
│   │   ├── registry.js                   ← 13 services catalog
│   │   ├── health-checker.js             ← Health pings
│   │   ├── expiry-tracker.js             ← Cert/token alerts
│   │   └── notification-engine.js        ← Toast notifications
│   ├── anatta-bamiyan/index.html         ← Philosophy dossier
│   ├── caravan-fresh/index.html          ← Consumer advocacy
│   ├── easter-sunday-.../index.html      ← Political dossier (hidden)
│   ├── happy-womaniser-day/index.html    ← Media accountability
│   ├── iran-us-israel-war/index.html     ← Geopolitics (hidden)
│   ├── sri-lanka-cricket-.../index.html  ← Corruption dossier
│   ├── sri-lanka-hormuz-.../index.html   ← Energy geopolitics
│   ├── waren-yan/index.html              ← Internal portal
│   ├── architecture-census/index.html    ← Infra monitor
│   └── mp-accountability/                ← Pending (empty)
├── functions/
│   ├── _middleware.js                    ← JWT + visibility gate
│   ├── auth/session.js                   ← Set auth cookies
│   ├── auth/logout.js                    ← Clear cookies
│   ├── api/comments.js                   ← Public comments
│   ├── api/moderate.js                   ← Admin moderation
│   └── collaborative-session.js          ← 30+ API endpoints
├── supabase/migrations/
│   ├── 001_comments.sql                  ← Basic comments table
│   ├── 002_comments_phase3.sql           ← Extended comments + moderation
│   ├── 003_dgtl_os_phase1.sql            ← Kanban tables + seed data
│   ├── 004_ip_anonymisation_cron.sql     ← Privacy function
│   └── 005_anonymous_dossier_comments.sql ← Public comments table
├── wrangler.toml                         ← Worker config, KV, cron
├── package.json                          ← Build config
├── PROJECT_TRACKER.md                    ← Living task tracker
├── EVIDENCE_PROTOCOL.md                  ← Evidence pipeline docs
├── ETHICS_PROTOCOL.md                    ← Source protection docs
└── ARCHITECTURE.md                       ← THIS FILE
```

---

*This document serves as the foundation for the Magazine + Command Centre homepage redesign. All architectural decisions for the redesign should reference this document to ensure compatibility with the existing platform.*
