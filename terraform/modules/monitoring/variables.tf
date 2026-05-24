variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "prometheus_enabled" {
  description = "Install kube-prometheus-stack (Prometheus + Grafana + AlertManager)"
  type        = bool
  default     = true
}

variable "prometheus_retention" {
  description = "Prometheus metric retention window (e.g. 30d)"
  type        = string
  default     = "30d"
}

variable "prometheus_storage_size" {
  description = "Persistent volume size for Prometheus TSDB"
  type        = string
  default     = "100Gi"
}

variable "grafana_admin_password" {
  description = "Initial Grafana admin password"
  type        = string
  sensitive   = true
}

variable "alertmanager_enabled" {
  description = "Enable AlertManager + alert routing"
  type        = bool
  default     = true
}

variable "slack_webhook_url" {
  description = "Slack incoming webhook for AlertManager notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "pagerduty_service_key" {
  description = "PagerDuty integration key for critical alerts"
  type        = string
  default     = ""
  sensitive   = true
}

variable "loki_enabled" {
  description = "Install Loki for log aggregation"
  type        = bool
  default     = true
}

variable "jaeger_enabled" {
  description = "Install Jaeger for distributed tracing"
  type        = bool
  default     = true
}

variable "kiali_enabled" {
  description = "Install Kiali for service mesh observability"
  type        = bool
  default     = false
}
