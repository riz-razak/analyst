#!/usr/bin/env python3
"""
Extract BOTH English and existing Sinhala text from dossier HTML.
Shows current state of translations for review.

Usage: python3 translate-extract-both.py <dossier.html> <output.json>
"""
import sys, re, json

def extract_paired_blocks(html):
    """Extract paired lang-en and lang-si blocks."""
    en_pattern = r'<(\w+)\s+([^>]*?lang-en[^>]*)>(.*?)</\1>'
    si_pattern = r'<(\w+)\s+([^>]*?lang-si[^>]*)>(.*?)</\1>'

    en_blocks = list(re.finditer(en_pattern, html, re.DOTALL))
    si_blocks = list(re.finditer(si_pattern, html, re.DOTALL))

    entries = []
    si_idx = 0

    for i, en_match in enumerate(en_blocks):
        en_tag = en_match.group(1)
        en_attrs = en_match.group(2)
        en_content = en_match.group(3)
        en_text = re.sub(r'<[^>]+>', '', en_content).strip()
        en_text = re.sub(r'\s+', ' ', en_text)

        # Get cms-id
        cms_match = re.search(r'data-cms-id="([^"]*)"', en_attrs)
        key = cms_match.group(1) if cms_match else f"auto-{i}"

        # Find matching si block (next one after this en block, same tag type)
        si_text = ""
        en_end = en_match.end()

        for j in range(si_idx, len(si_blocks)):
            si_match = si_blocks[j]
            if si_match.start() > en_end and si_match.group(1) == en_tag:
                si_content = si_match.group(3)
                si_text = re.sub(r'<[^>]+>', '', si_content).strip()
                si_text = re.sub(r'\s+', ' ', si_text)
                si_idx = j + 1
                break

        if en_text and len(en_text) > 1:
            entries.append({
                "key": key,
                "tag": en_tag,
                "en": en_text,
                "si": si_text,
                "si_quality": "existing" if si_text else "missing"
            })

    return entries

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 translate-extract-both.py <dossier.html> <output.json>")
        sys.exit(1)

    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        html = f.read()

    entries = extract_paired_blocks(html)

    translated = sum(1 for e in entries if e['si'])
    missing = sum(1 for e in entries if not e['si'])

    output = {
        "source": sys.argv[1],
        "total_entries": len(entries),
        "translated": translated,
        "missing": missing,
        "instructions": "Review 'si' fields. Replace bad translations. Fill in missing ones. Keep proper nouns in English.",
        "entries": entries
    }

    with open(sys.argv[2], 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Extracted {len(entries)} entries ({translated} translated, {missing} missing)")

if __name__ == '__main__':
    main()
