# Dossier Page Build Guidelines
**Platform:** analyst.rizrazak.com
**Last updated:** 2026-03-09 (session 4)

---

## 1. Required Shared Modules

Every dossier page MUST include these shared modules. They are the platform's reusable infrastructure.

### 1.1 Core Modules (existing)
```html
<link rel="stylesheet" href="../_shared/dossier-base.css">
<link rel="stylesheet" href="../_shared/dossier-components.css">
<link rel="stylesheet" href="../_shared/dossier-interactive.css">
<script src="../_shared/dossier-nav.js" defer></script>
<script src="../_shared/dossier-lang.js" defer></script>
<script src="../_shared/dossier-theme.js" defer></script>
<script src="../_shared/dossier-analytics.js" defer></script>
<script src="../_shared/dossier-disclaimer.js" defer></script>
```

### 1.2 Evidence System
```html
<link rel="stylesheet" href="../_shared/evidence-system.css">
<script src="../_shared/evidence-system.js" defer></script>
```

### 1.3 Narrative Timeline
```html
<link rel="stylesheet" href="../_shared/narrative-timeline.css">
<script src="../_shared/narrative-timeline.js" defer></script>
```
Plus the required `<script type="application/json" id="narrative-timeline-data">` block (see Section 3).

### 1.4 Category System
```html
<link rel="stylesheet" href="../_shared/category-system.css">
```

---

## 2. Narrative Timeline — Standard for Storytelling

**Every dossier MUST have a narrative timeline bar.** This is a subtle, fixed-position bar showing the reader's temporal position within the narrative.

### 2.1 How It Works
- Fixed bar below the navbar with a horizontal track
- Dots mark key events along the temporal axis
- Red dots = critical events, green dots = context
- Hover reveals: date, title, significance label
- Click a dot → smooth-scroll to that section
- User can toggle off (× button or press T key)
- Preference saved in localStorage

### 2.2 Data Format
```json
{
  "startDate": "Start label (e.g., 'Pre-2021')",
  "endDate": "End label (e.g., 'March 2026')",
  "events": [
    {
      "date": "Human-readable date",
      "title": "Short event description (max 60 chars)",
      "significance": "critical|important|context",
      "sectionId": "HTML id of the target section",
      "position": 0.35
    }
  ]
}
```

### 2.3 Position Mapping Rules
- `position` is 0.0 to 1.0 along the timeline
- Map dates proportionally to the time range
- Cluster events can share nearby positions (min 0.03 apart for visibility)
- The scroll-tracking interpolates between section positions automatically

### 2.4 CMS Integration
The timeline bar has `data-cms-id="narrative-timeline-toggle"`. In the admin CMS, this allows toggling the timeline off per-dossier if it doesn't suit the narrative structure.

### 2.5 When Time Jumps
Narratives often jump between time periods (e.g., flashback to 2021, then forward to 2026). This is fine. The timeline shows temporal reality, not narrative order. The reader should feel grounded in "when" regardless of how the story flows.

---

## 3. Platform Category System

### 3.1 Core Categories (max 20 total, always consolidate)

| # | Category | CSS Class | Use For |
|---|----------|-----------|---------|
| 1 | Policy & Law | `.cat-tag.policy-law` | Legislation, regulations, legal proceedings, constitutional matters |
| 2 | Geopolitics & Breaking News | `.cat-tag.geopolitics` | International relations, conflicts, sanctions, breaking stories |
| 3 | Philosophy | `.cat-tag.philosophy` | Political philosophy, ethics, theory, intellectual history |
| 4 | Social Commentary | `.cat-tag.social-commentary` | Cultural criticism, media analysis, societal observation |
| 5 | AI & Tech | `.cat-tag.ai-tech` | Technology policy, AI governance, digital rights, surveillance |
| 6 | Anarchist Social-Capitalism | `.cat-tag.anarchist-social-capitalism` | Original framework: mutual aid + market dynamics, Kropotkin meets Schumacher |
| 7 | Corruption & Mismanagement | `.cat-tag.corruption` | Fraud, abuse of power, institutional failure, accountability |
| 8 | Not Too Serious | `.cat-tag.not-too-serious` | Satire, lighter analysis, absurdist political commentary |
| 9 | Social Change | `.cat-tag.social-change` | Movements, activism, reform, community organizing |
| 10 | Media & Press | `.cat-tag.media-press` | Journalism ethics, press freedom, media ownership |
| 11 | Economics & Trade | `.cat-tag.economics` | Fiscal policy, trade, monetary systems, development |
| 12 | Human Rights | `.cat-tag.human-rights` | Civil liberties, dignity, justice, discrimination |
| 13 | Environment | `.cat-tag.environment` | Climate, conservation, sustainability, resource management |
| 14 | Culture & Identity | `.cat-tag.culture-identity` | Ethnicity, religion, nationalism, identity politics |
| 15 | Education | `.cat-tag.education` | Educational policy, academic freedom, institutional reform |

**Slots 16–20 are reserved.** Before adding a new category, try to fit it into an existing one. The goal is always contraction, not expansion.

### 3.2 Dossier-Category Mapping

Each dossier should be assigned 1–3 categories:

| Dossier | Primary | Secondary |
|---------|---------|-----------|
| Caravan Fresh | Corruption & Mismanagement | Social Commentary |
| Women's Day Betrayal | Social Commentary | Media & Press |
| Sri Lanka Cricket | Corruption & Mismanagement | Media & Press |
| Easter Sunday Attacks | Geopolitics & Breaking News | Human Rights |
| Iran-US-Israel | Geopolitics & Breaking News | Philosophy |
| MP Accountability | Corruption & Mismanagement | Policy & Law |
| Hormuz Crisis | Geopolitics & Breaking News | Economics & Trade |

### 3.3 Color Philosophy: Miyazaki Green
All colors derive from the central `--forest: #2d5a27` (Miyazaki green). The palette follows organic, earthy, Studio Ghibli-adjacent warmth. No neon, no pure primary colors. Everything should feel like it belongs in a Totoro-era forest.

### 3.4 Usage in HTML
```html
<!-- On dossier index page cards -->
<span class="cat-tag corruption">Corruption & Mismanagement</span>

<!-- On section headers -->
<span class="cat-badge">
  <span class="cat-dot social-commentary"></span>
  Social Commentary
</span>

<!-- Multiple categories -->
<div class="cat-tags">
  <span class="cat-tag social-commentary">Social Commentary</span>
  <span class="cat-tag media-press">Media & Press</span>
</div>
```

---

## 4. Evidence System Standards

See [EVIDENCE_PROTOCOL.md](EVIDENCE_PROTOCOL.md) for full details. Key requirements:

### 4.1 Every Dossier Must Have
- Source Index table with anchor IDs (`id="src-S1"`)
- Evidence cards with anchor IDs (`id="ev-S1"`) and verdict badges
- Inline `[SX]` reference markers in body text
- Bidirectional navigation between markers → cards → source index

### 4.2 Verdict Badges Required
Every evidence card needs a verdict: VERIFIED, DOCUMENTED, ALLEGED, or UNVERIFIED.

### 4.3 Category Tags on Evidence Cards
Use the evidence tag system (`.ec-tag.[type]`) — distinct from platform categories.

---

## 5. Bilingual Standard

All user-facing text must be bilingual (EN + Sinhala):
```html
<h2 lang-en data-cms-id="unique-id-en">English Title</h2>
<h2 lang-si class="si" style="display:none" data-cms-id="unique-id-si">සිංහල මාතෘකාව</h2>
```

---

## 6. CMS Integration

Every editable element gets a `data-cms-id` attribute:
```html
<p data-cms-id="s1-card1-body">Editable content here</p>
```

Toggle-able components (like the narrative timeline) get:
```html
<div data-cms-id="narrative-timeline-toggle">...</div>
```

---

## 7. File Structure

```
public/dossiers/
  _shared/
    dossier-base.css          # Core layout, typography
    dossier-components.css    # Cards, badges, grids
    dossier-interactive.css   # Animations, transitions
    dossier-nav.js            # Navigation
    dossier-lang.js           # Language toggle
    dossier-theme.js          # Theme/dark mode
    dossier-analytics.js      # Analytics
    dossier-disclaimer.js     # Disclaimer overlay
    evidence-system.css       # Evidence cards, badges, markers
    evidence-system.js        # Smooth scroll, hash navigation
    narrative-timeline.css    # Timeline bar styles
    narrative-timeline.js     # Timeline bar logic
    category-system.css       # Platform category tags
  [dossier-name]/
    index.html                # The dossier page
```

---

## 8. Quick Checklist for New Dossier Pages

```
┌─────────────────────────────────────────────────────────┐
│  NEW DOSSIER PAGE — CHECKLIST                           │
├─────────────────────────────────────────────────────────┤
│  1. Include all shared CSS/JS modules                   │
│  2. Add narrative timeline JSON data block               │
│  3. Add category tags (1-3 per dossier)                 │
│  4. Add disclaimer overlay (with bilingual text)         │
│  5. Add Source Index table with anchor IDs               │
│  6. Add evidence cards with verdict badges               │
│  7. Add inline [SX] reference markers                    │
│  8. Add bilingual text (lang-en / lang-si)              │
│  9. Add data-cms-id to all editable elements             │
│  10. Test: desktop, mobile (375px), smooth scroll        │
└─────────────────────────────────────────────────────────┘
```
