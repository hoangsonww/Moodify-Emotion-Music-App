# Canary deployment manifests

Gradual traffic-shift deployment strategy. The canary deployment carries
a small percentage of traffic; if metrics stay healthy we increase the
weight in stages until the canary is the new stable.

## Files

| File                            | Purpose                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| `backend-canary.yaml`           | Canary Deployment + HPA + PDB (labels: `track: canary`)        |
| `istio-traffic-split.yaml`      | Istio VirtualService + DestinationRule for L7 traffic split    |
| `nginx-ingress-canary.yaml`     | ingress-nginx canary annotations alternative (no Istio needed) |

## Two flavors

* **Istio path** (`istio-traffic-split.yaml`) — DestinationRule defines
  `stable` + `canary` subsets, VirtualService splits weight at L7. Best
  for clusters that already run Istio service mesh.
* **ingress-nginx path** (`nginx-ingress-canary.yaml`) — A second Ingress
  resource gets the `nginx.ingress.kubernetes.io/canary: "true"` +
  `canary-weight` annotations, sending N % to the canary backend. Best
  for clusters that just have ingress-nginx and no mesh.

Pick one — applying both at the same time is not supported.

## Default rollout schedule

| Stage | Weight | Soak | Abort criteria                            |
| ----- | ------ | ---- | ----------------------------------------- |
| 0     | 10 %   | 5 m  | error_rate > 2 % OR p95 > 2 × stable       |
| 1     | 25 %   | 10 m | same                                      |
| 2     | 50 %   | 15 m | same                                      |
| 3     | 100 %  | n/a  | promote canary → stable, delete old replica set |

Override via `CANARY_STAGES=5,15,40,100` env on the deploy script.

## Driven by the deploy script

```bash
make deploy-canary IMAGE_TAG=$(git rev-parse --short HEAD)
```

`scripts/deployment/canary-deploy.sh` orchestrates the stage progression,
polls Prometheus for the abort criteria, and either promotes the canary
into the stable deployment or rolls back automatically.

## When to use

| Use it when                                           | Skip it when                              |
| ----------------------------------------------------- | ----------------------------------------- |
| Risky change you want to ramp slowly                  | Single-AZ / single-pod clusters           |
| You have Prometheus metrics for SLO-based abort gates | Schema/contract changes (use blue/green)  |
| Customer impact must be bounded to a tiny %           | One-pod workloads (no meaningful split)   |

## See also

* [`../blue-green/`](../blue-green/) — atomic cutover alternative
* [`../../scripts/deployment/canary-deploy.sh`](../../scripts/deployment/canary-deploy.sh)
* [`../../argocd/`](../../argocd/) — GitOps + canary via Argo Rollouts
