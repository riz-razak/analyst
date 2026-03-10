# Dossier Side Navigation — Integration Protocol

## Overview
`dossier-sidenav.css` + `dossier-sidenav.js` provide a persistent section navigation panel for analyst dossier pages. Desktop gets a fixed left sidebar; mobile/tablet gets a floating action button (FAB) that opens an overlay drawer.

## Quick Start (Zero-Config)

### 1. Add to `<head>`
```html
<link rel="stylesheet" href="/_shared/dossier-sidenav.css">
```

### 2. Add `data-nav-label` to your sections
```html
<section class="section" id="incident" data-nav-label="The Incident">
<section class="section" id="evidence" data-nav-label="Evidence">
<section class="section" id="timeline" data-nav-label="Timeline">
```

### 3. Add script before `</body>`
```html
<script src="/_shared/dossier-sidenav.js"></script>
```

That's it. The module auto-discovers sections, builds the nav, FAB, and overlay.

## Theming (Per-Dossier)

Override CSS custom properties in your dossier's `<style>` block:

```css
:root {
  --sidenav-bg: rgba(247,245,237,0.96);
  --sidenav-border: var(--border);
  --sidenav-text: var(--text-muted);
  --sidenav-active: var(--forest);
  --sidenav-active-bg: var(--sage-mist);
  --sidenav-hover-bg: var(--sage-mist);
  --sidenav-dot: var(--border);
  --sidenav-dot-active: var(--forest);
  --sidenav-progress-from: var(--sage);
  --sidenav-progress-to: var(--forest);
  --sidenav-fab-bg: var(--forest);
  --sidenav-fab-shadow: rgba(45,90,39,0.35);
  --sidenav-width: 220px;
  --sidenav-top: 56px;
}
```

## Advanced Config (Manual Mode)

For explicit control, add a JSON config block:

```html
<script type="application/json" id="sidenav-config">
{
  "label": "Navigation",
  "fabLabel": "Sections",
  "fabCollapseDelay": 3500,
  "heroThreshold": 0.6,
  "sections": [
    { "id": "incident", "num": "01", "label": "The Incident" },
    { "id": "evidence", "num": "02", "label": "Evidence" }
  ]
}
</script>
```

### Config Options
| Option | Default | Description |
|--------|---------|-------------|
| `label` | "Navigation" | Heading above nav links |
| `fabLabel` | "Sections" | Text on FAB button (auto-retracts after delay) |
| `fabCollapseDelay` | 3500 | Milliseconds before FAB label collapses |
| `heroThreshold` | 0.6 | Scroll fraction (of viewport) before desktop sidebar appears |
| `sections` | auto-discover | Array of `{ id, num, label }` objects |

## Behaviour

### Desktop (≥1200px)
- Fixed left sidebar, 220px wide
- Auto-shows after scrolling past hero (configurable threshold)
- Page content shifts right to accommodate
- Active section highlighted with green border + dot

### Mobile/Tablet (<1200px)
- Floating ☰ button (FAB) at bottom-left
- FAB shows "Sections" label on first load, collapses after 3.5s
- Label re-expands on hover
- Tapping opens overlay drawer with section links
- Tapping a link scrolls to section and closes drawer

### Both
- Progress bar at bottom of nav shows overall scroll position
- Active section tracking via scroll position (40% viewport threshold)

## JS API

```javascript
// Exposed on window.DossierSideNav
DossierSideNav.open()    // Open drawer (mobile only)
DossierSideNav.close()   // Close drawer
DossierSideNav.toggle()  // Toggle drawer (mobile only)
DossierSideNav.update()  // Force recalculate active section + progress
```

## Files
- `/_shared/dossier-sidenav.css` — All styles (with CSS custom property hooks)
- `/_shared/dossier-sidenav.js` — All logic (self-initializing IIFE, no dependencies)
- `/_shared/SIDENAV-PROTOCOL.md` — This document
