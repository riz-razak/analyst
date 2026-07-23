#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

rm -rf .cache/codex
find . -name ".DS_Store" -type f -delete

echo "Analyst Codex cleanup complete."
