#!/usr/bin/env bash
# =============================================================================
# Local mirror of the Jenkins CI/CD pipeline
# =============================================================================
# Lets you reproduce the Jenkins pipeline on a developer laptop or any
# generic Linux runner. Each "stage" mirrors a Jenkins `stage { steps {} }`
# block; failure in any stage aborts the run with the same non-zero exit
# code Jenkins would surface.
#
# Usage:
#   ./jenkins_cicd.sh                      # full pipeline
#   ./jenkins_cicd.sh lint test            # only the listed stages
#   STAGES="install,test,build" ./jenkins_cicd.sh
#
# Available stages (in canonical order):
#   tooling install lint security test test-coverage build docker e2e perf-smoke
# =============================================================================
set -euo pipefail

# ---- Pretty printing ------------------------------------------------------
if [[ -t 1 ]]; then
  GREEN=$'\033[0;32m'; YEL=$'\033[0;33m'; RED=$'\033[0;31m'; DIM=$'\033[2m'; NC=$'\033[0m'
else
  GREEN=""; YEL=""; RED=""; DIM=""; NC=""
fi

print_stage() {
  printf '\n%s── %s ──%s\n' "${GREEN}" "$1" "${NC}"
}
fail() {
  printf '%s✗ %s%s\n' "${RED}" "$1" "${NC}" >&2
  exit 1
}
section_start=$EPOCHREALTIME
section_done() {
  local end=$EPOCHREALTIME
  local elapsed
  elapsed=$(awk "BEGIN {printf \"%.2f\", ${end} - ${section_start}}")
  printf '%s   ✓ done in %ss%s\n' "${DIM}" "${elapsed}" "${NC}"
  section_start=$EPOCHREALTIME
}

# ---- Project layout -------------------------------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="${ROOT}/frontend"
BACKEND="${ROOT}/backend"
MODAL="${ROOT}/modal_inference"
MOBILE="${ROOT}/mobile"

# ---- Stage selection ------------------------------------------------------
ALL_STAGES=(tooling install lint security test test-coverage build docker e2e perf-smoke)
if [[ $# -gt 0 ]]; then
  IFS=',' read -ra REQUESTED <<< "$*"
elif [[ -n "${STAGES:-}" ]]; then
  IFS=',' read -ra REQUESTED <<< "${STAGES}"
else
  REQUESTED=("${ALL_STAGES[@]}")
fi

# ---- Helpers --------------------------------------------------------------
should_run() {
  local s="$1"
  for r in "${REQUESTED[@]}"; do [[ "${r// /}" == "${s}" ]] && return 0; done
  return 1
}
have() { command -v "$1" >/dev/null 2>&1; }

# ---- Stages ---------------------------------------------------------------
if should_run tooling; then
  print_stage "Stage 1: Toolchain check"
  for t in git node npm python3 jq curl docker; do
    have "$t" || fail "missing required tool: $t"
  done
  printf '  node=%s npm=%s python=%s docker=%s\n' \
    "$(node -v)" "$(npm -v)" "$(python3 --version 2>&1)" "$(docker --version 2>&1)"
  section_done
fi

if should_run install; then
  print_stage "Stage 2: Install dependencies"
  ( cd "${FRONTEND}" && npm ci --no-audit --no-fund ) || fail "frontend install failed"
  ( cd "${MOBILE}"   && npm ci --no-audit --no-fund ) || fail "mobile install failed"
  ( cd "${BACKEND}"  && python3 -m venv .venv && . .venv/bin/activate && pip install -q -U pip && pip install -q -r requirements.txt ) \
    || fail "backend install failed"
  ( cd "${MODAL}"    && python3 -m venv .venv && . .venv/bin/activate && pip install -q -U pip && pip install -q -r requirements-dev.txt ) \
    || fail "modal install failed"
  section_done
fi

if should_run lint; then
  print_stage "Stage 3: Lint"
  ( cd "${FRONTEND}" && npx --yes eslint --max-warnings=0 src ) || fail "eslint failed"
  ( cd "${BACKEND}"  && . .venv/bin/activate && ruff check . )  || fail "backend lint failed"
  ( cd "${MODAL}"    && . .venv/bin/activate && ruff check . )  || fail "modal lint failed"
  section_done
fi

if should_run security; then
  print_stage "Stage 4: Security scan (best-effort)"
  ( cd "${FRONTEND}" && npm audit --omit=dev --audit-level=high ) || printf '%s  npm audit returned findings — review.%s\n' "${YEL}" "${NC}"
  ( cd "${BACKEND}"  && . .venv/bin/activate && pip install -q pip-audit && pip-audit ) \
    || printf '%s  pip-audit returned findings — review.%s\n' "${YEL}" "${NC}"
  if have trivy; then
    trivy fs --severity HIGH,CRITICAL --exit-code 0 "${ROOT}" || true
  fi
  section_done
fi

if should_run test; then
  print_stage "Stage 5: Tests"
  ( cd "${FRONTEND}" && CI=true npm test -- --watchAll=false ) || fail "frontend tests failed"
  ( cd "${MODAL}"    && . .venv/bin/activate && pytest -q )    || fail "modal tests failed"
  # backend django tests are run inside the modal venv image in CI; skip
  # locally unless explicitly opted in via RUN_DJANGO_TESTS=1.
  if [[ "${RUN_DJANGO_TESTS:-0}" == "1" ]]; then
    ( cd "${BACKEND}" && . .venv/bin/activate && python manage.py test --noinput ) || fail "backend tests failed"
  fi
  section_done
fi

if should_run test-coverage; then
  print_stage "Stage 6: Frontend coverage"
  ( cd "${FRONTEND}" && CI=true npm test -- --coverage --watchAll=false ) || fail "coverage failed"
  section_done
fi

if should_run build; then
  print_stage "Stage 7: Build frontend production bundle"
  ( cd "${FRONTEND}" && npm run build ) || fail "frontend build failed"
  section_done
fi

if should_run docker; then
  print_stage "Stage 8: Docker image builds"
  GIT_SHA=$(git -C "${ROOT}" rev-parse --short HEAD)
  REGISTRY="${REGISTRY:-ghcr.io/hoangsonww}"
  docker build -t "${REGISTRY}/moodify-backend:${GIT_SHA}"  -f "${BACKEND}/Dockerfile"  "${BACKEND}"  || fail "backend image build failed"
  docker build -t "${REGISTRY}/moodify-frontend:${GIT_SHA}" -f "${FRONTEND}/Dockerfile" "${FRONTEND}" || fail "frontend image build failed"
  docker build -t "${REGISTRY}/moodify-nginx:${GIT_SHA}"    -f "${ROOT}/nginx/Dockerfile" "${ROOT}/nginx" || fail "nginx image build failed"
  section_done
fi

if should_run e2e; then
  print_stage "Stage 9: e2e (placeholder — wire to playwright/cypress)"
  printf '%s  e2e stage not yet wired up; falling through.%s\n' "${YEL}" "${NC}"
  section_done
fi

if should_run perf-smoke; then
  print_stage "Stage 10: k6 smoke test"
  if have k6; then
    k6 run "${ROOT}/performance-tests/smoke-test.js"
  else
    printf '%s  k6 not installed — skipping. Install: brew install k6%s\n' "${YEL}" "${NC}"
  fi
  section_done
fi

printf '\n%s✓ Pipeline completed successfully.%s\n' "${GREEN}" "${NC}"
