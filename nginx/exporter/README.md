# `nginx/exporter/` — Prometheus metrics sidecar

A sidecar that scrapes the edge container's `/nginx_status` endpoint and
re-exposes it as Prometheus metrics on `:9113`.

## Files

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | Spins up `nginx/nginx-prometheus-exporter` next to the edge |
| `prometheus-scrape.yml` | Drop-in `scrape_configs` stanza |
| `alerts.yml` | Default alert rules (down / 5xx / connections / cert expiry) |

## Bring-up

```bash
# Same Docker network as the edge container
docker network create moodify-edge || true

# Edge first, then sidecar
docker compose -f ../docker-compose.yml up -d
docker compose -f docker-compose.yml up -d

curl -sf http://localhost:9113/metrics | head
```

## Wire into Prometheus

Append `prometheus-scrape.yml` to your Prometheus config and load `alerts.yml`
via `rule_files:`. Grafana panels live in
`terraform/modules/monitoring/dashboards/`.

## On Kubernetes

Run the exporter as a sidecar in the same Pod (recommended) or as a separate
DaemonSet pointed at the ingress controller. Use the `ServiceMonitor` CRD
from kube-prometheus-stack — example in `helm/monitoring/values.yaml`.
