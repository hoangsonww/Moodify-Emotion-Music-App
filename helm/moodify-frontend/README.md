# `helm/moodify-frontend/` — React SPA chart

Installs the Moodify React SPA on Kubernetes when you can't (or won't) use
Vercel. The chart packages the `nginx`-based image built from
`frontend/web/Dockerfile`, mounts a runtime-configurable `env.js`, and
ships sensible production defaults (HA replicas, PDB, HPA, hardened
securityContext, Ingress + cert-manager).

## When to install

| Scenario | Use this chart? |
| --- | --- |
| Default production (Vercel) | No |
| Self-host on Kubernetes | Yes |
| Air-gapped on-prem deploy | Yes |
| Local minikube smoke test | Yes (override `ingress.enabled=false`) |

## Quick start

```bash
helm upgrade --install moodify-frontend helm/moodify-frontend \
  -n moodify --create-namespace \
  --set image.tag=$(git rev-parse --short HEAD) \
  --set runtimeConfig.REACT_APP_BACKEND_URL=https://api.moodify.example.com
```

`make helm-install-frontend` (top-level Makefile) wraps the same command.

## Runtime config without rebuilds

`templates/configmap.yaml` mounts an `env.js` file into the nginx html dir.
At browser load the SPA reads `window.__env.<KEY>` instead of build-time
`process.env`. Change `runtimeConfig.*` in values.yaml and roll the
Deployment to swap URLs across environments using one image.

```yaml
runtimeConfig:
  REACT_APP_BACKEND_URL: "https://api.moodify.example.com"
  REACT_APP_MODAL_URL:   "https://hoangsonww--moodify-inference-inferenceservice-web.modal.run"
  REACT_APP_ENVIRONMENT: "production"
```

## Hardening defaults

* `readOnlyRootFilesystem: true` plus `emptyDirs` for nginx cache/run/tmp
* Drops all capabilities; runs as UID 101 (nginx-alpine)
* Pod anti-affinity preferred across nodes
* PDB requires `minAvailable: 2` so a node drain can't take the SPA down
* Liveness + readiness + startup probes all hit `/healthz`
* `automountServiceAccountToken: false` (SPA never calls the K8s API)

## Companion charts

* [`../moodify-backend/`](../moodify-backend/) — Django API + blue/green
* [`../monitoring/`](../monitoring/) — Prometheus + Grafana + Loki + Tempo

For the canonical Vercel path see [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md).
