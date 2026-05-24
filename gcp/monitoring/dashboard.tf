# =============================================================================
# Google Cloud Monitoring dashboard for the Moodify GKE / Cloud SQL stack
# =============================================================================
# Drop into gcp/ as `module "monitoring" { source = "../monitoring" ... }`.
# Mirrors the CloudWatch dashboard in aws/cloudwatch/ for symmetry.
# =============================================================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0"
    }
  }
}

variable "project_id" {
  type = string
}

variable "project_name" {
  type    = string
  default = "moodify"
}

variable "environment" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "cloudsql_instance" {
  type = string
}

resource "google_monitoring_dashboard" "moodify" {
  project        = var.project_id
  dashboard_json = jsonencode({
    displayName = "${var.project_name}-${var.environment}-overview"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "GKE — pod CPU"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"kubernetes.io/container/cpu/core_usage_time\" resource.type=\"k8s_container\" resource.label.\"cluster_name\"=\"${var.cluster_name}\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["resource.label.namespace_name"]
                    }
                  }
                }
              }]
            }
          }
        },
        {
          xPos   = 6
          width  = 6
          height = 4
          widget = {
            title = "GKE — pod memory"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"kubernetes.io/container/memory/used_bytes\" resource.type=\"k8s_container\" resource.label.\"cluster_name\"=\"${var.cluster_name}\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_MEAN"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["resource.label.namespace_name"]
                    }
                  }
                }
              }]
            }
          }
        },
        {
          yPos   = 4
          width  = 12
          height = 4
          widget = {
            title = "Cloud SQL — CPU + connections"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\" resource.label.\"database_id\"=\"${var.project_id}:${var.cloudsql_instance}\""
                      aggregation = {
                        alignmentPeriod  = "60s"
                        perSeriesAligner = "ALIGN_MEAN"
                      }
                    }
                  }
                },
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\" resource.label.\"database_id\"=\"${var.project_id}:${var.cloudsql_instance}\""
                      aggregation = {
                        alignmentPeriod  = "60s"
                        perSeriesAligner = "ALIGN_MEAN"
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    }
  })
}

output "dashboard_url" {
  value = "https://console.cloud.google.com/monitoring/dashboards/builder/${google_monitoring_dashboard.moodify.id}?project=${var.project_id}"
}
