#!/usr/bin/env bash
# =============================================================================
# reload.sh — graceful zero-downtime reload
# =============================================================================
# Validates the config first; only sends SIGHUP if `nginx -t` passes. Use after
# rotating certs, editing snippets, or swapping upstream lists.
# =============================================================================

set -euo pipefail

CONTAINER="${CONTAINER:-moodify-nginx}"

echo ">> validating config inside ${CONTAINER}"
docker exec "${CONTAINER}" nginx -t

echo ">> sending SIGHUP (graceful reload)"
docker exec "${CONTAINER}" nginx -s reload

echo ">> reload complete"
