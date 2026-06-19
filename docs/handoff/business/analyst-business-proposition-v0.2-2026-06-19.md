---
title: "The Analyst — Business Proposition v0.2 (clean ad economics, stress-tested)"
date: "2026-06-19"
owner: "Yan Finance Review — Hasib #30 (lead), Harini #45, Priya #9 · Mara #14 (gap round) · adversarial"
status: "draft-for-founder-review · 3 financial rounds + gap round complete"
companion: "analyst-business-proposition-v0.2.xlsx"
supersedes_scope: "v0.1 (ad-only framing) — reassessed per founder"
tags: ["business","ads","cpm","rpm","stress-test","membership","analyst"]
---

# The Analyst — Business Proposition v0.2 · Clean Ad Economics

**Reassessed scope (founder, this session):** "one ad" = **one ad unit per page/screen** (minimal clean
load), not one ad total. **No paywall, ever.** Ads are a revenue stream we **will want but not depend on**
— this packet isolates the **clean economics of the ad**. Output target with Yan agentic/institutional
support: **~2 huge + 15–20 big + 20 small (ML-drafted, human-curated)/month.** Question: *how do we get
there, and what do the ads actually pay?*

Run under the `finance` committee with three financial rounds + Mara's gap round. Numbers are **prudent**
and cited (workbook `Sources`). Companion model: `analyst-business-proposition-v0.2.xlsx`.

---

## Round F1 — Clean ad unit economics (Hasib #30)

One clean banner per page. **Effective RPM = CPM × fill × (1 − ad-block).**

| | Sri Lanka | Diaspora (Tier-1) |
|---|---|---|
| Gross CPM (single banner) | $0.40 | $3.00 |
| × Fill (90%) | | |
| × (1 − ad-block) | −20% | −35% |
| **Effective RPM / 1,000 pv** | **$0.29** | **$1.76** |

So a blended effective RPM lands ~**$0.73 (SL-heavy) to ~$1.17 (diaspora-tilt)** per 1,000 pageviews.
- **Direct-sold alternative:** sell the single slot to one aligned sponsor at a flat monthly rate
  (~$300/mo modelled). This can beat programmatic at low traffic — but reintroduces the **patron risk**
  the Philosophy Forum flagged. Permit only capped (≤20% of revenue), sector-screened, and disclosed.

## Round F2 — Traffic → revenue, working scenarios (Hasib / Harini #45)

**Programmatic ad-only reaches Tier-1 (~$594/mo grossed) at ~500k–1M pageviews/month** (workbook
`Traffic→Revenue`). A new SL investigative brand does not have that in year one.

Working scenarios (supported output; prudent mo-12→24 midpoints; traffic is lumpy):

| Scenario | Pageviews/mo | SL/diaspora | Blended RPM | Ad rev/mo | + 150 members | vs Tier-1 ($594) | Ad-only gap |
|---|---|---|---|---|---|---|---|
| Lean | 40,000 | 70/30 | $0.73 | $29 | $479 | −$115 | 20.4× |
| Base | 120,000 | 60/40 | $0.87 | $105 | $555 | −$39 | 5.7× |
| Growth | 300,000 | 55/45 | $0.95 | $284 | $734 | +$140 | 2.1× |
| Diaspora-tilt | 250,000 | 40/60 | $1.17 | $292 | $742 | +$148 | 2.0× |

**Read:** the **clean ad is a real but minor line** — ~$30–290/mo, i.e. **~5–25% of a Tier-1 salary** at
plausible traffic. Membership is the engine; the ad is the garnish. Even with full agentic-supported
output, **ad-only is 2–20× short**.

## Round F3 — Stress tests (Hasib #30, Mara #14)

Base scenario (120k pv) shocked; membership is the shock absorber (workbook `Stress Tests`):

| Shock | Ad rev/mo | Members still needed for Tier-1 |
|---|---|---|
| Base (no shock) | $105 | 163 |
| Ad-block surge +15pp | $84 | 170 |
| CPM crash −30% | $73 | 174 |
| Diaspora share −15pp | $79 | 172 |
| **AdSense ban (ad = $0)** | **$0** | **198** |

**Takeaway:** the difference between best and worst ad case is only **~35 members**. Ad revenue is
volatile and can go to **zero on one AdSense policy strike** (likely on political content) — member
revenue does not move. *This is the quantitative case for "ads must never be load-bearing."*

### Salary-tier readout (membership ladder, with a modest Base ad ~$105/mo)

| Tier | Salary | Gross target | Members alone | Members + Base ad |
|---|---|---|---|---|
| Tier-1 | $500 | $594 | ~198 | **~163** |
| Tier-2 | $1,000 | $1,169 | ~390 | ~355 |
| Tier-3 | $1,500 | $1,744 | ~581 | ~546 |

At $3/member/mo. A higher blended ARPU (diaspora members pay more) lowers these materially — the next
round should model tiered membership pricing.

---

## The "HOW" — Mara #14 gap round (build the verification spine first)

The output target is reachable **only if the credibility moat survives volume.** Today one human reads
every word; 20 ML-drafted pieces/month removes that bottleneck. The single hardest gap: **keeping "no
orphan numbers" and verbatim-quote integrity true across ML drafts** — LLMs emit fluent *unsourced*
numbers and quotes by default, and a fabricated figure under a named SL individual is an ICCPR/
defamation case with no defence.

**Minimum viable verification spine (build before the ML line goes live):**
1. **Source store** — every source ⇒ SHA-256 + type check + Archive.org snapshot + public/private flag + `source_id` at ingest.
2. **Claim-binding format** — every number, quote, named claim carries inline `claim_id → source_id`; quotes byte-match captured source; default label `UNVERIFIED`.
3. **Alleged Checker as a hard CI gate** — build parses every digit and quoted span; **one orphan = build fails = no publish**; ML output language-locked to English and quarantined until promoted.
4. **Exception-based human promote + audit log** — human reviews only tooling-raised flags; tier-3 (named private individual / ICCPR zone) needs logged right-of-reply + a **named second reviewer** (bus-factor; Sunera is the obvious candidate).

Sinhala/Tamil public text **never** comes from an LLM — only the Google-backed `scripts/translate-*.py`
path with human review. Mara's verdict: **Mara ✓ conditional — ship the spine before volume.** Ship
volume first and you publish a fabricated number with a real name on it before the gate exists. That is
the one irreversible move.

---

## Comparable — The Examiner (Daniel & Mimi Alphonsus)

Subscription-**only**, takes **zero advertising** ("you, dear subscriber, pay our bills"), strong
credibility, and **breakeven is tough**. Lesson: membership is the proven on-ethos lever in this exact
market; our differentiation is adding the **one clean, capped ad they refuse** — as a supplement, never
a dependency — while staying **open (no paywall)** where they gate.

---

## Recommendation & decisions (Priya #9)

1. **Fund the salary membership-primary**, clean ad as a capped supplement (≤20% of revenue). Ad-only is
   not a salary at realistic Y1 traffic; it's a $30–290/mo line.
2. **Build the 4-part verification spine before the ML small-pieces line** — this is the gating "HOW."
3. **Treat the salary as a lagging reward of traction** (~160–200 members or ~500k+ pv), per YAN.md
   anti-hallucination (founder currently jobless; 150k was a *planned* figure).
4. **Decisions needed:** (a) keep strategy.md no-ads ethos vs amend Pillar 2 to permit the conditioned
   clean ad (council: a *capped, screened, disclosed* clean ad is defensible; a load-bearing one is not);
   (b) programmatic vs direct-sold single slot; (c) membership pricing (flat $3 vs tiered SL/diaspora).

## Next rounds (your "3 financial rounds" can go deeper)

This delivered F1 (unit economics), F2 (scenarios) and F3 (stress) at a prudent base. Deeper passes:
tiered membership pricing + conversion funnel (visitor→member %, prudent 0.5–2%); direct-sold sponsor
pipeline sizing; LKR payout/tax (WHT) modelling with Hasib; and a 24-month cohort build to find the
month the salary trigger actually trips. Say `finance` to convene the next round.
