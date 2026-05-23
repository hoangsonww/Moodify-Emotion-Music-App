#!/usr/bin/env bash
# =============================================================================
# Build + push Moodify images to OCIR
# =============================================================================
# Usage:
#   ./push-images.sh <region> <tenancy_namespace> [tag]
#
# Notes:
#   * Re-uses ./ocir-login.sh under the hood so credentials never leak.
#   * Pushes three images: frontend, backend, ai_ml (model service).
#   * Tags are baked from the git SHA when no tag is provided so each
#     pipeline run produces a deterministic, traceable artifact.
# =============================================================================
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ docker is not installed" >&2
  exit 1
fi

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <region> <tenancy_namespace> [tag]" >&2
  echo "Example: $0 us-ashburn-1 mytenancy 2026.05.23" >&2
  exit 1
fi

REGION="$1"
NAMESPACE="$2"
IMAGE_TAG="${3:-$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo latest)}"
REGISTRY="${REGION}.ocir.io/${NAMESPACE}"

FRONTEND_IMAGE="${REGISTRY}/moodify-frontend:${IMAGE_TAG}"
BACKEND_IMAGE="${REGISTRY}/moodify-backend:${IMAGE_TAG}"
AI_ML_IMAGE="${REGISTRY}/moodify-ai-ml:${IMAGE_TAG}"
NGINX_IMAGE="${REGISTRY}/moodify-nginx:${IMAGE_TAG}"

# --- Login ------------------------------------------------------------------
"${SCRIPT_DIR}/ocir-login.sh" "${REGION}" "${NAMESPACE}"

# --- Build ------------------------------------------------------------------
# BuildKit gives layer parallelism + better cache. Each image goes to its
# own platform tag so multi-arch pulls (linux/amd64 default) work cleanly.
export DOCKER_BUILDKIT=1
PLATFORM="${PLATFORM:-linux/amd64}"

echo "→ Building ${FRONTEND_IMAGE} (${PLATFORM})"
docker build --platform="${PLATFORM}" -t "${FRONTEND_IMAGE}" "${REPO_ROOT}/frontend"

echo "→ Building ${BACKEND_IMAGE} (${PLATFORM})"
docker build --platform="${PLATFORM}" -t "${BACKEND_IMAGE}" -f "${REPO_ROOT}/backend/Dockerfile" "${REPO_ROOT}"

echo "→ Building ${AI_ML_IMAGE} (${PLATFORM})"
docker build --platform="${PLATFORM}" -t "${AI_ML_IMAGE}" -f "${REPO_ROOT}/ai_ml/Dockerfile" "${REPO_ROOT}"

echo "→ Building ${NGINX_IMAGE} (${PLATFORM})"
docker build --platform="${PLATFORM}" -t "${NGINX_IMAGE}" -f "${REPO_ROOT}/nginx/Dockerfile" "${REPO_ROOT}/nginx"

# --- Push -------------------------------------------------------------------
for img in "${FRONTEND_IMAGE}" "${BACKEND_IMAGE}" "${AI_ML_IMAGE}" "${NGINX_IMAGE}"; do
  echo "→ Pushing ${img}"
  docker push "${img}"
done

cat <<EOF

✓ Pushed images:
  - ${FRONTEND_IMAGE}
  - ${BACKEND_IMAGE}
  - ${AI_ML_IMAGE}
  - ${NGINX_IMAGE}

To roll out:
  kubectl set image deploy/moodify-backend backend=${BACKEND_IMAGE} -n moodify
EOF
