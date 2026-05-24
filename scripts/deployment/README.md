# Moodify deployment scripts

K8s-native deployment runbooks expressed as portable Bash. All four
scripts target a Kubernetes cluster (any provider) and consume the
manifests in `../../kubernetes/` + the Helm chart in `../../helm/`.

| Script               | Strategy        | Typical wall-clock | Reverts via             |
| -------------------- | --------------- | ------------------ | ----------------------- |
| `blue-green-deploy.sh` | Blue / green   | 5–15 min           | `rollback.sh -t blue-green` |
| `canary-deploy.sh`     | Canary 10→100% | 15–40 min          | `rollback.sh -t canary`     |
| `rollback.sh`          | Generic         | < 1 min            | (this script IS the rollback) |
| `smoke-tests.sh`       | Post-deploy probe | < 30 s          | n/a                          |

## Common env vars

| Var                     | Default            | Description                                 |
| ----------------------- | ------------------ | ------------------------------------------- |
| `KUBE_CONTEXT`          | current kubectl ctx | Kubectl context to use                      |
| `NAMESPACE`             | `moodify`          | Target K8s namespace                        |
| `IMAGE_TAG`             | latest git SHA      | Image tag to roll out                       |
| `REGISTRY`              | `ghcr.io/hoangsonww` | Container registry                         |
| `HEALTH_TIMEOUT_SECS`   | `120`              | How long to wait for the deployment to go Ready |
| `CANARY_STAGES`         | `10,25,50,100`     | Canary traffic-shift schedule (%)           |
| `DRY_RUN`               | `false`            | Print kubectl/helm commands without executing |

Each script also prints its own `--help` (`./blue-green-deploy.sh -h`).

## Blue / green

```bash
./blue-green-deploy.sh \
  --image ghcr.io/hoangsonww/moodify-backend:abc123 \
  --namespace moodify-prod
```

Steps:

1. Compute current active color from the service selector.
2. Deploy the *other* color with the new image.
3. Wait for the new deployment to go Ready (`HEALTH_TIMEOUT_SECS`).
4. Run smoke tests against the inactive color's preview service.
5. Flip the production service selector to the new color.
6. Leave the old color running for fast rollback.

## Canary

```bash
./canary-deploy.sh \
  --image ghcr.io/hoangsonww/moodify-backend:abc123 \
  --stages 5,10,25,50,100
```

Steps:

1. Deploy the canary version into its own deployment.
2. Wait for canary pods to go Ready.
3. For each stage in `--stages`:
   * Update the ingress `nginx.ingress.kubernetes.io/canary-weight`.
   * Soak for `STAGE_SOAK_SECS` (default 120 s).
   * Check error rate + p95 latency from Prometheus; abort + rollback if
     either breaches threshold.
4. At 100 %, promote canary into the stable deployment.

## Rollback

```bash
# Quick revert of the latest blue/green flip
./rollback.sh --type blue-green

# Revert a canary mid-rollout
./rollback.sh --type canary

# Roll back to a specific previous revision
./rollback.sh --type version --version abc123
```

## Smoke tests

```bash
./smoke-tests.sh production
./smoke-tests.sh canary
./smoke-tests.sh staging
```

Hits the canonical health endpoints + a couple of read-only API routes
and exits non-zero on any failure. Designed to be safe to run against
production at any cadence.

## Failure handling

Every script is wrapped with `trap` on `ERR` + `EXIT` and prints the
last failing command + a tail of pod logs before exiting non-zero.
Long-running operations use `kubectl rollout status --watch` so they
fail fast on bad images instead of polling forever.

## See also

* [`../../kubernetes/`](../../kubernetes/) — raw deployment manifests
* [`../../helm/moodify-backend/`](../../helm/moodify-backend/) — Helm chart
* [`../../argocd/`](../../argocd/) — GitOps alternative
* [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md) — end-to-end deploy guide
