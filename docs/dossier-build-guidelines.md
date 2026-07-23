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

### 1.5 Top-Level Traffic Counters

Every published dossier should expose the platform traffic counters at the top-level dossier shell:

- `Visits`: approximate recorded page visits for the canonical dossier path.
- `Live`: approximate active readers seen in the last two minutes.

The standard implementation is `src/components/DossierTrafficCounters.jsx`, mounted by `src/pages/DossierPage.jsx`. New React-routed dossiers get this automatically. Static dossier templates may still include their own local counters during migration, but the platform standard is the shared top bar so the counters sit beside the global back/date/title controls, not inside the article narrative.

Privacy requirements:

- Keep public counters aggregate-only.
- Do not expose raw visitor IDs, IP addresses, raw user agents, or private ledger detail.
- Use `/api/analytics/page-visits`, `/api/analytics/live-visitors`, and `/api/analytics/visit-ledger` only through the privacy-preserving Worker endpoints.

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

See [evidence-protocol.md](evidence-protocol.md) for full details. Key requirements:

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

## 5. Trilingual Standard

All user-facing text must be trilingual (EN + Sinhala + Tamil). Each translatable
node is an English element followed by **sibling** SI and TA elements:

```html
<h2 lang-en data-lang="en" data-cms-id="unique-id-en">English Title</h2>
<h2 lang-si data-lang="si" class="si" style="display:none" data-cms-id="unique-id-si"></h2>
<h2 lang-ta data-lang="ta" class="ta" style="display:none" data-cms-id="unique-id-ta"></h2>
```

The SI/TA siblings are authored **empty** and filled by the translation pipeline.
Instrumenting them is a build-time responsibility, not a translation-time one —
see [§9 Translation Gate](#9-translation-gate-required).

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

## 8. Evidence Thumbnail Protocol

Every evidence card MUST include a source preview thumbnail. This is the standard that applies to all dossiers once approved.

### 8.1 Thumbnail Structure

```html
<div class="evidence-card" id="ev-SX">
  <span class="ec-badge">SX</span>
  <span class="ev-verdict [verdict]">[VERDICT]</span>

  <!-- THUMBNAIL — required for every card -->
  <a href="[SOURCE_URL]" target="_blank" rel="noopener" class="ev-thumb-wrap"
     title="Open source: [description]">
    <img class="ev-thumb" src="[IMAGE_SRC]"
         alt="[Publication] — [Article title]" loading="lazy">
    <div class="ev-thumb-overlay"><span>Open Source →</span></div>
  </a>
  <!-- /THUMBNAIL -->

  <div class="ec-source">[Author] — [Type]</div>
  <span class="ec-quote">[Quote]</span>
  <span class="ec-meta">[Publication] • [Date]</span>
  <span class="ec-tag [type]">[TAG]</span>
  <a href="#src-SX" class="ev-nav-link">View in Source Index ↓</a>
</div>
```

### 8.2 Image Source Decision Tree

For each evidence card, choose the image source using this priority order:

| Source Type | Image Strategy |
|-------------|---------------|
| News article (public URL) | Use direct `src="[article-image-url]"` — img tags are CORS-free |
| Blog post (public URL) | Use direct `src="[article-image-url]"` from article's featured image |
| Facebook post | Use PIL-generated placeholder (base64) — login-wall blocks external fetching |
| Twitter/X post | Use PIL-generated placeholder (base64) |
| PDF / Document | Use first-page screenshot (base64 via browser canvas capture) |
| Screenshot evidence | Use the evidence screenshot itself (base64, cropped/blurred if sensitive) |

### 8.3 PIL Placeholder Generation

For social media sources (login-required), generate a placeholder thumbnail:

```python
from PIL import Image, ImageDraw, ImageFont
import base64, io

def create_social_placeholder(display_name, preview_text, date_str,
                               platform="Facebook", accent="#1877F2"):
    img = Image.new("RGB", (600, 340), "#f0f2f5")
    draw = ImageDraw.Draw(img)
    # Header bar
    draw.rectangle([0, 0, 600, 60], fill=accent)
    # ... (see scripts/gen_thumbnails.py for full implementation)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=72)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
```

### 8.4 CSS (shared — already in `_shared/evidence-system.css`)

The `.ev-thumb-wrap`, `.ev-thumb`, `.ev-thumb-overlay` classes handle:
- 150px tall thumbnail strip inside the card
- Hover: subtle zoom (scale 1.04) + dark overlay with "Open Source →" button
- Mobile (`hover: none`): persistent faint overlay so tap affordance is clear
- Lazy loading via `loading="lazy"` for performance

### 8.5 Thumbnail Validation Checklist

Before committing any dossier page:
```
[ ] Every evidence card has an ev-thumb-wrap block
[ ] External image URLs tested to load (not 404)
[ ] Base64 thumbnails are JPEG quality 72, max ~25KB per card
[ ] alt text describes the source meaningfully
[ ] Link href = the actual source URL (same as card's "Open source" link)
[ ] Mobile view: thumbnails display correctly at 375px width
[ ] Hover effect works on desktop
```

---

## 9. Translation Gate (REQUIRED)

Translation is a **publication stage, not an optional extra**. Every Analyst
dossier ships EN + SI + TA.

**Where it sits in the build sequence:**

```
build page (§1–§8) → English copy FROZEN → [ §9 TRANSLATION GATE ] → publish
```

Nothing translates until the English is frozen; nothing publishes until the gate
is green. If the English changes after a run, the gate must be re-run with
`--force`.

### 9.1 Instrumentation (build-time, mandatory)

Every translatable node needs **balanced** `lang-en` / `lang-si` / `lang-ta`
markers with matching `-en` / `-si` / `-ta` `data-cms-id`s (see §5). The scripts
key off the bare `lang-*` markers, so:

> **A dossier with zero markers silently translates nothing** — the pipeline
> exits 0, produces no output, and nothing warns you. Count your markers before
> you spend on an API call. Unbalanced markers are just as bad: an `lang-en`
> node without SI/TA siblings is skipped.

Embedded visualisations under `vis/*.html` are separate documents with their own
labels, captions and axis text. They carry no `lang-*` markers and are **not**
covered by the pipeline. They need their own instrumentation pass.

### 9.2 The run — one command

```bash
scripts/translate-all.sh public/<dossier>/index.html [--lang si|ta|both] [--force]
```

It activates `.venv-translation`, refuses to run without
`GOOGLE_TRANSLATE_API_KEY` / `GOOGLE_CLOUD_PROJECT`, never echoes the key, and
runs preflight → SI → TA → review pages → pipeline tests → QA gate.

### 9.3 The gate must exit 0

`scripts/translation-qa.py` is the machine gate. Exit `1` = not publishable. It
asserts seven checks: `sibling_coverage`, `target_script`, `cross_contamination`,
`residual_markup`, `keep_terms`, `numbers`, `stranded_english`.

**Both** languages must exit 0. `--skip-qa` output is never publishable.

### 9.4 Human-review carve-out

Machine output is a draft. **Headlines, deks, standfirsts, kickers and
pull-quotes require human Sinhala and Tamil lines** — NMT destroys wordplay,
rhythm and register silently, and no automated check catches it. A full human
read-through of both editions is required before the `#langToggle` is enabled.

### 9.5 Detail lives in the runbook

Do not duplicate procedure here. Credentials, failure modes, glossary governance
and triage: [translation-runbook.md](translation-runbook.md). The standing
mandate and do-not-regress list: [translation-protocol.md](translation-protocol.md).

---

## 10. Quick Checklist for New Dossier Pages

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
│  7. Add evidence thumbnail to EVERY card (see §8)       │
│  8. Add inline [SX] reference markers                    │
│  9. Instrument lang-en / lang-si / lang-ta siblings      │
│  10. Add data-cms-id to all editable elements            │
│  11. Test: desktop, mobile (375px), smooth scroll        │
│  12. Run thumbnail validation checklist (§8.5)           │
│  13. FREEZE English copy                                 │
│  14. Run the Translation Gate (§9) — QA must exit 0      │
│  15. Human SI/TA headline + dek; read-through; sign-off  │
│  16. Enable #langToggle, then publish                    │
└─────────────────────────────────────────────────────────┘
```
