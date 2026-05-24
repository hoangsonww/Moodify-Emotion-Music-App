# `terraform/modules/monitoring`

Installs the full observability stack into an existing Kubernetes
cluster via Helm:

* **kube-prometheus-stack** — Prometheus + Alertmanager + Grafana +
  the standard kube-state + node-exporter dashboards.
* **loki-stack** — log aggregation (Promtail DaemonSet → Loki).
* **jaeger** — distributed tracing (optional).

Plus the per-Moodify customisations:

* Dashboards from [`dashboards/`](dashboards/) auto-mounted into Grafana.
* PrometheusRule for SLO alarms (5xx > 5 %, p95 > 2.5 s, container OOMs).
* Alertmanager routing to Slack + PagerDuty when the relevant vars are set.

## Usage

```hcl
module "monitoring" {
  source       = "../../modules/monitoring"
  project_name = "moodify"
  environment  = "production"

  prometheus_enabled    = true
  loki_enabled          = true
  jaeger_enabled        = true
  alertmanager_enabled  = true
  prometheus_retention  = "45d"
  prometheus_storage_size = "200Gi"
  grafana_admin_password  = var.grafana_admin_password
  slack_webhook_url       = var.slack_webhook_url
  pagerduty_service_key   = var.pagerduty_service_key
}
```

## Outputs

| Output            | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `prometheus_url`  | `http://kube-prometheus-stack-prometheus.monitoring:9090` |
| `grafana_url`     | `http://kube-prometheus-stack-grafana.monitoring`         |
| `alertmanager_url`| in-cluster URL for the AM API             |
| `jaeger_url`      | Jaeger Query UI (when enabled)            |
| `alarm_topic_arn` | SNS topic that downstream modules (RDS, Redis) wire alarms into |

## Files

```
monitoring/
├── main.tf                full Helm install + alarm + topic
├── dashboards/            Grafana JSON; auto-mounted into the chart
│   ├── moodify-overview.json
│   ├── moodify-inference.json
│   ├── moodify-postgres.json
│   └── README.md
└── values/
    └── prometheus-stack.yaml  templated values passed to upstream chart
```

## Adding a dashboard

Drop the JSON in `dashboards/`, `terraform apply`. The ConfigMap mounted
into Grafana picks it up under the **Moodify** folder.
