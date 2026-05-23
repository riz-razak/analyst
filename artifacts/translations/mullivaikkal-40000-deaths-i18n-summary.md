# Mullivaikkal Dossier Translation Prep

Date: 2026-05-24

## Yan Ownership

- Elubaas: Tamil first, French second translation review and terminology discipline.
- Ravana: political and civic meaning checks, especially wording that can read as denial or ethnic contempt.
- Mara: legal and source-safety gate for genocide, casualty-number, and attribution language.
- Aether/Nuwan: implementation, metadata, sitemap/feed, and review-file generation.
- Ridma: reader-facing clarity and toggle/interface restraint.

## Current State

- English is the primary public text.
- Sinhala is live as the only exposed language toggle.
- Tamil and French are not live yet.
- The translation review sheet is generated from the current live page at:
  - `artifacts/translations/mullivaikkal-40000-deaths-i18n-review.json`
- Current extracted translatable entries: 182.

## Translation Service Status

The existing Analyst translation route is `scripts/translate-dossier.py`, which expects:

- `GOOGLE_TRANSLATE_API_KEY`
- `GOOGLE_CLOUD_PROJECT`

Those environment variables were not present in the shell during this pass, so the Google Translation/TLLM layer was not run. This pass therefore prepares the review substrate instead of injecting unreviewed machine Tamil or French into the public page.

## Translation Rules Carried Forward From Sinhala

- Use Google/TLLM output as a high-quality first pass, not as publication authority.
- Preserve SEO-critical terms where translation weakens search comprehension.
- When legal accuracy is uncertain, prefer a clear explanation over a forced one-word equivalent.
- Keep coined technical phrases such as `source route`, `claim hardening`, and `category collapse` understandable; quote or explain them where needed.
- Tamil should be written for average online readers, not only policy or legal readers.
- French should follow Tamil only after the Tamil pass proves the structure.
- Do not expose a new language toggle until Elubaas and Mara have cleared the legal and ethnic-risk lines.

## Next Translation Batch

1. Run Google Translation/TLLM for Tamil using the review JSON.
2. Manually review the hero, core claim, SEO section, words-before-numbers section, number table, and civic test first.
3. Add `data-ta` only after the first review batch is accepted.
4. Repeat the same workflow for French after Tamil structure is stable.
