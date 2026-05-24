# `helm/monitoring/` — observability umbrella chart

Real Helm umbrella chart that pulls in `kube-prometheus-stack`, Loki,
Promtail, and Tempo, then layers Moodify-specific extras (dashboards,
alert rules, ServiceMonitors) on top. Run this instead of installing
each chart manually.

For Terraform-driven installs the same chart is invoked via
[`../../terraform/modules/monitoring/`](../../terraform/modules/monitoring/);
the chart in this directory is the canonical source of truth.

## Layout

```
helm/monitoring/
├── Chart.yaml                  umbrella + dependency pins
├── values.yaml                 production defaults (HA, persistence, ingress)
├── values-dev.yaml             minikube / local overlay (small, no PVCs)
├── dashboards/                 Moodify Grafana dashboards (overview, inference, postgres)
└── templates/
    ├── _helpers.tpl
    ├── dashboards-configmap.yaml   wraps the dashboards/ JSON into one ConfigMap
    ├── prometheusrule.yaml         Moodify SLO alerts (5xx, p95, cold starts)
    ├── servicemonitor-extras.yaml  nginx + backend scrape targets
    └── NOTES.txt                   post-install pointers
```

## Quick start

```bash
# 1. Add the upstream chart repos (once)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana              https://grafana.github.io/helm-charts
helm repo update

# 2. Pull dependencies pinned in Chart.yaml
helm dependency update helm/monitoring

# 3. Install / upgrade
helm upgrade --install monitoring helm/monitoring \
  -n monitoring --create-namespace \
  -f helm/monitoring/values.yaml \
  --set "kube-prometheus-stack.grafana.adminPassword=$(openssl rand -hex 16)"

# Local / minikube
helm upgrade --install monitoring helm/monitoring \
  -n monitoring --create-namespace \
  -f helm/monitoring/values.yaml \
  -f helm/monitoring/values-dev.yaml
```

## What you get

| Component                | Replicas | Persistence | Notes |
| ------------------------ | -------- | ----------- | ----- |
| Prometheus               | 2        | 100Gi       | 30d retention, WAL compression, ServiceMonitor + PodMonitor auto-discovery |
| Grafana                  | 2        | 20Gi        | Ingress + cert-manager, Loki + Tempo data sources auto-wired |
| AlertManager             | 2        | 20Gi        | Slack default, PagerDuty for severity=critical |
| Loki (single-binary)     | 1        | 50Gi        | TSDB schema v13, filesystem backend (swap for S3/GCS in prod) |
| Promtail                 | DaemonSet | —          | Ships node logs into Loki |
| Tempo                    | 1        | 30Gi        | 7d trace retention |

Plus the Moodify-specific resources installed by the chart's own templates:
* `PrometheusRule` with backend / inference / pod-crash SLO alerts
* `ConfigMap` containing the three Moodify Grafana dashboards
* `ServiceMonitor` for the nginx exporter and Django backend

## Operating the stack

```bash
# Reload after editing values
helm diff upgrade monitoring helm/monitoring -f helm/monitoring/values.yaml
helm upgrade monitoring helm/monitoring -f helm/monitoring/values.yaml

# Render to plain YAML (CI gate)
helm template monitoring helm/monitoring -f helm/monitoring/values.yaml > /tmp/rendered.yaml

# Roll back a bad upgrade
helm rollback monitoring 1
```

## Tying it together

* The nginx exporter sidecar is wired in
  [`../../nginx/exporter/README.md`](../../nginx/exporter/README.md) — its
  Service is what `templates/servicemonitor-extras.yaml` scrapes.
* The Django backend exposes Prometheus metrics on `/metrics` via
  `django-prometheus`; the ServiceMonitor for it is created automatically.
* Modal cold-start metrics arrive via the Modal-side scrape config in
  `values.yaml::prometheus.additionalScrapeConfigs`.

## Migrating from the Terraform module

If you used to install via Terraform's `module "monitoring"`:
1. `helm dependency update helm/monitoring`
2. `helm upgrade --install monitoring helm/monitoring -n monitoring -f values.yaml`
3. Set `module.monitoring.enabled = false` (or remove the module block)
   on the next `terraform apply`.

Outputs from the Terraform module (`grafana_service`, `prometheus_service`,
`alertmanager_service`) still match this chart's service names.
