---
title: "2026 A/L Dossier — Live-State Handover for Codex Continuation"
date: "2026-07-23"
from: "Claude (Opus) session — founder running low on Opus credits, handing to Codex"
to: "Codex session (or any agent) continuing the 2026 A/L dossier"
repo: "/Users/rizrazak/Code/the-analyst  (github.com:riz-razak/analyst, branch main)"
research: "/Users/rizrazak/Code/research/Political/2026/10. 2026 A-Level"
status: "PUBLISHED (EN + machine SI/TA live behind toggle). Open items below."
read-first: "docs/translation-protocol.md · docs/translation-runbook.md · docs/handoff/analyst-translation-cli-handover-2026-07-23.md · Yan-Analyst.md"
---

# 2026 A/L Dossier — Live Handover

The dossier is **live** at `analyst.rizrazak.com/2026-al-cohort/`. English is final-ish; Sinhala and
Tamil are **machine-translated (Google v2 NMT), QA-green structurally, but NOT editorially reviewed**.
This document is everything a fresh session needs to finish it without re-deriving anything.

## 0. Ground truth / non-negotiables

- **Translation policy is absolute:** never write Sinhala / Tamil / French public text from LLM
  memory. Baseline is Google-backed MT (see runbook). EXCEPTION already used: the founder supplied
  the Sinhala headline verbatim (§2) — founder-supplied native copy is authorised; agent-generated
  is not. When the founder asks for "punchy / Singlish" transcreation, treat it as a request for
  OPTIONS he approves, not for you to ship your own SI/TA prose.
- **The live page names a sitting Prime Minister.** Right-of-reply (Gate 2) is still open. Do not
  add new adverse factual claims about her without the claim register backing them.
- **One entry point for translation:** `./scripts/translate-all.sh public/<dossier>/index.html
  [--lang si|ta|fr|both] [--force]`. Gate is `scripts/translation-qa.py` (exit 1 = fail). Never echo
  the API key.
- **Infra:** GCP project `yan-news-503217` (billing "Yan Rides", open). Cloud Translation **v2**
  (v3 rejects API keys). Old project `warenyan` retired (closed billing = the original outage).

## 1. What is DONE (do not redo)

- Six-ring council research, 10-round adversarial dissection, 5-round fact check → `research/.../03-council/`.
- English article (~2,050 words), 11 sections, published. Slug `2026-al-cohort`, registry entry at
  top of `public/data/dossiers.json`, category `accountability`.
- Four non-SVG visualisations in `public/2026-al-cohort/vis/` — single Play, autoplay-once, fixed
  postMessage iframe sizing. **English-only (not instrumented for translation).**
- Companion policy paper `public/2026-al-cohort/policy-paper.html`.
- SI + TA machine translation, structurally QA-green (7/7 both). Language toggle ENABLED
  (`data-lang-options="en,si,ta"`).
- **CTA fixed** (2026-07-23): was three stacked pills (instrumentation split the anchor); now ONE
  `.cta-rotate` pill with a single-line clipping window (`--cta-lh`) cycling EN→SI→TA every 4s,
  pausing on tab-hide, frozen to EN under reduced-motion. **French slot ready** — add a
  `<span class="cta-phrase" lang="fr" ...>` when FR copy lands and it cycles automatically.
- **French added to the shared language system** (`public/_shared/dossier-lang.js` +
  `dossier-base.css`): `SUPPORTED_LANGS`, `LANG_LABELS.fr='FR'`, `show-french` class + CSS
  show/hide rules. Dormant until a page sets `data-lang-options="...,fr"` and provides `lang-fr`
  nodes. **This is now standard for all future dossiers.**
- Founder's Sinhala headline applied (§2).

## 2. OPEN ITEMS — priority order

### P1 — Editorial transcreation of SI/TA/FR headline furniture (founder-directed)
Machine titles read literally wrong ("The Cohort That Paid the Bill" → `බිල්පත ගෙවූ කණ්ඩායම` =
"the group that paid the invoice"). Founder wants **punch + light Singlish**, native-idiomatic.

- **Sinhala headline — DONE, founder-supplied verbatim:** `අන්තිමට A/L බිල ගෙවන්නෙ ළමයින්ද?`
  (node `data-cms-id="al-page-02-si"`). Keep exactly; do not "correct".
- **STILL NEEDED (get from founder or a native sub-editor — DO NOT self-generate):**
  Tamil headline (equivalent of the SI, punchy, keep `A/L` in English);
  French headline; SI/TA/FR **subtitle/dek** rewrites (`al-page-03-*`) — the machine deks are the
  "doesn't fully make sense" ones the founder flagged; and a pass for punch on the SI/TA
  **section H2s and pull-quote** if the founder wants it.
- Mechanism: these are single-node text swaps. Edit the `data-cms-id="al-page-0X-si|ta|fr"` node's
  text, rebuild, push. The QA gate still passes (it checks structure, not idiom). **Log each
  founder-supplied line** in `research/.../04-output/` so provenance is clear.

### P2 — Broken/obscured SI rendering in body paragraphs (BUG, live)
The founder screenshot of the Arithmetic section shows the Sinhala paragraph
(`al-arithmetic-10-si`, and likely others carrying inline claim-ID chips `B1 B2 B3 B5` and inline
`<strong>`/status-chip spans) rendering with **horizontal lines through the text** — a real CSS
defect, not a translation issue. Likely causes to check in order:
1. Sinhala line-height too tight for the glyphs' descenders against an underline/border on inline
   children (claim-id chips, `.status-chip`, links) — the decoration or chip border bleeds across
   wrapped lines.
2. A `text-decoration` or bottom-border on an inline element that the taller Sinhala line-box
   exposes.
3. The `element_text` join left inline chips adjacent to Sinhala with no breathing room.
**Fix approach:** give `[data-lang="si"], [data-lang="ta"]` prose a larger `line-height` (~1.9) and
ensure inline chips/links inside translated prose use `text-decoration:none` + `box-decoration-break`
and don't draw a full-width rule. Verify at the Arithmetic, PM (has `<strong>`) and Contradiction
sections. This is page-local CSS in `public/2026-al-cohort/index.html`.

### P3 — Direct push from CLI (minimise bash) — founder ask
Founder wants to publish periodically without hand-typing the git dance. Build
`scripts/publish.sh`:
```
#!/usr/bin/env bash
set -Eeuo pipefail
# usage: ./scripts/publish.sh "commit message"
cd "$(dirname "$0")/.."
npm run build
git add -A
git commit -m "${1:?commit message required}"
git pull --rebase origin main    # a Codex session shares this repo — always rebase first
git push
```
Notes for whoever writes it: **the repo is shared with a Codex session restructuring
`Yan-Analyst.md`** — pushes get rejected without a `pull --rebase` first (happened twice today,
resolved cleanly). Bake the rebase in. Consider a `--dossier <slug>` narrow-add mode so publishes
stop sweeping 100 unrelated files (today's commit did). Optionally add a post-push `open`
of the live URL. If the founder wants to skip bash entirely, this single script + a shell alias
(`alias pub='~/Code/the-analyst/scripts/publish.sh'`) is the minimal surface.

### P4 — French edition rollout
Now that the system supports FR: (a) instrument nothing new — the `lang-fr` siblings need creating;
(b) run `./scripts/translate-all.sh public/2026-al-cohort/index.html --lang fr` (the script's
`--target-lang` already accepts values via `SUPPORTED_TARGET_LANGS` — CONFIRM `fr` is in that tuple
in `translate-dossier.py`; if not, add it, mirroring `ta`); (c) set the page
`data-lang-options="en,si,ta,fr"`; (d) add the FR `cta-phrase`; (e) FR headline/dek still need human
copy per P1. Keep-list terms (A/L, z-score, RTI…) stay English in French too.

### P5 — Standing blockers already on record (see publication-handoff.md)
- **`#court` section must be revised against the 23 July Court of Appeal order** before any final
  re-translation, or SI/TA ship stale. This is the one time-sensitive item.
- Right-of-reply letters (Gate 2) — **DRAFTED**, `research/.../04-output/right-of-reply-letters.md`
  (3 letters: PM Media Division, Ministry, Commissioner General). Founder to fill `[DATE]`/`[Name]`
  and send from an Analyst address; non-response after 48h is itself the Gate 2 discharge.
- Hero + thumbnail assets — none commissioned; homepage card renders bare.
- The four `vis/*.html` — decide: instrument for translation or declare English-only (current
  state). If instrumenting, they are separate HTML documents needing their own marker pass.

## 3. File map

| Path | What |
|---|---|
| `public/2026-al-cohort/index.html` | the dossier (EN + SI/TA nodes, CTA, page-local CSS/JS) |
| `public/2026-al-cohort/vis/*.html` | 4 visualisations, English-only |
| `public/2026-al-cohort/policy-paper.html` | companion paper |
| `public/2026-al-cohort/2026-al-cohort-translations{,-ta}.json` | translation maps |
| `public/data/dossiers.json` | registry (A/L entry is first) |
| `public/_shared/dossier-lang.js`, `dossier-base.css` | shared lang system (now incl. FR) |
| `scripts/translate-all.sh`, `translation-qa.py`, `translate-dossier.py` | pipeline |
| `docs/translation-runbook.md`, `translation-protocol.md` | procedure + policy |
| `docs/handoff/analyst-translation-cli-handover-2026-07-23.md` | CLI/LLM portability |
| `docs/handoff/analyst-translation-handover-2026-07-22.md` | proposed Yan-Analyst.md edits |
| `research/.../04-output/` | article, exec summary, publication-handoff, design-narrative-plan |
| `research/.../02-notes/claim-register.md` | governing claim ledger (STRIPPED list is binding) |

## 4. Do-not-regress (bugs already paid for)

1. Term protection uses `<span translate="no">`, NOT `__KEEP_` tokens (Tamil deletes tokens).
2. Numbers are wrapped in `translate="no"` too (NMT dropped a bare `300`).
3. Extraction joins on a space (`element_text`), never `get_text(strip=True)` ("Paidthe Bill").
4. Keep-list is acronyms/technical only (77 terms); ordinary words strand English in prose.
5. Every translatable node needs `data-lang` AND balanced `lang-en/si/ta[/fr]` markers, or it
   renders in all languages at once (this caused the 3-stacked-CTA bug).
6. Shared repo — always `git pull --rebase` before push.
