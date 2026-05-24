# Argo CD — GitOps for Moodify

Continuous deployment via [Argo CD](https://argo-cd.readthedocs.io/).
The cluster watches this repo and reconciles every change in
`argocd/applications/` automatically. No `kubectl apply` from
developer laptops, no drift between Git and the cluster.

```
argocd/
├── install-argocd.yaml          install Argo CD itself (namespace, CRDs, server, repo-server, controller)
└── applications/
    └── moodify-backend.yaml     Application that points at helm/moodify-backend
```

## Install Argo CD

```bash
kubectl apply -f install-argocd.yaml

# Wait for it to come up
kubectl wait --for=condition=Available --timeout=300s \
  deployment/argocd-server -n argocd

# Initial admin password (delete after rotating)
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d

# Port-forward to the UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
# → open https://localhost:8080 (user: admin)
```

## Register the Moodify application

```bash
kubectl apply -f applications/moodify-backend.yaml
```

This `Application` points at `helm/moodify-backend` in this repo and
syncs into the `moodify` namespace. Argo CD will:

* Detect drift (something changed in the cluster but not Git).
* Detect a Git change and apply it.
* Run `kubectl apply --prune` so removed resources actually disappear.
* Report health (degraded / progressing / healthy / missing).

## Sync policy

Default policy in `applications/moodify-backend.yaml`:

```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
  syncOptions:
    - CreateNamespace=true
    - PruneLast=true
    - ApplyOutOfSyncOnly=true
  retry:
    limit: 5
    backoff:
      duration: 5s
      factor: 2
      maxDuration: 3m
```

* **prune** — drop removed resources.
* **selfHeal** — auto-revert manual `kubectl` edits.
* Disable for break-glass mode by deleting the `automated` block.

## Progressive delivery (optional)

For canary or blue/green via Argo CD, add
[Argo Rollouts](https://argoproj.github.io/argo-rollouts/) on top:

```bash
kubectl apply -n argocd \
  -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
```

Then swap the Helm chart's `Deployment` for `Rollout` (the upstream
`argo-rollouts` Helm sub-chart can do this seamlessly).

## CLI

```bash
# Status
argocd app get moodify-backend

# Force a sync
argocd app sync moodify-backend

# Watch sync progress
argocd app wait moodify-backend --timeout 300

# Diff before sync
argocd app diff moodify-backend
```

Via the root Makefile:

```bash
make argocd-install
make argocd-sync
make argocd-status
```
