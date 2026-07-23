#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "Validating The Analyst at $ROOT_DIR"

npm run lint
npm run build
git diff --check

echo "Analyst validation complete."
