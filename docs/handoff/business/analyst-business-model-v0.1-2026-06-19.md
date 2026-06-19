---
title: "Analyst Business Model v0.1"
date: "2026-06-19"
owner: "claude (Priya governance + Senevi ops lens)"
status: "draft-for-founder-review"
tags: ["business", "financials", "breakeven", "runway", "funding-ledger", "analyst"]
companion: "analyst-business-model-v0.1.xlsx"
---

# Analyst Business Model v0.1

Primary deliverable for this session. First-pass financial operating model for The Analyst
(`analyst.rizrazak.com`), a Yan service. Closes the gaps named in the business/financial planning
stocktake: **no breakeven model, no burn/runway/P&L, no funding ledger, no committed-revenue view.**

Workbook companion: `analyst-business-model-v0.1.xlsx` (Assumptions → Monthly P&L → Breakeven →
Scenarios → Funding Ledger). All numbers there are **editable inputs**; this doc explains the logic.

> **Co-founder note:** Sunera Bandara has joined as co-founder of The Analyst (June 2026). The model
> carries a co-founder stipend line (default $0 = volunteer) and the funding ledger and access plan
> treat the founding pair (Riz + Sunera) as the accountable owners of these numbers.

## 1. Ethos lock — the money cannot contradict the mission

`docs/strategy.md` is explicit, and it constrains the model more than a normal startup plan would:

- **Funded by cooperative ventures + community support. No corporate sponsorship. No programmatic ads.**
- Independence is *demonstrated, not claimed* — revenue must never create a patron or an agenda.
- Transparency: the platform demands accountability of institutions, so its own finances should be
  publishable in a transparency report.

**Consequence for the stocktake.** The stocktake listed "no ad rate-card / media kit" and "no
CPM/CPC/sponsorship assumptions" as gaps. On the ethos, those are **not** gaps to fill — programmatic
ads and corporate sponsorship are off-limits. The right artefact is a **Supporter / Membership
Prospectus**, not a media kit. v0.1 reframes it accordingly.

## 2. Revenue architecture (ethos-aligned)

Five permissible streams, in rough order of near-term realism:

1. **Recurring community support** — members/patrons giving monthly (SL + diaspora blended). The
   pledge-portal funnel already exists (`public/caravan-fresh/pledge-portal.html`: tiers, goal
   tracker, live feed, local storage + CSV export) and is the natural seed.
2. **One-off pledges / donations** — campaign-driven, dossier-linked.
3. **Aligned grants** — press-freedom / journalism foundations only, no agenda strings; amortised
   across the year.
4. **Cooperative surplus transfer (Phase 2)** — ride-hailing, education, menstrual-pad coops
   cross-subsidising the journalism once live. $0 until a venture operates.
5. **Diaspora cooperative investment** — capital from Segment B (strategy.md) into the ventures, not
   into the newsroom directly (kept structurally separate to protect independence).

Explicitly **excluded:** corporate sponsorship, programmatic/display ads, paywalling investigations
(would cut off Segment C, the mass base).

## 3. Cost architecture

The stack is serverless + static, so fixed burn is genuinely low. Infra defaults use **current 2026
list prices** (verify against real invoices):

| Item | Default (USD/mo) | Basis |
|---|---|---|
| Cloudflare Workers Paid | $5.00 | $5/mo base — 10M req, 30M CPU-ms |
| Supabase | $0 (Free) → $25 (Pro) | Free tier viable now; Pro when limits hit |
| Resend email | $0 (Free) → $20 (Pro) | Free 3,000/mo (100/day); Pro $20/mo |
| Domain (amortised) | $1.25 | ~$15/yr at-cost; GitHub Pages free |
| Misc tools / buffer | $10.00 | backups, fonts, small SaaS |
| **Total infra** | **~$16/mo** | at current free-tier posture |

The real cost variables are **people** (founder/co-founder stipends, translation/contributor pool —
all default $0 = volunteer) and the **legal contingency reserve** (defamation / ICCPR exposure is a
named threat in strategy.md). When stipends turn on, burn moves from ~$16/mo to whatever the founders
decide to pay themselves and contributors.

## 4. What the model computes

- **Monthly P&L & runway** (Jul 2026 – Jun 2027): every revenue and cost line, net surplus/deficit,
  opening/closing cash, and runway. Recurring supporters compound by a monthly growth input.
- **Breakeven:** total monthly cost ÷ average recurring pledge = supporters needed. At $0 stipends,
  breakeven is just infra — on the order of **a few dozen modest supporters**. Stipends raise the bar
  materially (this is the central strategic tradeoff: how fast to move from volunteer to paid).
- **Scenarios:** Lean / Base / Growth on supporters, pledge size, grants, and coop surplus → Year-1 net.
- **Funding ledger:** starter table + schema brief (committed vs received, with a Source ID on every
  entry for traceability). This is the seed of the "committed revenue dashboard" the stocktake wanted.

## 5. Honesty / provenance

- Infra costs = published list prices; **everything on the revenue side and the opening cash balance
  are illustrative placeholders**, flagged yellow in the workbook. They are *not* actuals.
- USD is the base currency (infra is USD-billed). USD→LKR is a single flagged assumption — verify the
  live rate before any LKR figure is shown.
- Per the Analyst artifact protocol, **no number here may be published** (e.g. in a transparency
  report or fundraising page) until it traces to a real source.

## 6. Open questions for the founders (Riz + Sunera)

1. Real opening cash and current monthly spend?
2. Any committed grants or recurring supporters today (to seed the ledger)?
3. Stipend intent — stay volunteer through Year 1, or fund roles, and in what order?
4. When (if at all in Year 1) does a Phase-2 cooperative begin transferring surplus?
5. Should the Supporter/Membership Prospectus be the next business artefact (v0.2)?

## 7. Recommended next steps

1. Founders fill the YELLOW cells with real figures; we re-run runway and breakeven.
2. Stand up the **Funding Ledger** properly — but in the central Yan finance/People store, **not** a
   parallel Analyst-only DB (consistent with the member-management boundary).
3. Wire the pledge-portal funnel to the ledger so "committed vs received" is live, not manual.
4. Draft the **About → Mission / Standards / Promise** pages (separate scaffolding spec) so the
   funding ask has an ethos-credible home, and Google News eligibility improves (seo-strategy.md P2).
5. Produce **Supporter/Membership Prospectus v0.2** from the agreed numbers.
