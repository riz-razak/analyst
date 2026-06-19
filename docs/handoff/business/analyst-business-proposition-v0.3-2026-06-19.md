---
title: "The Analyst — Business Proposition v0.3 (net economics, one-ad path, combined breakeven, scaling)"
date: "2026-06-19"
owner: "Yan Finance Review — Hasib #30 (lead), Harini #45 · Vinita #47 (tax flag) · Priya #9"
status: "draft-for-founder-review · rounds F4–F8"
companion: "analyst-business-proposition-v0.3.xlsx"
note: "Tax figures are illustrative, NOT tax advice. Vinita #47 + Hasib #30 to verify with IRD before any public/committed number."
tags: ["business","tax","forex","ads","direct-sponsor","breakeven","scaling","analyst"]
---

# The Analyst — Business Proposition v0.3

Continues the founder directive: **win with the one clean ad first, then combined breakeven/scaling**,
plus **real LKR tax/forex** and the **direct-sponsor pipeline**. Companion model:
`analyst-business-proposition-v0.3.xlsx` (81 formulas, zero errors). Numbers prudent + cited.

> **Tax disclaimer (Vinita #47):** figures below are illustrative modelling, **not tax advice**. SL tax
> treatment of AdSense/forex income is unsettled — verify with IRD/a tax advisor before any committed or
> public number (SD-COMMS-COMPLIANCE-2).

## Round F4 — Net to the analyst (tax + forex)

SL APIT 2025/26: **personal relief LKR 1.8M/yr** (= 150k/mo), then 6→36%.

| | Tier-1 (150k) | Tier-2 (300k) | Tier-3 (500k) |
|---|---|---|---|
| APIT tax (LKR/yr) | **0** | 222,000 | 1,032,000 |
| Net take-home (LKR/mo) | **150,000** | 281,500 | 414,000 |
| Effective APIT rate | 0% | 6.2% | 17.2% |
| **Revenue needed to pay gross (USD/mo)** | **~$518** | **~$1,020** | **~$1,689** |
| If 15% forex-income tax applies (USD/mo) | ~$610 | ~$1,200 | ~$1,987 |

**Key insight:** a **Tier-1 salary is essentially tax-free** (it sits exactly at personal relief). The
binding figure for the business is **revenue ≈ $518/mo** to pay a Tier-1 gross (after ~2% forex spread +
$16 infra). The 15% foreign-income tax is the conservative case if AdSense/diaspora income is taxed as
forex service income — it raises the Tier-1 requirement to ~$610.

## Round F5 — Can ONE clean ad win a tier alone?

| Path | Tier-1 | Tier-2 | Tier-3 |
|---|---|---|---|
| Programmatic pageviews needed (base RPM $0.87) | ~596k | ~1.17M | ~1.94M |
| Programmatic pageviews needed (diaspora RPM $1.17) | ~443k | ~872k | ~1.44M |
| Direct sole-sponsor (flat USD/mo) to cover | ~$518 | ~$1,020 | ~$1,689 |

**Verdict:** one ad **can** win Tier-1 alone — but only two ways: **programmatically at ~440k–600k
pageviews/month** (Year 2–3 scale for a new SL brand), or via a **direct sole-sponsor paying ~$520/mo**
(reachable sooner, but that's a single patron — the independence risk the Philosophy Forum flagged).
Ad-alone is not a Year-1 programmatic outcome.

## Round F6 — Direct-sold sole-slot pipeline

Sole-slot monthly value = pageviews × (programmatic RPM × **2.5 premium**) × **0.7 sell-through**:

| Pageviews/mo | Slot value (base mix) | Slot value (diaspora mix) |
|---|---|---|
| 40,000 | ~$61 | ~$82 |
| 120,000 | ~$183 | ~$246 |
| 250,000 | ~$381 | ~$513 |
| 500,000 | ~$762 | ~$1,025 |

A brand-safe **sole** placement commands a premium over auction inventory, but at Year-1 traffic it's
~$60–250/mo market-derived. A **negotiated flat** sponsorship can exceed that — at the cost of patron
concentration. **Guardrails (Philosophy Forum):** if combined with members, cap ads ≤20% of revenue;
sector-screen (no politics/betting/finance/contractors); disclose the advertiser; written editorial
firewall; offer the slot to our own cooperatives first.

## Round F7 — Combined breakeven (the realistic path)

One slot (direct **or** programmatic — it's the same single unit) + membership, to hit Tier-1 ($518):

| Traffic | Sole-slot revenue | Members needed (after slot) | Conversion implied |
|---|---|---|---|
| 40k pv (Lean) | ~$61 | ~153 | 0.38% of pv |
| 120k pv (Base) | ~$183 | ~112 | 0.09% of pv |
| 250k pv (Growth) | ~$381 | ~46 | 0.02% of pv |

**This is how you break even.** At **Base traffic (~120k pv), one clean slot (~$183) + ~112 members
clears Tier-1** — a member-conversion of <0.1% of pageviews, very achievable. The ad does real work
(~35% of the requirement) without being load-bearing. Growth traffic makes the slot alone nearly cover
Tier-1.

## Round F8 — Scaling to a stable of branded analysts

Each analyst funds ~own Tier-1 revenue (~$518) + a share of **central overhead** (~$400/mo modelled:
verification-spine ops, legal, SEO/distribution, infra):

| | 1 analyst | 3 analysts | 6 analysts |
|---|---|---|---|
| Total revenue needed (USD/mo) | ~$918 | ~$1,954 | ~$3,508 |
| Overhead per analyst | $400 | ~$133 | ~$67 |
| Members needed (all-membership $3) | ~306 | ~651 | ~1,169 |

**Overhead per analyst falls sharply as the stable grows** (shared services amortise). The binding
constraint on scaling is **verification/legal capacity, not writer count** (Mara + Tech Review) — which
is exactly what the verification spine builds.

## The "HOW" — verification spine (precondition for ML volume)

The supported-output target (2 huge + 15–20 big + 20 small ML-drafted/mo) is reachable **only if the
verification spine exists first**: source store → claim-binding → Alleged Checker CI gate (one orphan
number = no publish) → exception-based human promote + audit log; Sinhala/Tamil never from an LLM. Full
buildable spec + phased sequence: `docs/handoff/tech/analyst-verification-spine-spec-2026-06-19.md`.
**Gate must be blocking before the ML line goes live.**

## Recommendation & open decisions (Priya #9)

1. **Win Tier-1 via COMBINED** — one clean slot (direct-sold, capped/screened/disclosed) + membership —
   not ad-alone. Ad ≈ 30–50% of the slot need; members are the base; ad never load-bearing.
2. **Tier-1 is tax-free** — the real target is **~$518/mo revenue** (or ~$610 if the 15% forex tax bites).
3. **Build the verification spine before ML volume** (Tech Review Phase 0–3 first).
4. **Verify tax** (Vinita + IRD) before any committed/public figure.
5. **Open:** (a) direct-sold vs programmatic for the single slot; (b) membership pricing (flat $3 vs
   diaspora-tiered — would cut members-needed materially); (c) when to trigger the salary (which traffic/
   member milestone); (d) confirm central-overhead figure for the scaling model.

## Next (your remaining financial rounds)

Deeper passes ready on `finance`: diaspora-tiered membership + a real visitor→member funnel (cohort
build to the salary-trigger month); a direct-sponsor target list + sell-through validation; and a
12–24 month combined cashflow once you pick the membership price and ad mode.
