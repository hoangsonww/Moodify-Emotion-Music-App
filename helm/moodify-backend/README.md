# moodify-backend Helm chart

Production-grade Helm chart for the Moodify Django backend. Supports
blue/green deployment, HPA, PDB, ingress (cert-manager + ingress-nginx),
network policies, custom-metric autoscaling, and ServiceMonitor +
PrometheusRule out-of-the-box.

## Install

```bash
helm upgrade --install moodify . \
  --namespace=moodify --create-namespace \
  --set image.tag=$(git rev-parse --short HEAD)
```

## Values

Every knob lives in [`values.yaml`](values.yaml). Highlights:

| Key                              | Default                              | Notes                                         |
| -------------------------------- | ------------------------------------ | --------------------------------------------- |
| `image.repository`               | `moodify/backend`                    | Override with your registry path              |
| `image.tag`                      | `latest`                             | Pass git SHA in CI                            |
| `replicaCount`                   | `3`                                  | Initial replica count                         |
| `blueGreen.enabled`              | `true`                               | Spin both color Deployments side-by-side      |
| `blueGreen.activeEnvironment`    | `blue`                               | Flip to `green` to swap traffic               |
| `autoscaling.enabled`            | `true`                               | HPA min 3 / max 15, CPU 70 % / mem 80 %        |
| `podDisruptionBudget.minAvailable` | `2`                                | Survives single-AZ outage                     |
| `service.port`                   | `8000`                               | Container port                                |
| `ingress.enabled`                | `true`                               | Creates an ingress-nginx Ingress              |
| `ingress.hosts[0].host`          | `api.moodify.com`                    | Replace with your hostname                    |
| `configMap.data`                 | `{NODE_ENV, LOG_LEVEL, DB_HOST, …}`  | Non-secret env                                |
| `secrets.create`                 | `true`                               | Pair with External Secrets in prod            |
| `networkPolicy.enabled`          | `true`                               | Deny by default, allow ingress + egress       |

## Blue/green flip

```bash
# Spin both colors (default).
helm upgrade --install moodify . \
  --set blueGreen.enabled=true \
  --set blueGreen.activeEnvironment=blue \
  --set image.tag=v1

# Stage v2 on green.
helm upgrade moodify . \
  --reuse-values \
  --set image.tag=v2 \
  --set blueGreen.activeEnvironment=blue \
  --set blueGreen.keepInactive=true

# Flip traffic to green.
helm upgrade moodify . \
  --reuse-values \
  --set blueGreen.activeEnvironment=green

# Roll back if anything is off.
helm upgrade moodify . \
  --reuse-values \
  --set blueGreen.activeEnvironment=blue
```

## Renders

```bash
helm template moodify . | kubectl apply --dry-run=client -f -
```

Produces:

* `Deployment/moodify-moodify-backend-blue`
* `Deployment/moodify-moodify-backend-green`
* `Service/moodify-moodify-backend` (selects `color=<active>`)
* `ServiceAccount/moodify-backend-sa`
* `ConfigMap/moodify-moodify-backend-config`
* `HorizontalPodAutoscaler/moodify-moodify-backend`
* `PodDisruptionBudget/moodify-moodify-backend`
* `Ingress/moodify-moodify-backend`
* `NetworkPolicy/moodify-moodify-backend`
