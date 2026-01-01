#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <cluster_ocid> [kubeconfig_path]"
  exit 1
fi

CLUSTER_ID="$1"
KUBECONFIG_PATH="${2:-$HOME/.kube/config}"

oci ce cluster create-kubeconfig \
  --cluster-id "${CLUSTER_ID}" \
  --file "${KUBECONFIG_PATH}" \
  --region "${OCI_REGION:-}"

printf '\nKubeconfig written to %s\n' "${KUBECONFIG_PATH}"
