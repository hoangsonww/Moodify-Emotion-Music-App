#!/usr/bin/env bash
# =============================================================================
# renew-certs.sh — Let's Encrypt renewal + nginx reload
# =============================================================================
# Intended for cron / systemd timer. Renews certificates with certbot in webroot
# mode (no nginx restart needed) and reloads nginx if a cert changed.
#
#   0 3 * * * /opt/moodify/nginx/scripts/renew-certs.sh >> /var/log/renew.log 2>&1
# =============================================================================

set -euo pipefail

WEBROOT="${WEBROOT:-/var/www/certbot}"
CONTAINER="${CONTAINER:-moodify-nginx}"
CERT_DIR="${CERT_DIR:-/etc/letsencrypt/live}"

echo ">> [$(date -u +%FT%TZ)] running certbot renewal"
certbot renew \
  --webroot --webroot-path "${WEBROOT}" \
  --quiet \
  --deploy-hook "/bin/touch ${CERT_DIR}/.renewed"

if [[ -f "${CERT_DIR}/.renewed" ]]; then
  echo ">> cert changed — reloading nginx"
  rm -f "${CERT_DIR}/.renewed"
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}\$"; then
    docker exec "${CONTAINER}" nginx -s reload
  else
    nginx -s reload
  fi
  echo ">> reload complete"
else
  echo ">> no cert changes"
fi
