#!/usr/bin/env bash
# Analyst one-command publish: build → commit → rebase → push.
#
#   ./scripts/publish.sh "commit message"                 # publish everything staged
#   ./scripts/publish.sh "message" --dossier 2026-al-cohort# narrow: only that dossier + shared/registry
#   ./scripts/publish.sh "message" --no-build             # skip the vite build
#
# The repo is shared with a Codex session, so a rebase is baked in before push
# (bare pushes get rejected otherwise). Opens the live URL on success if a slug
# was given.
set -Eeuo pipefail
trap 'echo "✗ publish failed at line $LINENO" >&2' ERR

cd "$(dirname "$0")/.."

MSG="${1:-}"
[ -n "$MSG" ] || { echo "usage: ./scripts/publish.sh \"commit message\" [--dossier <slug>] [--no-build]" >&2; exit 1; }
shift

DOSSIER=""
BUILD=1
while [ $# -gt 0 ]; do
  case "$1" in
    --dossier) DOSSIER="${2:?slug required}"; shift 2 ;;
    --no-build) BUILD=0; shift ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

if [ "$BUILD" -eq 1 ]; then
  echo "→ building…"
  npm run build
fi

if [ -n "$DOSSIER" ]; then
  echo "→ staging dossier '$DOSSIER' + shared assets + registry only"
  git add "public/$DOSSIER" \
          public/_shared \
          public/data/dossiers.json \
          docs scripts 2>/dev/null || true
else
  echo "→ staging all changes"
  git add -A
fi

# Nothing to commit? bail cleanly.
if git diff --cached --quiet; then
  echo "→ nothing staged; skipping commit. Pulling latest and exiting."
  git pull --rebase origin main
  exit 0
fi

git commit -m "$MSG"

echo "→ rebasing on origin/main (shared repo)…"
git pull --rebase origin main

echo "→ pushing…"
git push

echo "✓ published: $MSG"
if [ -n "$DOSSIER" ]; then
  echo "  live shortly at https://analyst.rizrazak.com/$DOSSIER/"
  command -v open >/dev/null && open "https://analyst.rizrazak.com/$DOSSIER/" || true
fi
