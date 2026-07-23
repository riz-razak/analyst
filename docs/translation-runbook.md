# Translation Runbook — Sinhala / Tamil

**Owner:** SENEVI #5 (ops) with ELUBAAS (Linguistic Intelligence)
**Last verified:** 22 July 2026
**Applies to:** every dossier under `public/<dossier>/index.html` on
analyst.rizrazak.com

This runbook is the operational companion to the Translation Policy section of
`Yan-Analyst.md`. Where the two disagree on the **keep-term list**, this file
records the reason for the divergence (see [Glossary
governance](#glossary-governance)) and a handover has been filed to reconcile
`Yan-Analyst.md`:
`docs/handoff/analyst-translation-handover-2026-07-22.md`.

---

## 0. What the pipeline is

| Piece | Path | Role |
|---|---|---|
| Translator | `scripts/translate-dossier.py` | extract → protect glossary → translate → restore → inject → review |
| QA gate | `scripts/translation-qa.py` | automated post-translation assertions; exits non-zero on failure |
| Entry point | `scripts/translate-all.sh` | preflight → SI → TA → review → pipeline test → QA gate |

Markup contract: each translatable element carries `lang-en data-lang="en"
data-cms-id="<id>-en"` and is **followed by sibling** `lang-si` / `lang-ta`
elements with matching `-si` / `-ta` CMS ids. The bare `lang-en` / `lang-si` /
`lang-ta` markers are what the scripts key off; `data-lang` drives the
front-end toggle.

---

## 1. Setup (once)

### 1.1 Credentials

Cloud Translation now bills to GCP project **`yan-news-503217`** ("Yan News",
billing account **Yan Rides**, org **dgtl.lk**). The Cloud Translation API is
enabled on it, and the API key is named **"Yan News"**, restricted to the Cloud
Translation API only.

> The old project **`warenyan` is retired. Its billing account is CLOSED.**
> That — not exhausted credits, not a quota, not a bad key — is what caused the
> long translation outage. If anything ever 403s with a billing message, check
> which project you are on before anything else.

```bash
export GOOGLE_TRANSLATE_API_KEY='…'          # "Yan News" key — NEVER commit
export GOOGLE_CLOUD_PROJECT='yan-news-503217'
export GOOGLE_CLOUD_LOCATION='us-central1'   # optional; script default
```

The key is supplied **by environment variable only**. It is never hardcoded,
never committed, never echoed by `translate-all.sh` (the script prints only its
character count), and never passed on a command line.

### 1.2 Virtualenv

```bash
cd /Users/rizrazak/Code/the-analyst
python3 -m venv .venv-translation
.venv-translation/bin/pip install beautifulsoup4 lxml requests
```

`translate-all.sh` activates `.venv-translation` itself if no virtualenv is
active, and aborts with instructions if it is missing or missing dependencies.

---

## 2. The run

```bash
cd /Users/rizrazak/Code/the-analyst
scripts/translate-all.sh public/2026-al-cohort
```

That single command runs, in order, failing loudly on any non-zero exit:

1. **Preflight dry run** for each language — no API call, no spend; confirms the
   script sees the expected element count.
2. **SI translation**, then **TA translation**.
3. **Side-by-side review page** for each language
   (`translation-review.html`, `translation-review-ta.html`).
4. The pipeline's own **`test`** QA pass for each language.
5. The **QA gate** (`translation-qa.py`) for each language — the last word.

Options:

| Flag | Effect |
|---|---|
| `--lang si` / `--lang ta` / `--lang both` | target language(s); default `both` |
| `--force` | re-translate siblings that **already** have copy — required after any keep-list change, otherwise the old text is kept |
| `--preflight-only` | stop after the dry run |
| `--skip-qa` | debugging only; output produced this way is **not publishable** |

The run is **idempotent**: without `--force`, elements that already carry
target-language copy are skipped, so re-running costs nothing and changes
nothing.

### Running the QA gate alone

```bash
python3 scripts/translation-qa.py public/2026-al-cohort/index.html --lang si
python3 scripts/translation-qa.py public/2026-al-cohort/index.html --lang ta
python3 scripts/translation-qa.py public/2026-al-cohort/index.html --lang both --json
```

No API key needed — it is pure static analysis. Exit `0` = pass, `1` = at least
one check failed, `2` = usage/IO error.

### What the QA gate asserts

| Check | Assertion |
|---|---|
| `sibling_coverage` | every `lang-en` element has a `lang-<t>` sibling that is non-empty and is not a verbatim English copy |
| `target_script` | every filled sibling contains target-script characters — Sinhala **U+0D80–U+0DFF**, Tamil **U+0B80–U+0BFF** |
| `cross_contamination` | no Sinhala characters in the Tamil edition and no Tamil characters in the Sinhala edition |
| `residual_markup` | zero `__KEEP_nnn__` tokens and zero stray `<span translate="no">` anywhere in the file |
| `keep_terms` | every keep-list term present in an English element is present in that element's translation |
| `numbers` | every curated load-bearing figure present in an English element is present in its translation (`CURATED_NUMBERS` in the script — funnel counts, day counts, z-score cut-offs, helpline 1926, years) |
| `stranded_english` | no bare English common word left inside translated prose |

The gate single-sources `SINGLISH_KEEP`, `element_text()` and `_term_pattern()`
from `translate-dossier.py` by loading it by path, so the glossary can never
drift between translator and checker.

---

## 3. Failure modes — symptom → cause → fix

Every entry below was hit for real. Do not rediscover them.

### 3.1 Everything 403s / billing errors — CLOSED billing account

**Symptom.** API calls fail with a billing or project error; the pipeline
appears "out of credits".
**Cause.** The old project `warenyan` had its **billing account closed**.
**Fix.** Use `yan-news-503217` (Yan News / Yan Rides / dgtl.lk) with Cloud
Translation enabled and the "Yan News" restricted key. Verify
`echo $GOOGLE_CLOUD_PROJECT` before debugging anything else.

### 3.2 `401 CREDENTIALS_MISSING` — v3 rejects API keys

**Symptom.** Cloud Translation **v3** returns `401 CREDENTIALS_MISSING` even
with a valid, correctly restricted key.
**Cause.** v3 (Advanced) requires **OAuth2 / service-account** credentials.
**Only v2 accepts an API key.**
**Fix.** Already handled: when an API key is present, `TranslationClient`
transparently routes the request to **v2 NMT**. Nothing is lost — TLLM is
v3-only *and* is not offered for `en→si` or `en→ta`, so v2 NMT is the identical
engine we would land on anyway. Do **not** "fix" this by adding a
service-account path unless someone actually needs a v3-only feature.

### 3.3 Welded words in the source sent to the API

**Symptom.** Text like `Paid <span>the Bill</span>` reached the API as
`Paidthe Bill`; adjacent `<span class="dek-l">` blocks became `…in 2020.In 2026…`.
**Cause.** BeautifulSoup `get_text(strip=True)` strips each `NavigableString`
and joins with **nothing**.
**Fix.** Use `element_text()` — `get_text(" ", strip=True)` with whitespace
collapsed. Never call `get_text(strip=True)` in this codebase.

### 3.4 Tamil silently deletes protected terms

**Symptom.** `G.C.E.`, `A/L`, `GSHS`, `Cyclone Ditwah` vanished from Tamil
output with no error. Sinhala output was fine.
**Cause.** Term protection used opaque `__KEEP_nnn__` placeholder tokens.
Sinhala NMT passes them through; **Tamil NMT deletes them outright.**
**Fix.** Term protection now wraps terms in `<span translate="no">`, which the
API honours natively because we send `mimeType=text/html`; the spans are
unwrapped after translation. Never reintroduce placeholder tokens.
**Detection:** the `keep_terms` QA check.

### 3.5 Glossary over-protection strands English in prose

**Symptom.** Sentences like `…තබා ඇත claim.` and `petition අත්සන් කරන්න` —
bare English words marooned inside Sinhala sentences. Protecting only part of a
longer official title ("Ministry of Education" inside "Ministry of Education,
Higher Education and Vocational Education") left the head in English and
translated the tail.
**Cause.** Ordinary English words were on the keep-list.
**Fix.** Keep-list cut **96 → 77** entries. See
[Glossary governance](#glossary-governance).
**Detection:** the `stranded_english` QA check.

### 3.6 Plural forms not protected

**Symptom.** `z-score` was keep-listed but `z-scores` was translated
(`ඉසෙඩ් ලකුණු`).
**Cause.** The term pattern matched the exact string only.
**Fix.** `_term_pattern()` now allows an optional trailing `'s` for terms
ending in an alphanumeric character. Note it deliberately uses `(?<!\w)` /
`(?!\w)` rather than `\b`, so punctuated terms (`A/L`, `G.C.E.`) match
correctly while `writ` no longer clobbers `written` and `app` no longer
clobbers `applied`.

### 3.7 Re-running after a glossary change does nothing

**Symptom.** You fix the keep-list, re-run, and the bad text is still there.
**Cause.** The pipeline skips siblings that already have content — by design.
**Fix.** Use `--force` (`scripts/translate-all.sh <dossier> --force`).

### 3.8 The headline pun dies

**Symptom.** "The Cohort That Paid the Bill" came back as "the group that paid
the invoice" in **both** languages.
**Cause.** Machine translation cannot carry wordplay. There is no fix in code.
**Rule:** see [Human review](#human-review-standing-rule).

---

## 4. Glossary governance

The keep-list is `SINGLISH_KEEP` in `scripts/translate-dossier.py`. It is
protected at **paragraph level**, which means the pipeline cannot tell a UI
label from the same word in running prose. That single fact drives the whole
policy.

**Belongs on the keep-list**

- Acronyms and initialisms: `G.C.E.`, `A/L`, `O/L`, `NIE`, `GSHS`, `CIABOC`,
  `HRCSL`, `RTI`, `UGC`, `CBSE`, `NCTB`, `HSC`, party abbreviations.
- Unambiguous technical terms with no ordinary-English sense in this context:
  `z-score`, `deepfake`, `blockchain`.
- Proper nouns and product names: `Facebook`, `WhatsApp`, `Change.org`,
  `Cyclone Ditwah`.
- Controlled-vocabulary evidence chips that must survive verbatim:
  `Verified`, `Documented`, `Alleged`, `Unaudited`.
- Multi-word Analyst method phrases that are unambiguous as phrases:
  `source trail`, `source route`, `source-gated dossier`, `exact count`,
  `leave to proceed`.

**Does NOT belong on the keep-list**

- Ordinary English words that are also Analyst method labels: **claim,
  petition, evidence, verify, stated, category, geography, writ, syllabus**.
  Protecting every occurrence strands bare English mid-sentence. They are
  keep-worthy as *dossier labels*, but the pipeline cannot distinguish label
  from prose, so prose wins.
- **Fragments of longer official titles** — e.g. "Ministry of Education" inside
  "Ministry of Education, Higher Education and Vocational Education". Half-
  protected titles are worse than unprotected ones. These institutions have
  settled Sinhala and Tamil renderings; let them translate as whole phrases.

**Departure from `Yan-Analyst.md`.** The stated preserve-list in
`Yan-Analyst.md`'s Translation Policy is **partially superseded** by the above.
This is deliberate, not drift. The handover filed at
`docs/handoff/analyst-translation-handover-2026-07-22.md` proposes the
reconciling edit.

**Procedure for changing the keep-list**

1. Edit `SINGLISH_KEEP` in `scripts/translate-dossier.py`.
2. Re-run with `--force` — otherwise nothing changes.
3. The QA gate picks the new list up automatically (it imports the same
   constant). Re-read `keep_terms` **and** `stranded_english` together: adding
   a term usually trades one for the other.

---

## 5. Human review — standing rule

Machine output is a **draft, not publishable copy.**

- **Headlines, deks, standfirsts, kickers and pull-quotes always require a
  human Sinhala and Tamil line.** They carry puns, rhythm and register that NMT
  destroys silently and that no automated check can catch. The 2026 A/L
  headline is the standing example: *The Cohort That Paid the Bill* →
  *"the group that paid the invoice"* in both languages.
- Every dossier needs a **human read-through of the full SI and TA editions**
  before the language toggle is enabled, per `Yan-Analyst.md` Translation
  Policy.
- Enable the toggle **only after** sign-off: in `index.html`, drop `disabled`
  and `title` from `#langToggle` and set `data-lang-options="en,si,ta"`.
- **Never** substitute another provider, another LLM, or a hand-translation
  workaround. If Google translation access is unavailable, **stop and ask**.
- Embedded visualisation documents under `vis/` are separate HTML files with
  their own labels, captions and axis text. They carry no `lang-*` markers and
  are **not** covered by this pipeline; they need their own pass.

---

## 6. Quick reference

```bash
# full run, both languages
scripts/translate-all.sh public/2026-al-cohort

# Sinhala only, forcing re-translation after a glossary change
scripts/translate-all.sh public/2026-al-cohort --lang si --force

# preflight only, no API spend
scripts/translate-all.sh public/2026-al-cohort --preflight-only

# QA gate alone (no key needed)
python3 scripts/translation-qa.py public/2026-al-cohort/index.html --lang both
```
