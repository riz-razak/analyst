# Analyst / Yan-auth — Task & Tech-Debt Register (2026-06-22)

**Method:** 3 progressive rounds — R1 enumerate · R2 classify (type/severity/owner/effort/deps) · R3 prioritize (sequence, quick wins, gates).
**Owners (Owner-12):** Priya (gov) · Bala (security) · Aether (infra/tech) · Senevi (ops/deploy) · Nuwan (data/analytics) · Ridma (design) · Elubaas (language).
**Convention:** new drift/debt IDs `ADT-NNN` (Analyst Debt). Design drift uses canon `DT-NNN`. Status: open / prepped / scheduled / blocked.

---

## Round 1 — Enumeration (everything open, ungroomed)

Sourced from this session's findings + repo state + [[analyst-build-state]], Yan-Analyst.md hardening notes, YAN_PEOPLE_IDENTITY_MODEL Stage 5, and the Canon v1.0 handover §6.

1. A3.1 — committed Supabase anon key + `FALLBACK_*` in live Worker (prepped doc exists).
2. Migration 016 (`yan_vada_aal1_product_assertions`) pending in DB log — vada AAL2→1.
3. Migration-log drift — DB log stops at 015; 016 unrecorded, 017 applied as data not logged.
4. Old Supabase project `stwzswsywmzfrfgeekjw` ("Riz's project 1") active but SESSION_10.1 F6 said pause.
5. Two Supabase orgs both named "DGTL" — free/test one needs renaming.
6. Stray `.~lock.*.xlsx#` files committed to the-analyst; no `.gitignore` rule.
7. Legacy orphan auth files (`functions/_middleware.js`, `auth/session.js`, `auth/me.js`) — dead, carry the key.
8. Worker hardening backlog: CSRF on state-changing admin routes; same-origin CORS; explicit route allowlist; deny direct `*.workers.dev` privileged routes; no `X-GitHub-Token` browser fallback (server secret only).
9. `security_audit_events` — table exists (775 rows) but confirm admin writes/denied-attempts are actually logged per the People model.
10. Least-privilege `analyst.*` bundles (editor/moderator) for incoming support staff — avoid blanket admin.
11. RLS coverage audit on `ogunznqyfmxkmmwizpfy` — confirm policies restrict, not just `rls_enabled=true`.
12. WarenYan-era 4-tier economics quarantined in `src/ops/*` — ensure never surfaced (two-tier lock).
13. Design canon drift: inventory ops-dashboard + reports + rizrazak.com vs canon@1.0; file `DT-NNN` (Canon handover §6).
14. Apply canon gesture system to review/ratification queues + decision feeds.
15. Reconcile ops concepts (`concept-b2a-*`) → canon; pick redesign from `yan-ops-redesign-plan.html`.
16. Google Search Console submission (free organic traffic) — still undone.
17. `admin-business-model.html` is a *copy* of the handoff dashboard — define single source of truth / build step.
18. Scale track (Yan GA): Supabase tier + Supavisor pooler + passkey/OAuth-over-SMS for millions.
19. Sunera live sign-in smoke test (verification, not debt).
20. Promote Analyst design handover from "first pass" → full dialect doc `yan/design-system/dialects/analyst.md`.

## Round 2 — Classification

Type: SEC security · INF infra · HYG hygiene · DES design · DATA data/analytics · GROW growth · DOC docs · SCALE scale.
Severity: P1 (act now) · P2 (this cycle) · P3 (scheduled) · P4 (backlog). Effort: S/M/L.

| ID | Item | Type | Sev | Owner | Effort | Depends on / gate |
|---|---|---|---|---|---|---|
| ADT-001 | A3.1 anon-key fallback removal (live Worker) | SEC/HYG | P2 | Bala | S | Founder picks Option A/B/C; secret-set + RLS audit |
| ADT-002 | RLS coverage audit on yan-auth-core | SEC | **P1** | Bala | M | none — gates ADT-001 severity |
| ADT-003 | Worker hardening: CSRF + same-origin CORS + route allowlist + workers.dev deny + no browser GitHub token | SEC | **P1** | Bala+Aether | L | precedes any CMS/admin power expansion |
| ADT-004 | security_audit_events actually logging (success+denied) | SEC | P2 | Bala+Nuwan | M | ADT-003 |
| ADT-005 | Migration 016 vada AAL2→1 review + apply (in order) | SEC | P2 | Bala+vada owners | S | vada review; founder go |
| ADT-006 | Migration-log reconciliation (push 016/017 in sequence) | INF | P3 | Senevi | S | ADT-005 |
| ADT-007 | Pause/retire old project `stwz…` | INF | P2 | Senevi | S | confirm nothing references it |
| ADT-008 | Rename free "DGTL" org → sandbox | HYG | P3 | Founder | S | none (trivial) |
| ADT-009 | Remove committed `.~lock.*.xlsx#` + `.gitignore` | HYG | P2 | Senevi | S | founder push |
| ADT-010 | Retire 3 legacy orphan auth files | HYG/SEC | P2 | Aether | S | confirm no build dep |
| ADT-011 | Least-privilege analyst.* bundles (editor/moderator) | SEC | P3 | Bala | M | when staff onboard |
| ADT-012 | WarenYan tier economics quarantine verify (two-tier lock) | DATA/DES | P2 | Nuwan+Ridma | M | 🔒 FOUNDER_LOCK |
| ADT-013 | Design canon inventory → DT-NNN drift tickets | DES | P2 | Ridma+Nuwan | L | Canon v1.0 (task #25) |
| ADT-014 | Gesture system on review/ratification queues | DES | P3 | Ridma | M | ADT-013 |
| ADT-015 | Reconcile ops `concept-b2a-*` → canon; pick redesign | DES | P3 | Ridma+Aether | L | ADT-013 |
| ADT-016 | Google Search Console submission | GROW | P2 | Senevi | S | quick win |
| ADT-017 | Dashboard source-of-truth (dedupe admin copy) | INF/DES | P3 | Aether | M | ADT-013 |
| ADT-018 | Scale: Supabase tier + Supavisor + passkey/OAuth | SCALE | P3 | Aether+Bala | L | Yan GA track |
| ADT-019 | Promote Analyst handover → full dialect doc | DOC/DES | P3 | Ridma | M | ADT-013 |
| ADT-020 | Sunera live sign-in smoke test | (verify) | P2 | Sunera/Riz | S | deploy live (done) |

## Round 3 — Prioritization & sequencing

**P1 — do first (security floor before expanding admin power):**
- **ADT-002** RLS coverage audit (cheap, gates everything that trusts the anon key).
- **ADT-003** Worker hardening (CSRF/CORS/allowlist/workers.dev/GitHub-token) — the People-model Stage-5 precondition; nothing new ships to admin until this lands.

**Quick wins (S effort, high signal — batch in one push):**
- ADT-009 `.~lock` cleanup + `.gitignore` · ADT-008 org rename · ADT-016 Search Console · ADT-020 Sunera smoke · ADT-010 retire orphans.

**P2 — this cycle (after P1 / on founder go):**
- ADT-001 A3.1 (Option B now) · ADT-005 migration 016 vada review · ADT-007 pause stwz · ADT-012 tier-quarantine verify · ADT-004 audit logging · ADT-013 design inventory.

**P3 — scheduled:**
- ADT-006 migration-log reconcile · ADT-011 least-priv bundles (on staff onboard) · ADT-014/015/017/019 design follow-through · ADT-018 scale track (Yan GA).

**Critical-path note (Bala):** ADT-002 + ADT-003 are the real gate. The People model (Stage 5) is explicit: *harden the Worker before expanding CMS/admin power.* Treat new admin surface as blocked-by ADT-003.

**Dependencies into task #25 (Canon alignment):** ADT-012, ADT-013, ADT-014, ADT-015, ADT-017, ADT-019 are all design-canon-driven — they get refined by the Canon v1.0 alignment report and may spawn `DT-NNN` tickets.

---

## Update — 2026-06-22 (A3.1 executed + ADT-002 audit)

- **ADT-001 / A3.1 — largely DONE.** Founder created `analyst_worker` **publishable key**; Worker secret `SUPABASE_ANON_KEY` set to it (all Worker secrets confirmed present). Live Worker verified healthy on the new key (`/auth/me` 200 JSON, `/auth/signed-out` 200). `FALLBACK_SUPABASE_*` removed from `functions/collaborative-session.js`; `node --check` passes. **Remaining:** founder commit+push (triggers deploy-worker smoke test); later disable legacy anon key (needs service→`sb_secret` migration first); retire 3 orphan files (ADT-010); post-deploy admin sign-in test.
- **ADT-002 — DONE (PASS).** All 28 sensitive tables RLS-on + deny-all to anon (people, identity_emails, product_memberships, access_bundles, auth_*, security_audit_events…). Only `comments` (self-scoped, auth-gated writes; public reads approved only) + `ops_*` (read-only) reachable by the publishable key. No anon write exposure. Confirms anon/publishable key is low-severity.
- **ADT-021 (new, P2, Bala):** `ops_audit_log` has `SELECT using true` (public-readable). Confirm intent; if it carries internal detail, downgrade to service-only or authenticated.

*Living doc. Update IDs as items close. Pairs with [[analyst-build-state]] and the A3.1 prep doc.*
