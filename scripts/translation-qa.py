#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════════════
  analyst.rizrazak.com — Automated post-translation QA gate
═══════════════════════════════════════════════════════════════════════════

  Hardens the checks that were previously run by hand after every
  Sinhala / Tamil pass. Wired in as the final gate of
  scripts/translate-all.sh; also runnable standalone.

  USAGE:
    python3 scripts/translation-qa.py public/<dossier>/index.html --lang si
    python3 scripts/translation-qa.py public/<dossier>/index.html --lang ta
    python3 scripts/translation-qa.py public/<dossier>/index.html --lang both
    python3 scripts/translation-qa.py public/<dossier>/index.html --lang si --json

  CHECKS (all hard failures unless noted):
    1. sibling_coverage    every lang-en element has a filled lang-<t> sibling
    2. target_script       every filled sibling contains target-script chars
                           (Sinhala U+0D80–U+0DFF / Tamil U+0B80–U+0BFF)
    3. cross_contamination no Sinhala in the Tamil edition and vice versa
    4. residual_markup     zero __KEEP_nnn__ tokens, zero stray
                           <span translate="no"> left in the output
    5. keep_terms          every SINGLISH_KEEP term present in an EN element
                           is present in that element's translation
                           (this is the Tamil-NMT-eats-placeholders regression)
    6. numbers             every curated load-bearing figure present in an EN
                           element is present in that element's translation
    7. stranded_english    no bare English common words stranded inside
                           translated prose (the glossary over-protection bug)

  EXIT CODES:
    0  all checks passed
    1  one or more checks failed
    2  usage / IO error

  NO API KEY REQUIRED. This is a pure static analysis of the HTML.
═══════════════════════════════════════════════════════════════════════════
"""

import argparse
import importlib.util
import json
import os
import re
import sys

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: pip install beautifulsoup4 lxml", file=sys.stderr)
    sys.exit(2)


# ── Single-source the glossary and the text extractor from the pipeline ──
# translate-dossier.py has a hyphen in its name, so it cannot be imported
# with a plain `import`. Loading it by path keeps SINGLISH_KEEP in exactly
# one place: if the keep-list changes, QA changes with it.
_HERE = os.path.dirname(os.path.abspath(__file__))
_PIPELINE = os.path.join(_HERE, "translate-dossier.py")

_spec = importlib.util.spec_from_file_location("translate_dossier", _PIPELINE)
if _spec is None or _spec.loader is None:
    print(f"ERROR: cannot load pipeline module at {_PIPELINE}", file=sys.stderr)
    sys.exit(2)
_pipeline = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pipeline)

SINGLISH_KEEP = _pipeline.SINGLISH_KEEP
element_text = _pipeline.element_text
_term_pattern = _pipeline._term_pattern
target_cms_id = _pipeline.target_cms_id
LANG_NAMES = _pipeline.LANG_NAMES


# ═══════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

SCRIPT_RANGES = {
    "si": (0x0D80, 0x0DFF),   # Sinhala
    "ta": (0x0B80, 0x0BFF),   # Tamil
}
SCRIPT_RE = {
    lang: re.compile(f"[\\u{lo:04X}-\\u{hi:04X}]")
    for lang, (lo, hi) in SCRIPT_RANGES.items()
}

# Curated load-bearing figures. These are the numbers the argument rests on;
# NMT has been observed to reformat or drop digits inside long sentences, and
# a silently mangled figure is a correction-grade error. Checked only in the
# elements whose ENGLISH text actually contains them.
CURATED_NUMBERS = [
    "166,967", "84,176", "42,147",   # 2022 sitting funnel
    "343", "300",                     # drift / benchmark day counts
    "132", "178", "198", "133",       # runway day counts
    "62.6", "64.7", "62.64", "64.73",  # two-rulers z-score cut-offs
    "1926",                           # helpline — must never be altered
    "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026",
]

# Bare English words that must NOT survive inside translated prose. These are
# exactly the words that the pre-fix, over-broad keep-list stranded in Sinhala
# sentences ("...තබා ඇත claim.", "petition අත්සන් කරන්න"). They are ordinary
# vocabulary, not terms of art, and have settled SI/TA renderings.
STRANDED_ENGLISH_WORDS = {
    "claim", "claims", "claimed",
    "petition", "petitions", "petitioner",
    "evidence", "verify", "verified", "verifies",
    "stated", "statement", "category", "categories",
    "geography", "writ", "syllabus", "syllabuses",
    "cohort", "candidate", "candidates", "examination", "examinations",
    "government", "ministry", "circular", "court", "appeal",
    "school", "schools", "student", "students", "teacher", "teachers",
    "calendar", "exam", "exams", "repair", "deadline",
}

# Latin-script tokens that are legitimately allowed to appear in the output:
# markup leakage guards, URLs, and anything on the keep-list.
ALLOWED_LATIN = {
    "style", "display", "none", "class", "href", "target", "blank",
    "http", "https", "www", "org", "com", "html", "css", "span", "div",
    "rel", "noopener", "true", "false",
}

RESIDUAL_PATTERNS = [
    ("__KEEP_ placeholder token", re.compile(r"__KEEP_\d+__")),
    ('stray <span translate="no">', re.compile(r'<span[^>]*translate\s*=\s*"?no"?', re.I)),
    ("stray translate=no attribute", re.compile(r"translate\s*=\s*['\"]?no['\"]?", re.I)),
]


# ═══════════════════════════════════════════════════════════════════════
# CHECK ENGINE
# ═══════════════════════════════════════════════════════════════════════

class Result:
    """Collects per-check pass/fail rows for one target language."""

    def __init__(self, lang: str, html_path: str):
        self.lang = lang
        self.html_path = html_path
        self.rows = []          # (check, status, count, detail)
        self.details = {}       # check -> list of offending strings

    def record(self, check: str, failures: list, scanned: int, note: str = ""):
        status = "PASS" if not failures else "FAIL"
        detail = note or (f"{len(failures)} of {scanned} scanned" if failures
                          else f"{scanned} scanned")
        self.rows.append((check, status, len(failures), detail))
        if failures:
            self.details[check] = failures

    @property
    def failed(self) -> bool:
        return any(r[1] == "FAIL" for r in self.rows)


def _label(el) -> str:
    """Short human handle for an element in the failure table."""
    cid = el.get("data-cms-id")
    if cid:
        return cid
    return f"<{el.name}> {element_text(el)[:40]}"


def _siblings_for(soup, lang: str):
    """Yield (en_element, target_sibling_or_None) pairs, pipeline-identically."""
    lang_attr = f"lang-{lang}"
    for en_el in soup.find_all(attrs={"lang-en": True}):
        sib = None
        for candidate in en_el.find_next_siblings():
            if candidate.get(lang_attr) is not None:
                sib = candidate
                break
        yield en_el, sib


def run_checks(html_path: str, lang: str) -> Result:
    if lang not in SCRIPT_RANGES:
        raise ValueError(f"unsupported target language: {lang}")

    with open(html_path, "r", encoding="utf-8") as f:
        raw = f.read()
    soup = BeautifulSoup(raw, "lxml")

    res = Result(lang, html_path)
    pairs = list(_siblings_for(soup, lang))
    other = "ta" if lang == "si" else "si"

    # ── 1. sibling coverage ────────────────────────────────────────────
    missing = []
    filled = []
    for en_el, sib in pairs:
        en_text = element_text(en_el)
        if sib is None:
            missing.append(f"{_label(en_el)}: no lang-{lang} sibling")
            continue
        t = element_text(sib)
        if not t:
            missing.append(f"{_label(en_el)}: lang-{lang} sibling is EMPTY")
        elif t == en_text:
            missing.append(f"{_label(en_el)}: sibling is a verbatim EN copy")
        else:
            filled.append((en_el, sib, en_text, t))
    res.record("sibling_coverage", missing, len(pairs))

    # ── 2. target script present ───────────────────────────────────────
    script_re = SCRIPT_RE[lang]
    no_script = [f"{_label(en)}: no {LANG_NAMES[lang]} characters — {t[:50]!r}"
                 for en, sib, _e, t in filled if not script_re.search(t)]
    res.record("target_script", no_script, len(filled))

    # ── 3. cross-contamination ─────────────────────────────────────────
    other_re = SCRIPT_RE[other]
    contaminated = [
        f"{_label(en)}: contains {LANG_NAMES[other]} script — "
        f"{''.join(other_re.findall(t))[:20]!r}"
        for en, sib, _e, t in filled if other_re.search(t)
    ]
    res.record("cross_contamination", contaminated, len(filled))

    # ── 4. residual markup / placeholder tokens ────────────────────────
    residual = []
    for en, sib, _e, _t in filled:
        markup = sib.decode_contents()
        for name, pat in RESIDUAL_PATTERNS:
            if pat.search(markup):
                residual.append(f"{_label(en)}: {name}")
    # Also sweep the whole file — a token could survive outside a sibling.
    for name, pat in RESIDUAL_PATTERNS:
        hits = pat.findall(raw)
        if hits:
            residual.append(f"<document>: {len(hits)} × {name}")
    res.record("residual_markup", residual, len(filled))

    # ── 5. keep-terms survive translation ──────────────────────────────
    keep_patterns = [(term, _term_pattern(term))
                     for term in sorted(SINGLISH_KEEP, key=len, reverse=True)]
    dropped = []
    keep_scanned = 0
    for en, sib, en_text, t in filled:
        for term, pat in keep_patterns:
            if not pat.search(en_text):
                continue
            keep_scanned += 1
            if not _term_present(term, t):
                dropped.append(f"{_label(en)}: keep-term {term!r} missing from translation")
    res.record("keep_terms", dropped, keep_scanned)

    # ── 6. curated numbers preserved ───────────────────────────────────
    dropped_nums = []
    num_scanned = 0
    for en, sib, en_text, t in filled:
        for num in CURATED_NUMBERS:
            if num not in en_text:
                continue
            num_scanned += 1
            if num not in t:
                dropped_nums.append(f"{_label(en)}: number {num!r} missing from translation")
    res.record("numbers", dropped_nums, num_scanned)

    # ── 7. stranded bare English ───────────────────────────────────────
    stranded = []
    for en, sib, _e, t in filled:
        # Strip everything we deliberately keep in English before looking.
        cleaned = t
        for term, pat in keep_patterns:
            cleaned = pat.sub(" ", cleaned)
        words = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", cleaned)
        hits = sorted({w for w in words
                       if w.lower() in STRANDED_ENGLISH_WORDS
                       and w.lower() not in ALLOWED_LATIN})
        if hits:
            stranded.append(f"{_label(en)}: stranded English {hits}")
    res.record("stranded_english", stranded, len(filled))

    return res


# ═══════════════════════════════════════════════════════════════════════
# REPORTING
# ═══════════════════════════════════════════════════════════════════════

MAX_DETAIL = 8


def print_report(res: Result) -> None:
    name = LANG_NAMES.get(res.lang, res.lang)
    title = f"  TRANSLATION QA — {name} ({res.lang}) — {os.path.basename(res.html_path)}"
    bar = "=" * 78
    print()
    print(bar)
    print(title)
    print(bar)
    print(f"  {'CHECK':<22} {'STATUS':<8} {'FAILS':>6}  DETAIL")
    print(f"  {'-' * 22} {'-' * 8} {'-' * 6}  {'-' * 30}")
    for check, status, count, detail in res.rows:
        print(f"  {check:<22} {status:<8} {count:>6}  {detail}")
    print(bar)

    if res.details:
        print("\n  FAILURE DETAIL")
        for check, items in res.details.items():
            print(f"\n  [{check}] {len(items)} issue(s):")
            for item in items[:MAX_DETAIL]:
                print(f"    - {item}")
            if len(items) > MAX_DETAIL:
                print(f"    ... and {len(items) - MAX_DETAIL} more")

    verdict = "FAILED" if res.failed else "PASSED"
    print(f"\n  RESULT: {name} QA {verdict}\n")


def _norm_acronym(text: str) -> str:
    """Strip full stops and hyphens so 'G.C.E.' and 'GCE' compare equal.

    Cloud Translation normalises dotted acronyms (G.C.E. -> GCE) even inside
    <span translate="no">. The term itself survives; only its punctuation is
    dropped, so a raw string comparison reports a false 'missing term'.
    """
    return re.sub(r"[.\-\u2010-\u2015\u00a0]", "", text)


def _term_present(term: str, haystack: str) -> bool:
    """True if the term survived, ignoring acronym punctuation normalisation."""
    if term in haystack:
        return True
    return _norm_acronym(term) in _norm_acronym(haystack)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Automated post-translation QA gate for Analyst dossiers")
    ap.add_argument("html_file", help="Path to the dossier index.html")
    ap.add_argument("--lang", choices=("si", "ta", "both"), default="both",
                    help="Target language to check (default: both)")
    ap.add_argument("--json", action="store_true",
                    help="Also emit a machine-readable JSON summary on stdout")
    args = ap.parse_args()

    if not os.path.isfile(args.html_file):
        print(f"ERROR: no such file: {args.html_file}", file=sys.stderr)
        return 2

    langs = ("si", "ta") if args.lang == "both" else (args.lang,)
    results = []
    for lang in langs:
        res = run_checks(args.html_file, lang)
        print_report(res)
        results.append(res)

    if args.json:
        print(json.dumps({
            "file": args.html_file,
            "languages": {
                r.lang: {
                    "failed": r.failed,
                    "checks": [
                        {"check": c, "status": s, "failures": n, "detail": d}
                        for c, s, n, d in r.rows
                    ],
                    "details": r.details,
                } for r in results
            },
        }, indent=2, ensure_ascii=False))

    failed = [r.lang for r in results if r.failed]
    if failed:
        print(f"QA GATE FAILED for: {', '.join(failed)}", file=sys.stderr)
        return 1
    print("QA GATE PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
