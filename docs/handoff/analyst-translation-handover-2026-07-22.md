# Handover: Translation Policy changes for `Yan-Analyst.md`

**To:** the Codex session currently restructuring `Yan-Analyst.md`
**From:** SENEVI #5 (ops) with ELUBAAS (Linguistic Intelligence)
**Date:** 22 July 2026
**Scope:** `Yan-Analyst.md` → `## Translation Policy` (currently lines ~55–86)

> **This document proposes changes for you to integrate. It does not itself
> edit `Yan-Analyst.md`.** No file under `Yan-Analyst.md` has been touched by
> this workstream. Everything below is a request, with the evidence for it.
> Where you disagree, raise it — but please do not silently drop items 1–4,
> which encode outage-grade findings.

Everything here was verified in a live run on 22 July 2026 against
`public/2026-al-cohort/index.html` (97 translatable elements, 4,246 words).

---

## 1. Project and credentials — factually wrong today

The Translation Policy section says nothing about which GCP project is used,
and the surrounding operational lore still points at `warenyan`. Both need
replacing with:

- Production project is **Yan News / `yan-news-503217`**, billing account
  **"Yan Rides"**, org **dgtl.lk**, Cloud Translation API enabled.
- The API key is named **"Yan News"** and is **restricted to the Cloud
  Translation API only**. It is supplied by `GOOGLE_TRANSLATE_API_KEY`
  environment variable, never hardcoded, never committed.
- **The old project `warenyan` is retired because its billing account was
  CLOSED.** That is the actual cause of the long translation outage — not
  exhausted credits, not quota, not a bad key. Please state the cause
  explicitly; it was expensive to find twice.

## 2. v2, not v3 — a hard constraint, not a preference

`scripts/translate-dossier.py` still advertises itself as a "v3 TLLM"
pipeline. The policy should record the constraint that makes that name
aspirational:

- **Cloud Translation v3 rejects API keys** — `401 CREDENTIALS_MISSING`, even
  with a valid, correctly restricted key. v3 requires OAuth2 / service-account
  credentials. **Only v2 accepts an API key.**
- **TLLM is v3-only, and is not offered for `en→si` or `en→ta` in any case.**
  So v2 NMT is the identical engine we would land on via v3.
- The script therefore **transparently routes key-auth requests to v2 NMT**.
  This is correct and should not be "fixed" by bolting on a service account
  unless a genuinely v3-only feature is needed.

## 3. Keep-term governance — the stated preserve-list is partially superseded

This is the substantive editorial change.

`Yan-Analyst.md` currently instructs preservation of terms including
`claim`, `source trail`, `source route`, `source-gated dossier`, `stated`,
`verify`, `evidence`, `online`, `harden`, `correction`, `denial`, `SEO`,
`final phase`, `exact count`, `Mullivaikkal-only`, `category`, `geography`,
`legal intent`, `accountability`, `war crimes`, `genocide`,
`ethnic cleansing`, `massacre`.

**The single-word ordinary-English entries in that list are now excluded from
machine protection.** Specifically, these are **removed** from `SINGLISH_KEEP`:

| Removed | Why |
|---|---|
| `claim` | ordinary verb/noun; produced `…තබා ඇත claim.` |
| `petition` | produced `petition අත්සන් කරන්න` |
| `evidence`, `verify`, `stated` | ordinary prose words throughout the dossier |
| `category`, `geography` | ordinary prose words |
| `writ` | ordinary legal noun in prose; also a substring hazard |
| `syllabus` | ordinary prose word, settled SI/TA renderings exist |

The same reasoning applies to, and the pipeline does not protect,
`harden`, `correction`, `denial`, `final phase`, `legal intent`,
`accountability`, `war crimes`, `genocide`, `ethnic cleansing`, `massacre`.

**Also removed: fragments of longer official titles.** "Ministry of Education"
was protected, but the real title in the copy is "Ministry of Education, Higher
Education and Vocational Education" — the head stayed English and the tail was
translated. A half-protected title is worse than an unprotected one.

**Retained** from the stated list: the multi-word, unambiguous method phrases
(`source trail`, `source route`, `source-gated dossier`, `exact count`,
`Mullivaikkal-only`) plus `online` and `SEO`.

Net effect: keep-list cut **96 → 77 entries — acronyms and unambiguous
technical terms only.**

**The reason this departs from the stated policy, and the sentence we would
like in `Yan-Analyst.md`:** the pipeline protects at **paragraph level** and
therefore **cannot distinguish a UI label from the same word in running
prose**. The stated preserve-list is right for dossier **labels and chips**;
applied to running prose it strands bare English mid-sentence and reads as
broken. Proposed policy wording:

> Preserve-terms are protected mechanically at paragraph level. Only acronyms,
> proper nouns, controlled-vocabulary evidence chips
> (`Verified` / `Documented` / `Alleged` / `Unaudited`) and unambiguous
> multi-word technical phrases may be added to `SINGLISH_KEEP`. Ordinary
> English words that also function as Analyst method labels are preserved in
> **labels only**, by editorial hand, not by the pipeline. Never protect a
> fragment of a longer official title.

## 4. Pointer to the new runbook and scripts

The "Relevant scripts" list should be updated to:

- `scripts/translate-all.sh` — **the entry point.** Idempotent: preflight dry
  run → SI → TA → review both → pipeline test both → automated QA gate.
  Activates `.venv-translation`, verifies `GOOGLE_TRANSLATE_API_KEY` and
  `GOOGLE_CLOUD_PROJECT`, never echoes the key, supports `--lang si|ta|both`
  and `--force`.
- `scripts/translate-dossier.py` — the translator (unchanged role).
- `scripts/translation-qa.py` — the automated QA gate. Asserts sibling
  coverage, target-script presence (Sinhala U+0D80–U+0DFF / Tamil
  U+0B80–U+0BFF), no cross-contamination between editions, zero residual
  `__KEEP_` tokens or stray `<span translate="no">`, keep-term survival,
  curated-number preservation, and no stranded bare English. Exits non-zero.
- `docs/translation-runbook.md` — **the operational document of record.**
  Setup, run command, every failure mode with symptom and fix, glossary
  governance, human-review rule.
- `scripts/translate-extract.py`, `translate-inject.py`, `translate-review.py`
  remain, but are superseded for dossier work by `translate-all.sh`.

Suggested line for the policy: *"The operational procedure lives in
`docs/translation-runbook.md`. Do not run the translator directly for a
dossier; run `scripts/translate-all.sh`, which ends in a QA gate that must
pass."*

## 5. Human review — please state it as a rule, not a preference

- **Headlines, deks, standfirsts, kickers and pull-quotes always require a
  human Sinhala and Tamil line.** Machine translation cannot carry a pun:
  *"The Cohort That Paid the Bill"* came back as *"the group that paid the
  invoice"* in **both** languages. No automated check can catch this class of
  loss.
- Machine output is a **draft, not publishable copy**. A full human
  read-through of the SI and TA editions is required before the language
  toggle is enabled.
- The QA gate is a floor, not a sign-off.
- `vis/` artifacts are separate documents with their own labels, captions and
  axis text; they carry no `lang-*` markers and are **not** covered by the
  pipeline. They need their own pass.
- The existing rule stands unchanged and should be kept verbatim: *"If Google
  translation access is unavailable, stop and ask."* No other provider, no
  LLM fallback, no hand-translation workaround.

---

## DO NOT REGRESS — four bugs that cost a day each

1. **Never use `__KEEP_nnn__` placeholder tokens for term protection.**
   Sinhala NMT preserves them; **Tamil NMT deletes them outright.** `G.C.E.`,
   `A/L`, `GSHS` and `Cyclone Ditwah` vanished from Tamil with no error. Term
   protection must use `<span translate="no">` (honoured because we send
   `mimeType=text/html`), unwrapped after translation.
2. **Never call BeautifulSoup `get_text(strip=True)` in this codebase.** It
   welds adjacent inline strings: `Paid <span>the Bill</span>` → `Paidthe Bill`,
   which was being sent to the API. Use the `element_text()` helper, which
   joins on a space.
3. **Never keep-list ordinary English words** (see §3). It strands bare English
   inside Sinhala and Tamil sentences.
4. **Keep the plural/possessive tail in `_term_pattern()`.** `z-score` did not
   match `z-scores`, which was then translated despite being keep-listed. The
   pattern must also keep using `(?<!\w)` / `(?!\w)` rather than `\b`, so that
   punctuated terms (`A/L`, `G.C.E.`) still match while `writ` does not clobber
   `written`.

Corollary: **after any keep-list change, re-run with `--force`**, or the
already-filled siblings are skipped and nothing changes.

---

## Current state of `public/2026-al-cohort/index.html`

SI and TA are populated from the **pre-fix** run. Running the QA gate today:

- **Sinhala — PASSES all seven checks** (97 elements).
- **Tamil — FAILS `keep_terms` with 16 dropped terms** across 12 elements
  (`Documented` ×5, `A/L` ×3, `Cyclone Ditwah` ×2, `G.C.E.`, `NPP`,
  `Unaudited`, `Verified`, `GSHS`, `leave to proceed`). This is exactly the
  placeholder-deletion regression in item 1 above, caught automatically.

Remediation is a `--force` re-run of Tamil once the `#court` section and lede
have been revised against the 23 July Court of Appeal order (STAGING.md ISS-03)
— translating before that revision would produce stale SI/TA on arrival.
