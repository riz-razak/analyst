#!/usr/bin/env python3
"""
Extract data-i18n strings from a static Analyst dossier.

This is designed for newer dossier pages that keep English/Sinhala strings in
data-en/data-si attributes rather than the older lang-en/lang-si block pattern.
It creates a review JSON for Tamil/French translation work without injecting
unreviewed translations into the live page.
"""

import argparse
from html.parser import HTMLParser
import json
import re
from pathlib import Path


KEEP_ENGLISH_TERMS = {
    "SEO",
    "UN",
    "OISL",
    "OHCHR",
    "ICRC",
    "ICC",
    "ICJ",
    "Wikipedia",
    "Mullivaikkal",
    "Vanni",
    "claim",
    "source",
    "source trail",
    "source route",
    "ClaimReview",
}

LEGAL_TERMS = {
    "genocide",
    "war crimes",
    "crimes against humanity",
    "legal intent",
    "judicial",
    "court",
    "adjudicated",
    "jurisdiction",
}


def classify(text: str) -> tuple[str, str]:
    lowered = text.lower()
    if any(term in lowered for term in LEGAL_TERMS):
        return (
            "legal_term_requires_review",
            "Do not force a one-word Tamil/French equivalent if the legal lane needs explanation.",
        )
    if "`" in text or "source route" in lowered or "claim harden" in lowered or "hardens" in lowered:
        return (
            "explain_or_quote_technical_phrase",
            "Keep coined technical phrases clear; explain rather than over-transliterate.",
        )
    if any(term in text for term in KEEP_ENGLISH_TERMS):
        return (
            "keep_key_english_terms_where_useful",
            "Preserve key SEO/source/legal abbreviations where they aid comprehension.",
        )
    if len(text) <= 24:
        return ("short_ui_label", "Keep concise; avoid formal or academic register.")
    return ("translate_for_average_reader", "Use plain online-reader Tamil/French, not academic prose.")


class I18nParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.entries = []
        self.section_stack = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {k: (v or "") for k, v in attrs}
        if tag in {"section", "header", "footer"}:
            self.section_stack.append(attr_map.get("id", tag))
        if "data-i18n" in attr_map and attr_map.get("data-en", "").strip():
            en = attr_map.get("data-en", "").strip()
            action, note = classify(en)
            self.entries.append(
                {
                    "tag": tag,
                    "section_hint": self.section_stack[-1] if self.section_stack else "",
                    "english": en,
                    "sinhala_current": attr_map.get("data-si", "").strip(),
                    "tamil_draft": attr_map.get("data-ta", "").strip(),
                    "french_draft": attr_map.get("data-fr", "").strip(),
                    "translation_action": action,
                    "review_note": note,
                    "risk_flags": sorted(
                        flag
                        for flag, pattern in {
                            "number_claim": r"40,000|70,000|169,796|7,721",
                            "legal_language": r"genocide|war crimes|legal|court|judicial|intent",
                            "ethnic_context": r"Tamil|Sinhala|Sri Lankan",
                            "seo_language": r"SEO|Wikipedia|search|source|claim|mirror|AI",
                        }.items()
                        if re.search(pattern, en, flags=re.I)
                    ),
                }
            )

    def handle_endtag(self, tag: str) -> None:
        if tag in {"section", "header", "footer"} and self.section_stack:
            self.section_stack.pop()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("html_file")
    parser.add_argument("output_json")
    args = parser.parse_args()

    source = Path(args.html_file)
    output = Path(args.output_json)
    parser_obj = I18nParser()
    parser_obj.feed(source.read_text(encoding="utf-8"))
    entries = [
        {"id": f"MUL-I18N-{idx:03d}", **entry}
        for idx, entry in enumerate(parser_obj.entries, start=1)
    ]

    payload = {
        "source": str(source),
        "generated_for": "Tamil first, French second translation review",
        "total_entries": len(entries),
        "production_rule": "Do not inject Tamil/French into the live page until Elubaas/Mara review has cleared legal and ethnic-risk wording.",
        "entries": entries,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Extracted {len(entries)} entries -> {output}")


if __name__ == "__main__":
    main()
