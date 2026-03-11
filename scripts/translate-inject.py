#!/usr/bin/env python3
"""
Step 4: Inject approved Sinhala translations back into dossier HTML.
Reads the translations JSON (with 'si' fields filled) and updates
the corresponding lang-si elements in the HTML.

Usage: python3 translate-inject.py <dossier-html> <translations-json> [--dry-run]

The script matches lang-en blocks to their sibling lang-si blocks
and replaces the text content while preserving HTML structure.
"""
import sys, re, json

def inject_translations(html, translations):
    """Replace lang-si text content with translations, matched by position."""

    changes = 0
    skipped = 0

    # Build a map of translations by key
    trans_map = {}
    for entry in translations:
        if entry.get('si') and entry['si'].strip():
            trans_map[entry['key']] = entry['si']

    # Strategy: For each lang-en element, find the next lang-si sibling
    # and replace its text content with the translation.

    # Find all lang-en elements with their positions
    en_pattern = r'(<(\w+)\s+[^>]*?lang-en[^>]*>)(.*?)(</\2>)'
    si_pattern = r'(<(\w+)\s+[^>]*?lang-si[^>]*>)(.*?)(</\2>)'

    # Get all en and si blocks in order
    en_blocks = list(re.finditer(en_pattern, html, re.DOTALL))
    si_blocks = list(re.finditer(si_pattern, html, re.DOTALL))

    print(f"Found {len(en_blocks)} lang-en blocks and {len(si_blocks)} lang-si blocks")
    print(f"Have {len(trans_map)} translations to inject")

    # Match en blocks to si blocks by proximity (si follows en)
    replacements = []  # (start, end, new_content)

    si_idx = 0
    auto_idx = 0

    for en_match in en_blocks:
        en_end = en_match.end()
        en_tag = en_match.group(2)

        # Extract cms-id or use auto key
        cms_id_match = re.search(r'data-cms-id="([^"]*)"', en_match.group(1))
        key = cms_id_match.group(1) if cms_id_match else f"auto-{auto_idx}"
        auto_idx += 1

        if key not in trans_map:
            skipped += 1
            # Still advance si_idx to keep alignment
            if si_idx < len(si_blocks):
                si_idx += 1
            continue

        # Find the next si block after this en block with matching tag
        while si_idx < len(si_blocks):
            si_match = si_blocks[si_idx]
            si_tag = si_match.group(2)

            if si_match.start() > en_end and si_tag == en_tag:
                # Found matching si block
                old_content = si_match.group(3)
                new_si = trans_map[key]

                # Build replacement: keep the opening tag, replace content, keep closing tag
                new_full = si_match.group(1) + new_si + si_match.group(4)
                replacements.append((si_match.start(), si_match.end(), new_full))

                si_idx += 1
                changes += 1
                break

            si_idx += 1

    # Apply replacements in reverse order to preserve positions
    result = html
    for start, end, new_content in reversed(replacements):
        result = result[:start] + new_content + result[end:]

    print(f"Injected {changes} translations, skipped {skipped} (no translation provided)")
    return result

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 translate-inject.py <dossier.html> <translations.json> [--dry-run]")
        sys.exit(1)

    html_file = sys.argv[1]
    trans_file = sys.argv[2]
    dry_run = '--dry-run' in sys.argv

    with open(html_file, 'r', encoding='utf-8') as f:
        html = f.read()

    with open(trans_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    result = inject_translations(html, data['entries'])

    if dry_run:
        print("[DRY RUN] Would write to:", html_file)
        # Show first few changes
        print("Preview of changes applied.")
    else:
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(result)
        print(f"Written to: {html_file}")

if __name__ == '__main__':
    main()
