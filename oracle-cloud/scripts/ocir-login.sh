#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <region> <namespace>"
  echo "Example: $0 us-ashburn-1 mytenancy"
  exit 1
fi

REGION="$1"
NAMESPACE="$2"

if [[ -z "${OCI_USERNAME:-}" || -z "${OCI_AUTH_TOKEN:-}" ]]; then
  echo "OCI_USERNAME and OCI_AUTH_TOKEN must be set for OCIR login."
  exit 1
fi

docker login "${REGION}.ocir.io" -u "${NAMESPACE}/${OCI_USERNAME}" -p "${OCI_AUTH_TOKEN}"
