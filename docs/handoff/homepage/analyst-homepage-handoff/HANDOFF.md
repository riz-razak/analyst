# The Analyst · Homepage Redesign — Complete Handoff Package

**Prepared:** 7 May 2026
**Author:** Riz Razak (riz@dgtl.lk)
**Target:** analyst.rizrazak.com homepage
**Status:** Mockup complete, production build ready to start

---

## 1. What This Package Contains

This is a self-contained handoff of the homepage redesign for "The Analyst" — a Sri Lankan investigative journalism platform. Everything needed to build the production homepage is here: design decisions, design rules, palette, typography, component specifications, animation specs, data structures, rejected approaches, and the final mockup HTML.

### Files in this package:

- `HANDOFF.md` — This document (master reference)
- `BUILD_PLAN.md` — Step-by-step production build plan with component list and file structure
- `COMPONENT_SPEC.md` — Detailed component-level specifications with props, states, and CSS
- `mockups/magazine-v7-full.html` — **THE definitive mockup** (open in browser, fully interactive)
- `mockups/magazine-v6-nav.html` — Navigation variants explored
- `mockups/magazine-v5-tools.html` — Tools section variants explored
- `mockups/magazine-v4-3.html` — Base magazine layout

---

## 2. Project Context

"The Analyst" is a one-person investigative journalism platform focused on Sri Lankan geopolitics, governance, corruption, and accountability. The site publishes long-form "dossiers" (investigative reports), runs live analytical tools (Hormuz Oracle, Shipping Lane Monitor, etc.), and maintains an MP Accountability Tracker.

The homepage redesign transforms a basic search-and-filter list into a newspaper-style magazine front page inspired by the H3 Gazette / Al Jazeera / A1 broadsheet aesthetic, rendered in a Bawa Tropical Modernist design language.

### Current tech stack (unchanged):
- React 19 + React Router 7
- Vite 7 (SPA build)
- Fuse.js (search)
- Vanilla CSS (custom properties, no Tailwind)
- GitHub Pages via GitHub Actions (push to main → build → deploy)
- Data: static `dossiers.json` in `/public/data/`

---

## 3. Design Language: Bawa Tropical Modernism

Named after Geoffrey Bawa, Sri Lanka's most celebrated architect. The palette draws from tropical earth, jungle canopy, terracotta tile, and plaster walls. No cold grays, no neon, no glassmorphism.

### 3.1 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--jungle` | `#1B3A2D` | Primary dark green. Nameplate border, menu panel bg, hero gradient, strip border, active states |
| `--canopy` | `#3D7A5A` | Secondary green. Hover states, category badges, "For you" indicators |
| `--terracotta` | `#A0522D` | Accent. Kickers, progress bar, "Exclusive" tags, the dot in "The Analyst ·" |
| `--plaster` | `#F5F1E6` | Main background. Body bg, text on dark surfaces |
| `--ochre` | `#C9A96E` | Gold accent. Menu labels, intel kickers, internal accountability dot, "Editor Pinned" labels |
| `--near-black` | `#1A1815` | Primary text color |
| `--stone` | `#7A6F65` | Secondary/muted text. Metadata, labels, dates |
| `--white` | `#FFFFFF` | Card backgrounds, nameplate bg |
| `--border` | `#E5DDD0` | Default borders |
| `--border-light` | `#EDE8DE` | Light borders (article separators, tag borders) |
| `--surface` | `#FAF8F2` | Interactive surface bg (tags, footer) |
| `--surface-hover` | `#F0EDE4` | Hover state for surfaces |
| `--red-urgent` | `#8B2020` | External accountability alerts (dot, label) |
| `--red-bg` | `rgba(139,32,32,0.06)` | Accountability strip hover bg |
| `--red-border` | `rgba(139,32,32,0.15)` | Accountability ticker border |

### 3.2 Typography

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| Display / Headlines | Playfair Display | 700, 800 | H1 brand (28px/800), hero title (26px/800), strip titles (14px/700), article titles (15px/700), FYP titles (20px/800), intel figures (24px/800) |
| Body / UI | Inter | 400, 500, 600 | Body text (13px/400), article excerpts (12-13px/400), menu links (15px/500), sidebar titles (12px/600) |
| Mono / Labels | JetBrains Mono | 400, 500 | All metadata, kickers, filters, badges, stats, dates (9-11px), location, date/time |

**Font loading (Google Fonts):**
```
Playfair Display: ital,wght@0,700;0,800;1,700
Inter: wght@400;500;600
JetBrains Mono: wght@400;500
```

### 3.3 Spacing & Geometry

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `3px` | Small corners: tags, buttons, filter tabs, thumbnails |
| `--radius-md` | `6px` | Card corners: hero card, intel card, tool card, FYP cards, menu panel elements |
| `--shadow-lift` | `0 4px 20px rgba(26,24,21,0.08)` | Card elevation on hover/float |
| `--t` | `0.15s ease` | Default transition for all interactive states |

### 3.4 Design Rules (MUST follow)

1. **No glassmorphism** — no backdrop-filter, no frosted glass
2. **No AI-glow** — no neon gradients, no pulsing glow effects (except accountability dot pulse)
3. **No cold grays** — every gray must be warm (stone-toned)
4. **No infinite scroll** — pagination only
5. **Max 0.15s transitions** — except strip flip (350ms) and ticker flip (150ms)
6. **Solid backgrounds** — no transparency on main surfaces
7. **Light mode always default** — dark mode exists but never first
8. **No carousel** — flip animation only (departure-board style)
9. **WCAG AA contrast** — 4.5:1 minimum for body text
10. **Data honesty** — never label something "Live" if it lacks real data
11. **Bilingual-ready** — `lang-en` / `lang-si` attributes, Google Cloud Translation API v3 Advanced only (no AI translations)

---

## 4. Homepage Layout Specification

The homepage has two views — **Magazine** (default) and **FYP** (For You Page). Both share the Nameplate, Accountability Ticker, and Footer. Only the content area changes.

### 4.1 Nameplate (top bar)

```
┌─────────────────────────────────────────────────────────┐
│ COLOMBO, SRI LANKA ▾    The Analyst ·    [MAG|FYP] [≡] │
│ Thursday, 12 March...                                    │
└─────────────────────────────────────────────────────────┘
```

- **LHS:** Location (clickable dropdown, switches between cities) + date/time stacked below
- **Center:** "The Analyst" (Playfair 800 28px, jungle) + terracotta middot
- **RHS:** Segmented view switcher (Magazine|FYP with SVG icons) + Hamburger button
- Nameplate has 3px solid jungle bottom border
- Padding: 10px vertical, 48px horizontal
- Location dropdown: absolute positioned, white card with city options
- Location will eventually be IP-based geolocation (later feature)

### 4.2 Accountability Ticker (between nameplate and hero)

A compact 26px ticker that only appears when there are active alerts. Two types:

**External (red, pulsing dot):** Holding power to account.
Example: "NPP Coal Tender: 47 days without official response"

**Internal (ochre, static dot):** Editorial transparency.
Example: "Cricket Corruption dossier: source count revised from 12 to 9"

**Behavior:**
- Multiple alerts: rotates every 15 seconds with translateY flip animation (150ms)
- After all alerts shown once: ticker collapses (max-height: 0, opacity: 0)
- Single alert: displays for 60 seconds then collapses
- Hidden when FYP view is active
- Clickable — navigates to relevant dossier or corrections page
- When no active alerts: lives under hamburger menu as "MP Accountability Tracker" + "Corrections & Retractions"
- Aligns with ETHICS_PROTOCOL.md Section 5.3 (errors corrected immediately, corrections visible not silent)

### 4.3 Hero Section (Magazine view only)

- Full-bleed background image: 440px height
- Left-side gradient overlay: jungle green to transparent, 55% width
- White floating "Featured Investigation" card:
  - Positioned: absolute, bottom -40px, left 48px, 500px wide
  - Contains: kicker ("Featured Investigation"), headline (Playfair 800 26px), excerpt, metadata grid, tags
  - Metadata grid: 2×2 layout (Author, Published, Read time, Sources)
  - Tags: colored pills (green=Governance, terracotta=Exclusive, ochre=Geopolitics)
  - Elevated with shadow-lift

### 4.4 Rotating Feature Strip (3-up, below hero)

```
┌──────────────┬──────────────┬──────────────┐
│ [thumb] text │ [thumb] text │ [thumb] text │
├══════════════╧══════════════╧══════════════┤ ← terracotta progress bar
└────────────────────────────────────────────┘ ← 2px jungle border
```

- 3-column grid with 1px vertical rules between columns
- Each slot contains: 68×68px thumbnail + kicker + title + meta
- **Per-card flip animation** (departure-board style):
  - Cards flip individually, not all at once
  - 120ms stagger between cards (left → right)
  - Each card: rotateX(90deg) out (350ms ease-in) → new content injected → rotateX(-90deg) in (350ms ease-out)
  - Container has `perspective: 600px`
- Rotates every 15 seconds through 3 sets of content
- Terracotta progress bar (2px) at bottom spans all 3 columns, animates width 0→100% over 15s
- **Pause on hover:** progress bar freezes, rotation stops, resumes on mouseleave
- Content mixes: dossiers, intel reports, tool highlights, breaking figures

**Strip data structure (3 sets × 3 cards):**
```javascript
const stripData = [
  // Set 0: Dossiers
  [
    { gradient: 'g2', kicker: 'Corruption', kickerClass: '', title: 'Rajapaksa Foundation Money Trail', meta: '5 Mar · 14 min' },
    { gradient: 'g3', kicker: 'Intelligence', kickerClass: '', title: 'RAW vs ISI: Shadow War in the North', meta: '2 Mar · 22 min' },
    { gradient: 'g4', kicker: 'Economy', kickerClass: '', title: 'IMF Conditionality vs Sovereignty', meta: '28 Feb · 16 min' }
  ],
  // Set 1: Intel + Tools
  [
    { gradient: 'g9', kicker: 'Intel Report', kickerClass: 'intel', title: 'Hormuz Strait: Tanker Diversions Up 340%', meta: 'Live · Hormuz Oracle' },
    { gradient: 'g10', kicker: 'Tool Highlight', kickerClass: 'tool', title: 'Shipping Lane Monitor: 3 Flagged Vessels', meta: 'Updated 2h ago' },
    { gradient: 'g11', kicker: 'Geopolitics', kickerClass: '', title: 'Chinese Naval Base Theory: Evidence Assessment', meta: '25 Feb · 20 min' }
  ],
  // Set 2: Breaking Figures + Mixed
  [
    { gradient: 'g5', kicker: 'Breaking Figure', kickerClass: 'intel', title: 'Brent Crude: $94.20 — SL Fuel Subsidy at Risk', meta: 'Live feed · 3 min ago' },
    { gradient: 'g12', kicker: 'Accountability', kickerClass: '', title: 'Easter Bombing Trial: 47 Postponements Exposed', meta: '22 Feb · 25 min' },
    { gradient: 'g6', kicker: 'Dashboard', kickerClass: 'tool', title: 'Colombo AQI: 142 — Unhealthy for Sensitive Groups', meta: 'Live · Air Quality Index' }
  ]
];
```

**Kicker color semantics:**
- Default (no class): terracotta — standard dossiers
- `.strip__kicker--intel` (ochre): intel reports, breaking figures
- `.strip__kicker--tool` (canopy): tool highlights, dashboards

### 4.5 Body Grid (Magazine view)

```
┌──────────────────────────────────────┬─────────────┐
│ Filter bar: Dossiers [All|Week|Month]│             │
│                                      │  Trending   │
│ ┌──────────┬──────────┬──────────┐  │  ─────────  │
│ │ Latest   │ Gov &    │ Economy  │  │  [items]    │
│ │ Chrono   │ Power    │ & Trade  │  │             │
│ │          │ For you  │ For you  │  │  Tools &    │
│ │ [arts]   │ [arts]   │ [arts]   │  │  Intel      │
│ └──────────┴──────────┴──────────┘  │  ─────────  │
│                                      │  [cards]    │
│ ← 1 [2] 3 4 →                      │  [list]     │
└──────────────────────────────────────┴─────────────┘
```

- **Outer grid:** `1fr 300px` (main + sidebar), no gap
- **Main area:** has `padding-right: 28px` and `border-right: 1px`
- **Sidebar:** has `padding-left: 20px`, `padding-top: 4px`

### 4.6 Filter Bar

- Label "Dossiers" (mono 10px uppercase, stone)
- Tabs: All / This Week / This Month
- Active tab: jungle bg, white text
- Global filter — applies to all 3 category columns

### 4.7 Three-Column Categories

- Grid: `1fr 1px 1fr 1px 1fr` (3 columns with 1px rule separators)
- **Column 1:** "Latest" with "Chronological" badge (canopy)
- **Column 2:** Algorithm-selected category with "For you" badge (ochre)
- **Column 3:** Algorithm-selected category with "For you" badge (ochre)
- Each column: header + 3 article cards
- First article in each column has a 16:9 thumbnail; others are text-only
- Article card: title (Playfair 700 15px) + excerpt (12px, 2-line clamp) + meta (mono 10px)
- Hover: title color transitions to canopy

**Recommendation engine (future):** Columns 2 and 3 are powered by a reco-engine with formula: `score = recency * 0.4 + engagement * 0.35 + popularity * 0.25 + noise`. Algorithm weights are editable only from admin panel, proprietary to founder. For initial build, use hardcoded category assignments.

### 4.8 Pagination

- Simple numbered buttons: ← 1 2 3 4 →
- Current page: jungle bg, white text
- No infinite scroll (explicitly banned)

### 4.9 Sidebar: Trending

- Section label: "Trending" (mono 10px uppercase)
- Items: 48×48px square thumbnail + title (600 12px) + meta ("4.2k reads")
- Grid layout per item: `48px 1fr`
- `margin-top: 14px` on section label (clears main border)

### 4.10 Sidebar: Tools & Intel

Three card types stacked:

**Intel Card (dark jungle bg):**
- "Breaking Figure · Editor Pinned" label (ochre, with 5px ochre dot)
- Large figure: "$94.20" (Playfair 800 24px, plaster)
- Description: "Brent Crude — SL fuel subsidy threshold breached"
- Change indicator: "▲ +$3.40 (3.7%) today" (green for up, red for down)
- Contextual — shows editor-pinned breaking data (oil prices, stock indices, AQI, etc.)

**Tool Feature Card (dark jungle bg):**
- "Editor Pinned" label (ochre)
- Tool name: "Hormuz Oracle" (Playfair 700 14px, plaster)
- Description: scenario summary
- Badges: "Live" (green tint) + "Updated 6 Mar"
- Links to actual tool (e.g., oracle-v7.pages.dev)

**Tool Inline List:**
- Compact rows: colored dot (green=live, terracotta=pinned) + name + tag
- Items: Shipping Lane Monitor, Investigation Timeline, Fuel Reserve Tracker, Colombo AQI Monitor
- Hover: name transitions to canopy

**Selection modes (future):** Tools can be contextually auto-selected or manually editor-pinned. Admin panel controls which mode is active.

### 4.11 FYP View (For You Page)

- Replaces the entire body grid with a single-column vertical card feed
- Max-width 720px, centered
- Same nameplate, same accountability ticker (hidden), same footer
- Filter bar: "For You" label + same tabs
- Cards: full-width, 16:9 image + body (kicker, title, excerpt, meta, tags)
- Mixes dossiers with intel reports and breaking figures
- FYP card kicker colors: terracotta (default), ochre (intel), canopy (breaking figure)
- Pagination at bottom

### 4.12 Hamburger Menu (slides from right)

- Trigger: hamburger button on RHS of nameplate (34×34px, 3 bars)
- Overlay: fixed, full-screen, rgba(26,24,21,0.4)
- Panel: fixed, right-side, 320px wide, full height, jungle bg
- Slides in via `transform: translateX(100%) → translateX(0)`, 150ms
- Close button: × in top-left of panel

**Menu sections:**

1. **Navigate:**
   - Home
   - Dossiers (sublabel: "16 published · 3 exclusives")
   - Tools & Dashboards (sublabel: "5 live tools")
   - About The Analyst

2. **Accountability:**
   - MP Accountability Tracker (ochre text, sublabel: "Formerly Pavura.lk · Active monitoring")
   - Corrections & Retractions (sublabel: "Editorial transparency log")
   - Submit Evidence (sublabel: "Encrypted · Anonymous")

3. **Preferences:**
   - සිංහල / English (toggle switch)
   - Dark Mode (toggle switch)

4. **Legal:**
   - Privacy Policy
   - Terms of Use
   - AI Safety & Ethics

Link hover: ochre text + 6px left padding shift

### 4.13 Footer

```
┌──────────────────────────────────────────────────────┐
│ The Analyst ·              Privacy Terms AI Safety    │
│ Dig deep. Stay free.      Ethics Protocol Contact    │
├──────────────────────────────────────────────────────┤
│ © 2026 Riz Razak          16 dossiers  42k reads     │
│                            3 exclusives  5 tools live │
└──────────────────────────────────────────────────────┘
```

- 2px jungle top border
- Surface bg
- Brand: "The Analyst ·" (Playfair 800 16px, jungle)
- Tagline: "Dig deep. Stay free." (mono 10px, stone)
- Links: Privacy, Terms, AI Safety, Ethics Protocol, Contact (mono 10px uppercase)
- Stats: 16 dossiers, 42k reads, 3 exclusives, 5 tools live (mono 10-11px)

---

## 5. Animation Specifications

### 5.1 Strip Card Flip

| Parameter | Value |
|-----------|-------|
| Trigger | Every 15 seconds |
| Stagger | 120ms between cards (L→R) |
| Flip-out | `rotateX(0°) → rotateX(90°)`, opacity `1→0`, 350ms ease-in |
| Content swap | At 350ms mark (after flip-out completes) |
| Flip-in | `rotateX(-90°) → rotateX(0°)`, opacity `0→1`, 350ms ease-out |
| Container | `perspective: 600px` on slot |
| Progress bar | `width: 0% → 100%` over 15s linear, 2px terracotta |
| Hover | Pause rotation, freeze progress bar at current position |

**Timeline for one rotation cycle:**
```
0ms    → Card 0 starts flip-out
120ms  → Card 1 starts flip-out
240ms  → Card 2 starts flip-out
350ms  → Card 0 content swaps, starts flip-in
470ms  → Card 1 content swaps, starts flip-in
590ms  → Card 2 content swaps, starts flip-in
710ms  → Card 0 flip-in complete
830ms  → Card 1 flip-in complete
950ms  → Card 2 flip-in complete, progress bar restarts
```

### 5.2 Accountability Ticker Flip

| Parameter | Value |
|-----------|-------|
| Trigger | Every 15 seconds |
| Flip-out | `translateY(0) → translateY(-100%)`, opacity `1→0`, 150ms ease-in |
| Flip-in | `translateY(100%) → translateY(0)`, opacity `0→1`, 150ms ease-out |
| Collapse | `max-height: 26px → 0`, `opacity: 1 → 0`, 150ms ease |
| Single alert | Disappears after 60 seconds |
| Multiple alerts | Rotates all, collapses after last one shown |

### 5.3 External Accountability Dot Pulse

```css
@keyframes acctPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
/* Duration: 2s, infinite, ease-in-out */
```
Internal accountability dot: NO pulse (static ochre)

### 5.4 Default Transitions

All interactive hover/active states: `0.15s ease` via `var(--t)`
Menu panel slide: `transform 0.15s ease`
Menu overlay: `opacity 0.15s ease`

---

## 6. Responsive Breakpoint

Single breakpoint at `900px`:

| Element | Desktop (>900px) | Mobile (≤900px) |
|---------|-------------------|-----------------|
| Nameplate | 10px 48px padding | 12px 20px padding |
| Hero card | left: 48px, 500px wide | left: 20px, calc(100% - 40px) |
| Body grid | 2 columns (1fr + 300px) | 1 column |
| Main content | right border + 28px padding | no border, no padding |
| Sidebar | beside main, 20px left padding | below main, 32px top margin |
| 3-col categories | 3 columns with rules | 1 column, rules hidden |
| Column padding | 0 16px | 0 |
| Wrap | 0 48px padding | 0 20px padding |
| Footer | 22px 48px padding | 24px 20px padding |

---

## 7. Rejected Approaches & Rationale

These were explored and deliberately rejected:

| Rejected | Why |
|----------|-----|
| **Infinite scroll** | User explicitly banned it. Pagination only. |
| **Carousel for strip** | "Instead of the three features just suddenly refreshing, flip the cards." Led to departure-board flip. |
| **Hamburger on LHS** | User specified RHS. |
| **Date/time on RHS** | User moved it under location on LHS. |
| **Glassmorphism / blur** | Banned in design rules. Solid backgrounds only. |
| **Cold gray palette** | Banned. All grays must be warm/stone-toned. |
| **Tall accountability banner** | User said "should be shorter in height." Compressed from multi-line banner to 26px ticker. |
| **Permanent accountability** | User wanted it to "completely disappear in one minute." Auto-dismiss added. |
| **Platform Intelligence section in body** | User moved it to footer in small mono text. |
| **Feed-first layout** | Explored in wireframes; Magazine layout selected. |
| **Dashboard layout** | Explored in wireframes; rejected for editorial focus. |
| **View toggle as text button** | User said "Magazine switch icon should be obvious." Became segmented toggle with SVG icons. |
| **Tailwind / CSS-in-JS** | Codebase uses vanilla CSS with custom properties. No framework change. |
| **Pavura.lk as separate site** | Will become the Sinhala version of The Analyst instead. |

---

## 8. Deferred / Future Features

These are NOT in the current build scope but are planned:

| Feature | Notes |
|---------|-------|
| **Recommendation engine** | Powers columns 2-3 + FYP. Formula: `recency*0.4 + engagement*0.35 + popularity*0.25 + noise`. Admin-only weight controls. |
| **IP geolocation** | Location dropdown becomes automatic. Serves as reco-engine signal. |
| **Admin panel** | Algorithm weights, tool pinning, featured investigation selection, accountability alert management |
| **AI-generated hero fields** | Auto-summary, related dossiers, source reliability score, threat level |
| **Dark mode** | Bawa dark tokens (Teak #2F2B28 base). Toggle exists in menu. |
| **Sinhala version** | Language toggle in menu. Google Cloud Translation API v3 Advanced only. Pavura.lk becomes Sinhala entry point. |
| **mp-accountability section** | Directory exists in codebase, no index.html yet. Full accountability tracker page. |
| **AI Safety page** | Content TBD. Link exists in footer and menu. |
| **Ed25519 key management** | Cryptographic signing for dossier authenticity. |
| **Brand logo lockup** | "The Analyst ·" needs proper logo + brand guide. |

---

## 9. Data Layer

### 9.1 Current: dossiers.json

Located at `/public/data/dossiers.json`. Fetched by `useDossiers()` hook. Each dossier has: id, title, tags, date, summary, etc.

### 9.2 Extensions needed for magazine layout

```json
{
  "id": "adani-port-deal",
  "title": "The Adani–Sri Lanka Port Deal: What the Contracts Actually Say",
  "kicker": "Featured Investigation",
  "excerpt": "A line-by-line analysis of the Colombo West Terminal agreement...",
  "author": "Riz Razak",
  "published": "2026-03-08",
  "readTime": "18 min",
  "sourceCount": 3,
  "sourceLabel": "3 independent",
  "category": "governance-power",
  "tags": ["Governance", "Exclusive", "Geopolitics"],
  "hero": true,
  "thumbnail": "/images/dossiers/adani-port.jpg",
  "gradient": "g1"
}
```

### 9.3 New data sources needed

**Accountability alerts:**
```json
[
  {
    "type": "external",
    "label": "Accountability",
    "title": "NPP Coal Tender: 47 days without official response",
    "meta": "Filed 24 Feb",
    "url": "/mp-accountability/npp-coal-tender"
  },
  {
    "type": "internal",
    "label": "Correction",
    "title": "Cricket Corruption dossier: source count revised from 12 to 9",
    "meta": "10 Mar",
    "url": "/corrections/cricket-corruption-source-count"
  }
]
```

**Tools & intel:**
```json
{
  "intelCards": [
    {
      "label": "Breaking Figure · Editor Pinned",
      "figure": "$94.20",
      "description": "Brent Crude — SL fuel subsidy threshold breached",
      "change": { "direction": "up", "value": "+$3.40", "percentage": "3.7%", "period": "today" }
    }
  ],
  "featuredTools": [
    {
      "name": "Hormuz Oracle",
      "description": "3 probability-weighted crisis scenarios for SL energy supply",
      "href": "https://oracle-v7.pages.dev",
      "pinned": true,
      "live": true,
      "lastUpdated": "6 Mar"
    }
  ],
  "inlineTools": [
    { "name": "Shipping Lane Monitor", "status": "live", "tag": "Live" },
    { "name": "Investigation Timeline", "status": "live", "tag": "New" },
    { "name": "Fuel Reserve Tracker", "status": "live", "tag": "Live" },
    { "name": "Colombo AQI Monitor", "status": "live", "tag": "Live" }
  ]
}
```

---

## 10. Accessibility Requirements

- Semantic HTML: `<nav>`, `<main>`, `<aside>`, `<article>`, `<footer>`
- ARIA labels on: view switcher, hamburger button, menu panel, location dropdown, filter tabs, pagination
- `:focus-visible` styles: 2px jungle outline, 2px offset
- Keyboard navigation: Tab through interactive elements, Enter to activate, Escape to close menu/dropdown
- Skip-to-content link (hidden, appears on Tab)
- Alt text on all images (hero, article thumbnails, tool thumbnails)
- `prefers-reduced-motion`: disable strip flip + ticker rotation, show static content instead

---

## 11. Key Codebase Context

### Files to create (new components):
Nameplate, ViewSwitcher, MenuPanel, AccountabilityTicker, Hero, HeroCard, RotatingStrip, FilterBar, BodyGrid, CategoryColumns, ArticleCard, Pagination, Sidebar, TrendingSection, ToolsIntelSection, IntelCard, ToolFeatureCard, ToolInlineItem, FYPView, FYPCard, Footer

### Files to retire:
Header.jsx, ViewToggle.jsx, TileGrid.jsx, DossierList.jsx, DossierTile.jsx, useInfiniteScroll.js

### Files to modify:
global.css (Bawa palette), HomePage.jsx (rewrite), useDossiers.js (extend), useTheme.js (Bawa dark), App.jsx (minor), dossiers.json (new fields)

### New custom hooks:
`useStripRotation(sets, interval, stagger)` — manages strip flip timer, pause-on-hover, progress bar
`useAccountabilityTicker(alerts)` — manages rotation, auto-dismiss, collapse

### Routing (unchanged):
- `/` → HomePage (magazine/FYP)
- `/:id` → DossierPage
- `/dossier/:id` → redirects to `/:id`

### Deploy pipeline (unchanged):
Push to main → GitHub Actions → Vite build → GitHub Pages at analyst.rizrazak.com

---

## 12. The Mockup Is the Spec

`mockups/magazine-v7-full.html` is a fully interactive, self-contained HTML file. Open it in any browser. It demonstrates:

- Every visual element at production fidelity
- All animations running (strip flip, progress bar, ticker rotation)
- View switching (Magazine ↔ FYP)
- Location dropdown
- Hamburger menu slide-in
- Filter tab switching
- Hover states on all interactive elements
- Responsive behavior at 900px breakpoint

**Every CSS class, every animation keyframe, every JavaScript function, every data structure in that file is production-intentional.** The React build should reproduce it exactly, decomposed into components.
