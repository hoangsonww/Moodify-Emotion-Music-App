#!/usr/bin/env bash
# =============================================================================
# Authenticate Docker against OCI Container Registry (OCIR)
# =============================================================================
# Usage:
#   ./ocir-login.sh <region> <tenancy_namespace>
#
# Env:
#   OCI_USERNAME    OCIR user (typically <tenancy>/<username> or an IAM user)
#   OCI_AUTH_TOKEN  OCI auth token (NOT your console password)
# =============================================================================
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ docker is not installed" >&2
  exit 1
fi

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <region> <tenancy_namespace>" >&2
  echo "Example: $0 us-ashburn-1 mytenancy" >&2
  exit 1
fi

REGION="$1"
NAMESPACE="$2"
REGISTRY="${REGION}.ocir.io"

if [[ -z "${OCI_USERNAME:-}" || -z "${OCI_AUTH_TOKEN:-}" ]]; then
  cat >&2 <<EOF
✗ OCI_USERNAME and OCI_AUTH_TOKEN must be set.
  Generate an auth token at: Console → User Settings → Auth Tokens
EOF
  exit 1
fi

# Use stdin to avoid leaking the token into shell history / ps output.
printf '%s' "${OCI_AUTH_TOKEN}" | docker login "${REGISTRY}" \
  -u "${NAMESPACE}/${OCI_USERNAME}" --password-stdin

echo "✓ Logged into ${REGISTRY} as ${NAMESPACE}/${OCI_USERNAME}"
