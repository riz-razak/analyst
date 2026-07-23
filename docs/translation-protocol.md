# Translation Protocol — The Analyst

**Status:** STANDING — canonical. Read this first.
**Owner:** PRIYA #9 (governance) with SENEVI #5 (ops)
**Last verified:** 22 July 2026
**Operational detail:** [translation-runbook.md](translation-runbook.md)
**Build placement:** [dossier-build-guidelines.md](dossier-build-guidelines.md) §9
**Pre-publish checks:** [qa-checklist.md](qa-checklist.md)

---

## 1. Mandate

**Every Analyst dossier ships EN + SI + TA.** Translation is a required
publication stage, not a follow-up task. English-only publication is a policy
exception requiring a founder decision, recorded in the dossier's handoff.

Sequence: build → **English copy frozen** → translation gate → human sign-off →
publish. If the English changes after a run, re-run with `--force`.

---

## 2. Infrastructure (facts, not guesses)

| Item | Value |
|---|---|
| GCP project | `yan-news-503217` ("Yan News") |
| Billing account | Yan Rides |
| Org | dgtl.lk |
| API | Cloud Translation, enabled on that project |
| Key | named "Yan News", **restricted to Cloud Translation only** |
| Retired project | `warenyan` — billing account CLOSED, cause of the outage |

```bash
export GOOGLE_TRANSLATE_API_KEY='…'          # never commit, never echo
export GOOGLE_CLOUD_PROJECT='yan-news-503217'
```

Key is supplied by environment variable only. `translate-all.sh` refuses to run
without both variables and prints only the key's character count.

**Engine:** Cloud Translation **v2 NMT**. v3 rejects API keys (`401
CREDENTIALS_MISSING`) and TLLM is not offered for `en→si` or `en→ta`, so v2 NMT
is the identical engine either way. Do not "fix" this with a service account.

**Never** substitute another provider, another LLM, or a hand-translation
workaround. If Google translation access is unavailable, **stop and ask**.

---

## 3. The one command

```bash
scripts/translate-all.sh public/<dossier>/index.html [--lang si|ta|both] [--force]
```

Activates `.venv-translation`; runs preflight → SI → TA → review pages →
pipeline tests → QA gate. Idempotent without `--force`.

**Instrumentation is a precondition.** Every translatable node needs balanced
`lang-en` / `lang-si` / `lang-ta` markers with matching `-en` / `-si` / `-ta`
`data-cms-id`s. A dossier with zero markers **silently translates nothing**.

---

## 4. The gate

`scripts/translation-qa.py` — pure static analysis, no API key needed.
Exit `0` = publishable, `1` = at least one check failed, `2` = usage error.

Seven checks: `sibling_coverage`, `target_script`, `cross_contamination`,
`residual_markup`, `keep_terms`, `numbers`, `stranded_english`.

**Exit 1 means do not publish.** `--skip-qa` output is never publishable.

---

## 5. Glossary governance

The keep-list is `SINGLISH_KEEP` in `scripts/translate-dossier.py`, protected at
**paragraph level** — the pipeline cannot tell a UI label from the same word in
running prose. That single fact drives the whole policy.

**MAY join the keep-list**

- Acronyms and initialisms — `G.C.E.`, `A/L`, `O/L`, `NIE`, `GSHS`, `CIABOC`, `RTI`, `UGC`.
- Exam, legal and technical terms with no ordinary-English sense here — `z-score`, `leave to proceed`, `deepfake`.
- Proper nouns and product names — `Facebook`, `Change.org`, `Cyclone Ditwah`.
- Controlled-vocabulary evidence chips that must survive verbatim — `Verified`, `Documented`, `Alleged`, `Unaudited`.

**MAY NOT join the keep-list**

- Ordinary English words, even when they are Analyst method labels — *claim,
  petition, evidence, verify, stated, category, geography, writ, syllabus*.
  Protecting them strands bare English mid-sentence. Prose wins over labels.
- **Fragments of official titles** — e.g. "Ministry of Education" inside
  "Ministry of Education, Higher Education and Vocational Education". A
  half-protected title is worse than an unprotected one. These institutions have
  settled Sinhala and Tamil renderings; let them translate whole.

Any keep-list change requires a `--force` re-run and a joint re-read of
`keep_terms` **and** `stranded_english` — adding a term usually trades one for
the other. Acronym punctuation normalisation (`G.C.E.` → `GCE`) is **acceptable,
not a loss**.

The keep-list in `Yan-Analyst.md`'s Translation Policy is partially superseded by
the above. This is deliberate. The reconciling edit is proposed in
[`handoff/analyst-translation-handover-2026-07-22.md`](handoff/analyst-translation-handover-2026-07-22.md);
`Yan-Analyst.md` is not to be edited outside that handover.

---

## 6. Human review — non-negotiable

Machine output is a **draft, not publishable copy.**

1. **Headlines, deks, standfirsts, kickers and pull-quotes require human Sinhala
   and Tamil lines.** NMT destroys puns, rhythm and register silently and no
   automated check can catch it. Standing example: *The Cohort That Paid the
   Bill* → "the group that paid the invoice" in both languages.
2. **Full human read-through of the SI and TA editions** before publication.
3. **Enable the language toggle only after sign-off** — drop `disabled` and
   `title` from `#langToggle`, set `data-lang-options="en,si,ta"`.
4. **Never invent Sinhala or Tamil text** from model memory. Human lines come
   from a human.
5. **`vis/*.html` is out of scope** for this pipeline and needs its own pass.

---

## 7. Do not regress — the five bugs

These were paid for once. Re-introducing any of them is a regression.

| # | Bug | Rule |
|---|---|---|
| 1 | `__KEEP_nnn__` placeholder tokens — **Tamil NMT deletes them outright** (Sinhala passes them through), so protected terms vanished with no error | Protect terms with `<span translate="no">` only. Never reintroduce placeholder tokens. Detected by `keep_terms`. |
| 2 | `get_text(strip=True)` welds adjacent inline strings (`Paidthe Bill`, `…in 2020.In 2026…`) | Use `element_text()` (`get_text(" ", strip=True)`). Never call `get_text(strip=True)` in this codebase. |
| 3 | Over-broad keep-list strands bare English inside translated prose | Keep-list stays lean (77 entries, cut from 96). See §5. Detected by `stranded_english`. |
| 4 | v3 "fix" attempts — v3 rejects API keys with `401 CREDENTIALS_MISSING` | Stay on v2 NMT. Do not add a service-account path without a v3-only requirement. |
| 5 | Silent no-op re-runs after a glossary or copy change | Always `--force` after changing the keep-list or the English. |

Bonus rules of the same standing: plural/possessive forms must stay protected
(`_term_pattern()` uses `(?<!\w)` / `(?!\w)`, not `\b`); digit groups are wrapped
in `<span translate="no">` so NMT cannot drop a number.

---

## 8. When this breaks — check these in order

1. **Billing.** Is the project's billing account open? `warenyan` is retired and
   its billing is CLOSED. Anything that 403s with a billing message is this until
   proven otherwise.
2. **Project.** `echo $GOOGLE_CLOUD_PROJECT` → must be `yan-news-503217`.
3. **Key.** Is `GOOGLE_TRANSLATE_API_KEY` set, non-empty, and the "Yan News" key
   restricted to Cloud Translation? Check the character count the script prints.
4. **API enablement.** Cloud Translation API enabled on `yan-news-503217`.
5. **API version.** `401 CREDENTIALS_MISSING` means something routed to v3. It
   must be v2 for key auth.
6. **Virtualenv.** `.venv-translation` present with `beautifulsoup4`, `lxml`,
   `requests`.
7. **Instrumentation.** Count `lang-en` / `lang-si` / `lang-ta` markers. Zero or
   unbalanced markers = the pipeline "succeeds" and does nothing.
8. **Staleness.** Text unchanged after a fix? You forgot `--force`.
9. **QA output.** Read which of the seven checks failed. `keep_terms` and
   `stranded_english` are usually the same argument seen from two sides.
10. **Only then** open the code. Every failure above has happened for real; see
    [translation-runbook.md](translation-runbook.md) §3.
