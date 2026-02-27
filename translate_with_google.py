#!/usr/bin/env python3
"""
Google NMT Batch Translator for Sri Lanka Cricket Dossier
Reads en_texts.json, translates via Google Cloud Translation API,
and updates data-si attributes in the dossier HTML file.

Usage: python3 translate_with_google.py
"""

import re
import json
import time
import urllib.request
import os

API_KEY = "AIzaSyDu-6DwM2ySGmOq1iuz9Llz21w6PbO_rTg"
TRANSLATE_URL = f"https://translation.googleapis.com/language/translate/v2?key={API_KEY}"

# Resolve paths relative to this script's location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EN_TEXTS_FILE = os.path.join(SCRIPT_DIR, "en_texts.json")
HTML_FILE = os.path.join(SCRIPT_DIR, "public", "dossiers", "sri-lanka-cricket-corruption", "index.html")


def google_translate_batch(texts, source="en", target="si"):
    """Send a batch of texts to Google Translate API v2."""
    results = []
    batch_size = 100

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        payload = json.dumps({
            "q": batch,
            "source": source,
            "target": target,
            "format": "text"
        }).encode("utf-8")

        req = urllib.request.Request(
            TRANSLATE_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        batch_results = [item["translatedText"] for item in data["data"]["translations"]]
        results.extend(batch_results)
        print(f"  Batch {i // batch_size + 1}: translated {len(batch)} strings")
        time.sleep(0.3)

    return results


def main():
    # 1. Read English texts
    print(f"Reading: {EN_TEXTS_FILE}")
    with open(EN_TEXTS_FILE, "r", encoding="utf-8") as f:
        unique_texts = json.load(f)
    print(f"  {len(unique_texts)} unique texts to translate")

    # 2. Translate
    print(f"\nTranslating {len(unique_texts)} texts with Google NMT (en -> si)...")
    translations = google_translate_batch(unique_texts)
    print(f"  Got {len(translations)} translations back")

    # Build lookup map
    translation_map = dict(zip(unique_texts, translations))

    # Save translations for reference
    si_file = os.path.join(SCRIPT_DIR, "si_translations.json")
    with open(si_file, "w", encoding="utf-8") as f:
        json.dump(translation_map, f, ensure_ascii=False, indent=2)
    print(f"\nSaved translation map to: {si_file}")

    # 3. Read HTML
    print(f"\nReading: {HTML_FILE}")
    with open(HTML_FILE, "r", encoding="utf-8") as f:
        html = f.read()

    # Count existing data-si attributes
    old_count = len(re.findall(r'data-si="', html))
    print(f"  Found {old_count} existing data-si attributes")

    # 4. Replace data-si values
    def replacer(m):
        en_val = m.group(1)
        old_si = m.group(2)
        new_si = translation_map.get(en_val, old_si)
        # Escape quotes for HTML attribute
        new_si = new_si.replace('"', '&quot;')
        return f'data-en="{en_val}" data-si="{new_si}"'

    pattern = re.compile(r'data-en="((?:[^"\\]|\\.)*)" data-si="((?:[^"\\]|\\.)*)"')
    new_html = pattern.sub(replacer, html)

    new_count = len(re.findall(r'data-si="', new_html))
    print(f"  After replacement: {new_count} data-si attributes")

    # 5. Show samples
    print("\nSample translations (first 5):")
    for i, (en, si) in enumerate(list(translation_map.items())[:5]):
        print(f"  [{i+1}] EN: {en[:70]}{'...' if len(en) > 70 else ''}")
        print(f"       SI: {si[:70]}{'...' if len(si) > 70 else ''}")

    # 6. Write updated HTML
    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(new_html)
    print(f"\n✅ Updated: {HTML_FILE}")
    print("Done! Now commit and push to deploy.")


if __name__ == "__main__":
    main()
