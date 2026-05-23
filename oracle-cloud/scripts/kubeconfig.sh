#!/usr/bin/env bash
# =============================================================================
# Generate / refresh kubeconfig for an OKE cluster
# =============================================================================
# Usage:
#   ./kubeconfig.sh <cluster_ocid> [kubeconfig_path]
#
# Env:
#   OCI_REGION     Required when kubeconfig context needs a region (default
#                  inherited from the OCI CLI profile).
#   OCI_PROFILE    Optional OCI CLI profile name (defaults to DEFAULT).
# =============================================================================
set -euo pipefail

if ! command -v oci >/dev/null 2>&1; then
  echo "✗ oci CLI not installed. See https://docs.oracle.com/iaas/Content/API/SDKDocs/cliinstall.htm" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <cluster_ocid> [kubeconfig_path]" >&2
  echo "Example: $0 ocid1.cluster.oc1.iad.xxxx" >&2
  exit 1
fi

CLUSTER_ID="$1"
KUBECONFIG_PATH="${2:-${HOME}/.kube/config}"
REGION_ARG=()
[[ -n "${OCI_REGION:-}" ]] && REGION_ARG=(--region "${OCI_REGION}")
PROFILE_ARG=()
[[ -n "${OCI_PROFILE:-}" ]] && PROFILE_ARG=(--profile "${OCI_PROFILE}")

# Make sure the parent dir exists (oci CLI doesn't mkdir).
mkdir -p "$(dirname "${KUBECONFIG_PATH}")"

# Back up an existing kubeconfig — never silently overwrite.
if [[ -f "${KUBECONFIG_PATH}" ]]; then
  BACKUP="${KUBECONFIG_PATH}.bak.$(date +%Y%m%d-%H%M%S)"
  cp -p "${KUBECONFIG_PATH}" "${BACKUP}"
  echo "→ Backed up existing kubeconfig to ${BACKUP}"
fi

oci ce cluster create-kubeconfig \
  "${PROFILE_ARG[@]}" "${REGION_ARG[@]}" \
  --cluster-id "${CLUSTER_ID}" \
  --file "${KUBECONFIG_PATH}" \
  --kube-endpoint PUBLIC_ENDPOINT \
  --token-version 2.0.0

chmod 600 "${KUBECONFIG_PATH}"
echo "✓ Kubeconfig written to ${KUBECONFIG_PATH}"

# Verify connectivity with a single API call.
if command -v kubectl >/dev/null 2>&1; then
  echo "→ Verifying cluster connectivity…"
  if KUBECONFIG="${KUBECONFIG_PATH}" kubectl cluster-info --request-timeout=10s >/dev/null 2>&1; then
    echo "✓ kubectl can reach the cluster"
  else
    echo "✗ kubectl could not reach the cluster — check OCI auth + network ACLs" >&2
    exit 2
  fi
fi
