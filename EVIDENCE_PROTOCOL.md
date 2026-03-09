# Evidence Pipeline Protocol
**Platform:** analyst.rizrazak.com
**Repo:** `riz-razak/analyst` → GitHub Pages
**Last updated:** 2026-03-09 (session 3)

---

## 1. Evidence Lifecycle

```
CAPTURE → VERIFY → CLASSIFY → FORMAT → EMBED → CITE → DEPLOY
```

Every piece of evidence must pass through all seven stages before it appears on a live dossier page. No exceptions.

---

## 2. CAPTURE — Acquiring Evidence

### 2.1 Screenshot Evidence (Facebook, social media, private messages)
- **Method:** Browser canvas capture → base64 encoding
- **Why base64:** GitHub Pages is static-only; no server to host uploaded images. Base64-embedded images survive as self-contained HTML.
- **Resolution:** Capture at native resolution; do not upscale.
- **Censoring:** If names/faces of non-public figures need redacting, use browser canvas overlay (solid color rectangles) BEFORE encoding. Never publish uncensored versions.

```javascript
// Canvas capture pattern (in-browser)
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
// Draw source, apply censoring rectangles, then:
const base64 = canvas.toDataURL('image/jpeg', 0.85);
```

### 2.2 Article Evidence (news sites, blogs)
- **Method:** Archive the URL via Wayback Machine (`web.archive.org/save/[URL]`) as a preservation step.
- **Do NOT screenshot entire articles** — use text-based evidence cards instead (see Section 5).
- **Record:** Publication name, author, date, headline, and one key quote (max 30 words).

### 2.3 Public Social Media Posts
- **Method:** Screenshot the post including: author name, date, content, engagement metrics.
- **Also record:** Direct URL to the post, even if it might be deleted later.
- **Facebook search URLs:** Use `facebook.com/search/posts/?q=[encoded query]` as fallback evidence of public discourse.

### 2.4 Video/Audio Evidence
- **Method:** Screenshot key frames. Note timestamp ranges for critical moments.
- **Store:** Direct URL + description of content at specific timestamps.

---

## 3. VERIFY — Source Validation

Every piece of evidence must pass this checklist before embedding:

| Check | Method | Required? |
|-------|--------|-----------|
| Source exists and is publicly accessible | Click the URL | ✅ Yes |
| Author/publication is correctly attributed | Cross-reference | ✅ Yes |
| Date is accurate | Check page metadata | ✅ Yes |
| Content matches the claim being made | Re-read in context | ✅ Yes |
| Screenshot is unaltered (no edits beyond censoring) | Visual inspection | ✅ Yes |
| Archived copy exists (for web articles) | Wayback Machine | Recommended |
| Multiple sources corroborate (for serious allegations) | Cross-reference | Recommended |

### Verification Notes
- If a source is deleted after capture, note this in the evidence card metadata: `"[Archived — original deleted]"`
- Never fabricate or embellish evidence descriptions. Quote directly where possible.
- If a claim cannot be independently verified, state this explicitly: `"[Unverified — single source]"`

---

## 4. CLASSIFY — Evidence Categories

Each evidence item gets a **Source ID** (e.g., S1, S2, ...) and a **category tag**.

### 4.1 Source IDs
- Format: `S[number]` — sequential within each dossier
- Assigned in the Source Index table (see Section 6)
- Example: S1, S2, S3, ... S11

### 4.2 Category Tags

| Tag | CSS Class | Background | Text Color | Use For |
|-----|-----------|------------|------------|---------|
| THE ARTICLE | `.ec-tag.article` | `#dbeafe` | `#1e40af` | Published news articles, features, editorials |
| SOCIAL MEDIA | `.ec-tag.social` | `#fce7f3` | `#9d174d` | Facebook posts, tweets, Instagram, public shares |
| TESTIMONY | `.ec-tag.testimony` | `#fef3c7` | `#92400e` | Blog posts, personal accounts, witness statements |
| COMMENTARY | `.ec-tag.commentary` | `#e0f2fe` | `#0369a1` | Third-person analytical articles, opinion pieces, academic commentary |
| PRIMARY SOURCE | `.ec-tag.primary` | `#d1fae5` | `#065f46` | Direct evidence from individuals involved |
| OFFICIAL RECORD | `.ec-tag.official` | `#e0e7ff` | `#3730a3` | Government docs, court filings, official statements |
| SCREENSHOT | `.ec-tag.screenshot` | `#f3e8ff` | `#6b21a8` | Captured screenshots of conversations, posts, pages |
| VIDEO/AUDIO | `.ec-tag.media` | `#fef9c3` | `#854d0e` | Video clips, audio recordings, broadcasts |
| DOCUMENT | `.ec-tag.document` | `#f1f5f9` | `#475569` | PDFs, letters, reports, internal documents |

### 4.3 TESTIMONY vs COMMENTARY

**TESTIMONY** is reserved for first-person accounts by victims or witnesses. **COMMENTARY** is for third-person analytical articles, opinion pieces, or academic writing about events. A journalist writing *about* allegations is commentary; a victim describing *their own experience* is testimony.

### 4.4 Verdict Badges

Every evidence card must carry a verdict badge indicating verification level:

| Verdict | CSS Class | Background | Text Color | Meaning |
|---------|-----------|------------|------------|---------|
| VERIFIED | `.ev-verdict.verified` | `#d1fae5` | `#065f46` | Multiple independent sources confirm |
| DOCUMENTED | `.ev-verdict.documented` | `#dbeafe` | `#1e40af` | Source exists and is accessible |
| ALLEGED | `.ev-verdict.alleged` | `#fef3c7` | `#92400e` | Claim made but not independently confirmed |
| UNVERIFIED | `.ev-verdict.unverified` | `#fee2e2` | `#991b1b` | Cannot currently verify |

### 4.3 Adding New Tags
To add a new category tag, add CSS to the dossier's `<style>` block:
```css
.ec-tag.newtag { background: #[bg-hex]; color: #[text-hex]; }
```

---

## 5. FORMAT — Evidence Card HTML

Evidence cards are **always-visible inline elements** that appear directly below their associated source link. They are NOT hover-only — they are permanently rendered on the page.

### 5.1 Card HTML Template

```html
<a class="src-link evidence-link" href="[SOURCE_URL]" target="_blank">
  <span class="preview-dot"></span> [LINK_TEXT] →
</a>
<div class="evidence-card" id="ev-[SOURCE_ID]">
  <span class="ec-badge">[SOURCE_ID]</span>
  <span class="ev-verdict [VERDICT_CLASS]">[VERDICT_LABEL]</span>
  <div class="ec-source">[SOURCE_NAME] — [SOURCE_TYPE]</div>
  <span class="ec-quote">[KEY_QUOTE_OR_DESCRIPTION]</span>
  <span class="ec-meta">[PUBLICATION] &bull; [DATE]</span>
  <span class="ec-tag [CATEGORY_CLASS]">[TAG_LABEL]</span>
  <a href="#src-[SOURCE_ID]" class="ev-nav-link">View in Source Index ↓</a>
</div>
```

### 5.2 Field Definitions

| Field | Max Length | Required | Notes |
|-------|-----------|----------|-------|
| `SOURCE_URL` | — | Yes | Full URL to source |
| `LINK_TEXT` | ~50 chars | Yes | Human-readable link text |
| `SOURCE_ID` | S + number | Yes | Must match Source Index |
| `SOURCE_NAME` | ~40 chars | Yes | Author or publication name |
| `SOURCE_TYPE` | ~30 chars | Yes | e.g., "Facebook Post", "Feature Article" |
| `KEY_QUOTE_OR_DESCRIPTION` | ~150 chars | Yes | Italicized. Direct quote preferred. |
| `PUBLICATION` | ~30 chars | Yes | Publication or platform name |
| `DATE` | — | Yes | Format: "Month DD, YYYY" or "Multiple dates, YYYY–YYYY" |
| `CATEGORY_CLASS` | — | Yes | One of: article, social, testimony, primary, official, screenshot, media, document |
| `TAG_LABEL` | ~20 chars | Yes | Human-readable tag (uppercase) |

### 5.3 Card CSS (required in every dossier)

```css
/* ===== EVIDENCE SOURCE CARDS (always visible inline) ===== */
.evidence-link {
  position: relative; cursor: pointer;
  color: var(--forest); text-decoration: underline;
  text-decoration-style: dotted; text-underline-offset: 3px;
}
.evidence-card {
  display: block; position: relative; z-index: 1;
  width: 100%; max-width: 100%;
  background: var(--sage-mist, #e8f0e2);
  border-radius: 10px; box-shadow: none;
  padding: 14px 18px 12px; margin-top: 12px;
  border-left: 3px solid var(--forest, #2d5a27);
  font-size: 0.85rem; line-height: 1.5;
}
.evidence-card .ec-badge {
  display: inline-block; background: var(--forest, #2d5a27);
  color: #fff; font-size: 0.7rem; font-weight: 700;
  padding: 2px 8px; border-radius: 4px; margin-right: 8px;
  vertical-align: middle; letter-spacing: 0.5px;
}
.evidence-card .ec-source {
  font-weight: 600; color: var(--forest, #2d5a27);
  display: inline; vertical-align: middle;
}
.evidence-card .ec-quote {
  display: block; margin-top: 8px;
  color: #444; font-style: italic;
}
.evidence-card .ec-meta {
  display: block; margin-top: 6px;
  color: var(--text-muted, #888); font-size: 0.75rem;
}
.evidence-card .ec-tag {
  display: inline-block; margin-top: 8px;
  font-size: 0.65rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 1px;
  padding: 2px 10px; border-radius: 3px;
}
.ec-tag.article { background: #dbeafe; color: #1e40af; }
.ec-tag.social { background: #fce7f3; color: #9d174d; }
.ec-tag.testimony { background: #fef3c7; color: #92400e; }
.ec-tag.primary { background: #d1fae5; color: #065f46; }
.ec-tag.official { background: #e0e7ff; color: #3730a3; }
.ec-tag.screenshot { background: #f3e8ff; color: #6b21a8; }
.ec-tag.media { background: #fef9c3; color: #854d0e; }
.ec-tag.document { background: #f1f5f9; color: #475569; }
@media (max-width: 600px) {
  .evidence-card { padding: 12px 14px 10px; font-size: 0.8rem; }
}
```

### 5.4 Dossier-Specific Color Overrides
Each dossier uses its own CSS variables. The evidence card system uses `--forest` and `--sage-mist` which should be defined per-dossier:

| Dossier | `--forest` | `--sage-mist` | Theme |
|---------|-----------|---------------|-------|
| Women's Day Betrayal | `#2d5a27` | `#e8f0e2` | Warm green |
| Caravan Fresh | *(define)* | *(define)* | *(per dossier)* |
| Cricket Corruption | *(define)* | *(define)* | Dark purple/gold |

---

## 6. CITE — Source Index & Inline References

### 6.1 Source Index Table
Every dossier must have a Source Index section with a table:

```html
<section class="section" id="sources">
  <div class="section-header">
    <div class="section-label" lang-en>Section XX</div>
    <h2 lang-en>Source Index</h2>
    <p class="section-desc" lang-en>Every claim is backed by a publicly accessible source</p>
  </div>
  <table class="src-table">
    <thead><tr><th>#</th><th>Source</th><th>Type</th><th>Link</th></tr></thead>
    <tbody>
      <tr id="src-S1"><td>S1 <a href="#ev-S1" class="ev-nav-link" style="margin:0">↑</a></td><td>[Source Name]</td><td>[Type]</td><td><a href="[URL]">[Short Label]</a></td></tr>
      <!-- ... -->
    </tbody>
  </table>
</section>
```

### 6.2 Inline Reference Markers
Body text should include inline citations that link to the Source Index:

```html
<!-- In body text -->
...documented allegations <a href="#sources" class="ref-marker">[S3]</a> dating back to 2021...
```

CSS for reference markers:
```css
.ref-marker {
  font-size: 0.75em; font-weight: 700;
  color: var(--forest); text-decoration: none;
  vertical-align: super; padding: 0 2px;
  border-bottom: 1px dotted var(--forest);
}
.ref-marker:hover { color: var(--ember); }
```

### 6.3 Citation Rules
- Every factual claim must have at least one `[SX]` reference
- Quotes must be attributed with source ID
- Dates must be verifiable against the source
- If multiple sources support a claim, cite all: `[S3, S5]`

---

## 7. EMBED — Adding Evidence to a Dossier

### 7.1 Screenshot Evidence (base64)
For screenshots that need to be embedded directly:

```html
<div class="evidence-img">
  <img src="data:image/jpeg;base64,[BASE64_DATA]" alt="[DESCRIPTIVE_ALT_TEXT]" loading="lazy">
  <div class="evidence-caption">[SOURCE_ID]: [Brief description] — [Date]</div>
</div>
```

### 7.2 Text-Based Evidence Cards
For articles, blog posts, and external sources — use the evidence card format from Section 5.

### 7.3 Placement Rules
- Evidence cards go **immediately after** their associated source link
- Screenshot evidence goes inside the relevant section's `.card` or `.callout` div
- Never place evidence outside of a section context
- Group related evidence together (e.g., multiple screenshots from same conversation)

### 7.4 Naming Convention for Evidence Items
- Screenshots: `evidence-[dossier-slug]-[number].jpg` (e.g., `evidence-caravan-fresh-36.jpg`)
- For base64 embedded: No filename needed, but track via the Source Index
- Alt text must describe the content for accessibility

---

## 8. DEPLOY — Publishing Evidence

### 8.1 Pre-Deploy Checklist

- [ ] All evidence cards render correctly in local preview
- [ ] Base64 images display without errors
- [ ] All source URLs are valid and accessible
- [ ] Source Index table matches all inline references
- [ ] Evidence cards have all required fields (badge, source, quote, meta, tag)
- [ ] Bilingual text included where required (`lang-en` / `lang-si`)
- [ ] CMS `data-cms-id` attributes present on editable elements
- [ ] No uncensored personal information of private individuals
- [ ] Git commit message describes what evidence was added

### 8.2 Deployment Steps

```bash
# 1. Stage the dossier file
git add public/dossiers/[dossier-name]/index.html

# 2. Commit with descriptive message
git commit -m "Add evidence S[X]-S[Y] to [dossier-name] dossier"

# 3. Push to trigger GitHub Pages deploy
git push origin main

# 4. Wait ~30 seconds, then verify on live site
# https://analyst.rizrazak.com/dossiers/[dossier-name]/
```

### 8.3 Post-Deploy Verification
- Open the live URL in browser
- Scroll to each new evidence card and confirm visibility
- Click each source link to verify it opens correctly
- Check mobile view (resize to 375px width)
- Confirm the Source Index table is up to date

---

## 9. Evidence Registry

### 9.1 Per-Dossier Evidence Tracking

Each dossier maintains its own evidence count. Track here:

| Dossier | Evidence Count | Last Updated | Notes |
|---------|---------------|--------------|-------|
| Caravan Fresh | 36+ screenshots | 2026-03-09 | Base64 embedded, Evidence 37 pending review |
| Women's Day Betrayal | 4 evidence cards (S1, S2, S3, S8/S9) + Source Index S1–S11 | 2026-03-09 | Text-based cards, always visible |
| Sri Lanka Cricket | TBD | — | Dossier has hover preview infrastructure |
| Easter Sunday Attacks | TBD | — | — |
| Iran-US-Israel | TBD | — | — |
| MP Accountability | TBD | — | — |
| Hormuz Crisis | TBD | — | — |

### 9.2 Evidence ID Allocation
- **Caravan Fresh:** Evidence 1–36+ (sequential, screenshot-based)
- **Women's Day Betrayal:** S1–S11 (source-based, text cards for S1, S2, S3, S8/S9)
- Other dossiers: Start from S1 when adding evidence

---

## 10. Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│  ADDING NEW EVIDENCE — QUICK CHECKLIST                  │
├─────────────────────────────────────────────────────────┤
│  1. Capture: Screenshot or record source details        │
│  2. Verify: URL works, date correct, content accurate   │
│  3. Classify: Assign S-number + category tag            │
│  4. Format: Create evidence-card HTML (see template)    │
│  5. Embed: Place after source link in correct section   │
│  6. Cite: Add [SX] inline markers in body text          │
│  7. Update: Source Index table                          │
│  8. Commit: Descriptive git message                     │
│  9. Push: Deploy to GitHub Pages                        │
│  10. Verify: Check live site, desktop + mobile          │
└─────────────────────────────────────────────────────────┘
```

---

## Appendix: CSS Variable Reference

```css
/* Common across dossiers */
--forest: #2d5a27;     /* Primary accent (green dossiers) */
--sage: #7da56d;       /* Secondary accent */
--sage-mist: #e8f0e2;  /* Light background */
--ember: #c0392b;      /* Warning/danger */
--gold: #a67c00;       /* Highlight */
--bg: #f7f5ed;         /* Page background */
--bg-card: #ffffff;    /* Card background */
--text-muted: #888;    /* Metadata text */
--radius: 12px;        /* Card border radius */
--radius-lg: 16px;     /* Large card radius */
--shadow-lg: 0 12px 48px rgba(0,0,0,0.12);
```

---

## Appendix: Shared Module Files

Evidence system CSS and JS are centralized for all dossiers:

- **`public/dossiers/_shared/evidence-system.css`** — All evidence card styles, category tags, ref-markers, verdict badges, nav links
- **`public/dossiers/_shared/evidence-system.js`** — Smooth scroll navigation, highlight animations, hash handling

Include in any dossier:
```html
<link rel="stylesheet" href="../_shared/evidence-system.css">
<script src="../_shared/evidence-system.js" defer></script>
```

---

## Appendix: Cross-References

This protocol works alongside:

- **[ETHICS_PROTOCOL.md](ETHICS_PROTOCOL.md)** — Source protection, victim-centered reporting, censoring, legal compliance
- **[STRATEGY.md](STRATEGY.md)** — Platform strategy, audience segmentation, theory of change, risk framework
- **[PROJECT_TRACKER.md](PROJECT_TRACKER.md)** — Living session tracker and task management
