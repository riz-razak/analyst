#!/usr/bin/env python3
"""
Translate mindmap node descriptions and link facts using Google Cloud Translation API,
then inject the Sinhala translations back into mindmap.html as JS objects.
"""
import json, time, urllib.request, re, os, html as html_mod

API_KEY = "AIzaSyDu-6DwM2ySGmOq1iuz9Llz21w6PbO_rTg"
TRANSLATE_URL = f"https://translation.googleapis.com/language/translate/v2?key={API_KEY}"

_BASE = os.path.dirname(os.path.abspath(__file__))
TEXTS_FILE = os.path.join(_BASE, "mindmap_texts_for_translate.json")
MINDMAP_FILE = os.path.join(_BASE, "public/dossiers/sri-lanka-cricket-corruption/mindmap.html")

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

        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        batch_results = [html_mod.unescape(item["translatedText"]) for item in data["data"]["translations"]]
        results.extend(batch_results)
        print(f"  Batch {i // batch_size + 1}: translated {len(batch)} strings")
        time.sleep(0.5)

    return results

def main():
    # 1. Load texts
    with open(TEXTS_FILE, 'r', encoding='utf-8') as f:
        texts_map = json.load(f)

    keys = list(texts_map.keys())
    values = list(texts_map.values())
    print(f"Loaded {len(keys)} texts to translate ({sum(1 for k in keys if k.startswith('node:'))} nodes, {sum(1 for k in keys if k.startswith('link:'))} links)")

    # 2. Translate via Google
    print("\nTranslating via Google Cloud Translation API (en → si)...")
    translations = google_translate_batch(values)
    print(f"  Got {len(translations)} translations back")

    # 3. Build JS objects
    node_si = {}
    link_si = {}

    for key, si_text in zip(keys, translations):
        # Escape for JS string
        si_text = si_text.replace('\\', '\\\\').replace('"', '\\"').replace("'", "\\'")

        if key.startswith('node:'):
            node_id = key[5:]
            node_si[node_id] = si_text
        elif key.startswith('link:'):
            link_key = key[5:]
            link_si[link_key] = si_text

    # 4. Build JS code block
    js_lines = ['    // ============ SINHALA TRANSLATIONS (Google Cloud NMT) ============']

    # nodeDescSi — replace the empty object
    js_lines.append('    // Populated by Google Translate API')

    node_entries = []
    for nid, si in node_si.items():
        node_entries.append(f'      "{nid}": "{si}"')
    node_js = ',\n'.join(node_entries)

    link_entries = []
    for lk, si in link_si.items():
        link_entries.append(f'      "{lk}": "{si}"')
    link_js = ',\n'.join(link_entries)

    # 5. Inject into mindmap.html
    with open(MINDMAP_FILE, 'r', encoding='utf-8') as f:
        html = f.read()

    # Replace empty nodeDescSi
    html = html.replace(
        "    const nodeDescSi = {};",
        "    const nodeDescSi = {\n" + node_js + "\n    };"
    )

    # Replace empty linkFactsSi
    html = html.replace(
        "    const linkFactsSi = {};",
        "    const linkFactsSi = {\n" + link_js + "\n    };"
    )

    with open(MINDMAP_FILE, 'w', encoding='utf-8') as f:
        f.write(html)

    # Save translation map for reference
    save_path = os.path.join(_BASE, "mindmap_si_translations.json")
    full_map = {k: t for k, t in zip(keys, translations)}
    with open(save_path, 'w', encoding='utf-8') as f:
        json.dump(full_map, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Injected into mindmap.html:")
    print(f"   nodeDescSi: {len(node_si)} entries")
    print(f"   linkFactsSi: {len(link_si)} entries")
    print(f"\n📝 Saved full translation map → {save_path}")

    # Show samples
    print("\nSample translations:")
    for i, (k, t) in enumerate(list(full_map.items())[:5]):
        en = texts_map[k]
        print(f"  [{k}]")
        print(f"    EN: {en[:80]}{'...' if len(en)>80 else ''}")
        print(f"    SI: {t[:80]}{'...' if len(t)>80 else ''}")

if __name__ == "__main__":
    main()
