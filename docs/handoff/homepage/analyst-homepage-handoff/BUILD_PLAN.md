# Production Build Plan — The Analyst Homepage

## Stack

React 19 + React Router 7 + Vite 7 + Fuse.js + vanilla CSS (custom properties). No new frameworks.

---

## Phase 1: Foundation

### Step 1 — Overhaul `global.css` to Bawa palette
Replace all cold-gray CSS custom properties with Bawa tokens. The full token map is in HANDOFF.md §3.1. Key changes:

```
--bg-primary: #fafafa → #F5F1E6 (Plaster)
--text-primary: #1a1a2e → #1A1815 (Near-black)
--text-secondary: #4a4a60 → #7A6F65 (Stone)
--border-color: rgba(0,0,0,0.08) → #E5DDD0
```

Add all new tokens: `--jungle`, `--canopy`, `--terracotta`, `--ochre`, `--surface`, `--surface-hover`, `--red-urgent`, `--shadow-lift`, `--t`, etc.

### Step 2 — Create `src/styles/magazine.css`
Extract ALL CSS from `magazine-v7-full.html` lines 8-335 into this file, organized by component. Import in `main.jsx`.

### Step 3 — Extend `dossiers.json`
Add new fields: `hero`, `category`, `readTime`, `sourceCount`, `excerpt`, `kicker`, `thumbnail`, `gradient`. See HANDOFF.md §9.

---

## Phase 2: Structural Components (Steps 4-6)

### Step 4 — Nameplate + ViewSwitcher + HamburgerButton
Build first because everything else sits below it.

### Step 5 — MenuPanel
Overlay + slide-from-right panel. Independent of body content.

### Step 6 — Footer
Brand + tagline + links + stats. Independent.

---

## Phase 3: Hero + Strip (Steps 7-8)

### Step 7 — Hero + HeroCard
Full-bleed image, gradient overlay, floating card with metadata grid.

### Step 8 — RotatingStrip + useStripRotation hook
Per-card flip animation. This is the most complex animation component — build the hook first, then the UI.

---

## Phase 4: Body Content (Steps 9-12)

### Step 9 — FilterBar
Shared between Magazine and FYP views.

### Step 10 — BodyGrid + CategoryColumns + ArticleCard
Main 3-column layout with sidebar grid.

### Step 11 — Pagination
Numbered page buttons.

### Step 12 — TrendingSection + ToolsIntelSection + IntelCard + ToolFeatureCard + ToolInlineItem
Complete sidebar build.

---

## Phase 5: Accountability + FYP (Steps 13-14)

### Step 13 — AccountabilityTicker + useAccountabilityTicker hook
Compact ticker with rotation + auto-dismiss. Second most complex animation.

### Step 14 — FYPView + FYPCard
Vertical card feed, shares FilterBar and Pagination.

---

## Phase 6: Integration (Step 15)

### Step 15 — Rewrite HomePage.jsx
Replace current search/filter/list with:
```jsx
<Nameplate ... />
<AccountabilityTicker ... />
{view === 'mag' ? <MagazineView ... /> : <FYPView ... />}
<Footer ... />
<MenuPanel ... />
```

Wire all state: view, menuOpen, activeFilter, location, currentPage.

Retire: Header.jsx, ViewToggle.jsx, TileGrid.jsx, DossierList.jsx, DossierTile.jsx, useInfiniteScroll.js.

---

## Phase 7: Polish (Step 16)

### Step 16 — Responsive, accessibility, prefers-reduced-motion
- 900px breakpoint (see HANDOFF.md §6)
- Semantic HTML, ARIA labels, focus-visible
- `prefers-reduced-motion`: static content, no flips

---

## File Structure

```
src/
├── styles/
│   ├── global.css           ← MODIFY (Bawa palette)
│   └── magazine.css          ← NEW (all magazine styles)
├── pages/
│   └── HomePage.jsx          ← REWRITE
├── components/
│   ├── Nameplate.jsx         ← NEW
│   ├── LocationDropdown.jsx  ← NEW
│   ├── ViewSwitcher.jsx      ← NEW
│   ├── MenuPanel.jsx         ← NEW
│   ├── AccountabilityTicker.jsx ← NEW
│   ├── Hero.jsx              ← NEW
│   ├── HeroCard.jsx          ← NEW
│   ├── RotatingStrip.jsx     ← NEW
│   ├── FilterBar.jsx         ← NEW
│   ├── BodyGrid.jsx          ← NEW
│   ├── CategoryColumns.jsx   ← NEW
│   ├── ArticleCard.jsx       ← NEW
│   ├── Pagination.jsx        ← NEW
│   ├── Sidebar.jsx           ← NEW
│   ├── TrendingSection.jsx   ← NEW
│   ├── ToolsIntelSection.jsx ← NEW
│   ├── IntelCard.jsx         ← NEW
│   ├── ToolFeatureCard.jsx   ← NEW
│   ├── ToolInlineItem.jsx    ← NEW
│   ├── FYPView.jsx           ← NEW
│   ├── FYPCard.jsx           ← NEW
│   └── Footer.jsx            ← REWRITE
├── hooks/
│   ├── useDossiers.js        ← MODIFY
│   ├── useStripRotation.js   ← NEW
│   └── useAccountabilityTicker.js ← NEW
└── App.jsx                   ← MINOR EDIT
```

---

## Constraints Checklist

- [ ] Bawa palette only — no cold grays, no neon
- [ ] Light mode default
- [ ] No glassmorphism, no AI-glow, no backdrop-filter
- [ ] No infinite scroll — pagination only
- [ ] Max 0.15s transitions (except strip 350ms, ticker 150ms)
- [ ] Solid backgrounds
- [ ] WCAG AA contrast (4.5:1 body text)
- [ ] Semantic HTML + ARIA labels
- [ ] No carousel — flip animation only
- [ ] Nameplate: location LHS, brand center, controls RHS
- [ ] Hamburger on RHS
- [ ] "The Analyst ·" (terracotta dot)
- [ ] Bilingual-ready (lang-en / lang-si)
- [ ] Google Cloud Translation API only
- [ ] prefers-reduced-motion support
