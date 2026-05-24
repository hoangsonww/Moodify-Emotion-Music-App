output "namespace" {
  description = "Kubernetes namespace hosting the observability stack"
  value       = kubernetes_namespace.monitoring.metadata[0].name
}

output "prometheus_release_name" {
  description = "Helm release name for kube-prometheus-stack (empty if disabled)"
  value       = var.prometheus_enabled ? helm_release.kube_prometheus_stack[0].name : ""
}

output "loki_release_name" {
  description = "Helm release name for Loki (empty if disabled)"
  value       = var.loki_enabled ? helm_release.loki[0].name : ""
}

output "jaeger_release_name" {
  description = "Helm release name for Jaeger (empty if disabled)"
  value       = var.jaeger_enabled ? helm_release.jaeger[0].name : ""
}

output "grafana_service" {
  description = "In-cluster Grafana service DNS — port-forward target"
  value       = "kube-prometheus-stack-grafana.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local"
}

output "prometheus_service" {
  description = "In-cluster Prometheus service DNS"
  value       = "kube-prometheus-stack-prometheus.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
}

output "alertmanager_service" {
  description = "In-cluster AlertManager service DNS"
  value       = "kube-prometheus-stack-alertmanager.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9093"
}
