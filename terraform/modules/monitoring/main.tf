# Monitoring Module - Complete Observability Stack
# Deploys Prometheus, Grafana, AlertManager, Loki, and Jaeger

# Create monitoring namespace
resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring"

    labels = {
      name        = "monitoring"
      environment = var.environment
    }
  }
}

# Prometheus Stack (includes Prometheus, Grafana, AlertManager)
resource "helm_release" "kube_prometheus_stack" {
  count = var.prometheus_enabled ? 1 : 0

  name       = "kube-prometheus-stack"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "55.0.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/values/prometheus-stack.yaml", {
      environment             = var.environment
      grafana_admin_password  = var.grafana_admin_password
      prometheus_retention    = var.prometheus_retention
      prometheus_storage_size = var.prometheus_storage_size
      alertmanager_enabled    = var.alertmanager_enabled
      slack_webhook_url       = var.slack_webhook_url
      pagerduty_service_key   = var.pagerduty_service_key
    })
  ]

  timeout = 600

  set {
    name  = "prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues"
    value = "false"
  }

  set {
    name  = "prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues"
    value = "false"
  }
}

# Loki for log aggregation
resource "helm_release" "loki" {
  count = var.loki_enabled ? 1 : 0

  name       = "loki"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "loki-stack"
  version    = "2.9.11"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/values/loki.yaml", {
      environment = var.environment
    })
  ]

  timeout = 600
}

# Jaeger for distributed tracing
resource "helm_release" "jaeger" {
  count = var.jaeger_enabled ? 1 : 0

  name       = "jaeger"
  repository = "https://jaegertracing.github.io/helm-charts"
  chart      = "jaeger"
  version    = "0.71.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/values/jaeger.yaml", {
      environment = var.environment
    })
  ]

  timeout = 600
}

# Kiali for Istio service mesh observability
resource "helm_release" "kiali" {
  count = var.kiali_enabled ? 1 : 0

  name       = "kiali-server"
  repository = "https://kiali.org/helm-charts"
  chart      = "kiali-server"
  version    = "1.79.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/values/kiali.yaml", {
      environment = var.environment
    })
  ]

  timeout = 600

  depends_on = [helm_release.kube_prometheus_stack]
}

# Grafana Dashboards ConfigMap
resource "kubernetes_config_map" "grafana_dashboards" {
  metadata {
    name      = "grafana-custom-dashboards"
    namespace = kubernetes_namespace.monitoring.metadata[0].name

    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "moodify-backend.json" = file("${path.module}/dashboards/backend-dashboard.json")
    "moodify-frontend.json" = file("${path.module}/dashboards/frontend-dashboard.json")
    "kubernetes-cluster.json" = file("${path.module}/dashboards/k8s-cluster.json")
  }
}

# ServiceMonitor for Moodify backend
resource "kubernetes_manifest" "backend_service_monitor" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "moodify-backend"
      namespace = "moodify-production"
      labels = {
        app       = "moodify"
        component = "backend"
      }
    }
    spec = {
      selector = {
        matchLabels = {
          app       = "moodify"
          component = "backend"
        }
      }
      endpoints = [{
        port     = "metrics"
        path     = "/metrics"
        interval = "30s"
      }]
    }
  }

  depends_on = [helm_release.kube_prometheus_stack]
}

# PrometheusRule for alerts
resource "kubernetes_manifest" "backend_alerts" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "PrometheusRule"
    metadata = {
      name      = "moodify-backend-alerts"
      namespace = kubernetes_namespace.monitoring.metadata[0].name
      labels = {
        prometheus = "kube-prometheus"
      }
    }
    spec = {
      groups = [{
        name = "moodify-backend"
        rules = [
          {
            alert = "HighErrorRate"
            expr  = "rate(http_requests_total{job=\"moodify-backend\",status=~\"5..\"}[5m]) > 0.05"
            for   = "5m"
            labels = {
              severity = "critical"
            }
            annotations = {
              summary     = "High error rate detected"
              description = "Error rate is {{ $value }}% over the last 5 minutes"
            }
          },
          {
            alert = "HighLatency"
            expr  = "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2"
            for   = "5m"
            labels = {
              severity = "warning"
            }
            annotations = {
              summary     = "High latency detected"
              description = "P95 latency is {{ $value }}s"
            }
          },
          {
            alert = "PodCrashLooping"
            expr  = "rate(kube_pod_container_status_restarts_total{namespace=\"moodify-production\"}[15m]) > 0"
            for   = "5m"
            labels = {
              severity = "critical"
            }
            annotations = {
              summary     = "Pod is crash looping"
              description = "Pod {{ $labels.pod }} in namespace {{ $labels.namespace }} is crash looping"
            }
          },
          {
            alert = "HighMemoryUsage"
            expr  = "container_memory_usage_bytes{namespace=\"moodify-production\"} / container_spec_memory_limit_bytes{namespace=\"moodify-production\"} > 0.9"
            for   = "5m"
            labels = {
              severity = "warning"
            }
            annotations = {
              summary     = "High memory usage"
              description = "Container {{ $labels.container }} is using {{ $value }}% of memory limit"
            }
          },
          {
            alert = "HighCPUUsage"
            expr  = "rate(container_cpu_usage_seconds_total{namespace=\"moodify-production\"}[5m]) > 0.8"
            for   = "10m"
            labels = {
              severity = "warning"
            }
            annotations = {
              summary     = "High CPU usage"
              description = "Container {{ $labels.container }} is using {{ $value }}% of CPU limit"
            }
          }
        ]
      }]
    }
  }

  depends_on = [helm_release.kube_prometheus_stack]
}
