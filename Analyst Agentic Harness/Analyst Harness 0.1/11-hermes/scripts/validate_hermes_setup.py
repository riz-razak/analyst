#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REQUIRED = [
    "11-hermes/README.md",
    "11-hermes/manifests/hermes-profile.analyst.json",
    "11-hermes/manifests/council-roster.analyst.json",
    "11-hermes/manifests/lane-policy.analyst.json",
    "06-handoffs/HANDOFF_HERMES_EXTENSION_2026_06_28.md",
]
SECRET_PATTERNS = [
    re.compile("DISCORD_" + "BOT_" + "TOKEN\\s*=", re.I),
    re.compile("BOT_" + "TOKEN\\s*=", re.I),
    re.compile("WEBHOOK_" + "URL\\s*=", re.I),
    re.compile("Authorization:" + "\\s*Bearer", re.I),
    re.compile("sk-" + "proj-[A-Za-z0-9_-]+"),
    re.compile("xox" + "[baprs]-[A-Za-z0-9-]+"),
]

def fail(message: str) -> None:
    print(f"FAIL {message}")
    raise SystemExit(1)

def main() -> None:
    missing = [rel for rel in REQUIRED if not (ROOT / rel).exists()]
    if missing:
        fail(f"missing files: {missing}")
    for path in (ROOT / "11-hermes" / "manifests").glob("*.json"):
        json.loads(path.read_text())
    profile = json.loads((ROOT / "11-hermes/manifests/hermes-profile.analyst.json").read_text())
    if profile.get("product_repo_write_allowed") or profile.get("publication_release_allowed"):
        fail("Analyst extension must not allow product writes or publication release")
    handoff = (ROOT / "06-handoffs/HANDOFF_HERMES_EXTENSION_2026_06_28.md").read_text()
    for heading in ["## Summary", "## Evidence", "## Next"]:
        if heading not in handoff:
            fail(f"handoff missing {heading}")
    bad = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or "runtime" in path.parts:
            continue
        text = path.read_text(errors="ignore")
        for pattern in SECRET_PATTERNS:
            if pattern.search(text):
                bad.append(str(path.relative_to(ROOT)))
    if bad:
        fail(f"secret pattern found: {bad[:5]}")
    print("ANALYST_HERMES_EXTENSION_VALID")

if __name__ == "__main__":
    main()
