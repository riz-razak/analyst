# SEO Strategy — analyst.rizrazak.com

*Practical, prioritised SEO plan for the dossier platform. Philosophy lives in STRATEGY.md. This is the operational playbook.*

---

## Current State

| Signal | Status |
|---|---|
| Custom domain (analyst.rizrazak.com) | ✓ Active |
| HTTPS / CNAME | ✓ Via GitHub Pages + Cloudflare |
| sitemap.xml | ✓ Regenerated 2026-03-08 — correct SPA routes, published dossiers only |
| robots.txt | ✓ Present |
| Article JSON-LD schema | ✓ On all published dossiers |
| Open Graph + Twitter Card | ✓ Present |
| RSS feed (feed.xml) | ✓ Present (auto-discovery added to all dossiers 2026-03-08) |
| Google Search Console | ✗ Not submitted |
| BreadcrumbList schema | ✓ Added to cricket and caravan-fresh (2026-03-08) |
| Internal linking between dossiers | ✓ "Also on Analyst" section added to cricket + caravan-fresh |
| Image alt text | ⚠ Partial |
| Meta description length (150–160 chars) | ✓ Iran dossier updated to 143 chars (acceptable range) |

---

## Priority Queue

### P0 — Do This Week

**1. Submit to Google Search Console**
- Verify ownership via DNS TXT record (Cloudflare dashboard)
- Submit `https://analyst.rizrazak.com/sitemap.xml`
- Request indexing for all 2 published dossiers manually

**2. Regenerate sitemap.xml** ✅ Done 2026-03-08
- Corrected URLs to React SPA routes (`/sri-lanka-cricket-corruption` not `/dossiers/...`)
- Excluded hidden dossiers (iran-us-israel-war, easter-sunday-attacks-suresh-sallay)
- When `mp-accountability` and `sri-lanka-hormuz-crisis` are published, add them
- Sub-pages retained for cricket (betting-web, kalathma-scandal, mindmap, power-network)

**3. Fix RSS auto-discovery** ✅ Done 2026-03-08
Added to `<head>` of iran-us-israel-war, caravan-fresh, and sri-lanka-hormuz-crisis. Cricket and easter already had it.

---

### P1 — Do This Month

**4. Add BreadcrumbList schema to all dossiers** ✅ Done 2026-03-08
Added to `sri-lanka-cricket-corruption` and `caravan-fresh` (the two published dossiers). Add to hidden dossiers when they go live.

**5. Fix meta descriptions** ✅ Done 2026-03-08
Iran dossier is at 143 chars (acceptable range). Hidden dossiers — check when publishing.

**6. Add OG image to easter-sunday-attacks-suresh-sallay**

Missing social preview thumbnail. Create a 1200×630 image (match style of existing thumbnails) and add:
```html
<meta property="og:image" content="https://analyst.rizrazak.com/images/thumbnails/easter-sunday-attacks-suresh-sallay.jpg">
<meta name="twitter:image" content="https://analyst.rizrazak.com/images/thumbnails/easter-sunday-attacks-suresh-sallay.jpg">
```

**7. Internal linking** ✅ Done 2026-03-08
"Also on Analyst" section added to cricket (→ caravan-fresh) and caravan-fresh (→ cricket). Update cross-links as more dossiers are published:

| From | Link to |
|---|---|
| sri-lanka-cricket-corruption | easter-sunday-attacks (political patronage connection) — add when published |
| iran-us-israel-war | sri-lanka-hormuz-crisis (direct economic consequence) — add when both published |
| easter-sunday-attacks | iran-us-israel-war (intelligence / geopolitics angle) — add when both published |

---

### P2 — Next Quarter

**8. Google News eligibility**

The platform already meets many Google News criteria (original reporting, bylined authors, HTTPS, structured data). To qualify:
- Add a clear `/about` page with editorial mission and authorship
- Add a visible publication date on each dossier (already in JSON-LD — ensure it's visible in the HTML too)
- Ensure article URLs are stable and do not change (they are: slugs are fixed)
- Apply via [Google Publisher Center](https://publishercenter.google.com)

**9. Sinhala SEO**

Many dossiers have Sinhala translations but these are toggled in-page, not separate URLs. Options:
- **Option A (recommended):** Add `hreflang` alternate for Sinhala sub-pages if/when separate Sinhala URLs are created
- **Option B (current):** Ensure Sinhala text is in the DOM (not just JavaScript-injected after load) so Googlebot can index it. Check with `View Source` — if the Sinhala text isn't in the HTML, it's not indexed.

**10. Backlink strategy**

High-value targets for earning backlinks:
- Sri Lankan journalist Twitter/X community — share thread versions of dossiers
- GroundViews, Roar Media, Himal Southasian — pitch for mentions or cross-links
- Wikipedia — cite specific facts from dossiers as Wikipedia references where verifiable
- Academic researchers — the Easter Sunday and geopolitics dossiers have citation-worthy analysis

**11. FAQ schema on key dossiers**

The cricket and Iran dossiers naturally answer questions people search for. Add `FAQPage` schema using existing section headings. This can earn FAQ rich snippets in Google results.

Example questions to target:
- "What happened to Sri Lankan cricket?" → cricket dossier
- "How did Suresh Sallay connect to Easter Sunday attacks?" → Suresh Sallay dossier
- "What is Iran's strategy in the 2026 war?" → Iran dossier

---

## Keyword Targets

### Tier 1 — High volume, high relevance
| Keyword | Monthly volume (est.) | Target dossier |
|---|---|---|
| Easter Sunday attacks Sri Lanka | ~9,100 | easter-sunday-attacks-suresh-sallay |
| Iran US Israel war 2026 | ~6,800 | iran-us-israel-war |
| Suresh Sallay arrest | ~3,200 | easter-sunday-attacks-suresh-sallay |
| Sri Lanka cricket corruption | ~4,500 | sri-lanka-cricket-corruption |

### Tier 2 — Lower volume, strong intent
| Keyword | Monthly volume (est.) | Target dossier |
|---|---|---|
| Caravan Fresh Sri Lanka | ~1,400 | caravan-fresh |
| Sri Lanka cricket mafia | ~900 | sri-lanka-cricket-corruption |
| Zahran Hashim Easter Sunday | ~2,100 | easter-sunday-attacks-suresh-sallay |
| Sri Lanka hormuz crisis oil | ~800 | sri-lanka-hormuz-crisis (when published) |
| MP accountability Sri Lanka | ~600 | mp-accountability (when published) |

### Long-tail opportunities (blog posts / sub-sections)
- "who funded the Easter Sunday bombings"
- "Sri Lanka cricket board political interference"
- "how Iran US war affects Sri Lanka economy"
- "Caravan Fresh complaint suppression"

---

## Technical SEO Checklist

- [ ] Core Web Vitals — run Lighthouse audit on each dossier. Dossier pages with D3.js interactive elements (cricket, Iran) may have LCP issues on mobile.
- [ ] Image compression — thumbnails in `/images/thumbnails/` should be WebP, under 100KB
- [ ] Lazy loading on dossier iframes and heavy charts
- [ ] No broken internal links (run `linkchecker` or similar after each deploy)
- [ ] `<html lang="en">` on all pages (✓ already set — ensure Sinhala content has `lang="si"` wrapper)
- [ ] Heading hierarchy — each dossier should have exactly one `<h1>` (the title); verify no H2 is being used before H1

---

## Metrics to Track

Once Search Console is set up, monitor monthly:

1. **Impressions by dossier** — which dossiers are appearing in search results
2. **Click-through rate** — if impressions are high but CTR is low, the title/meta description needs work
3. **Average position** — target: top 10 for Tier 1 keywords within 6 months
4. **Index coverage** — ensure all published dossiers are indexed, none are blocked
5. **Core Web Vitals** — mobile performance on dossier pages

---

## Risks

**Deindexing risk:** Dossiers on terrorism (Easter Sunday) and geopolitics (Iran war) may trigger "sensitive topics" filters. Mitigate by ensuring: factual framing, attribution to named authors, clear editorial mission on `/about`, no sensationalist headlines.

**Orphaned URL risk:** If dossier slugs ever change, 301 redirects must be in place. The existing `LegacyDossierRedirect` component in React handles the old `/dossier/` prefix — preserve this permanently.

**Duplicate content:** The Sinhala toggle creates bilingual content on a single URL. Monitor for any Google "duplicate content" warnings in Search Console.

---

*Last updated: 2026-03-08*
*Owner: Riz Razak*
