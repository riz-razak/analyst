#!/usr/bin/env python3
"""
Inject JSON-LD structured data (NewsArticle schema) into all dossier pages.
Also adds RSS autodiscovery <link> tag.
Idempotent — detects existing markers and replaces.
"""
import os, re, json

DOSSIER_ROOT = os.path.join(os.path.dirname(__file__), 'public', 'dossiers')

# JSON-LD definitions per page
PAGES = {
    'sri-lanka-cricket-corruption/index.html': {
        'headline': 'The Death of Sri Lankan Cricket: Politics, Mafia & The Road to Ruin',
        'description': 'A comprehensive investigation into the systematic corruption, political interference, and criminal networks that have hollowed out Sri Lanka Cricket.',
        'datePublished': '2026-02-01',
        'dateModified': '2026-03-01',
        'url': 'https://analyst.rizrazak.com/dossiers/sri-lanka-cricket-corruption/',
        'keywords': ['Sri Lanka Cricket', 'corruption', 'match fixing', 'Shammi Silva', 'SLC', 'investigation'],
    },
    'sri-lanka-cricket-corruption/betting-web.html': {
        'headline': 'The STBet-1xBet Betting Web: How Illegal Gambling Networks Infiltrated Sri Lankan Cricket',
        'description': 'Mapping the connections between international betting syndicates and Sri Lankan cricket — player sponsorships, match manipulation, and regulatory failures.',
        'datePublished': '2026-02-01',
        'dateModified': '2026-03-01',
        'url': 'https://analyst.rizrazak.com/dossiers/sri-lanka-cricket-corruption/betting-web.html',
        'keywords': ['STBet', '1xBet', 'betting', 'match fixing', 'Sri Lanka Cricket', 'gambling'],
    },
    'sri-lanka-cricket-corruption/kalathma-scandal.html': {
        'headline': 'The Kalathma Scandal: When Cricket\'s Elite Silenced a Teenager',
        'description': 'How Sri Lankan cricket\'s establishment used legal threats against a teenager who exposed misconduct — a case study in institutional power.',
        'datePublished': '2026-02-01',
        'dateModified': '2026-03-01',
        'url': 'https://analyst.rizrazak.com/dossiers/sri-lanka-cricket-corruption/kalathma-scandal.html',
        'keywords': ['Kalathma', 'KalathmaGate', 'Sri Lanka Cricket', 'accountability', 'youth'],
    },
    'sri-lanka-cricket-corruption/mindmap.html': {
        'headline': 'Sri Lanka Cricket Corruption Network Map',
        'description': 'Interactive network visualization mapping the connections between players, officials, betting syndicates, and political figures in Sri Lankan cricket.',
        'datePublished': '2026-02-01',
        'dateModified': '2026-03-01',
        'url': 'https://analyst.rizrazak.com/dossiers/sri-lanka-cricket-corruption/mindmap.html',
        'keywords': ['network map', 'Sri Lanka Cricket', 'connections', 'visualization'],
    },
    'sri-lanka-cricket-corruption/power-network.html': {
        'headline': 'Sri Lanka Cricket Power Network Analysis',
        'description': 'Mapping the power structures, institutional relationships, and influence networks within Sri Lanka Cricket administration.',
        'datePublished': '2026-02-01',
        'dateModified': '2026-03-01',
        'url': 'https://analyst.rizrazak.com/dossiers/sri-lanka-cricket-corruption/power-network.html',
        'keywords': ['power network', 'Sri Lanka Cricket', 'administration', 'influence'],
    },
    'easter-sunday-attacks-suresh-sallay/index.html': {
        'headline': 'Easter Sunday Attacks: The Suresh Sallay Connection',
        'description': 'Investigating the intelligence failures, political connections, and unanswered questions surrounding the 2019 Easter Sunday bombings in Sri Lanka.',
        'datePublished': '2026-02-15',
        'dateModified': '2026-03-01',
        'url': 'https://analyst.rizrazak.com/dossiers/easter-sunday-attacks-suresh-sallay/',
        'keywords': ['Easter Sunday attacks', 'Suresh Sallay', 'intelligence', 'Sri Lanka', '2019 bombings'],
    },
    'easter-sunday-attacks-suresh-sallay/conspiracy-board.html': {
        'headline': 'Easter Sunday Attacks: Conspiracy Board — Timeline & Connections',
        'description': 'Interactive conspiracy board mapping the timeline, actors, and connections in the Easter Sunday attacks investigation.',
        'datePublished': '2026-02-15',
        'dateModified': '2026-03-01',
        'url': 'https://analyst.rizrazak.com/dossiers/easter-sunday-attacks-suresh-sallay/conspiracy-board.html',
        'keywords': ['Easter Sunday', 'conspiracy board', 'timeline', 'connections', 'investigation'],
    },
}

MARKER_START = '<!-- ═══ JSON-LD Structured Data ═══ -->'
MARKER_END   = '<!-- ═══ End JSON-LD ═══ -->'
RSS_LINK     = '<link rel="alternate" type="application/rss+xml" title="analyst.rizrazak.com — Investigative Dossiers" href="https://analyst.rizrazak.com/feed.xml" />'
RSS_MARKER   = '<!-- rss-autodiscovery -->'

def build_jsonld(page_info):
    """Build JSON-LD NewsArticle schema."""
    schema = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": page_info['headline'],
        "description": page_info['description'],
        "datePublished": page_info['datePublished'],
        "dateModified": page_info['dateModified'],
        "url": page_info['url'],
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": page_info['url']
        },
        "author": {
            "@type": "Person",
            "name": "Riz Razak",
            "url": "https://rizrazak.com"
        },
        "publisher": {
            "@type": "Organization",
            "name": "analyst.rizrazak.com",
            "url": "https://analyst.rizrazak.com",
            "logo": {
                "@type": "ImageObject",
                "url": "https://analyst.rizrazak.com/images/logo.png"
            }
        },
        "keywords": page_info['keywords'],
        "inLanguage": ["en", "si"],
        "isAccessibleForFree": True,
        "isPartOf": {
            "@type": "WebSite",
            "name": "analyst.rizrazak.com",
            "url": "https://analyst.rizrazak.com"
        }
    }
    return json.dumps(schema, indent=2, ensure_ascii=False)

def inject_page(filepath, page_info):
    """Inject JSON-LD and RSS link into a single page."""
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    modified = False

    # --- JSON-LD ---
    jsonld_block = f'{MARKER_START}\n<script type="application/ld+json">\n{build_jsonld(page_info)}\n</script>\n{MARKER_END}'

    if MARKER_START in html:
        # Replace existing
        pattern = re.compile(re.escape(MARKER_START) + r'.*?' + re.escape(MARKER_END), re.DOTALL)
        html = pattern.sub(jsonld_block, html)
        modified = True
        print(f'  ↻ Replaced JSON-LD in {filepath}')
    elif '</head>' in html:
        html = html.replace('</head>', jsonld_block + '\n</head>', 1)
        modified = True
        print(f'  ✓ Injected JSON-LD into {filepath}')
    else:
        print(f'  ✗ No </head> found in {filepath}')

    # --- RSS autodiscovery ---
    if RSS_MARKER not in html and '</head>' in html:
        rss_block = f'{RSS_MARKER}\n{RSS_LINK}'
        html = html.replace('</head>', rss_block + '\n</head>', 1)
        modified = True
        print(f'  ✓ Added RSS autodiscovery to {filepath}')
    elif RSS_MARKER in html:
        print(f'  ↻ RSS link already present in {filepath}')

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)

def main():
    print('JSON-LD + RSS Injector')
    print('=' * 50)
    count = 0
    for rel_path, page_info in PAGES.items():
        filepath = os.path.join(DOSSIER_ROOT, rel_path)
        if os.path.exists(filepath):
            inject_page(filepath, page_info)
            count += 1
        else:
            print(f'  ✗ Not found: {filepath}')
    print(f'\nDone — processed {count} pages.')

if __name__ == '__main__':
    main()
