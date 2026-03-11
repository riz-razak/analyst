# CLAUDE.md — AI Assistant Instructions for analyst.rizrazak.com

This file governs how AI assistants (Claude, Copilot, etc.) work on this codebase.
Read this BEFORE making any changes.

## Project Overview

Investigative journalism dossier platform. Bilingual (English/Sinhala).
Deployed via GitHub Pages at `analyst.rizrazak.com` and `rizrazak.com`.

## Translation Policy — MANDATORY

### Approved Method

**Google Cloud Translation API v3 Advanced** is the ONLY approved translation method.

Script: `scripts/translate-dossier.py`

The script automatically selects the best available model:
1. **Translation LLM (TLLM)** — preferred, highest quality
2. **NMT (Neural Machine Translation)** — automatic fallback if TLLM doesn't support the language pair

The script includes:
- Singlish term protection (brand names, acronyms kept in English)
- Buddhist/Pali terminology dictionary (correct Sinhala forms)
- Post-processing quality fixes (formal → natural Sinhala)
- QA testing and back-translation verification
- Side-by-side review HTML generation

### BANNED Translation Methods

The following are **explicitly banned** for all content published on `analyst.rizrazak.com` or any `rizrazak.com` subdomain:

1. **Claude/Anthropic API translations** — Do NOT use Claude to translate Sinhala content
2. **Manual AI translations** — Do NOT write Sinhala translations yourself, even if the API is unreachable
3. **Google Translate v2 Basic** — Legacy NMT without quality post-processing
4. **Any other machine translation service** — DeepL, OpenAI, etc.

If the approved translation API is unreachable (e.g. network proxy blocks it), **stop and tell the user**. Do NOT substitute an alternative method.

### Running Translations

```bash
# Set environment variables
export GOOGLE_TRANSLATE_API_KEY=your-api-key
export GOOGLE_CLOUD_PROJECT=your-project-id

# Translate a dossier (TLLM preferred, NMT fallback)
python3 scripts/translate-dossier.py translate public/<dossier>/index.html

# Dry run first
python3 scripts/translate-dossier.py translate public/<dossier>/index.html --dry-run

# QA test
python3 scripts/translate-dossier.py test public/<dossier>/index.html

# Generate review page
python3 scripts/translate-dossier.py review public/<dossier>/index.html
```

Note: The translation script must be run on the **user's local machine** — the Cowork sandbox proxy blocks googleapis.com.

## Navigation

The site uses **SpineNav** (`/_shared/spine-nav.css` + `/_shared/spine-nav.js`).
The old dossier-sidenav has been removed. Do not recreate it.

Sections are auto-discovered via `data-nav-label` attributes on `<section>` elements.

## Shared Modules

All shared CSS/JS lives in `/public/_shared/`:
- `spine-nav.css` / `spine-nav.js` — Navigation rail
- `comments-v3.css` / `comments-v3.js` — Supabase-backed comments
- `analytics.js` — Privacy-first analytics

## Bilingual HTML Pattern

```html
<p lang-en data-cms-id="key-en">English text</p>
<p lang-si data-cms-id="key-si" class="si" style="display:none">සිංහල පෙළ</p>
```

Language toggle: `body.sinhala` class shows `lang-si`, hides `lang-en`.

## Deployment

Push to `main` → GitHub Actions → Vite build → GitHub Pages.
No manual deployment steps needed.

## Code Style

- Vanilla HTML/CSS/JS — no frameworks
- CSS custom properties for theming (`--spine-*`, `--forest`, `--sage`, etc.)
- Mobile-first responsive design
- Accessibility: semantic HTML, ARIA labels, keyboard navigation
