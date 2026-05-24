# Grafana dashboards

Each `*.json` file in this directory is a Grafana dashboard exported via
`Dashboard settings → JSON Model`. The monitoring module mounts them
into the Grafana ConfigMap so they appear under the **Moodify** folder
on next reconciliation.

## Files

| File                  | What it shows                                                  |
| --------------------- | -------------------------------------------------------------- |
| `moodify-overview.json` | RED metrics (request rate, error rate, duration) per service  |
| `moodify-inference.json` | Modal inference latency, cold-start frequency, degraded rate |
| `moodify-postgres.json`  | RDS CPU, connections, free storage, replication lag           |

## Adding a new dashboard

1. Build it in Grafana → export JSON.
2. Drop the JSON file in this directory.
3. `terraform apply` — the monitoring module re-mounts the ConfigMap
   and Grafana auto-discovers.

## Common variables

Every Moodify dashboard expects these template variables (declared in
the JSON):

| Variable        | Source                                                 |
| --------------- | ------------------------------------------------------ |
| `$datasource`   | Prometheus data source                                 |
| `$namespace`    | label selector on `kube_pod_info.namespace`            |
| `$service`      | label selector on `app.kubernetes.io/name`             |
| `$interval`     | rate window (`$__rate_interval` recommended)            |
