#!/usr/bin/env python3
"""
Step 1: Extract all translatable English text from a dossier HTML.
Outputs a JSON file with { key: english_text } for translation.

Usage: python3 translate-extract.py <dossier-html> <output-json>
"""
import sys, re, json

def extract_lang_en_blocks(html):
    """Extract text from lang-en elements using regex (more reliable for custom attributes)."""
    entries = []

    # Pattern: find elements with lang-en attribute
    # Matches: <tagname lang-en [other attrs]>content</tagname>
    pattern = r'<(\w+)\s+[^>]*?lang-en[^>]*?(?:data-cms-id="([^"]*)")?[^>]*>(.*?)</\1>'

    # Also handle self-referencing pattern with data-cms-id before lang-en
    pattern2 = r'<(\w+)\s+[^>]*?data-cms-id="([^"]*)"[^>]*?lang-en[^>]*>(.*?)</\1>'

    seen_keys = set()

    for match in re.finditer(pattern, html, re.DOTALL):
        tag, cms_id, content = match.group(1), match.group(2), match.group(3)
        # Strip HTML tags to get pure text
        text = re.sub(r'<[^>]+>', '', content).strip()
        text = re.sub(r'\s+', ' ', text)  # normalize whitespace

        if text and len(text) > 1:
            key = cms_id or f"auto-{len(entries)}"
            if key not in seen_keys:
                seen_keys.add(key)
                entries.append({
                    "key": key,
                    "tag": tag,
                    "en": text,
                    "si": "",
                    "html_snippet": content.strip()[:200]
                })

    for match in re.finditer(pattern2, html, re.DOTALL):
        tag, cms_id, content = match.group(1), match.group(2), match.group(3)
        text = re.sub(r'<[^>]+>', '', content).strip()
        text = re.sub(r'\s+', ' ', text)

        if text and len(text) > 1 and cms_id not in seen_keys:
            seen_keys.add(cms_id)
            entries.append({
                "key": cms_id,
                "tag": tag,
                "en": text,
                "si": "",
                "html_snippet": content.strip()[:200]
            })

    return entries

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 translate-extract.py <dossier.html> <output.json>")
        sys.exit(1)

    html_file = sys.argv[1]
    output_file = sys.argv[2]

    with open(html_file, 'r', encoding='utf-8') as f:
        html = f.read()

    entries = extract_lang_en_blocks(html)

    output = {
        "source": html_file,
        "total_entries": len(entries),
        "instructions": "Fill in the 'si' field for each entry. Keep proper nouns in English. Preserve [S1] reference markers.",
        "entries": entries
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Extracted {len(entries)} translatable entries -> {output_file}")

if __name__ == '__main__':
    main()
