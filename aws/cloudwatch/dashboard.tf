# =============================================================================
# CloudWatch dashboard for the Moodify production EKS cluster
# =============================================================================
# Re-uses the EKS / RDS / Redis identifiers emitted by aws/terraform/. Drop
# this file in as an extra module reference, e.g.:
#
#   module "cloudwatch" {
#     source           = "../cloudwatch"
#     cluster_name     = module.eks.cluster_name
#     rds_instance_id  = module.rds.endpoint
#     redis_cluster_id = module.redis.endpoint
#   }
#
# Outputs the dashboard URL so CI can echo it after a deploy.
# =============================================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

variable "project_name" {
  type    = string
  default = "moodify"
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "rds_instance_id" {
  type = string
}

variable "redis_cluster_id" {
  type = string
}

resource "aws_cloudwatch_dashboard" "moodify" {
  dashboard_name = "${var.project_name}-${var.environment}-overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "EKS — node CPU"
          region = var.region
          view   = "timeSeries"
          stacked = false
          metrics = [
            ["ContainerInsights", "node_cpu_utilization", "ClusterName", var.cluster_name, { stat = "Average" }],
            ["ContainerInsights", "node_cpu_utilization", "ClusterName", var.cluster_name, { stat = "p95" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "EKS — pods running"
          region  = var.region
          view    = "timeSeries"
          metrics = [["ContainerInsights", "pod_number_of_running_pods", "ClusterName", var.cluster_name]]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "RDS — CPU + connections"
          region = var.region
          view   = "timeSeries"
          metrics = [
            ["AWS/RDS", "CPUUtilization",      "DBInstanceIdentifier", var.rds_instance_id],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.rds_instance_id]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "RDS — free storage / IO latency"
          region = var.region
          view   = "timeSeries"
          metrics = [
            ["AWS/RDS", "FreeStorageSpace",   "DBInstanceIdentifier", var.rds_instance_id],
            ["AWS/RDS", "ReadLatency",        "DBInstanceIdentifier", var.rds_instance_id],
            ["AWS/RDS", "WriteLatency",       "DBInstanceIdentifier", var.rds_instance_id]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 24
        height = 6
        properties = {
          title  = "ElastiCache — CPU, evictions, current connections"
          region = var.region
          view   = "timeSeries"
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization",       "CacheClusterId", var.redis_cluster_id],
            ["AWS/ElastiCache", "Evictions",            "CacheClusterId", var.redis_cluster_id],
            ["AWS/ElastiCache", "CurrConnections",      "CacheClusterId", var.redis_cluster_id]
          ]
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 18
        width  = 24
        height = 6
        properties = {
          title   = "Backend — recent 5xx (from JSON access log)"
          region  = var.region
          query   = "SOURCE '/aws/eks/${var.cluster_name}/application' | fields @timestamp, status, uri, upstream_addr | filter status >= 500 | sort @timestamp desc | limit 50"
        }
      }
    ]
  })
}

output "dashboard_url" {
  description = "Open in browser after `terraform apply`"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${aws_cloudwatch_dashboard.moodify.dashboard_name}"
}
