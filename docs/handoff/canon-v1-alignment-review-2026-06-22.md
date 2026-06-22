# Yan Canon v1.0 — Analyst Alignment Review (5 rounds)

**Trigger:** Company-wide update — `yan/design-system/` **canon@1.0.0** ratified (G4, 2026-06-21): mother design language + token source-of-record + gesture system + Session Kernel + AutoDream sovereignty. Analyst is a **conforming dialect**.
**Method:** 5 council rounds. **Status: REPORT ONLY — nothing executed.** Gated per founder "prepare report before moving on."
**Council:** Priya (chair/gov) · Ridma (design lead) · Nuwan (#42 data/dashboards) · Aether (tech/impl) · Bala (security/doctrine floor) · Mara (adversarial) · Senevi (ops).
**Grounded in:** `yan/design-system/CANON.md`, `canon-tokens.json`, `dialects/analyst.md`, the uploaded `YAN_ANALYST_DESIGN_HANDOVER.md`, `the-analyst/docs/design-system.md`, `public/_shared/yan-core.css`, and this session's built artifacts.

---

## Round 1 — Decode the update (Ridma + Priya)

Canon@1.0 ratifies five things and an invariant floor:

1. **Mother token source of record** = `canon-tokens.json`. Rule: *single source; no raw hex outside the token file.* Conforming dialects inherit and override **minimally, each override justified**, pinning a canon version.
2. **Canon law** (absorbs DESIGN_RULES): Bawa Earth, flat, warm. **No-Go everywhere:** dark mode · glass/blur · AI-glow (gradient/neon/glow/particles) · cold grays · gratuitous animation. *Content is the interface; tables for tabular data.*
3. **Motion (G3):** UI transitions ≤0.15s; direct-manipulation gestures 0.20–0.32s eased; honour reduced-motion.
4. **Gesture system (canon §4):** row-action (swipe→primary / swipe→archive + kebab parity + archive-not-delete + 6s undo) and nav/dismiss; **left=archive, right=primary**; desktop kebab/hover parity.
5. **Invariant floor (no product may cross):** 🔒 FOUNDER_LOCK · WCAG AA / ≥44px / reduced-motion · doctrine (no payment custody, **N3 qualitative-only**, no raw email) · safety No-Go.

Plus, from the handover §7a: **Session Kernel** (SD-KERNEL pick-up + implied/self-adapting rounds + mandatory close-loop) and **AutoDream sovereignty** (SD-AUTODREAM — Analyst's data-heavy reports/feeds are prime capture sources, emit-at-source to Yan ingest once adapters land).

**Posture:** Analyst = **conforming dialect** (inherit visual layer, minimal justified overrides). Not an exception dialect — it does **not** get its own look.

## Round 2 — Impact map, surface by surface (Nuwan + Aether)

Two repos carry "Analyst" surfaces; the canon dialect currently names only the yan-repo ones.

| Surface | Repo | Canon impact |
|---|---|---|
| Ops dashboard (`04-ops-dashboard/concept-b2a-*`, redesign plan) | yan | Reconcile to canon tokens; pick redesign; tables stay tables; gesture system on ratification/decision queues |
| Meridian reports (`04-reports/*`) | yan | Dense tables + sticky headers + canon status tints; no infinite scroll; N3 if user-facing |
| priya-pwa | yan | Canon tokens where it presents data; gesture nav/dismiss |
| `src/ops/*` live data layer | yan | **WarenYan 4-tier economics quarantined — must never surface (two-tier 🔒)** |
| **Public reader (rizrazak.com / the-analyst)** | the-analyst | **Not yet mapped in the dialect** — scope gap (R3-D) |
| **Admin SPA + dashboards** (`admin-preview.html`, `admin-business-model.html`) | the-analyst | Token compliance; table-first; N3 on user-facing analytics |
| Shared tokens `public/_shared/yan-core.css` | the-analyst | **Must derive from canon-tokens.json** — currently a fork (R3-A) |

**Already aligned (good):** headline brand colors (green #2D6A4F, gold #C4A35A, cream #FAFAF8, ink #1A1A2E, border #E5E1DA) match canon across yan-core.css and the Analyst doc; Inter is canon; "tables for tabular data" is already the Analyst instinct.

## Round 3 — Alignment & conflict ledger (Mara adversarial + Bala)

Concrete divergences, with evidence. Proposed drift tickets `DT-NNN` (canon `drift-tickets/` convention; DT-001 = golab).

**R3-A · Token fork in `yan-core.css` (this session's build) — DT-002.** `public/_shared/yan-core.css` re-declares hex that drifts from `canon-tokens.json`:
| Token | yan-core.css | canon-tokens.json | verdict |
|---|---|---|---|
| status red | `#C0492F` | `#D4644A` (red) / `#8A2D2D` (danger) | drift |
| status orange | `#D97706` | `#E88D2A` (orange) / `#7A5A16` (warn) | drift |
| status green | `#34A853` | `#2D6A4F` (ok) | drift (Google-green, borderline "cold") |
| accent-strong | `#1B4D2E` | `#214F3B` (greenDark) | drift |
| text-secondary | `#4A4A5A` | `#5C5C6B` (muted) / `#43434F` (slate) | drift |
| radius | 6/10/12 | 8/12/16 | drift |
| shadow | `…,.05` (2-layer diff) | `…,.06 + …,.04` | drift |
| type scale | none (families only) | hero28/h1 20/h2 15/body13 | not enforced |
Canon rule violated: *no raw hex outside the token file.* **Fix:** regenerate yan-core.css as a thin layer mirroring canon values exactly; any genuine override documented + justified. (Self-inflicted this session — own it.)

**R3-B · Three competing sources of truth — DT-003.** (1) `canon-tokens.json` (new mother, authoritative); (2) `the-analyst/docs/design-system.md` ("WarenYan + rizrazak.com Design Rules", **pre-canon**, standalone, still carries the old *WarenYan* name; its red/orange actually match canon but it predates and competes); (3) `yan-core.css` (executable, forked). **Fix:** canon is authority; demote the Analyst doc to a canon pointer (or update it to cite canon + record only justified Analyst overrides); regenerate yan-core.css from canon.

**R3-C · No-Go self-audit (this session) — PASS.** Scanned `admin-business-model.html`: **no** gradients, blur, dark-mode, cold-gray, or glow. Clean. Caveat: Plotly's default palette should be pinned to canon status tints (minor) — DT-004.

**R3-D · Scope gap — DT-005.** `dialects/analyst.md` points only at yan-repo surfaces; the **the-analyst repo** (public reader + admin + dashboards) isn't declared under the dialect. Two repos, one dialect, undocumented boundary. **Fix:** the dialect doc must enumerate the-analyst surfaces and their canon pins.

**R3-E · Gesture system not yet applied.** Review/ratification queues + decision feeds need the row-action family (canon §4). Net-new work, not a conflict — DT-006.

**R3-F · Type/heading conflict.** Analyst doc says "headings 22px max"; canon says h1 20 / hero 28. Reconcile to canon scale — folded into DT-002.

**R3-G · Doctrine floor on dashboards (Bala).** Canon invariant floor includes **N3 qualitative-only** where analytics are user-facing. The business-model/Meridian dashboards present numbers — confirm any *user-facing* surface respects N3 (internal admin is fine). Flag, not yet a violation.

**No conflict found:** Council Operating Model (Owner-12) vs **Session Kernel** — they're complementary. Kernel = session pick-up ritual + implied/self-adapting rounds + close-loop (Distil→Memory Capsule→Galaxy); Owner-12 = who convenes. Adopt Kernel's close-loop into our session discipline; no governance clash. (Priya R4.)

## Round 4 — Governance & cross-project reconciliation (Priya + Senevi)

- **Authority order:** canon@1.0 is design home-of-record; it *absorbs* DESIGN_RULES. Our `Yan-Analyst.md` "Council Operating Model" governs *who* decides; canon `governance.md` governs *design* versioning/drift/escalation. No overlap conflict — link them: Yan-Analyst.md should cite canon as the design authority.
- **Isolation rules:** yan-repo dialect/handover edits vs the-analyst repo edits are cross-repo; per Yan-Vada-style isolation, batch cross-repo doc updates and apply on a designated cross-update with founder authorization. This review **proposes**, doesn't cross-write.
- **AutoDream (SD-AUTODREAM):** Analyst is the most data-heavy surface → prime capture source. No action until ingest adapters land; note as a forward dependency (don't build capture now).
- **Session Kernel adoption:** add the close-loop (Distil → Memory Capsule → Galaxy) to Analyst session discipline; cheap, aligns us to company standard.
- **Memory:** record canon@1.0 as the design authority for Analyst so future sessions pin it.

## Round 5 — Synthesis & recommendation (Priya, decision-ready)

**Verdict: ALIGNED in direction, with concrete drift to remediate — no blockers, nothing to rip out.** Our build this session is No-Go-clean; the brand core matches canon. The real work is **token reconciliation + declaring the-analyst surfaces under the dialect**, most of it small.

**Proposed drift tickets (for `yan/design-system/drift-tickets/`):**
- **DT-002** Regenerate `yan-core.css` from `canon-tokens.json` (status colors, radius, shadow, type scale; document overrides). *P2, Ridma+Aether, M.*
- **DT-003** Resolve three-sources-of-truth: canon authoritative; demote/repoint `the-analyst/docs/design-system.md`; drop "WarenYan" naming. *P2, Ridma, S.*
- **DT-004** Pin dashboard (Plotly) palette to canon status tints. *P3, Nuwan, S.*
- **DT-005** Extend `dialects/analyst.md` to enumerate the-analyst repo surfaces + pins. *P2, Ridma, M.*
- **DT-006** Apply gesture system to review/ratification queues + decision feeds. *P3, Ridma, M.*
- **DT-007** Inventory ops-dashboard + reports vs canon; reconcile `concept-b2a-*`; pick redesign. *P3, Ridma+Aether, L.*

**Sequence:** DT-003 (authority) → DT-002 (tokens) → DT-005 (scope) → DT-004/006/007 (surface work). Folds into the tech-debt register (ADT-012/013/014/015/017/019).

**Needs founder ratification:** (a) accept canon@1.0 as Analyst design authority (supersede the pre-canon Analyst doc); (b) approve cross-repo write to `dialects/analyst.md` + handover on a designated cross-update; (c) confirm N3 posture on any user-facing dashboard.

**Auto-adopt (no ratification):** Session Kernel close-loop; No-Go compliance (already met); table-first (already practiced).

**Conflicts to escalate:** none hard. Soft: the status-color drift in yan-core.css is self-inflicted this session and should be fixed before it propagates to more surfaces.

🔒 **Gate:** This is the report. **No execution / no cross-repo writes / no token regeneration until founder ratifies §R5.** "Before moving on" honoured.
