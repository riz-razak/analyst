#!/usr/bin/env python3
"""
Step 3: Generate a side-by-side review HTML for translation QA.
Opens in browser for human review before injection.

Usage: python3 translate-review.py <translations.json> <output.html>
"""
import sys, json, html

def generate_review_html(data, output_file):
    entries = data['entries']
    total = len(entries)
    translated = sum(1 for e in entries if e.get('si', '').strip())
    missing = total - translated

    rows = ""
    for i, entry in enumerate(entries):
        en = html.escape(entry['en'])
        si = html.escape(entry.get('si', '')) if entry.get('si') else '<span style="color:#dc2626;font-style:italic;">⚠️ MISSING</span>'
        status = '✅' if entry.get('si', '').strip() else '❌'
        key = html.escape(entry['key'])
        tag = html.escape(entry.get('tag', '?'))

        rows += f"""
        <tr id="row-{i}" class="{'ok' if entry.get('si','').strip() else 'missing'}">
            <td class="idx">{i+1}</td>
            <td class="key"><code>{key}</code><br><small>&lt;{tag}&gt;</small></td>
            <td class="en">{en}</td>
            <td class="si">{si}</td>
            <td class="status">{status}</td>
        </tr>"""

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Translation Review — {data.get('source','dossier')}</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: 'Inter', system-ui, sans-serif; background: #f7f5ed; color: #1a1a1a; padding: 20px; }}
  h1 {{ font-size: 1.4rem; margin-bottom: 8px; color: #2d5a27; }}
  .stats {{ margin-bottom: 16px; font-size: 0.9rem; color: #666; }}
  .stats span {{ font-weight: 600; }}
  .filter-bar {{ margin-bottom: 12px; }}
  .filter-bar button {{ padding: 6px 14px; border: 1px solid #ccc; background: white; border-radius: 6px; cursor: pointer; margin-right: 6px; font-size: 0.82rem; }}
  .filter-bar button.active {{ background: #2d5a27; color: white; border-color: #2d5a27; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 0.85rem; }}
  th {{ background: #2d5a27; color: white; padding: 10px; text-align: left; position: sticky; top: 0; }}
  td {{ padding: 10px; border-bottom: 1px solid #e0ddd4; vertical-align: top; }}
  .idx {{ width: 40px; text-align: center; color: #999; }}
  .key {{ width: 140px; font-size: 0.75rem; color: #666; }}
  .en {{ width: 42%; line-height: 1.6; }}
  .si {{ width: 42%; line-height: 1.6; font-family: 'Noto Sans Sinhala', sans-serif; }}
  .status {{ width: 40px; text-align: center; font-size: 1.2rem; }}
  tr.missing td {{ background: #fef2f2; }}
  tr:hover td {{ background: #f0ece0; }}
  .hidden {{ display: none; }}
</style>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body>
<h1>Translation Review — Sinhala QA</h1>
<div class="stats">
  <span>{translated}</span> translated &middot;
  <span style="color:#dc2626">{missing}</span> missing &middot;
  <span>{total}</span> total entries
</div>
<div class="filter-bar">
  <button class="active" onclick="filter('all')">All ({total})</button>
  <button onclick="filter('missing')">Missing ({missing})</button>
  <button onclick="filter('ok')">Translated ({translated})</button>
</div>
<table>
  <thead>
    <tr><th class="idx">#</th><th class="key">Key</th><th class="en">English</th><th class="si">සිංහල</th><th class="status">OK?</th></tr>
  </thead>
  <tbody>
    {rows}
  </tbody>
</table>
<script>
function filter(mode) {{
  document.querySelectorAll('.filter-bar button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('tbody tr').forEach(row => {{
    if (mode === 'all') row.classList.remove('hidden');
    else if (mode === 'missing') row.classList.toggle('hidden', !row.classList.contains('missing'));
    else row.classList.toggle('hidden', row.classList.contains('missing'));
  }});
}}
</script>
</body>
</html>"""

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(page)

    print(f"Review page: {output_file}")
    print(f"  {translated}/{total} translated, {missing} missing")

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 translate-review.py <translations.json> <output.html>")
        sys.exit(1)

    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)

    generate_review_html(data, sys.argv[2])

if __name__ == '__main__':
    main()
