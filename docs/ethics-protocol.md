# Ethics & Source Protection Protocol
**Platform:** analyst.rizrazak.com
**Repo:** `riz-razak/analyst` → GitHub Pages
**Created:** 2026-03-09 (session 4)
**Standards referenced:** ICIJ, Bellingcat, ProPublica, Dart Center for Journalism & Trauma

---

## 1. Core Principles

This platform operates as citizen journalism in the public interest. Every editorial decision must balance three obligations:

1. **Truth** — accuracy above speed, verification above sensation
2. **Harm reduction** — minimize collateral damage to non-public individuals
3. **Accountability** — hold power to account, not individuals to ridicule

These principles are non-negotiable and override all other considerations including engagement, shareability, or editorial preference.

---

## 2. Source Protection

### 2.1 Anonymity by Default

- **Private individuals** are anonymous by default. Names, faces, and identifying details are censored unless the individual is a public figure acting in a public capacity.
- **Public figures** may be named when acting in their public role. Their private lives remain protected unless directly relevant to the public-interest claim.
- **Whistleblowers** are never identified without explicit, documented, written consent. Even with consent, consider whether identification serves their interest or merely the story's.

### 2.2 Consent Protocol

| Level | Meaning | Required For |
|-------|---------|-------------|
| **Explicit written** | Email/message confirming consent | Naming a source, using their photo, quoting them by name |
| **Informed verbal** | Conversation where risks are explained | Background information, off-record guidance |
| **Implied public** | Content posted publicly by the individual | Quoting public social media posts, public statements |

**Rule:** If in doubt, default to maximum protection. It is always better to under-identify than to over-expose.

### 2.3 Source Communication Security

- Never store source communications on cloud-synced or networked devices without encryption
- Use end-to-end encrypted channels (Signal preferred) for sensitive communications
- Never screenshot source conversations without their knowledge
- Delete metadata from all files before any sharing or publishing

---

## 3. Victim-Centered Reporting

### 3.1 Core Rules

1. **Victims control their narrative** — they opt IN to being named, not opt out
2. **Trauma-informed language** — avoid sensationalizing violence or suffering
3. **Right to withdraw** — any victim can request removal of their information at any time, and we comply immediately
4. **No gratuitous detail** — include only what serves truth and accountability, not shock value
5. **Agency preservation** — frame victims as people who experienced harm, not as defined by that harm

### 3.2 Language Guidelines

| Avoid | Use Instead |
|-------|-------------|
| "Victim claimed..." | "According to [Name]'s account..." |
| "Alleged victim" | "The person who reported..." |
| "Sexual assault details" (graphic) | "Documented sexual harassment" (factual) |
| "She was raped" (passive) | "He assaulted her" (agency on perpetrator) |
| "Broke her silence" | "Spoke publicly" |
| Euphemisms ("inappropriate behavior") | Direct language ("sexual harassment") |

### 3.3 Retraumatization Prevention

- Do not contact victims repeatedly for updates
- Do not publish details that could lead to victim identification if they wish to remain anonymous
- When quoting victim testimony, use only what they have already made public
- Provide content warnings before graphic testimony sections

---

## 4. Censoring Protocol

### 4.1 What Must Always Be Censored

| Category | Action | Method |
|----------|--------|--------|
| Private individuals' names | Redact or use initials | Browser canvas overlay |
| Private individuals' faces | Blur or solid rectangle | Browser canvas overlay |
| Phone numbers | Redact entirely | Solid color rectangle |
| Email addresses | Redact entirely | Solid color rectangle |
| Home addresses | Redact entirely | Solid color rectangle |
| Minors (under 18) | Never identify, never include images | Complete removal |
| Bystanders in screenshots | Blur faces | Browser canvas overlay |

### 4.2 What May Be Published Uncensored

- Public figures' names when acting in public capacity
- Public figures' publicly posted content
- Published articles and news reports (with attribution)
- Court records and official documents (public)
- Publicly accessible social media posts by named individuals who chose to post publicly

### 4.3 Censoring Method

```javascript
// Standard browser canvas censoring method
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
// Load image, then:
ctx.fillStyle = '#1a1a1a'; // or appropriate color
ctx.fillRect(x, y, width, height); // cover sensitive area
const base64 = canvas.toDataURL('image/jpeg', 0.85);
```

**Rule:** Censoring MUST happen BEFORE base64 encoding. Never publish an uncensored version, even temporarily.

---

## 5. Evidence Integrity

### 5.1 No Fabrication

- Never fabricate, alter, or embellish evidence
- Quotes must be exact or clearly marked as paraphrased
- Screenshots must be unaltered except for censoring (per Section 4)
- Dates must be verifiable against the original source

### 5.2 Transparency Labels

Every evidence item must carry a verdict badge:

| Verdict | Meaning | Standard |
|---------|---------|----------|
| **VERIFIED** | Multiple independent sources confirm | 2+ independent sources |
| **DOCUMENTED** | Source exists and is accessible | Source URL verified working |
| **ALLEGED** | Claim made but not independently confirmed | Single source, no corroboration |
| **UNVERIFIED** | Cannot currently verify | Source deleted, inaccessible, or disputed |

### 5.3 Corrections Policy

- Errors are corrected **immediately** upon discovery
- Corrections are **visible** — not silently edited
- A corrections log is maintained (add to footer or dedicated section)
- If an entire evidence item is invalidated, it is **struck through** with explanation, not silently removed

---

## 6. Comment Moderation Ethics

### 6.1 Pre-Publication Review

All comments require admin approval before going live. This is a non-negotiable safety requirement.

### 6.2 Comments That Must Be Rejected

- Comments that could identify protected victims or sources
- Comments that constitute harassment, threats, or incitement
- Comments containing personal information of private individuals
- Spam, commercial content, or off-topic promotion
- Comments that could be used to locate, track, or harm individuals

### 6.3 Comments That Must Be Approved

- Substantive critique of the dossier's methodology or claims
- Additional verifiable information or evidence
- Corrections to factual errors
- Expressions of support for victims (within community guidelines)

### 6.4 Rate Limiting

- Maximum 3 comments per 15-minute window per user
- No more than 10 comments per hour per user
- These limits prevent brigading and coordinated harassment

---

## 7. Legal Compliance

### 7.1 Pre-Publish Checklist

- [ ] All allegations are attributed to their original sources
- [ ] The platform is clearly identified as a **compiler**, not originator, of allegations
- [ ] Verdict badges (VERIFIED / DOCUMENTED / ALLEGED / UNVERIFIED) are applied
- [ ] Two-source rule applied for serious allegations where possible
- [ ] Right of reply offered where practical
- [ ] No uncensored personal information of private individuals
- [ ] Content warnings present for graphic material
- [ ] Creative Commons CC BY-SA 4.0 license displayed
- [ ] Disclaimer overlay functional and requires acknowledgment

### 7.2 Defamation Defense

The platform's defamation defense rests on:

1. **Attribution** — all allegations are attributed to named public sources
2. **Public interest** — content serves documented public interest
3. **Fair comment** — analysis is clearly marked as editorial/analytical
4. **Truth** — evidence is verifiable and linked
5. **Compilation, not origination** — the platform compiles existing public information

### 7.3 Takedown Procedure

If a legitimate legal request or victim request is received:

1. Assess the request's legitimacy
2. If the request is from a victim → comply immediately
3. If the request is a legal challenge → assess evidence quality
4. If evidence supports the claim → maintain publication with explanation
5. If evidence is weak → suspend the specific claim pending review
6. Document all takedown decisions in PROJECT_TRACKER.md

---

## 8. Digital Security

### 8.1 Evidence Capture Security

- Screenshots via browser canvas (no third-party tools that might log or upload)
- Base64 embedding eliminates external hosting risk
- HTTPS-only source links
- Archive.org preservation for source permanence

### 8.2 Platform Security

- No server-side code (GitHub Pages static hosting)
- No user data collection beyond Supabase auth (future comments system)
- No analytics that track individual users
- Admin access via GitHub PAT (not stored in client code)
- Cloudflare for DDoS protection and CDN

### 8.3 EXIF and Metadata

- Strip EXIF data from all images before embedding
- Remove GPS coordinates, device information, timestamps from metadata
- Never publish raw image files — always process through canvas

---

## 9. Cross-Reference

This protocol works alongside:

- **[EVIDENCE_PROTOCOL.md](EVIDENCE_PROTOCOL.md)** — Technical pipeline for evidence capture, formatting, and deployment
- **[STRATEGY.md](STRATEGY.md)** — Platform strategy, audience, theory of change, risk framework
- **[PROJECT_TRACKER.md](PROJECT_TRACKER.md)** — Living session tracker and task management

---

## 10. Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│  ETHICS CHECKLIST — Before Every Publish                │
├─────────────────────────────────────────────────────────┤
│  1. Are private individuals protected? (names, faces)   │
│  2. Do victims control their own narrative?             │
│  3. Is every claim attributed to its source?            │
│  4. Are verdict badges applied? (VERIFIED/ALLEGED/etc)  │
│  5. Is language trauma-informed, not sensational?       │
│  6. Is there a right-of-reply path?                     │
│  7. Are screenshots censored BEFORE encoding?           │
│  8. Is metadata stripped from all images?                │
│  9. Does the disclaimer overlay work?                   │
│  10. Would you publish this if the victim were reading? │
└─────────────────────────────────────────────────────────┘
```
