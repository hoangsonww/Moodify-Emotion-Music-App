# `aws/cloudwatch/` — Moodify CloudWatch dashboard + alarms

Tiny Terraform module that builds a single CloudWatch dashboard covering EKS,
RDS, and ElastiCache plus a baseline alarm set. Wire it into the AWS root
module:

```hcl
module "cloudwatch" {
  source               = "../cloudwatch"
  project_name         = var.project_name
  environment          = var.environment
  region               = var.aws_region
  cluster_name         = module.eks.cluster_name
  rds_instance_id      = module.rds.endpoint   # use the bare id, not the URL
  redis_cluster_id     = module.redis.endpoint
  alarm_sns_topic_arns = [module.alerts.topic_arn]
}
```

After `tf-apply`:

```bash
terraform output -raw dashboard_url
open "$(terraform output -raw dashboard_url)"
```

## What you get

| Resource | Purpose |
| --- | --- |
| `aws_cloudwatch_dashboard.moodify` | Single pane (EKS / RDS / Redis + recent backend 5xx log query) |
| `aws_cloudwatch_metric_alarm.eks_node_cpu_high` | Node CPU > 80% for 15m |
| `aws_cloudwatch_metric_alarm.eks_pod_restart_spike` | > 5 restarts in 5m inside `moodify` ns |
| `aws_cloudwatch_metric_alarm.rds_cpu_high` | RDS CPU > 75% (10m) |
| `aws_cloudwatch_metric_alarm.rds_storage_low` | RDS free storage < 10 GiB |
| `aws_cloudwatch_metric_alarm.redis_memory_pressure` | Redis memory > 75% (15m) |

Hook alarms to SNS via `alarm_sns_topic_arns`; subscribe PagerDuty / Slack /
email to that topic.

## Grafana parity

The same metrics are scraped by Prometheus and visualised in the Grafana
dashboards under `helm/monitoring/dashboards/`. CloudWatch stays as the
out-of-band view if Prometheus itself is down.
