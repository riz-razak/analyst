---
title: "Yan News Founder Decision Brief"
date: "2026-07-23"
package: "YAN-NEWS-RENAME-RESET-STOCKTAKE-01"
status: "R1 ballot"
---

# Yan News Founder Decision Brief

## Locked

`Yan News` is locked as the future public/product name and direction.

The immediate priority is the Yan News rename stocktake. Active A/L fixes remain important, but they are
not the active priority for this package.

## Still Deliberately Not Locked

The name lock does not settle:

- domain
- repo name
- Worker name or route
- auth product/client ID
- rights namespace
- local session cookie
- CMS/data migration
- dossier slugs, IDs, feed GUIDs, or canonical URLs
- publisher/legal identity
- public transition wording
- deployment timing

## Decision 1: Successor Brand Or Fresh Product Surface

Options:

1. Successor brand: Yan News succeeds The Analyst and carries the corpus with visible lineage.
2. Endorsed transition: Yan News launches as the next edition of The Analyst with a compatibility alias.
3. Fresh surface: Yan News starts as a new product surface and imports only approved corpus items.

Recommendation for R1: treat Yan News as successor direction, but preserve The Analyst as lineage and
compatibility until corpus/domain/legal gates decide the exact public language.

## Decision 2: Display-Only Candidate Or Product-Identity Migration

Options:

1. Display-only candidate first.
2. Product-identity migration now.
3. Parallel display and identity migration.

Recommendation for R1: display-only candidate first. Keep `analyst.rizrazak.com`, `riz-razak/analyst`,
`AUTH_UNIFIED_CLIENT_ID=analyst`, `analyst.*` rights, and `__Host-analyst_session` unchanged.

Rationale: auth, Worker, CMS, callbacks, cookies, routes, and feed/canonical contracts are coupled. A
display-only candidate can be reviewed and rolled back cleanly; a product-identity migration needs
central-auth, domain, Worker, CMS, and rollback packages.

## Decision 3: Domain Posture And Compatibility Window

Options:

1. Keep `analyst.rizrazak.com` for the display-only candidate and defer Yan News domain decisions.
2. Reserve or prepare Yan News domain names privately, but do not route traffic yet.
3. Move canonical domain during first public launch.

Recommendation for R1: keep current domain and document target-domain choices separately.

Required later decisions:

- primary Yan News domain
- old-domain redirect policy
- canonical URL policy
- RSS/feed GUID strategy
- social handle and email posture
- compatibility window owner and expiry review

## Decision 4: Publisher And Legal Identity

Options:

1. Keep Riz Razak / The Analyst legal wording for display candidate.
2. Add a transition note without changing legal identity.
3. Define Yan News publisher/legal identity before public launch.

Recommendation for R1: do not change legal/publisher wording in display-only planning. Create a later
About/Standards/Corrections/Team scaffold with legal review.

## Decision 5: Old Corpus Migration And Disclosure

Options:

1. Carry all Analyst dossiers into Yan News with visible lineage.
2. Carry selected dossiers after publication review.
3. Archive Analyst as historical, with Yan News starting fresh.

Recommendation for R1: retain all current slugs and IDs. Build a corpus lineage register before any
public wording changes.

Disclosure language to decide later:

- `Yan News, formerly The Analyst`
- `Yan News, from The Analyst`
- `The Analyst, becoming Yan News`
- `Yan News` only, with lineage in About/Standards

## Decision 6: Auth/Product ID Changes

Recommendation: explicitly defer.

Current locked runtime values:

- issuer: `https://auth.yan.lk`
- client: `analyst`
- required right: `analyst.admin.access`
- namespace: `analyst.*`
- cookie: `__Host-analyst_session`

Later auth migration must include dual-name compatibility, callback allowlist changes, smoke tests, and
rollback.

## Founder Ballot For R1

Recommended approvals:

1. R1 may create a current-main Yan News stocktake package.
2. R1 treats 2dee as archive/evidence, not source authority.
3. R1 may prepare a display-only candidate plan, but not implement it yet.
4. All auth/product/domain/service-ID migration is deferred by default.
5. All CMS/data/corpus/feed migration is deferred by default.
6. Yan News is the locked future name and direction.

Hard stops:

- no global replacement
- no 2dee merge
- no deploy
- no auth/domain/CMS/data edit
- no claim/source/content changes
- no Sinhala/Tamil copy from LLM memory
- no use of golab as Yan News authority
