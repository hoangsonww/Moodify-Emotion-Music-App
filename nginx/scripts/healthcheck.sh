#!/usr/bin/env bash
# =============================================================================
# healthcheck.sh — external probe runner for the edge
# =============================================================================
# Hits /healthz from outside the container, checks status + body, and verifies
# TLS expiry. Exit 0 = healthy, 1 = degraded, 2 = down.
#
#   ./scripts/healthcheck.sh https://moodify.example.com
# =============================================================================

set -euo pipefail

URL="${1:-https://localhost}"
WARN_DAYS="${WARN_DAYS:-14}"

echo ">> probing ${URL}/healthz"
status=$(curl -k -s -o /tmp/hc-body -w '%{http_code}' "${URL}/healthz" || echo "000")
body=$(cat /tmp/hc-body 2>/dev/null || true)

if [[ "${status}" != "200" ]]; then
  echo "FAIL: status=${status} body=${body}"
  exit 2
fi
if [[ "${body}" != *"ok"* ]]; then
  echo "FAIL: unexpected body=${body}"
  exit 2
fi

# TLS expiry — skip for plain HTTP.
if [[ "${URL}" == https://* ]]; then
  host=$(printf '%s' "${URL}" | sed -E 's|https?://([^/:]+).*|\1|')
  port=$(printf '%s' "${URL}" | sed -E 's|https?://[^/:]+:?([0-9]*)/.*|\1|')
  port="${port:-443}"

  expiry=$(echo | openssl s_client -connect "${host}:${port}" -servername "${host}" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null \
    | sed 's/notAfter=//') || expiry=""

  if [[ -n "${expiry}" ]]; then
    expiry_epoch=$(date -d "${expiry}" +%s 2>/dev/null || date -j -f '%b %e %H:%M:%S %Y %Z' "${expiry}" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
    days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
    echo ">> cert valid ${days_left}d (warn at ${WARN_DAYS}d)"
    if [[ "${days_left}" -lt "${WARN_DAYS}" ]]; then
      echo "WARN: cert expires in ${days_left} days"
      exit 1
    fi
  fi
fi

echo "OK"
exit 0
