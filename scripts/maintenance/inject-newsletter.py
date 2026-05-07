#!/usr/bin/env python3
"""
Inject newsletter signup script into all dossier pages.
Idempotent — skips pages that already have the marker.
"""
import os, glob

DOSSIER_ROOT = os.path.join(os.path.dirname(__file__), 'public', 'dossiers')
MARKER = '<!-- newsletter-signup -->'
SCRIPT_TAG = '<script src="../_newsletter.js" defer></script>'

# Also handle root-level pages with different relative path
SCRIPT_TAG_ROOT = '<script src="/dossiers/_newsletter.js" defer></script>'

pages = glob.glob(os.path.join(DOSSIER_ROOT, '**', '*.html'), recursive=True)
# Exclude analytics, privacy, terms, sources
EXCLUDE = ['analytics.html', 'privacy.html', 'terms.html', 'sources.html']

count = 0
for page in pages:
    basename = os.path.basename(page)
    if basename in EXCLUDE:
        print(f'  ⊘ Skipped (excluded): {page}')
        continue

    with open(page, 'r', encoding='utf-8') as f:
        html = f.read()

    if MARKER in html:
        print(f'  ↻ Already has newsletter: {page}')
        continue

    if '</body>' in html:
        inject = f'{MARKER}\n{SCRIPT_TAG}'
        html = html.replace('</body>', inject + '\n</body>', 1)
        with open(page, 'w', encoding='utf-8') as f:
            f.write(html)
        count += 1
        print(f'  ✓ Injected newsletter into {page}')
    else:
        print(f'  ✗ No </body> in {page}')

print(f'\nDone — injected into {count} pages.')
