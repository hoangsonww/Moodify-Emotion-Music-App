# `gcp/monitoring/` — Cloud Monitoring dashboard + alert policies

Companion to `aws/cloudwatch/`. Provisions a single Google Cloud Monitoring
dashboard plus baseline alert policies for the GKE cluster and Cloud SQL
instance built by `gcp/terraform/`.

## Wiring

```hcl
module "monitoring" {
  source                   = "../monitoring"
  project_id               = var.project_id
  project_name             = var.project_name
  environment              = var.environment
  cluster_name             = module.gke.cluster_name
  cloudsql_instance        = module.cloudsql.instance_name
  notification_channel_ids = [google_monitoring_notification_channel.pagerduty.id]
}
```

Open the dashboard right after apply:

```bash
open "$(terraform output -raw dashboard_url)"
```

## Files

| File | What it provisions |
| --- | --- |
| `dashboard.tf` | One dashboard: GKE pod CPU + memory, Cloud SQL CPU + connections |
| `alerts.tf` | Node CPU > 80%, Cloud SQL CPU > 75%, Cloud SQL disk > 85% |

## Notification channels

Create the channels separately (Slack, PagerDuty, email) and pass their
resource IDs into `notification_channel_ids`. Example:

```hcl
resource "google_monitoring_notification_channel" "pagerduty" {
  display_name = "PagerDuty — Moodify on-call"
  type         = "pagerduty"
  sensitive_labels {
    service_key = var.pagerduty_service_key
  }
}
```

## Grafana parity

If you also installed `helm/monitoring/`, those Grafana dashboards remain the
primary view. Cloud Monitoring is the fallback that keeps working when the
cluster (and therefore Prometheus) is down.
