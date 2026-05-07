# Evidence Protocol — analyst.rizrazak.com

> **Purpose:** Every claim in a dossier must be traceable, complete, and legally defensible.
> Every shortcut in evidence handling is a liability for the publisher.

---

## 1. Evidence Intake — Per File Checklist

For every file added to an evidence folder, before integration into a dossier:

| Check | Requirement |
|-------|-------------|
| **File integrity** | Record SHA256 hash. Rename only to canonical name, never alter content. |
| **True file type** | Run `file <name>` to confirm actual format, regardless of extension. |
| **Completeness** | Is the evidence complete? Is text cut off? Is there a "See more"? Is it cropped? |
| **Date/time** | What date/time does the content show? What date was it captured? |
| **Authorship** | Who created/posted the content? Is that identity confirmed or assumed? |
| **Platform** | Which platform? Does the UI signature match? |
| **Language** | If non-English: full verbatim original + full verified translation. Never paraphrase. |
| **Audio/video** | If audio/video: document duration, actual content from listen/view — not assumed. |
| **Visibility** | Was this content public? Private? Shared with consent? |
| **Duplicates** | Is this identical to another file? Document and discard if so. |

---

## 2. Evidence Status Labels

| Status | Meaning |
|--------|---------|
| `VERIFIED` | Complete, authorship confirmed, platform consistent, independently corroborated where possible. |
| `PARTIAL` | Content is cut off, cropped, or incomplete. Only quote what is visible. Explicitly note what is missing. |
| `UNVERIFIED` | Cannot confirm authorship or authenticity from the file alone. |
| `ALLEGED` | Content attributes a claim to a third party — treat as allegation, not established fact. |

---

## 3. Quoting Rules

- Always quote **verbatim**. Never paraphrase and present it as a quote.
- Never use `...` inside a quote to fill a gap you have not read. If text is cut off, quote only to the visible end and append `[text continues — screenshot cut off]`.
- Translated quotes: *Original (Sinhala):* "..." / *Translation:* "..." — never merge or paraphrase.
- Never add implication to a quote. If the source says "hid behind his father," that is the claim as stated. Do not characterise the father further unless a source does.

---

## 4. Claim–Source Matrix (current dossier)

| Claim | Source | Verbatim Quote | Status |
|-------|--------|----------------|--------|
| Vangeesa "hid behind his father" when complaint filed | Vincika De Saram, Facebook, March 8 2026 [S9] | "he hid behind his father like a coward" | ALLEGED — single source, father's identity unconfirmed |
| Anuradha "pleased" article went viral | Anuradha Perera, Facebook post, March 9 2026 [S13] | "I am actually pleased that this situation caused the article to go viral" | VERIFIED — first-person statement |
| Geethika calls Vangeesa "serial offender" | Geethika Dharmasinghe, Facebook, July 16 2021 [S15] | "a serial offender like Vangeesa Sumanasekara" | PARTIAL — post truncated at "See more" |
| Madhubhashini says Anuradha "misused editorial power" | Madhubhashini R. Rathnayaka, comment on S13 | "you have clearly misused your editorial power in a national newspaper by..." | PARTIAL — comment cut off, remainder unknown |
| Vangeesa operates an "Epstein platform" | Ranjan Ranja, comment [S1] | "Epstein platform?" | ALLEGED — rhetorical question, single commentator |
| "Minister Paul-Raj" called out as hypocrite | Sasanka Perera, comment on Melani's post [S14] | "I would be curious to know the take on this of the Prime Minister and Minister Paul-Raj..." | VERIFIED — verbatim from screenshot |
| Vincika audio recording documents conversation | vincika-screen-recording.mp3 | File confirmed: MPEG Layer III, 128kbps, 44.1kHz, ~19 sec | UNVERIFIED — audio content not reviewed |

---

## 5. What Belongs in the Dossier vs. What Does Not

**Include:**
- Direct quotes, verbatim, attributed to a named person, from a visible source
- Facts observable from evidence itself (timestamps, reaction counts, UI context)
- Structural facts that are established public record

**Do NOT include without flagging:**
- Inferences from evidence (e.g., inferring the father is politically powerful from a single quote)
- Claims from private knowledge not traceable to a source in the evidence
- Paraphrased quotes presented as verbatim
- Partial quotes where the cut-off portion could change the meaning

---

## 6. Incomplete Evidence Handling

1. Mark evidence `PARTIAL` in metadata
2. Quote only what is fully visible/audible
3. In the dossier, note: *(Note: screenshot is cut off — full text not captured)*
4. Do NOT fill the gap with inference
5. Flag in evidence gallery with `⚠️ PARTIAL` tag

---

## 7. Audio/Video Evidence

Before referencing any audio or video in the dossier:
1. Confirm actual file type (`file` command)
2. Note duration
3. Describe actual content from listening/viewing — not assumed from filename
4. If audio cannot be reviewed: flag as `CONTENT UNVERIFIED — audio not reviewed`

---

## 8. Legal Risk Flags

Review before publishing:
- Any claim about a living person's character or identity not directly attributed to a primary source
- Single-source claims — flag as `SINGLE SOURCE`
- Private communications posted publicly — note consent status
- Any claim where the named person has not had opportunity to respond

---

## 9. Evidence Folder README Structure

Each evidence README.md must include per file:
- Original filename received
- SHA256 hash (for integrity verification)
- Date received
- Date of content (if visible in evidence)
- Completeness: COMPLETE / PARTIAL / UNKNOWN
- Content: what is actually visible/audible (not inferred)
