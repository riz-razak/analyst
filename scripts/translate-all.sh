#!/usr/bin/env bash
# =============================================================================
#  analyst.rizrazak.com — one-shot Sinhala/Tamil translation run
# =============================================================================
#
#  Single idempotent entry point for the whole pipeline:
#
#      preflight (dry run) -> SI -> TA -> review (both) -> QA gate (both)
#
#  Idempotent: translate-dossier.py skips siblings that already carry
#  target-language copy, so re-running is safe and cheap. Pass --force to
#  re-translate already-filled siblings (use after a keep-list change).
#
#  USAGE
#      scripts/translate-all.sh public/2026-al-cohort
#      scripts/translate-all.sh public/2026-al-cohort/index.html --lang si
#      scripts/translate-all.sh public/2026-al-cohort --lang ta --force
#      scripts/translate-all.sh public/2026-al-cohort --preflight-only
#
#  OPTIONS
#      --lang si|ta|both   target language(s); default both
#      --force             re-translate siblings that already have copy
#      --preflight-only    stop after the dry run (no API spend)
#      --skip-qa           run everything except the final QA gate (not
#                          allowed before publish; debugging only)
#      -h | --help         this message
#
#  REQUIRES
#      .venv-translation           virtualenv with beautifulsoup4 lxml requests
#      GOOGLE_TRANSLATE_API_KEY    "Yan News" Cloud Translation API key
#      GOOGLE_CLOUD_PROJECT        yan-news-503217
#
#  The API key is never printed, never logged, and never passed on a command
#  line — translate-dossier.py reads it from the environment.
#
#  Fails loudly: any non-zero exit from any stage aborts the run.
# =============================================================================

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
VENV_DIR="${REPO_ROOT}/.venv-translation"
PIPELINE="${SCRIPT_DIR}/translate-dossier.py"
QA_SCRIPT="${SCRIPT_DIR}/translation-qa.py"
EXPECTED_PROJECT="yan-news-503217"

# Never turn on xtrace in this script: it would echo the environment.
set +x

# ── output helpers ──────────────────────────────────────────────────────────
BOLD=""; RED=""; GRN=""; YLW=""; RST=""
if [ -t 1 ]; then
  BOLD=$'\033[1m'; RED=$'\033[31m'; GRN=$'\033[32m'; YLW=$'\033[33m'; RST=$'\033[0m'
fi

step() { printf '\n%s==> %s%s\n' "${BOLD}" "$*" "${RST}"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '%s    WARNING: %s%s\n' "${YLW}" "$*" "${RST}"; }
die()  { printf '\n%sERROR: %s%s\n\n' "${RED}" "$*" "${RST}" >&2; exit 1; }

on_error() {
  local rc=$? line=$1
  printf '\n%sFAILED at line %s (exit %s). Pipeline aborted — nothing further was run.%s\n\n' \
    "${RED}" "${line}" "${rc}" "${RST}" >&2
  exit "${rc}"
}
trap 'on_error ${LINENO}' ERR

# ── argument parsing ────────────────────────────────────────────────────────
DOSSIER_ARG=""
LANG_OPT="both"
FORCE=""
PREFLIGHT_ONLY=0
SKIP_QA=0

usage() { sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --lang)
      [ $# -ge 2 ] || die "--lang needs a value (si|ta|both)"
      LANG_OPT="$2"; shift 2 ;;
    --lang=*) LANG_OPT="${1#*=}"; shift ;;
    --force)  FORCE="--force"; shift ;;
    --preflight-only) PREFLIGHT_ONLY=1; shift ;;
    --skip-qa) SKIP_QA=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option: $1 (try --help)" ;;
    *)
      [ -z "${DOSSIER_ARG}" ] || die "only one dossier path may be given"
      DOSSIER_ARG="$1"; shift ;;
  esac
done

[ -n "${DOSSIER_ARG}" ] || { usage; die "no dossier path given"; }

case "${LANG_OPT}" in
  si|ta|both) ;;
  *) die "--lang must be si, ta or both (got '${LANG_OPT}')" ;;
esac

if [ "${LANG_OPT}" = "both" ]; then
  LANGS=(si ta)
else
  LANGS=("${LANG_OPT}")
fi

# ── resolve the dossier index.html ──────────────────────────────────────────
if [ -d "${DOSSIER_ARG}" ]; then
  HTML="${DOSSIER_ARG%/}/index.html"
else
  HTML="${DOSSIER_ARG}"
fi
[ -f "${HTML}" ] || die "dossier HTML not found: ${HTML}"
HTML="$(cd -- "$(dirname -- "${HTML}")" && pwd)/$(basename -- "${HTML}")"

[ -f "${PIPELINE}" ]  || die "missing pipeline script: ${PIPELINE}"
[ -f "${QA_SCRIPT}" ] || die "missing QA script: ${QA_SCRIPT}"

# ── virtualenv ──────────────────────────────────────────────────────────────
step "Environment"
if [ -n "${VIRTUAL_ENV:-}" ]; then
  info "virtualenv already active: ${VIRTUAL_ENV}"
else
  [ -f "${VENV_DIR}/bin/activate" ] || die \
"translation virtualenv not found at ${VENV_DIR}

  Create it once with:
    python3 -m venv ${VENV_DIR}
    ${VENV_DIR}/bin/pip install beautifulsoup4 lxml requests"
  # shellcheck disable=SC1091
  . "${VENV_DIR}/bin/activate"
  info "activated ${VIRTUAL_ENV}"
fi

PY="$(command -v python3)"
info "python: ${PY}"
"${PY}" - <<'PYEOF' || die "virtualenv is missing dependencies — run: pip install beautifulsoup4 lxml requests"
import sys
missing = []
for mod in ("bs4", "lxml", "requests"):
    try:
        __import__(mod)
    except ImportError:
        missing.append(mod)
if missing:
    print("    missing python modules: " + ", ".join(missing))
    sys.exit(1)
print("    deps ok: beautifulsoup4, lxml, requests")
PYEOF

# ── credentials ─────────────────────────────────────────────────────────────
if [ -z "${GOOGLE_TRANSLATE_API_KEY:-}" ]; then
  die "GOOGLE_TRANSLATE_API_KEY is not set.

  The Cloud Translation key lives in GCP project ${EXPECTED_PROJECT} (\"Yan News\",
  billed to Yan Rides, org dgtl.lk). The key is named \"Yan News\" and is
  restricted to the Cloud Translation API. The old 'warenyan' project is retired —
  its billing account is CLOSED, which is what broke the pipeline originally.

  Export it (never commit it, never paste it into a file):
    export GOOGLE_TRANSLATE_API_KEY='…'
    export GOOGLE_CLOUD_PROJECT='${EXPECTED_PROJECT}'"
fi

if [ -z "${GOOGLE_CLOUD_PROJECT:-}" ]; then
  die "GOOGLE_CLOUD_PROJECT is not set.

  Export the current project:
    export GOOGLE_CLOUD_PROJECT='${EXPECTED_PROJECT}'"
fi

if [ "${GOOGLE_CLOUD_PROJECT}" != "${EXPECTED_PROJECT}" ]; then
  warn "GOOGLE_CLOUD_PROJECT is '${GOOGLE_CLOUD_PROJECT}', expected '${EXPECTED_PROJECT}'."
  warn "If this is the retired 'warenyan' project the run WILL fail (billing closed)."
fi

# Key length only — the value itself is never printed.
info "API key: present (${#GOOGLE_TRANSLATE_API_KEY} chars, value not shown)"
info "project: ${GOOGLE_CLOUD_PROJECT}"
info "dossier: ${HTML}"
info "targets: ${LANGS[*]}${FORCE:+  (force re-translate)}"

cd "${REPO_ROOT}"

# ── 1. preflight: dry run per language (no API call, no spend) ──────────────
for lang in "${LANGS[@]}"; do
  step "Preflight dry run — ${lang}"
  "${PY}" "${PIPELINE}" translate "${HTML}" --dry-run --target-lang "${lang}"
done

if [ "${PREFLIGHT_ONLY}" -eq 1 ]; then
  step "Preflight only — stopping before any API call"
  exit 0
fi

# ── 2. translate ────────────────────────────────────────────────────────────
for lang in "${LANGS[@]}"; do
  step "Translate — ${lang}"
  # shellcheck disable=SC2086
  "${PY}" "${PIPELINE}" translate "${HTML}" --target-lang "${lang}" ${FORCE}
done

# ── 3. review pages ─────────────────────────────────────────────────────────
for lang in "${LANGS[@]}"; do
  step "Side-by-side review page — ${lang}"
  "${PY}" "${PIPELINE}" review "${HTML}" --target-lang "${lang}"
done

# ── 4. pipeline's own QA test ───────────────────────────────────────────────
for lang in "${LANGS[@]}"; do
  step "Pipeline QA test — ${lang}"
  "${PY}" "${PIPELINE}" test "${HTML}" --target-lang "${lang}"
done

# ── 5. final gate: automated QA ─────────────────────────────────────────────
if [ "${SKIP_QA}" -eq 1 ]; then
  warn "--skip-qa given: the QA gate did NOT run. This output is not publishable."
  exit 0
fi

QA_RC=0
for lang in "${LANGS[@]}"; do
  step "QA GATE — ${lang}"
  # Do not let the ERR trap swallow the gate: collect the result, report all
  # languages, then fail once at the end.
  if ! "${PY}" "${QA_SCRIPT}" "${HTML}" --lang "${lang}"; then
    QA_RC=1
  fi
done

if [ "${QA_RC}" -ne 0 ]; then
  printf '\n%sQA GATE FAILED — do not publish. See docs/translation-runbook.md.%s\n\n' \
    "${RED}" "${RST}" >&2
  exit 1
fi

printf '\n%sAll stages passed for: %s%s\n' "${GRN}" "${LANGS[*]}" "${RST}"
printf '    Reminder: headlines, deks and pull-quotes still need a HUMAN line.\n'
printf '    Machine output is a draft. Human review is mandatory before publish.\n\n'
