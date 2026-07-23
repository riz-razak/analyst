# The Analyst Agentic AI Search Research

Date: 2026-05-25
Scope: 4-round Yan Agent Council (Suite) research for an agentic AI search function
Status: planning source for the search/CMS build

Implementation update, 2026-05-26:

- Added a Worker-backed retrieval MVP at `GET /api/search`.
- Added protected admin/indexing endpoints: `POST /api/search/capture`, `POST /api/search/reindex`, and `GET /api/search/status`.
- Added KV-backed search artifacts using `search:index:v1` and `search:doc:v1:<slug>`.
- Added publish-time capture hooks after successful `handlePublish()` and allowed root-level dossier HTML writes through `/api/github/file`.
- Added a public React `/search` route with result cards, topic filters, policy badges, and local Vite fallback when the Worker API is unavailable.
- Added a homepage `Search` entry in the nameplate.
- Kept answer mode retrieval-only and citation-gated; it does not generate public prose yet.

## Council Setup

The review used Yan Agent Council (Suite) lenses only:

- @bala: systems architecture and operational fit
- @nuwan: implementation and database/API contracts
- @ridma: UX/search product design and evidence-safe public interface
- @Senevi: governance, security, evidence provenance, and operational risk

No special or parallel agent identities were created.

## Executive Recommendation

Build search in two layers:

1. Ship a Worker-backed public search endpoint with deterministic lexical/body retrieval and strict visibility gating.
2. Add managed Cloudflare AI Search as the preferred semantic/RAG layer once the search artifact contract is stable.

Do not ship a public static full-body `search-index.json` as the first implementation. The Worker must enforce the same hidden/published visibility state that already protects root-level dossiers.

## Best-Practice Findings

Cloudflare AI Search is the strongest managed fit for the current Analyst stack because new AI Search instances include built-in storage and a built-in vector index backed by R2 and Vectorize. Uploaded files can be indexed directly through the Items API, and built-in-storage uploads are indexed immediately while website/R2 sources sync on a schedule.

Cloudflare AI Search also exposes Worker bindings for `search()` and `chatCompletions()`, supports retrieval options, query rewriting, streaming, and namespace-level search across instances. This lets The Analyst keep the React UI as a client and keep keys, model routing, rate limits, and source filters inside the Worker.

If managed AI Search is not enough for evidence-grade control, the fallback should be a custom Worker stack:

- D1 for canonical documents, chunks, source refs, claim refs, search jobs, audit logs, and correction versions.
- Vectorize for embedding search behind stable chunk IDs.
- Queues for asynchronous indexing, retries, and dead-letter handling.
- KV only for cache and short-lived status, not search source of truth.

Supabase pgvector remains a good alternative if Analyst articles become database-native later. Supabase's automatic embeddings pattern uses triggers, queues, Edge Functions, `pg_net`, and `pg_cron` to keep embeddings in sync when rows change, but today the Analyst source of truth is Git-backed static dossiers and `public/data/dossiers.json`, not article rows in Supabase.

OpenAI vector stores/file search are a viable provider-hosted option for fast RAG and metadata-filtered retrieval, but they increase provider lock-in and need explicit deletion/retention governance.

## Current Repo Fit

Current public content path:

- React app reads `public/data/dossiers.json` through `src/hooks/useDossiers.js`.
- Homepage ranking/filtering happens in `src/pages/HomePage.jsx`.
- Existing `src/hooks/useSearch.js` is Fuse-only over registry metadata.
- Static articles live at `public/<slug>/index.html`.
- `src/pages/DossierPage.jsx` embeds dossier HTML by iframe.
- Worker CMS writes GitHub files through `functions/collaborative-session.js`.

Current gap:

- `handlePublish()` commits `public/{slug}/index.html` and stores a short KV published record, but does not update a search index.
- `/api/github/file` commits HTML/registry/image files but has no capture hook.
- Visibility is split between Worker KV and registry status. Search must resolve this before returning body snippets.

## Search Artifact Contract

Each published article should produce a structured search artifact:

- `slug`
- `content_url`
- `title`, `title_si`, `title_ta` where approved
- `description`, approved translated descriptions where available
- `date`, `updated_at`, `content_version`, `commit_sha`, `html_sha`
- `status`, `public_status`, `editor_approved_at`
- `article_family`
- `topic`, `industry_vertical`, `tags`
- `language`, `available_languages`
- `evidence_status`
- `source_ids`, `claim_ids`, `model_fields`
- `chunk_id`, `heading`, `anchor`, `chunk_kind`, `chunk_text`, `chunk_hash`
- `source_refs_json`
- `indexed_at`

Chunk by section, evidence/source card, timeline block, FAQ block, and model/table note. Do not chunk only by arbitrary character windows.

## API Contract

Recommended Worker endpoints:

- `GET /api/search?q=&lang=&topic=&limit=&mode=retrieve`
  Public retrieval. Enforces current visibility map before returning hits.
- `GET /api/search?q=&lang=&topic=&limit=&mode=answer`
  Optional answer mode after retrieval quality is proven. Must return cited answer or refusal.
- `POST /api/search/capture`
  Admin/internal capture for one slug after publish.
- `POST /api/search/reindex`
  Admin-only rebuild from registry and public dossier HTML.
- `GET /api/search/status?slug=`
  Admin diagnostics for index state, chunk count, hashes, and last error.

For CMS automatic capture:

- call capture after successful `handlePublish()`;
- call capture after successful `/api/github/file` writes to allowed root-level dossier HTML paths;
- use `ctx.waitUntil()` so CMS publishing does not block on indexing;
- store failures in an indexing ledger rather than hiding them.

## UX Contract

Search should be an evidence interface, not a chatbot.

Default mode:

- search result cards;
- topic/language/evidence filters;
- matched snippets;
- article type and evidence status;
- source/claim trail links where available.

Answer mode:

- opt-in;
- only uses retrieved approved chunks;
- cites articles or source-register entries;
- shows where evidence is thin;
- refuses when the approved archive cannot support the answer.

Recommended entry points:

- nameplate search icon opening `/search`;
- ranked-wall toolbar search scoped to all/current topic/evidence/latest;
- dossier-level "search inside this dossier";
- dossier-level "ask from this dossier's sources" only after evidence indexing is ready.

For Sinhala/Tamil:

- never generate public Sinhala/Tamil from model memory;
- use approved translated text and indexed approved snippets only;
- if approved non-English material is absent, return English or say the non-English answer is not available yet.

## Governance Requirements

Minimum launch bar:

- no public answer without citations to approved material;
- no generated public number unless it resolves to approved source IDs, claim IDs, or model fields;
- no retrieval from raw research, unpublished leads, private notes, or auth/security materials;
- no search tool with write/delete/publish authority;
- no hidden dossier returned by search;
- no answer when citation confidence is low.

Log for audit:

- query hash/session hash;
- retrieval filters;
- returned chunk IDs/source IDs/claim IDs;
- answer ID and citations shown;
- refusal reason;
- model/provider/version;
- policy decision;
- indexing version and content hash.

On correction:

- tombstone old chunk versions;
- reindex new versions;
- invalidate cached answers;
- preserve internal correction log;
- expose public correction trail when relevant.

## Implementation Sequence

1. Add a local extractor/backfill script that reads `public/data/dossiers.json` and `public/<slug>/index.html` and emits deterministic search artifacts.
2. Add a Worker search module with strict visibility filtering and a lexical retrieval endpoint.
3. Add D1 schema for `search_documents`, `search_chunks`, `search_index_jobs`, and `search_query_audit`.
4. Wire `ctx.waitUntil(capturePublishedDossier(...))` into `handlePublish()` and allowed `/api/github/file` HTML writes.
5. Backfill current published dossiers and test that hidden dossiers do not appear.
6. Add `/search` UI with result cards and filters.
7. Add Cloudflare AI Search or Vectorize semantic retrieval behind the same chunk IDs.
8. Add answer mode only after retrieval, citations, refusals, and audit logs are reliable.

## Sources Checked

- Cloudflare AI Search built-in storage: https://developers.cloudflare.com/ai-search/configuration/data-source/built-in-storage/
- Cloudflare AI Search Workers binding: https://developers.cloudflare.com/ai-search/api/search/workers-binding/
- Cloudflare Vectorize metadata filtering: https://developers.cloudflare.com/vectorize/reference/metadata-filtering/
- Cloudflare Vectorize intro and metadata indexes: https://developers.cloudflare.com/vectorize/get-started/intro/
- Cloudflare Queues overview and retry/dead-letter behavior: https://developers.cloudflare.com/queues/
- Cloudflare D1 SQL/FTS support: https://developers.cloudflare.com/d1/sql-api/sql-statements/
- Supabase automatic embeddings: https://supabase.com/docs/guides/ai/automatic-embeddings
- OpenAI vector stores API: https://platform.openai.com/docs/api-reference/vector-stores/create
- Google Search AI features guidance: https://developers.google.com/search/docs/appearance/ai-features
- AP AI guidance for journalism: https://apnews.com/article/artificial-intelligence-guidelines-ap-news-532b417395df6a9e2aed57fd63ad416a
- W3C language guidance: https://www.w3.org/International/getting-started/language
- W3C internationalization specs guidance: https://www.w3.org/TR/international-specs/
