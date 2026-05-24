#!/usr/bin/env python3
"""
Translate extracted dossier review rows with Google Cloud Translation v3.

This script is intentionally review-sheet only. It fills draft fields inside the
i18n JSON package and never injects machine output into public HTML.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


DEFAULT_LOCATION = "us-central1"
TARGET_FIELDS = {
    "si": "sinhala_current",
    "ta": "tamil_draft",
    "fr": "french_draft",
}

KEEP_RE = re.compile(r"(`[^`]+`|https?://\S+|MUL-[A-Z0-9-]+)")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fill Tamil/French/Sinhala draft fields in a dossier i18n review JSON."
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--target", required=True, choices=sorted(TARGET_FIELDS))
    parser.add_argument("--source", default="en")
    parser.add_argument("--api-key", default=os.environ.get("GOOGLE_TRANSLATE_API_KEY"))
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT"))
    parser.add_argument("--location", default=os.environ.get("GOOGLE_CLOUD_LOCATION", DEFAULT_LOCATION))
    parser.add_argument(
        "--auth",
        default="auto",
        choices=["auto", "adc", "api-key"],
        help="Use local Google application-default credentials, API key, or auto-detect.",
    )
    parser.add_argument(
        "--adc-file",
        type=Path,
        default=Path.home() / ".config/gcloud/application_default_credentials.json",
    )
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--ids", default="", help="Comma-separated row IDs to translate.")
    parser.add_argument("--section", default="", help="Only translate rows with this section_hint.")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.2)
    return parser.parse_args()


def load_rows(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("entries"), list):
        raise SystemExit(f"Expected a JSON object with an entries list: {path}")
    return data


def protect(text: str) -> tuple[str, dict[str, str]]:
    protected: dict[str, str] = {}

    def repl(match: re.Match[str]) -> str:
        token = f"ZZZKEEP{len(protected)}ZZZ"
        protected[token] = match.group(0)
        return token

    return KEEP_RE.sub(repl, text), protected


def restore(text: str, protected: dict[str, str]) -> str:
    for token, value in protected.items():
        text = text.replace(token, value)
        text = text.replace(token.lower(), value)
    return text


class TranslateClient:
    def __init__(
        self,
        project: str,
        location: str,
        api_key: str | None = None,
        access_token: str | None = None,
        quota_project: str | None = None,
    ) -> None:
        self.api_key = api_key
        self.project = project
        self.location = location
        base = f"https://translation.googleapis.com/v3/projects/{project}/locations/{location}:translateText"
        self.endpoint = f"{base}?{urllib.parse.urlencode({'key': api_key})}" if api_key else base
        self.access_token = access_token
        self.quota_project = quota_project or project
        self.models = [
            f"projects/{project}/locations/{location}/models/general/translation-llm",
            f"projects/{project}/locations/{location}/models/general/nmt",
        ]
        self.active_model: str | None = None

    def translate_batch(self, texts: list[str], source: str, target: str) -> tuple[list[str], str]:
        if not texts:
            return [], self.active_model or ""

        models = [self.active_model] if self.active_model else self.models
        models = [m for m in models if m]
        last_error = ""
        for model in models:
            payload = {
                "contents": texts,
                "sourceLanguageCode": source,
                "targetLanguageCode": target,
                "mimeType": "text/plain",
                "model": model,
            }
            req = urllib.request.Request(
                self.endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers=self._headers(),
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=120) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
                self.active_model = model
                return [row["translatedText"] for row in body["translations"]], model
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="replace")
                last_error = f"HTTP {exc.code}: {body[:300]}"
                if exc.code == 400 and ("translation-llm" in model or "not supported" in body.lower()):
                    continue
                raise RuntimeError(last_error) from exc
            except urllib.error.URLError as exc:
                raise RuntimeError(str(exc)) from exc
        raise RuntimeError(last_error or "No translation model succeeded")

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
            headers["x-goog-user-project"] = self.quota_project
        return headers


def access_token_from_adc(path: Path) -> tuple[str, str | None]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("type") != "authorized_user":
        raise SystemExit(f"Unsupported ADC type in {path}: {data.get('type')}")
    required = ["client_id", "client_secret", "refresh_token"]
    missing = [key for key in required if not data.get(key)]
    if missing:
        raise SystemExit(f"ADC file is missing: {', '.join(missing)}")
    payload = urllib.parse.urlencode(
        {
            "client_id": data["client_id"],
            "client_secret": data["client_secret"],
            "refresh_token": data["refresh_token"],
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            token_data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Could not refresh ADC token: HTTP {exc.code}: {body[:300]}") from exc
    token = token_data.get("access_token")
    if not token:
        raise SystemExit("ADC token refresh did not return an access_token.")
    return token, data.get("quota_project_id")


def chunks(items: list, size: int) -> Iterable[list]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def main() -> int:
    args = parse_args()
    if not args.project:
        raise SystemExit("GOOGLE_CLOUD_PROJECT is required.")

    data = load_rows(args.input)
    out = deepcopy(data)
    field = TARGET_FIELDS[args.target]
    selected_ids = {value.strip() for value in args.ids.split(",") if value.strip()}

    candidates = []
    for index, row in enumerate(out["entries"]):
        if selected_ids and row.get("id") not in selected_ids:
            continue
        if args.section and row.get("section_hint") != args.section:
            continue
        if not args.overwrite and row.get(field):
            continue
        english = (row.get("english") or "").strip()
        if not english:
            continue
        candidates.append((index, english))
        if args.limit and len(candidates) >= args.limit:
            break

    auth_mode = args.auth
    if auth_mode == "auto":
        auth_mode = "adc" if args.adc_file.exists() else "api-key"
    access_token = None
    quota_project = None
    if auth_mode == "adc":
        access_token, quota_project = access_token_from_adc(args.adc_file)
    elif auth_mode == "api-key" and not args.api_key:
        raise SystemExit("GOOGLE_TRANSLATE_API_KEY is required for --auth api-key.")

    client = TranslateClient(
        project=args.project,
        location=args.location,
        api_key=args.api_key if auth_mode == "api-key" else None,
        access_token=access_token,
        quota_project=quota_project,
    )
    translated_count = 0
    models_used: set[str] = set()

    for batch in chunks(candidates, args.batch_size):
        indexes = [item[0] for item in batch]
        protected_rows = [protect(item[1]) for item in batch]
        texts = [item[0] for item in protected_rows]
        translations, model = client.translate_batch(texts, args.source, args.target)
        models_used.add(model)
        for index, translated, (_, protected) in zip(indexes, translations, protected_rows):
            out["entries"][index][field] = restore(translated, protected).strip()
            out["entries"][index]["translation_action"] = "machine_draft_for_human_review"
        translated_count += len(batch)
        if args.sleep:
            time.sleep(args.sleep)

    metadata = out.setdefault("translation_generation", {})
    metadata[args.target] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "field": field,
        "source_language": args.source,
        "target_language": args.target,
        "project": args.project,
        "location": args.location,
        "auth_mode": auth_mode,
        "models_used": sorted(models_used),
        "translated_rows": translated_count,
        "input": str(args.input),
        "review_rule": "Machine draft only; human editorial review required before page injection.",
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "target": args.target,
                "field": field,
                "translated_rows": translated_count,
                "output": str(args.output),
                "models_used": sorted(models_used),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
