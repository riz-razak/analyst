---
title: "Live Top-1,000 Crawl Method"
owner: "Research desk"
status: "planned-not-run"
created: "2026-05-22"
tags: [seo, crawl, replication, evidence-standard]
---

# Live Top-1,000 Crawl Method

## Status

The current package contains a `1,000`-link accounting model, a reviewed top-100 seed capture, and three live crawl batches captured as evidence. It does not yet claim a completed live top-1,000 crawl.

This method defines what must be captured before the package can make that stronger claim.

## What Counts As A Live Crawl Row

Each row must include:

- query and rank
- direct URL and final redirected URL
- title and snippet
- capture date and locale/language
- exact observed claim text
- number, geography, time window, and category
- cited source or source stack
- final source route
- whether the source supports the exact claim
- whether the wording hardens a UN-linked claim
- whether categories are collapsed
- archive status
- screenshot/HTML evidence path
- weak-link reason
- reviewer confidence
- what cannot be inferred

## Public Labels

Use labels that describe evidence behaviour:

- `Source supports this`
- `Needs qualifier`
- `Repeated source`
- `Mixed categories`
- `Not confirmed by cited source`
- `Broken or missing link`
- `Political recognition, not legal finding`
- `High-authority compression`

Do not label a page as propaganda because it is Tamil, Sinhala, diaspora, state-linked, NGO-linked, or political. If intent, coordination, or paid message amplification is alleged, the money-to-message evidence must be shown separately.

## Acceptance Gates

| Gate | Requirement |
|---|---|
| Live top-100 | 100 unique ranked URLs with raw SERP output, fetched page evidence, archive check, and manual review for the top 30. |
| Live top-500 | Multi-bucket coverage, dedupe families, regenerated heatmap, source-route status, and documented exclusions. |
| Live top-1,000 | 1,000 attempted ranked result slots, normalized result table, run log, archive/screenshot coverage report, dedupe report, and evidence-file manifest. |

The top-2,000 extension should wait until the top-1,000 evidence pass is complete.

## Tool Routes

- Google Custom Search JSON API if existing access is available: https://developers.google.com/custom-search/v1/overview
- Wikimedia APIs for Wikipedia/revision/citation work: https://api.wikimedia.org/wiki/Main_Page
- Common Crawl CDXJ for open-corpus URL discovery: https://commoncrawl.org/cdxj-index
- Wayback CDX for archive checks: https://github.com/internetarchive/wayback/tree/master/wayback-cdx-server

Legacy Bing Search API routes should not be used as the primary plan because Microsoft announced retirement of Bing Search APIs on 2025-08-11: https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement
