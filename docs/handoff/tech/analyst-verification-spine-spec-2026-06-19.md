---
title: "The Analyst — Verification Spine Implementation Spec"
date: "2026-06-19"
owner: "Yan Tech Review — Aether #3 (lead), Bala #2, Senevi #5, Nuwan #42"
status: "spec / plan-only — no code, no build, no deploy"
tags: ["verification", "ci-gate", "evidence", "ml-guardrails", "tech-spec", "analyst"]
context: "Implements Mara #14's 4-part spine so ML-assisted volume can't break credibility"
---

# The Analyst — Verification Spine Implementation Spec

Plan-only spec (Tech Review: Aether lead, Bala, Senevi, Nuwan). Turns Mara's 4-part "verification spine"
into a buildable design so the platform can publish ~2 huge + 15–20 big + 20 small (ML-drafted,
human-curated)/month **without losing credibility (the #1 asset)**. Enforces: no orphan numbers,
verbatim quotes, evidence labels, and **Sinhala/Tamil never from an LLM**. Builds on the existing stack
(React/Vite + static dossier HTML + Cloudflare Worker + Supabase + GitHub Pages); **no new infra class**.

## Component 1 — Source store (Aether/Bala/Nuwan)

Two-tier, split across the repo boundary: **raw capture stays in `/Users/rizrazak/Code/research`**
(bytes, private/sensitive material — never in Analyst); **Analyst holds a derivative source manifest**
(metadata only). Canonical record = **Supabase `sources` table** (CI gate + review surface query it
server-side); a public-subset `public/<slug>/sources.json` is exported at publish for the dossier's own
source index (public sources only).

Key `sources` fields: `source_id` (`<slug>:S9`), `sha256` (required), `file_type_detected` (`file`
output), `archive_url` + `archive_captured_at` (Archive.org), `original_url`, `visibility`
(public/private — gates Pages export), `author_attributed`, `content_date`, `captured_date`,
`evidence_status` (VERIFIED/DOCUMENTED/ALLEGED/UNVERIFIED/PARTIAL), `language`, **`verbatim_text`**
(source of truth for quote byte-match), `consent_level`, `tier` (1–3; 3 = named private individual /
ICCPR zone), `research_artifact_ref` (pointer into research repo, not bytes). Owner: Nuwan (content),
Bala (visibility/consent/tier).

## Component 2 — Claim-binding format (Aether/Nuwan)

Inline data-attributes parallel to the existing `data-cms-id`:

```html
<span data-claim-id="C12" data-source-id="happy-womaniser-day:S9"
      data-claim-type="quote"  data-evidence-status="ALLEGED" data-verbatim="true">
  "…verbatim quote…"
</span>
```

`data-claim-type` ∈ {quote, number, named-claim}. **Every claim-number, quoted span, and named-claim
must bind to ≥1 `source_id`** (≥2 for serious allegations — two-source rule). Supabase `claims` table
mirrors the evidence-protocol §4 claim–source matrix (`claim_id`, `claim_type`, `bound_source_ids[]`,
`rendered_text`, `verbatim_match`, `right_of_reply_status`). Sinhala/Tamil spans carry
`data-lang="si|ta"` + `data-translation-of="C12"` and match against the captured **original**, never an
LLM rendering.

## Component 3 — Alleged Checker as CI gate (Senevi/Bala/Nuwan)

GitHub Actions `verification-gate` runs on PR/push to `main`, **before** Pages deploy (branch-protection
required check + deploy `needs: verification-gate`). It parses changed `public/**/index.html` (visible
body only), then:
1. **Numbers** — every digit-string (minus an ignore-list + explicit `data-not-a-claim` escape hatch)
   must be `data-claim-type="number"` with a valid `data-source-id`. Orphan → **FAIL**.
2. **Quotes** — quoted spans ≥ threshold must be `data-claim-type="quote"`. Orphan → **FAIL**.
3. **Verbatim byte-match** — `data-verbatim="true"` quotes must be byte-identical (NFC + trim) to
   `sources.verbatim_text`. Mismatch → **FAIL** with diff.
4. **Translation lock** — `data-lang="si|ta"` must carry `data-translation-source ∈ {google-mt, human}`;
   `llm` or missing → **FAIL**.
5. **Quarantine** — UNVERIFIED (or ALLEGED without attribution) outside a `data-quarantine` wrapper → FAIL.
6. **Escape-hatch counter** — over threshold → flag to human review (can't quietly become the norm).

One orphan = red check = no publish. Output is a machine-readable report feeding Component 4.

## Component 4 — Human promote + audit log (Bala/Aether)

Exception-based review view in the admin SPA (`#/verification-queue`) showing **only tooling-flagged
items**. Promote/Reject writes reviewer identity + timestamp + reason to an **append-only
`verification_audit`** table (hash-chained for tamper-evidence; no UPDATE/DELETE grant). **Tier-3**
(named private individual / ICCPR zone) cannot promote until (a) `right_of_reply_status` logged AND
(b) a **named second reviewer (Sunera)** records a `second-review`. Auth rides the **Yan People model**
(`analyst.verify.promote`, `analyst.verify.tier3`) — no parallel store; enforced server-side in the
**hardened Worker** (route allowlist, AAL2, CSRF, same-origin CORS, no browser PAT, every call audited).

## Phased build sequence (gate-first — safe before ML volume)

0. **Manifest foundation** — `sources` + `claims` tables; backfill the existing claim–source matrix; public-subset export. (Nuwan/Bala)
1. **Claim-binding + author tooling** — attributes + CMS emit/validate; retrofit the ~7 live dossiers as known-good corpus. (Aether)
2. **CI gate in WARN mode** — non-blocking; tune ignore-list/false-positives against the corpus. (Senevi/Nuwan)
3. **Flip gate to BLOCKING + Worker hardening** — required check + deploy `needs:`; harden Worker (`/api/verify/*`, AAL2, CSRF, kill PAT). (Senevi/Bala)
4. **Human promote surface + audit + tier-3** — `#/verification-queue`, append-only audit, People-model rights, Sunera second-review. (Bala/Aether/Sunera)
5. **ML line goes live** — English-only drafter connected only now; start at low volume, ramp as false-positive rate + reviewer load prove out. (full sign-off)

**Non-negotiable:** the gate must be **blocking (Phase 3) before any ML-drafted piece can merge.**

## Risks / open questions

R1 byte-match normalization spec (curly quotes/entities) must be defined before Phase 2. R2 number
false-positive ceiling → escape-hatch threshold TBD. R3 source-store sync (research repo ↔ Supabase
manifest) needs an automated intake for the ML line. R4 tier-3 is human judgment → default-conservative
auto-flag. R5 translation provenance attribute can lie → bind to the translate-script run. R6 People
model must support `analyst.*` rights grants now (or define interim that isn't a parallel store).
R7 right-of-reply is process not code → two humans on the hook for tier-3.

**Sign-off:** Aether ✓ · Bala ✓ (Worker hardening + People rights first) · Senevi ✓ (gate blocking before
ML merge) · Nuwan ✓ (normalization spec + verbatim source-of-truth). Recommend proceeding to Phase 0.
