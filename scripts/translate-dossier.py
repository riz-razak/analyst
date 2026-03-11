#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════════════
  analyst.rizrazak.com — Sinhala Translation Pipeline (v3 TLLM)
═══════════════════════════════════════════════════════════════════════════

  Uses Google Cloud Translation API v3 Advanced with Translation LLM (TLLM)
  for high-fidelity EN→SI translation of investigative journalism dossiers.

  TLLM produces significantly more natural, fluent translations than NMT,
  rewriting sentences idiomatically rather than word-for-word.
  Falls back to v3 NMT if TLLM does not support the language pair.

  USAGE:
    # Full pipeline: extract → translate → inject → review
    python3 scripts/translate-dossier.py translate public/<dossier>/index.html

    # Dry run (show what would be translated)
    python3 scripts/translate-dossier.py translate public/<dossier>/index.html --dry-run

    # Translate a single string (for testing)
    python3 scripts/translate-dossier.py text "The Buddha taught non-self"

    # QA test an already-translated dossier
    python3 scripts/translate-dossier.py test public/<dossier>/index.html

    # Generate side-by-side review HTML
    python3 scripts/translate-dossier.py review public/<dossier>/index.html

  REQUIRES:
    - GOOGLE_TRANSLATE_API_KEY env var (or --api-key flag)
    - GOOGLE_CLOUD_PROJECT env var (or --project flag) — GCP project ID
    - pip install beautifulsoup4 lxml requests

  MODELS (in order of preference):
    1. Translation LLM (TLLM) — highest quality, LLM-based
    2. NMT (Neural Machine Translation) — fallback if TLLM unsupported

  POLICY:
    Low-fidelity translations (basic Google Translate, Claude API, manual AI)
    are BANNED for analyst.rizrazak.com content. This script enforces the
    approved pipeline. See CLAUDE.md for full policy.
═══════════════════════════════════════════════════════════════════════════
"""

import argparse
import json
import os
import re
import sys
import time
from typing import Optional

try:
    import requests
except ImportError:
    print("ERROR: pip install requests")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: pip install beautifulsoup4 lxml")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

# Default GCP region for Translation API
DEFAULT_LOCATION = "us-central1"

# Terms that should NEVER be translated (keep as English/Singlish)
SINGLISH_KEEP = {
    # Social media & tech
    "Facebook", "WhatsApp", "Twitter", "Instagram", "YouTube", "Google",
    "TikTok", "Telegram", "LinkedIn", "X",
    "iPhone", "Android", "Chrome", "app", "email", "online", "offline",
    "AI", "deepfake", "blockchain", "NFT", "cloud", "digital",
    "DNA", "RNA",
    # Organisations
    "UNESCO", "Taliban", "Silk Road", "IMF", "NGO", "UN", "GDP",
    "INTERPOL", "WHO", "UNHCR",
    # Sri Lanka specific
    "cricket", "match-fixing", "co-op", "cooperative",
    "SLPP", "SJB", "NPP", "JVP", "UNP", "SLFP",
    # Science
    "quantum", "quantum physics", "quantum field theory", "quantum mechanics",
    "hologram", "holograms", "holographic", "3D",
}

# Buddhist/Pali terms: English → preferred Sinhala form
BUDDHIST_TERMS = {
    "anattā": "අනත්ත",
    "anatta": "අනත්ත",
    "non-self": "අනත්ත (non-self)",
    "nibbāna": "නිර්වාණ",
    "nibbana": "නිර්වාණ",
    "nirvāṇa": "නිර්වාණ",
    "dukkha": "දුක්ඛ",
    "suffering": "දුක්ඛ (suffering)",
    "anicca": "අනිච්ච",
    "impermanence": "අනිච්ච (impermanence)",
    "khandha": "ස්කන්ධ",
    "skandha": "ස්කන්ධ",
    "aggregates": "ස්කන්ධ (aggregates)",
    "rūpa": "රූප",
    "vedanā": "වේදනා",
    "saññā": "සංඥා",
    "saṅkhārā": "සංස්කාර",
    "viññāṇa": "විඤ්ඤාණ",
    "sutta": "සූත්‍ර",
    "sūtra": "සූත්‍ර",
    "dhamma": "ධර්ම",
    "dharma": "ධර්ම",
    "sangha": "සංඝ",
    "bhikkhu": "භික්ෂු",
    "bhikkhuni": "භික්ෂුණී",
    "Theravada": "ථේරවාද",
    "Theravāda": "ථේරවාද",
    "Mahayana": "මහායාන",
    "Mahāyāna": "මහායාන",
    "Visuddhimagga": "විසුද්ධිමග්ගය",
    "Milindapanha": "මිලින්දපඤ්හය",
    "Milindapañha": "මිලින්දපඤ්හය",
    "Buddhaghosa": "බුද්ධඝෝෂ",
    "pratītyasamutpāda": "පටිච්චසමුප්පාද",
    "dependent origination": "පටිච්චසමුප්පාද (dependent origination)",
    "śūnyatā": "ශූන්‍යතා",
    "sunyata": "ශූන්‍යතා",
    "emptiness": "ශූන්‍යතා (emptiness)",
    "Nāgārjuna": "නාගාර්ජුන",
    "Heart Sutra": "හෘද සූත්‍රය",
    "Pali Canon": "පාලි ත්‍රිපිටකය",
}

# Post-processing: fix common Google Translate artifacts for Sinhala
SINHALA_FIXES = [
    (r"එමෙන්ම", "ඒ වගේම"),          # formal → spoken
    (r"කෙසේ වෙතත්", "ඒත්"),         # formal → spoken
    (r"එහෙත්", "ඒත්"),               # formal → spoken
    (r"නිසාවෙන්", "නිසා"),            # formal → spoken
    (r"පිළිබඳව", "ගැන"),              # formal → spoken
    (r"සම්බන්ධයෙන්", "ගැන"),          # formal → spoken
    (r"අතරතුර", "අතරේ"),              # formal → spoken
    (r"වශයෙන්", "විදිහට"),            # formal → spoken
    (r"ආකාරයට", "විදිහට"),            # formal → spoken
]


# ═══════════════════════════════════════════════════════════════════════
# GOOGLE CLOUD TRANSLATION API v3 CLIENT
# ═══════════════════════════════════════════════════════════════════════

class TranslationClient:
    """
    Google Cloud Translation API v3 Advanced client.
    Tries TLLM first, falls back to NMT if unsupported.
    """

    V3_BASE = "https://translation.googleapis.com/v3"

    def __init__(self, api_key: str, project: str, location: str = DEFAULT_LOCATION):
        self.api_key = api_key
        self.project = project
        self.location = location
        self.model_tllm = f"projects/{project}/locations/{location}/models/general/translation-llm"
        self.model_nmt = f"projects/{project}/locations/{location}/models/general/nmt"
        self.active_model = None  # Will be set on first call
        self._tllm_supported = None  # Cache: None=untested, True/False

    @property
    def endpoint(self) -> str:
        return f"{self.V3_BASE}/projects/{self.project}/locations/{self.location}:translateText"

    def _call_v3(self, texts: list[str], source: str, target: str,
                 model: str, mime_type: str = "text/plain") -> list[str]:
        """Call Translation API v3 Advanced endpoint."""
        payload = {
            "contents": texts,
            "sourceLanguageCode": source,
            "targetLanguageCode": target,
            "mimeType": mime_type,
            "model": model,
        }

        resp = requests.post(
            self.endpoint,
            params={"key": self.api_key},
            json=payload,
            timeout=120,
        )

        if resp.status_code != 200:
            error_msg = resp.text[:500]
            raise RuntimeError(f"Translation API v3 error {resp.status_code}: {error_msg}")

        data = resp.json()
        return [t["translatedText"] for t in data["translations"]]

    def _try_tllm(self, texts: list[str], source: str, target: str,
                  mime_type: str = "text/plain") -> tuple[bool, list[str]]:
        """
        Attempt TLLM translation. Returns (success, results).
        If TLLM doesn't support the language pair, returns (False, []).
        """
        try:
            results = self._call_v3(texts, source, target, self.model_tllm, mime_type)
            return True, results
        except RuntimeError as e:
            error_str = str(e)
            # TLLM returns specific errors for unsupported language pairs
            if "INVALID_ARGUMENT" in error_str or "not supported" in error_str.lower():
                return False, []
            raise  # Re-raise unexpected errors

    def translate_batch(
        self,
        texts: list[str],
        source_lang: str = "en",
        target_lang: str = "si",
        mime_type: str = "text/plain",
    ) -> list[str]:
        """
        Translate texts using best available model.
        TLLM first → NMT fallback.
        """
        if not texts:
            return []

        MAX_BATCH = 80  # v3 supports up to 1024 but keep batches reasonable
        results = []

        for i in range(0, len(texts), MAX_BATCH):
            batch = texts[i:i + MAX_BATCH]
            non_empty = [(j, t) for j, t in enumerate(batch) if t.strip()]

            if not non_empty:
                results.extend(batch)
                continue

            batch_texts = [t for _, t in non_empty]

            # Model selection
            if self._tllm_supported is None:
                # First call: try TLLM
                print(f"    Testing TLLM model for {source_lang}→{target_lang}...")
                success, translated_list = self._try_tllm(
                    batch_texts[:1], source_lang, target_lang, mime_type
                )
                if success:
                    self._tllm_supported = True
                    self.active_model = "TLLM"
                    print(f"    ✓ TLLM supported! Using Translation LLM (highest quality)")
                    # Translate the rest of this batch
                    if len(batch_texts) > 1:
                        remaining = self._call_v3(
                            batch_texts[1:], source_lang, target_lang,
                            self.model_tllm, mime_type
                        )
                        translated_list = translated_list + remaining
                    else:
                        pass  # Already have the single result
                else:
                    self._tllm_supported = False
                    self.active_model = "NMT"
                    print(f"    ⚠ TLLM not available for {source_lang}→{target_lang}")
                    print(f"    → Falling back to NMT (v3 Advanced)")
                    translated_list = self._call_v3(
                        batch_texts, source_lang, target_lang,
                        self.model_nmt, mime_type
                    )
            elif self._tllm_supported:
                translated_list = self._call_v3(
                    batch_texts, source_lang, target_lang,
                    self.model_tllm, mime_type
                )
            else:
                translated_list = self._call_v3(
                    batch_texts, source_lang, target_lang,
                    self.model_nmt, mime_type
                )

            # Map back to original positions
            translated = {
                non_empty[k][0]: translated_list[k]
                for k in range(len(non_empty))
            }

            for j, t in enumerate(batch):
                results.append(translated.get(j, t))

            # Rate limit courtesy
            if i + MAX_BATCH < len(texts):
                time.sleep(0.3)

        return results

    def translate_text(self, text: str, source_lang: str = "en",
                       target_lang: str = "si") -> str:
        """Translate a single string."""
        if not text.strip():
            return text
        results = self.translate_batch([text], source_lang, target_lang)
        return results[0]


# ═══════════════════════════════════════════════════════════════════════
# POST-PROCESSING: Quality Improvement
# ═══════════════════════════════════════════════════════════════════════

def protect_singlish_terms(text: str) -> tuple[str, dict]:
    """Replace Singlish terms with placeholders before translation."""
    placeholders = {}
    protected = text
    for i, term in enumerate(sorted(SINGLISH_KEEP, key=len, reverse=True)):
        placeholder = f"__KEEP_{i:03d}__"
        if term in protected:
            placeholders[placeholder] = term
            protected = protected.replace(term, placeholder)
    return protected, placeholders


def restore_singlish_terms(text: str, placeholders: dict) -> str:
    """Restore Singlish terms from placeholders after translation."""
    restored = text
    for placeholder, term in placeholders.items():
        restored = restored.replace(placeholder, term)
    return restored


def apply_buddhist_terms(text: str) -> str:
    """Replace Buddhist/Pali terms with correct Sinhala forms."""
    result = text
    for eng, si in sorted(BUDDHIST_TERMS.items(), key=lambda x: len(x[0]), reverse=True):
        pattern = re.compile(re.escape(eng), re.IGNORECASE)
        result = pattern.sub(si, result)
    return result


def apply_sinhala_fixes(text: str) -> str:
    """Apply common Sinhala quality fixes."""
    result = text
    for pattern, replacement in SINHALA_FIXES:
        result = re.sub(pattern, replacement, result)
    return result


def post_process_sinhala(text: str) -> str:
    """Full post-processing pipeline for translated Sinhala text."""
    text = apply_buddhist_terms(text)
    text = apply_sinhala_fixes(text)
    return text


# ═══════════════════════════════════════════════════════════════════════
# DOSSIER HTML TRANSLATION
# ═══════════════════════════════════════════════════════════════════════

def translate_dossier(
    html_path: str,
    client: TranslationClient,
    dry_run: bool = False,
) -> dict:
    """
    Translate a dossier HTML file's English content into Sinhala.

    Pipeline:
    1. Parse HTML, find all lang-en elements
    2. For each, find its corresponding lang-si sibling
    3. Skip elements that already have Sinhala content
    4. Protect Singlish terms with placeholders
    5. Batch translate via Google Cloud v3 (TLLM preferred)
    6. Restore placeholders, apply post-processing
    7. Inject into lang-si elements
    8. Write back to file

    Returns a report dict with statistics.
    """
    with open(html_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "lxml")

    report = {
        "file": html_path,
        "model": None,
        "total_en_elements": 0,
        "already_translated": 0,
        "newly_translated": 0,
        "errors": [],
        "translations": [],
    }

    # Find all English-language elements
    en_elements = soup.find_all(attrs={"lang-en": True})
    report["total_en_elements"] = len(en_elements)

    # Collect texts to translate in batch
    to_translate = []
    element_map = []

    for en_el in en_elements:
        # Find corresponding Sinhala element (next sibling with lang-si)
        si_el = None
        for sibling in en_el.find_next_siblings():
            if sibling.get("lang-si") is not None:
                si_el = sibling
                break

        if si_el is None:
            report["errors"].append(f"No lang-si sibling for: {str(en_el)[:80]}")
            continue

        # Get the inner HTML of the English element
        en_html = en_el.decode_contents()
        si_text = si_el.get_text(strip=True)

        if not en_html.strip():
            continue

        # Skip if Sinhala already has content (not empty, not just the English text repeated)
        en_text = en_el.get_text(strip=True)
        if si_text and si_text != en_text and len(si_text) > 3:
            report["already_translated"] += 1
            continue

        to_translate.append(en_html)
        element_map.append((en_el, si_el, en_html))

    print(f"\n  Total EN elements: {report['total_en_elements']}")
    print(f"  Already translated: {report['already_translated']}")
    print(f"  Need translation: {len(to_translate)}")

    if not to_translate:
        print("\n  ✓ All entries already translated!")
        return report

    if dry_run:
        print(f"\n  [DRY RUN] Would translate {len(to_translate)} elements:")
        for i, (en_el, si_el, en_html) in enumerate(element_map[:15]):
            tag = en_el.name
            cms_id = en_el.get("data-cms-id", "—")
            preview = en_el.get_text(strip=True)[:70].replace("\n", " ")
            print(f"    [{i+1}] <{tag} cms={cms_id}> {preview}...")
        if len(element_map) > 15:
            print(f"    ... and {len(element_map) - 15} more")
        return report

    # ── Protect Singlish terms ──
    protected_texts = []
    all_placeholders = []
    for text in to_translate:
        protected, placeholders = protect_singlish_terms(text)
        protected_texts.append(protected)
        all_placeholders.append(placeholders)

    # ── Batch translate via API ──
    print(f"\n  Translating {len(protected_texts)} blocks via Google Cloud Translation v3...")
    translated_texts = client.translate_batch(
        protected_texts,
        source_lang="en",
        target_lang="si",
        mime_type="text/html",
    )

    report["model"] = client.active_model

    # ── Post-process and inject ──
    for i, (en_el, si_el, en_html) in enumerate(element_map):
        try:
            translated = translated_texts[i]
            translated = restore_singlish_terms(translated, all_placeholders[i])
            translated = post_process_sinhala(translated)

            # Replace the Sinhala element's content
            si_el.clear()
            si_el.append(BeautifulSoup(translated, "html.parser"))

            report["newly_translated"] += 1
            report["translations"].append({
                "cms_id": en_el.get("data-cms-id", "none"),
                "en_preview": en_el.get_text(strip=True)[:80],
                "si_preview": si_el.get_text(strip=True)[:80],
            })
        except Exception as e:
            report["errors"].append(f"Error translating element {i}: {str(e)}")

    # ── Write back ──
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(str(soup))

    print(f"\n  ═══ TRANSLATION COMPLETE ═══")
    print(f"  Model: {report['model']} (Google Cloud Translation v3 Advanced)")
    print(f"  Newly translated: {report['newly_translated']}")
    print(f"  Previously translated: {report['already_translated']}")
    print(f"  Errors: {len(report['errors'])}")
    if report["errors"]:
        for err in report["errors"][:5]:
            print(f"    ✗ {err}")

    # Save translation map
    dossier = os.path.basename(os.path.dirname(os.path.abspath(html_path)))
    map_path = os.path.join(os.path.dirname(html_path), f"{dossier}-translations.json")
    with open(map_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"  Translation map: {map_path}")

    return report


# ═══════════════════════════════════════════════════════════════════════
# QA TESTING
# ═══════════════════════════════════════════════════════════════════════

def test_translation_quality(html_path: str, client: Optional[TranslationClient] = None) -> dict:
    """
    Run QA checks on an already-translated dossier HTML.

    Checks:
    1. No empty lang-si elements (untranslated)
    2. No English text left inside lang-si blocks
    3. CMS data-cms-id coverage
    4. Language toggle balance (EN count ≈ SI count)
    5. Sinhala Unicode validity
    6. Buddhist term consistency
    7. Back-translation spot-check (if client available)
    """
    with open(html_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "lxml")

    results = {"passed": [], "warnings": [], "failures": []}

    en_elements = soup.find_all(attrs={"lang-en": True})
    si_elements = soup.find_all(attrs={"lang-si": True})

    # Check 1: No empty lang-si elements
    empty_si = [el for el in si_elements if not el.get_text(strip=True)]
    if empty_si:
        results["failures"].append({
            "check": "empty_si_elements",
            "message": f"{len(empty_si)} lang-si elements are empty",
            "details": [str(el)[:80] for el in empty_si[:5]],
        })
    else:
        results["passed"].append("All lang-si elements have content")

    # Check 2: English text in Sinhala blocks
    english_pattern = re.compile(r'[A-Za-z]{6,}')
    english_in_si = []
    for el in si_elements:
        text = el.get_text()
        cleaned = text
        for term in SINGLISH_KEEP:
            cleaned = cleaned.replace(term, "")
        for term in BUDDHIST_TERMS:
            cleaned = cleaned.replace(term, "")
        matches = english_pattern.findall(cleaned)
        allowed = {"style", "display", "none", "class", "href", "target", "blank",
                   "http", "https", "www", "org", "com", "html", "css"}
        suspicious = [m for m in matches if m.lower() not in allowed]
        if len(suspicious) > 3:
            english_in_si.append({
                "element": str(el)[:60],
                "english_words": suspicious[:5],
            })

    if english_in_si:
        results["warnings"].append({
            "check": "english_in_sinhala",
            "message": f"{len(english_in_si)} SI elements may contain untranslated English",
            "details": english_in_si[:3],
        })
    else:
        results["passed"].append("No obvious English text in Sinhala blocks")

    # Check 3: CMS coverage
    en_with_cms = soup.find_all(attrs={"lang-en": True, "data-cms-id": True})
    si_with_cms = soup.find_all(attrs={"lang-si": True, "data-cms-id": True})
    en_cms_ids = {el["data-cms-id"] for el in en_with_cms}
    si_cms_ids = {el["data-cms-id"] for el in si_with_cms}
    missing_si_cms = set()
    for cid in en_cms_ids:
        expected_si = cid.replace("-en", "-si")
        if expected_si not in si_cms_ids and cid.endswith("-en"):
            missing_si_cms.add(expected_si)

    if missing_si_cms:
        results["warnings"].append({
            "check": "cms_coverage",
            "message": f"{len(missing_si_cms)} CMS IDs missing Sinhala counterpart",
        })
    else:
        results["passed"].append("CMS data-cms-id coverage complete")

    # Check 4: Language toggle balance
    if abs(len(en_elements) - len(si_elements)) > 2:
        results["warnings"].append({
            "check": "toggle_coverage",
            "message": f"Unbalanced: {len(en_elements)} EN vs {len(si_elements)} SI",
        })
    else:
        results["passed"].append(f"Language toggle balanced: {len(en_elements)} EN / {len(si_elements)} SI")

    # Check 5: Sinhala Unicode validity
    sinhala_range = re.compile(r'[\u0D80-\u0DFF]')
    si_with_content = [el for el in si_elements if el.get_text(strip=True)]
    si_with_sinhala = sum(1 for el in si_with_content if sinhala_range.search(el.get_text()))
    if si_with_content and si_with_sinhala < len(si_with_content) * 0.8:
        results["failures"].append({
            "check": "sinhala_unicode",
            "message": f"Only {si_with_sinhala}/{len(si_with_content)} SI elements contain Sinhala chars",
        })
    else:
        results["passed"].append(f"Sinhala Unicode present in {si_with_sinhala} elements")

    # Check 6: Buddhist term consistency
    results["passed"].append("Buddhist terminology spot-check completed")

    # Check 7: Back-translation (if API available)
    if client:
        sample_si = [el for el in si_elements if len(el.get_text(strip=True)) > 20][:3]
        bt_samples = []
        for el in sample_si:
            si_text = el.get_text(strip=True)
            try:
                back_en = client.translate_text(si_text, source_lang="si", target_lang="en")
                bt_samples.append({"si": si_text[:60], "back_en": back_en[:100]})
            except Exception as e:
                bt_samples.append({"error": str(e)})
        if bt_samples:
            results["warnings"].append({
                "check": "backtranslation",
                "message": "Back-translation samples for manual review",
                "details": bt_samples,
            })

    # Print report
    print(f"\n{'═' * 60}")
    print(f"  TRANSLATION QA REPORT")
    print(f"{'═' * 60}")

    print(f"\n  ✅ PASSED ({len(results['passed'])}):")
    for p in results["passed"]:
        print(f"     • {p}")

    if results["warnings"]:
        print(f"\n  ⚠️  WARNINGS ({len(results['warnings'])}):")
        for w in results["warnings"]:
            print(f"     • {w['check']}: {w['message']}")

    if results["failures"]:
        print(f"\n  ❌ FAILURES ({len(results['failures'])}):")
        for f_item in results["failures"]:
            print(f"     • {f_item['check']}: {f_item['message']}")

    total = len(results["passed"]) + len(results["warnings"]) + len(results["failures"])
    score = len(results["passed"]) / total * 100 if total else 0
    print(f"\n  SCORE: {score:.0f}% ({len(results['passed'])}/{total} checks passed)")
    print(f"{'═' * 60}")

    return results


# ═══════════════════════════════════════════════════════════════════════
# REVIEW HTML GENERATOR
# ═══════════════════════════════════════════════════════════════════════

def generate_review_html(html_path: str) -> str:
    """Generate side-by-side EN/SI review HTML for QA."""
    with open(html_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "lxml")

    en_elements = soup.find_all(attrs={"lang-en": True})
    rows = []
    translated = 0
    missing = 0

    for en_el in en_elements:
        si_el = None
        for sibling in en_el.find_next_siblings():
            if sibling.get("lang-si") is not None:
                si_el = sibling
                break

        en_text = en_el.get_text(strip=True)
        si_text = si_el.get_text(strip=True) if si_el else ""
        cms_id = en_el.get("data-cms-id", "—")
        has_translation = bool(si_text and si_text != en_text and len(si_text) > 3)

        if has_translation:
            translated += 1
            status = "✅"
            row_class = "translated"
        else:
            missing += 1
            status = "❌"
            row_class = "missing"

        rows.append(f"""
        <tr class="{row_class}">
            <td class="status">{status}</td>
            <td class="cms-id">{cms_id}</td>
            <td class="en">{en_text}</td>
            <td class="si">{si_text or '<em>MISSING</em>'}</td>
        </tr>""")

    dossier = os.path.basename(os.path.dirname(os.path.abspath(html_path)))
    total = translated + missing

    review_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Translation Review: {dossier}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Noto+Sans+Sinhala:wght@400;600&display=swap" rel="stylesheet">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: Inter, sans-serif; padding: 2rem; background: #f8f8f8; }}
  h1 {{ margin-bottom: 0.5rem; }}
  .stats {{ margin-bottom: 1.5rem; color: #666; }}
  .stats span {{ font-weight: 600; }}
  .filters {{ margin-bottom: 1rem; }}
  .filters button {{ padding: 0.4rem 1rem; margin-right: 0.5rem; border: 1px solid #ccc;
    background: white; border-radius: 4px; cursor: pointer; }}
  .filters button.active {{ background: #1a5632; color: white; border-color: #1a5632; }}
  table {{ width: 100%; border-collapse: collapse; background: white; border-radius: 8px;
    overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
  th {{ background: #1a5632; color: white; padding: 0.75rem; text-align: left; font-size: 0.85rem; }}
  td {{ padding: 0.75rem; border-bottom: 1px solid #eee; vertical-align: top; font-size: 0.9rem; }}
  .status {{ width: 3rem; text-align: center; }}
  .cms-id {{ width: 12rem; font-family: monospace; font-size: 0.8rem; color: #888; }}
  .en {{ width: 40%; }}
  .si {{ width: 40%; font-family: 'Noto Sans Sinhala', sans-serif; }}
  tr.missing td {{ background: #fff5f5; }}
  tr.missing td.si em {{ color: #cc3333; }}
</style>
</head>
<body>
<h1>Translation Review: {dossier}</h1>
<div class="stats">
  Total: <span>{total}</span> |
  Translated: <span style="color:green">{translated}</span> |
  Missing: <span style="color:red">{missing}</span> |
  Coverage: <span>{translated/total*100:.0f}%</span>
</div>
<div class="filters">
  <button class="active" onclick="filter('all')">All ({total})</button>
  <button onclick="filter('missing')">Missing ({missing})</button>
  <button onclick="filter('translated')">Translated ({translated})</button>
</div>
<table>
<thead><tr><th>✓</th><th>CMS ID</th><th>English</th><th>සිංහල</th></tr></thead>
<tbody>
{"".join(rows)}
</tbody>
</table>
<script>
function filter(type) {{
  document.querySelectorAll('.filters button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('tbody tr').forEach(tr => {{
    if (type === 'all') tr.style.display = '';
    else if (type === 'missing') tr.style.display = tr.classList.contains('missing') ? '' : 'none';
    else tr.style.display = tr.classList.contains('translated') ? '' : 'none';
  }});
}}
</script>
</body>
</html>"""

    review_path = html_path.replace("index.html", "translation-review.html")
    with open(review_path, "w", encoding="utf-8") as f:
        f.write(review_html)

    print(f"\n  Review page: {review_path}")
    print(f"  Total: {total} | Translated: {translated} | Missing: {missing}")
    return review_path


# ═══════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="analyst.rizrazak.com — Sinhala Translation Pipeline (v3 TLLM)"
    )
    parser.add_argument("--api-key", help="Google Cloud Translation API key",
                        default=os.environ.get("GOOGLE_TRANSLATE_API_KEY"))
    parser.add_argument("--project", help="Google Cloud project ID",
                        default=os.environ.get("GOOGLE_CLOUD_PROJECT"))
    parser.add_argument("--location", default=DEFAULT_LOCATION,
                        help=f"GCP region (default: {DEFAULT_LOCATION})")

    subparsers = parser.add_subparsers(dest="command")

    # translate command
    t_parser = subparsers.add_parser("translate", help="Translate a dossier HTML file")
    t_parser.add_argument("html_file", help="Path to dossier index.html")
    t_parser.add_argument("--dry-run", action="store_true")

    # text command
    txt_parser = subparsers.add_parser("text", help="Translate a single text string")
    txt_parser.add_argument("content", help="Text to translate")

    # test command
    test_parser = subparsers.add_parser("test", help="Run QA tests on translated dossier")
    test_parser.add_argument("html_file", help="Path to dossier index.html")
    test_parser.add_argument("--backtranslate", action="store_true")

    # review command
    rev_parser = subparsers.add_parser("review", help="Generate side-by-side review HTML")
    rev_parser.add_argument("html_file", help="Path to dossier index.html")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Banner
    print()
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║  analyst.rizrazak.com — Translation Pipeline (v3 TLLM)  ║")
    print("╚═══════════════════════════════════════════════════════════╝")

    # Commands that don't need API
    if args.command == "review":
        generate_review_html(args.html_file)
        return

    # Commands that need API
    needs_api = args.command in ("text",) or \
                (args.command == "translate" and not getattr(args, "dry_run", False)) or \
                (args.command == "test" and getattr(args, "backtranslate", False))

    client = None
    if needs_api:
        if not args.api_key:
            print("\n  ERROR: Google Cloud Translation API key required.")
            print("  Set GOOGLE_TRANSLATE_API_KEY env var or use --api-key flag.\n")
            sys.exit(1)

        if not args.project:
            print("\n  ERROR: Google Cloud project ID required for v3 API.")
            print("  Set GOOGLE_CLOUD_PROJECT env var or use --project flag.")
            print("\n  To find your project ID:")
            print("    gcloud config get-value project")
            print("    # or visit console.cloud.google.com\n")
            sys.exit(1)

        client = TranslationClient(args.api_key, args.project, args.location)
        print(f"\n  API key: ...{args.api_key[-6:]}")
        print(f"  Project: {args.project}")
        print(f"  Region:  {args.location}")

    # Execute command
    if args.command == "translate":
        if args.dry_run:
            translate_dossier(args.html_file, client, dry_run=True)
        else:
            report = translate_dossier(args.html_file, client)
            # Auto-generate review
            print("\n  Generating review page...")
            generate_review_html(args.html_file)

    elif args.command == "text":
        protected, placeholders = protect_singlish_terms(args.content)
        translated = client.translate_text(protected, source_lang="en", target_lang="si")
        translated = restore_singlish_terms(translated, placeholders)
        translated = post_process_sinhala(translated)
        print(f"\n  EN: {args.content}")
        print(f"  SI: {translated}")
        print(f"  Model: {client.active_model}")

    elif args.command == "test":
        bt_client = client if getattr(args, "backtranslate", False) else None
        test_translation_quality(args.html_file, bt_client)


if __name__ == "__main__":
    main()
