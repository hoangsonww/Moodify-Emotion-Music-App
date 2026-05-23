# Monitoring stack (wrapper)

This directory is a placeholder for a thin Helm wrapper around the
upstream `kube-prometheus-stack` + `loki-stack` + `jaeger` charts. The
production wiring already happens via Terraform in
[`../../terraform/modules/monitoring/`](../../terraform/modules/monitoring/),
which calls those charts with the right values for the Moodify alarm /
dashboard set.

## Why an empty wrapper?

* If you run Terraform, you get the full stack out of `tf-apply` — no
  need to install Helm charts by hand.
* If you don't run Terraform but DO have Helm + a cluster, the values
  the Terraform module passes to `kube-prometheus-stack` are documented
  in [`../../terraform/modules/monitoring/values/prometheus-stack.yaml`](../../terraform/modules/monitoring/values/prometheus-stack.yaml).
  Copy them and run:

  ```bash
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
  helm repo add grafana https://grafana.github.io/helm-charts
  helm repo update

  helm upgrade --install kps prometheus-community/kube-prometheus-stack \
    -n monitoring --create-namespace \
    --version 55.0.0 \
    --values ../../terraform/modules/monitoring/values/prometheus-stack.yaml

  helm upgrade --install loki grafana/loki-stack \
    -n monitoring --version 2.9.11
  ```

## Dashboards + alerts

* Dashboards: see [`../../terraform/modules/monitoring/dashboards/`](../../terraform/modules/monitoring/dashboards/).
* Alerts: defined in the Terraform module via `PrometheusRule`.
* Scrape config for Moodify pods: shipped via the Helm chart in
  [`../moodify-backend/values.yaml`](../moodify-backend/values.yaml)
  (`monitoring.serviceMonitor: true`, `monitoring.prometheusRule: true`).

## Adding a real chart later

If you outgrow the wrapper, drop a `Chart.yaml` here that lists
`kube-prometheus-stack` + `loki` + `tempo` + `jaeger` as `dependencies`
and check in the values overrides under `templates/`. Until then,
prefer the Terraform path — it owns the install upgrade cycle alongside
the cluster lifecycle.
