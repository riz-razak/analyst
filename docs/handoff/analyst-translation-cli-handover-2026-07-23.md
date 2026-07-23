---
title: "Analyst Translation Pipeline — CLI / LLM Portability Handover"
date: "2026-07-23"
owner: "Senevi #5 (ops) + Elubaas (language)"
status: active
audience: "Any future session (Claude, Codex, or other) that must run, change, or re-host the translation layer"
supersedes-note: "Complements docs/translation-runbook.md and docs/translation-protocol.md; does not replace them."
---

# Translation Pipeline — Portability & Change Handover

**Purpose.** So that if the CLI, the model, or the whole harness changes, whoever picks this up
can run the trilingual layer without rediscovering the six failure modes that cost a full day.
Everything here is verified working as of 2026-07-23 on the `2026-al-cohort` dossier (EN live;
SI/TA QA-green).

## 1. The one-command contract (do not break this interface)

```
./scripts/translate-all.sh public/<dossier>/index.html [--lang si|ta|both] [--force]
```

Any replacement CLI/harness MUST preserve this entry point and these guarantees:
- Activates `.venv-translation` (beautifulsoup4, lxml, requests) or fails loudly.
- Refuses to start without `GOOGLE_TRANSLATE_API_KEY` and `GOOGLE_CLOUD_PROJECT`.
- Never echoes the key (prints char-count only).
- Ends by running `scripts/translation-qa.py` as a hard gate (exit 1 on any failure).
- `--force` re-translates already-filled siblings (needed after any glossary change).

## 2. Infrastructure — the facts that break silently

| Item | Value | Failure if wrong |
|---|---|---|
| GCP project | `yan-news-503217` ("Yan News") | 403 SERVICE_DISABLED |
| Billing account | "Yan Rides" (open) | closed billing → API silently disabled (this was the outage) |
| Retired project | `warenyan` — billing CLOSED, do not use | — |
| API key | "Yan News", restricted to Cloud Translation API only, env var only | 400 API_KEY_SERVICE_BLOCKED if over-restricted |
| API surface | **v2** (`.../language/translate/v2`) | **v3 returns 401 for API keys** — v3 needs OAuth2/service account |
| Model | NMT (TLLM unavailable for en→si / en→ta, so v2 NMT is identical) | — |

**If moving off API-key auth to a service account (to unlock v3/TLLM):** the v3 path is still in
`translate-dossier.py` (`_call_v3`, `_try_tllm`). Provide `GOOGLE_APPLICATION_CREDENTIALS`,
remove the `if self.api_key: return self._call_v2(...)` short-circuit in `_call_v3`, and re-enable
the TLLM probe (currently guarded off for key auth). Do not do this without re-running the full QA
gate — TLLM changes term handling.

## 3. If the LLM/CLI changes — what must be re-implemented, not re-derived

Any new translation backend MUST reproduce these behaviours (each is a bug we already paid for):

1. **Term protection uses `<span translate="no">…</span>`, NOT opaque tokens.**
   Tamil NMT *deletes* `__KEEP_nnn__` tokens; Sinhala preserves them. HTML `translate="no"` is
   honoured natively because we send `mimeType=text/html`. See `protect_singlish_terms()`.
2. **Numbers are wrapped in `translate="no"` too.** NMT dropped a bare `300`. Digit groups get the
   same guard.
3. **Text extraction joins on a space** (`element_text()`), never `get_text(strip=True)` — the
   latter welded "Paid<span>the Bill</span>" into "Paidthe Bill" and shipped it to the API.
4. **Keep-list is acronyms + technical terms only** (77 entries). Ordinary words (claim, petition,
   evidence, verify, stated, syllabus) and fragments of official titles were removed — protecting
   them stranded bare English inside translated sentences. This deliberately departs from the
   preserve-list historically stated in Yan-Analyst.md; see the Codex handover
   `analyst-translation-handover-2026-07-22.md`.
5. **Acronym comparison is punctuation-insensitive** in QA (`G.C.E.` ≡ `GCE`) — the API normalises
   dotted acronyms and that is acceptable, not a loss. See `translation-qa.py::_term_present`.
6. **`_term_pattern` matches an optional trailing `'s`** so `z-score` protects `z-scores`.

## 4. The seven QA checks (the gate a new backend must still pass)

`sibling_coverage · target_script · cross_contamination · residual_markup · keep_terms · numbers ·
stranded_english`. `translation-qa.py` loads the glossary and matchers *from* `translate-dossier.py`
by path, so translator and checker cannot drift. Keep that coupling.

## 5. What machine translation CANNOT do (human-only, every dossier)

- **Headlines, deks, standfirsts, kickers, pull-quotes.** Machine output is literal: "The Cohort
  That Paid the Bill" became `බිල්පත ගෙවූ කණ්ඩායම` / `கட்டணத்தைச் செலுத்திய குழு` — both "paid the
  invoice", losing the *bore the cost* sense. These need a human SI and TA line before the language
  toggle is exposed. The QA gate cannot catch this — it is a semantic, not structural, check.
- **Translation policy is absolute:** Sinhala/Tamil public text is never written from LLM memory.
  Google-backed MT is the production baseline; a human reviews before publish.

## 6. Instrumentation requirement (or the pipeline no-ops)

Every translatable node needs balanced `lang-en` / `lang-si` / `lang-ta` markers with
`data-cms-id` ending `-en`/`-si`/`-ta`, AND a `data-lang` attribute so the shared hide/show CSS
(`body.show-sinhala` / `body.show-tamil` in `_shared/dossier-base.css`) covers it. A node with a
`lang-en` marker but no `data-lang` renders in every language at once — this is exactly the bug
that showed three CTA pills simultaneously on the live page (fixed 2026-07-23 by collapsing to one
rotating pill). `vis/*.html` are separate documents and are NOT yet instrumented.

## 7. Triage — when it breaks, check in this order

1. Billing account open? (closed billing was the original outage, not credits)
2. `echo $GOOGLE_CLOUD_PROJECT` = `yan-news-503217`?
3. Key set, non-empty, restricted to Cloud Translation?
4. Cloud Translation API enabled on that project?
5. `401 CREDENTIALS_MISSING` → something routed to v3; key auth must use v2.
6. `.venv-translation` present with the three deps?
7. Instrumentation present and balanced? (zero markers = silent success, no output)
8. Text unchanged after a fix? → forgot `--force`.
9. Which of the seven QA checks failed? (`keep_terms` vs `stranded_english` are the two sides of the
   same glossary argument.)
10. Only then open `translate-dossier.py` → `docs/translation-runbook.md` §3.

## 8. Files of record

| File | Role |
|---|---|
| `scripts/translate-all.sh` | entry point |
| `scripts/translation-qa.py` | the gate |
| `scripts/translate-dossier.py` | translator (v2/v3 client, protection, extraction) |
| `docs/translation-runbook.md` | procedure of record |
| `docs/translation-protocol.md` | standing policy |
| `docs/handoff/analyst-translation-handover-2026-07-22.md` | proposed Yan-Analyst.md edits (Codex) |
| this file | CLI/LLM portability |
