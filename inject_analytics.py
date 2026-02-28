#!/usr/bin/env python3
"""
Inject GA4 + Microsoft Clarity tracking into all public dossier pages.
GDPR-aware: skips tracking if user explicitly declined consent.

Usage: python3 inject_analytics.py
After running: update GA4_ID and CLARITY_ID with real values from
your GA4 property and Clarity project, then re-run.
"""

import os

BASE = "/sessions/laughing-funny-carson/mnt/Political Research/analyst-site"

# ── IDs — replace these once you have real accounts ──────────────────────────
GA4_ID      = "G-XXXXXXXXXX"   # From GA4: Admin → Data Streams → Measurement ID
CLARITY_ID  = "XXXXXXXXXXXX"   # From Clarity: Settings → Overview → Project ID
# ─────────────────────────────────────────────────────────────────────────────

SNIPPET = f"""
  <!-- ═══ Analytics: GA4 + Microsoft Clarity ═══
       GDPR-aware: skips tracking if user explicitly declined consent.
       To update IDs: replace values in analytics.html → Analytics tab,
       or edit GA4_ID / CLARITY_ID directly in inject_analytics.py and re-run.
       GA4 Measurement ID : {GA4_ID}
       Clarity Project ID  : {CLARITY_ID}
  -->
  <script>
    (function(){{
      try {{
        var c = JSON.parse(localStorage.getItem('gdpr_consent_v1') || 'null');
        if (c && c.accepted === false) return; // user declined — skip analytics
      }} catch(e) {{}}
      // ── Google Analytics 4 ───────────────────────────────────────────────
      var _ga = document.createElement('script');
      _ga.async = true;
      _ga.src = 'https://www.googletagmanager.com/gtag/js?id={GA4_ID}';
      document.head.appendChild(_ga);
      window.dataLayer = window.dataLayer || [];
      function gtag(){{ dataLayer.push(arguments); }}
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', '{GA4_ID}', {{
        'anonymize_ip': true,      // GDPR best-practice
        'send_page_view': true
      }});
      // ── Microsoft Clarity ────────────────────────────────────────────────
      (function(c,l,a,r,i,t,y){{
        c[a] = c[a] || function(){{ (c[a].q = c[a].q || []).push(arguments) }};
        t = l.createElement(r); t.async = 1;
        t.src = 'https://www.clarity.ms/tag/' + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t,y);
      }})(window, document, 'clarity', 'script', '{CLARITY_ID}');
    }})();
  </script>
  <!-- ═══ End Analytics ═══ -->"""

# Pages to inject (skip analytics.html, privacy, terms, sources — utility pages)
TARGETS = [
    # Sri Lanka cricket dossier
    "public/dossiers/sri-lanka-cricket-corruption/index.html",
    "public/dossiers/sri-lanka-cricket-corruption/betting-web.html",
    "public/dossiers/sri-lanka-cricket-corruption/kalathma-scandal.html",
    "public/dossiers/sri-lanka-cricket-corruption/mindmap.html",
    "public/dossiers/sri-lanka-cricket-corruption/power-network.html",
    # Easter Sunday dossier
    "public/dossiers/easter-sunday-attacks-suresh-sallay/index.html",
    "public/dossiers/easter-sunday-attacks-suresh-sallay/conspiracy-board.html",
]

MARKER_START = "<!-- ═══ Analytics: GA4 + Microsoft Clarity"
MARKER_END   = "<!-- ═══ End Analytics ═══ -->"

def inject(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    # Remove existing snippet if present (idempotent)
    if MARKER_START in html:
        # Strip everything between markers
        start_idx = html.find(MARKER_START)
        end_idx   = html.find(MARKER_END)
        if end_idx != -1:
            end_idx += len(MARKER_END)
            # Also eat the surrounding whitespace/newlines
            html = html[:start_idx].rstrip() + "\n" + html[end_idx:].lstrip("\n")
        print(f"  ↻ Replaced existing snippet in {os.path.basename(filepath)}")
    else:
        print(f"  + Injected into {os.path.basename(filepath)}")

    # Inject just before </head>
    if '</head>' not in html:
        print(f"  ⚠ No </head> found in {filepath} — skipping")
        return False

    html = html.replace('</head>', SNIPPET + '\n</head>', 1)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    return True

def main():
    print(f"Injecting GA4 ({GA4_ID}) + Clarity ({CLARITY_ID}) into dossier pages...\n")
    ok = 0
    for rel in TARGETS:
        full = os.path.join(BASE, rel)
        if not os.path.exists(full):
            print(f"  ✗ Not found: {rel}")
            continue
        if inject(full):
            ok += 1
    print(f"\n✅ Done — {ok}/{len(TARGETS)} pages updated")
    print("\n⚠ NEXT STEP: Replace placeholder IDs before going live:")
    print(f"   GA4_ID     = \"{GA4_ID}\"  → your real Measurement ID from analytics.google.com")
    print(f"   CLARITY_ID = \"{CLARITY_ID}\" → your real Project ID from clarity.microsoft.com")
    print("\nThen re-run this script to update all pages at once.")

if __name__ == "__main__":
    main()
