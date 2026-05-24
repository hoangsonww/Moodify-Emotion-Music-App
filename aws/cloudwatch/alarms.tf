# =============================================================================
# CloudWatch alarms — production guardrails
# =============================================================================
# Lives next to dashboard.tf so the same module emits dashboard + alarms.
# Wire the SNS topic into PagerDuty / Slack via aws_sns_topic_subscription.
# =============================================================================

variable "alarm_sns_topic_arns" {
  description = "SNS topics that receive Alarm/OK transitions"
  type        = list(string)
  default     = []
}

# --- EKS ---------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "eks_node_cpu_high" {
  alarm_name          = "${var.project_name}-${var.environment}-eks-node-cpu-high"
  alarm_description   = "EKS node CPU > 80% for 15m"
  namespace           = "ContainerInsights"
  metric_name         = "node_cpu_utilization"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  period              = 300
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  dimensions          = { ClusterName = var.cluster_name }
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arns
  ok_actions          = var.alarm_sns_topic_arns
}

resource "aws_cloudwatch_metric_alarm" "eks_pod_restart_spike" {
  alarm_name          = "${var.project_name}-${var.environment}-eks-pod-restarts"
  alarm_description   = "Pod restart spike in moodify namespace"
  namespace           = "ContainerInsights"
  metric_name         = "pod_number_of_container_restarts"
  statistic           = "Sum"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 5
  period              = 300
  evaluation_periods  = 2
  dimensions = {
    ClusterName = var.cluster_name
    Namespace   = "moodify"
  }
  treat_missing_data = "notBreaching"
  alarm_actions      = var.alarm_sns_topic_arns
}

# --- RDS ---------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-cpu-high"
  alarm_description   = "RDS CPU > 75% for 10m"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 75
  period              = 300
  evaluation_periods  = 2
  dimensions          = { DBInstanceIdentifier = var.rds_instance_id }
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arns
}

resource "aws_cloudwatch_metric_alarm" "rds_storage_low" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-storage-low"
  alarm_description   = "RDS free storage < 10 GB"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Minimum"
  comparison_operator = "LessThanThreshold"
  threshold           = 10737418240 # 10 GiB
  period              = 300
  evaluation_periods  = 2
  dimensions          = { DBInstanceIdentifier = var.rds_instance_id }
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arns
}

# --- ElastiCache -------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "redis_memory_pressure" {
  alarm_name          = "${var.project_name}-${var.environment}-redis-mem-pressure"
  alarm_description   = "Redis memory > 75% used"
  namespace           = "AWS/ElastiCache"
  metric_name         = "DatabaseMemoryUsagePercentage"
  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 75
  period              = 300
  evaluation_periods  = 3
  dimensions          = { CacheClusterId = var.redis_cluster_id }
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arns
}
