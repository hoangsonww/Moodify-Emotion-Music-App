#!/usr/bin/env bash
# =============================================================================
# maintenance.sh — toggle drain mode
# =============================================================================
# Touches/removes /etc/nginx/maintenance.flag inside the container. When the
# flag is present and snippets/maintenance.conf is included, the edge returns
# 503 with a static maintenance page.
#
#   ./scripts/maintenance.sh on     # start drain
#   ./scripts/maintenance.sh off    # resume traffic
#   ./scripts/maintenance.sh status # show current state
# =============================================================================

set -euo pipefail

CONTAINER="${CONTAINER:-moodify-nginx}"
FLAG="/etc/nginx/maintenance.flag"
ACTION="${1:-status}"

case "${ACTION}" in
  on)
    docker exec "${CONTAINER}" sh -c "touch ${FLAG}"
    docker exec "${CONTAINER}" nginx -s reload
    echo ">> maintenance ON"
    ;;
  off)
    docker exec "${CONTAINER}" sh -c "rm -f ${FLAG}"
    docker exec "${CONTAINER}" nginx -s reload
    echo ">> maintenance OFF"
    ;;
  status)
    if docker exec "${CONTAINER}" sh -c "test -f ${FLAG}"; then
      echo "maintenance: ON"
    else
      echo "maintenance: OFF"
    fi
    ;;
  *)
    echo "usage: $0 {on|off|status}" >&2
    exit 64
    ;;
esac
