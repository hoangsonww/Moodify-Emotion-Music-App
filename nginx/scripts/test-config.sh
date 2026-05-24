#!/usr/bin/env bash
# =============================================================================
# test-config.sh — `nginx -t` against the local config without running it
# =============================================================================
# Builds a throwaway container, mounts the repo's nginx/ tree, and runs
# `nginx -t`. Returns non-zero if any directive fails to parse.
# =============================================================================

set -euo pipefail

IMAGE="${IMAGE:-nginx:1.27-alpine}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo ">> nginx config syntax check (image=${IMAGE})"

docker run --rm \
  -v "${ROOT}/nginx.conf:/etc/nginx/conf.d/moodify.conf:ro" \
  -v "${ROOT}/snippets:/etc/nginx/snippets:ro" \
  "${IMAGE}" nginx -t -c /etc/nginx/nginx.conf

echo ">> config OK"
