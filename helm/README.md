# Moodify — Helm charts

Helm 3 charts for the self-hosted variant of Moodify. The canonical
production deploys to **Vercel + Modal**; this directory targets
Kubernetes clusters as an optional alternative.

```
helm/
├── moodify-backend/    Django backend chart (blue/green-aware, HPA, PDB, ingress, network policy)
└── monitoring/         Wrapper / values for kube-prometheus-stack (see terraform/modules/monitoring/)
```

## Quick start

```bash
# Add this repo as a local working chart (no chart museum needed).
helm dependency update helm/moodify-backend

# Lint + dry-render
helm lint helm/moodify-backend
helm template moodify helm/moodify-backend --namespace=moodify

# Install / upgrade
helm upgrade --install moodify helm/moodify-backend \
  --namespace=moodify --create-namespace \
  --values helm/moodify-backend/values.yaml \
  --set image.tag=$(git rev-parse --short HEAD)

# Status + history
helm status moodify -n moodify
helm history moodify -n moodify

# Roll back
helm rollback moodify -n moodify
```

Via the root Makefile:

```bash
make helm-lint
make helm-template
make helm-install
make helm-uninstall
```

## Chart anatomy

Every chart ships:

* `Chart.yaml` — metadata + version pinning
* `values.yaml` — every knob with sane prod defaults
* `templates/` — rendered K8s objects
  * `_helpers.tpl` — common label / name helpers
  * `deployment.yaml` — workload (blue + green pair when `blueGreen.enabled`)
  * `service.yaml` — ClusterIP, selector flips with `blueGreen.activeEnvironment`
  * `serviceaccount.yaml` — non-mounted SA, IRSA-ready
  * `configmap.yaml` — non-secret env
  * `hpa.yaml` — CPU + memory + custom metrics
  * `pdb.yaml` — minAvailable: 2 by default
  * `ingress.yaml` — ingress-nginx + cert-manager
  * `networkpolicy.yaml` — egress allow-list (Mongo, Redis, HTTPS)
  * `NOTES.txt` — post-install message

## Per-env values

Use the standard Helm pattern of base + override:

```bash
helm upgrade --install moodify helm/moodify-backend \
  --namespace moodify-prod --create-namespace \
  --values helm/moodify-backend/values.yaml \
  --values helm/moodify-backend/values-production.yaml \
  --set image.tag=v1.2.3
```

The repo doesn't ship per-env values files by design — checking in
production sizing alongside dev sizing tempts copy-paste mistakes.
Generate them from terraform outputs or `kustomize` instead.

## See also

* [`../kubernetes/`](../kubernetes/) — raw manifests (alt path)
* [`../argocd/`](../argocd/) — GitOps wrapper around this chart
* [`../scripts/deployment/`](../scripts/deployment/) — blue/green + canary scripts
