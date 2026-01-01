#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <region> <namespace> [tag]"
  echo "Example: $0 us-ashburn-1 mytenancy 2025.01.01"
  exit 1
fi

REGION="$1"
NAMESPACE="$2"
IMAGE_TAG="${3:-latest}"
REGISTRY="${REGION}.ocir.io/${NAMESPACE}"

FRONTEND_IMAGE="${REGISTRY}/moodify-frontend:${IMAGE_TAG}"
BACKEND_IMAGE="${REGISTRY}/moodify-backend:${IMAGE_TAG}"
AI_ML_IMAGE="${REGISTRY}/moodify-ai-ml:${IMAGE_TAG}"

DOCKER_BUILDKIT=1 docker build -t "${FRONTEND_IMAGE}" ./frontend
DOCKER_BUILDKIT=1 docker build -t "${BACKEND_IMAGE}" -f backend/Dockerfile .
DOCKER_BUILDKIT=1 docker build -t "${AI_ML_IMAGE}" -f ai_ml/Dockerfile .


docker push "${FRONTEND_IMAGE}"
docker push "${BACKEND_IMAGE}"
docker push "${AI_ML_IMAGE}"

printf '\nPushed images:\n- %s\n- %s\n- %s\n' "${FRONTEND_IMAGE}" "${BACKEND_IMAGE}" "${AI_ML_IMAGE}"
