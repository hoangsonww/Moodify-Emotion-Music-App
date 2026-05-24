# =============================================================================
# Google Cloud Monitoring alert policies — production guardrails
# =============================================================================
# Mirrors aws/cloudwatch/alarms.tf. Each policy ties to a notification channel
# (PagerDuty + Slack typically) passed in via `notification_channel_ids`.
# =============================================================================

variable "notification_channel_ids" {
  description = "Notification channel resource IDs (projects/.../notificationChannels/...)"
  type        = list(string)
  default     = []
}

resource "google_monitoring_alert_policy" "gke_node_cpu_high" {
  project      = var.project_id
  display_name = "${var.project_name}-${var.environment}-gke-node-cpu-high"
  combiner     = "OR"
  conditions {
    display_name = "Node CPU > 80% (15m)"
    condition_threshold {
      filter          = "metric.type=\"kubernetes.io/node/cpu/allocatable_utilization\" resource.type=\"k8s_node\" resource.label.\"cluster_name\"=\"${var.cluster_name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "900s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
  notification_channels = var.notification_channel_ids
  alert_strategy { auto_close = "1800s" }
}

resource "google_monitoring_alert_policy" "cloudsql_cpu_high" {
  project      = var.project_id
  display_name = "${var.project_name}-${var.environment}-cloudsql-cpu-high"
  combiner     = "OR"
  conditions {
    display_name = "Cloud SQL CPU > 75% (10m)"
    condition_threshold {
      filter          = "metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\" resource.label.\"database_id\"=\"${var.project_id}:${var.cloudsql_instance}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.75
      duration        = "600s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
  notification_channels = var.notification_channel_ids
}

resource "google_monitoring_alert_policy" "cloudsql_storage_low" {
  project      = var.project_id
  display_name = "${var.project_name}-${var.environment}-cloudsql-storage-low"
  combiner     = "OR"
  conditions {
    display_name = "Cloud SQL storage > 85% used"
    condition_threshold {
      filter          = "metric.type=\"cloudsql.googleapis.com/database/disk/utilization\" resource.label.\"database_id\"=\"${var.project_id}:${var.cloudsql_instance}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85
      duration        = "600s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
  notification_channels = var.notification_channel_ids
}
