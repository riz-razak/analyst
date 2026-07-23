#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "Codex setup for The Analyst: $ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required for Analyst Codex setup." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm is required for Analyst Codex setup." >&2
  exit 1
fi

if [ ! -f package-lock.json ]; then
  echo "ERROR: package-lock.json not found; refusing non-lockfile install." >&2
  exit 1
fi

echo "Node: $(node --version)"
echo "npm: $(npm --version)"

mkdir -p .cache/codex
npm ci --no-audit --no-fund

echo "Dependency install complete."

if [ "${CODEX_RUN_VALIDATE:-0}" = "1" ]; then
  bash scripts/codex/validate.sh
else
  echo "Skipping validation. Run: bash scripts/codex/validate.sh"
fi
