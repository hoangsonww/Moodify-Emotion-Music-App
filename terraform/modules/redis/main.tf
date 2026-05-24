# =============================================================================
# Redis (ElastiCache) module
# =============================================================================
# Replication group (cluster-mode disabled) with TLS in-transit + at-rest,
# AUTH token, automatic failover, snapshots and a CloudWatch alarm.
# =============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.5" }
  }
}

locals {
  name = "${var.project_name}-${var.environment}-redis"
  tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      Component   = "redis"
      ManagedBy   = "terraform"
    },
    var.tags,
  )
}

# ---- KMS key for encryption-at-rest ---------------------------------------
resource "aws_kms_key" "redis" {
  description             = "KMS key for Moodify Redis encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  tags                    = local.tags
}

resource "aws_kms_alias" "redis" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.redis.id
}

# ---- AUTH token ----------------------------------------------------------
resource "random_password" "auth" {
  length  = 64
  special = false # ElastiCache disallows special chars in AUTH tokens
}

resource "aws_secretsmanager_secret" "auth" {
  name        = "${local.name}-auth"
  description = "AUTH token for ${local.name}"
  kms_key_id  = aws_kms_key.redis.arn
  tags        = local.tags
}

resource "aws_secretsmanager_secret_version" "auth" {
  secret_id = aws_secretsmanager_secret.auth.id
  secret_string = jsonencode({
    auth_token = random_password.auth.result
    host       = aws_elasticache_replication_group.this.primary_endpoint_address
    port       = aws_elasticache_replication_group.this.port
  })
}

# ---- Networking ----------------------------------------------------------
resource "aws_elasticache_subnet_group" "this" {
  name       = local.name
  subnet_ids = var.subnet_ids
  tags       = local.tags
}

resource "aws_security_group" "this" {
  name        = local.name
  description = "Moodify Redis access"
  vpc_id      = var.vpc_id
  tags        = local.tags
}

resource "aws_security_group_rule" "ingress_from_cluster" {
  count                    = length(var.allowed_security_group_ids)
  type                     = "ingress"
  description              = "Redis from app SG #${count.index}"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = var.allowed_security_group_ids[count.index]
  security_group_id        = aws_security_group.this.id
}

# ---- Parameter group -----------------------------------------------------
resource "aws_elasticache_parameter_group" "this" {
  name        = local.name
  family      = var.parameter_group_family
  description = "Moodify Redis tuning"
  tags        = local.tags

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
  parameter {
    name  = "timeout"
    value = "300"
  }
  parameter {
    name  = "tcp-keepalive"
    value = "60"
  }
}

# ---- Replication group ---------------------------------------------------
resource "aws_elasticache_replication_group" "this" {
  replication_group_id          = local.name
  description                   = "Moodify Redis (${var.environment})"

  engine                        = "redis"
  engine_version                = var.engine_version
  node_type                     = var.node_type
  num_cache_clusters            = var.num_cache_nodes
  parameter_group_name          = aws_elasticache_parameter_group.this.name
  port                          = 6379

  subnet_group_name             = aws_elasticache_subnet_group.this.name
  security_group_ids            = [aws_security_group.this.id]

  automatic_failover_enabled    = var.automatic_failover_enabled
  multi_az_enabled              = var.automatic_failover_enabled

  at_rest_encryption_enabled    = true
  kms_key_id                    = aws_kms_key.redis.arn
  transit_encryption_enabled    = true
  auth_token                    = random_password.auth.result

  snapshot_retention_limit      = var.snapshot_retention_d
  snapshot_window               = "03:00-04:00"
  maintenance_window            = "sun:05:00-sun:06:00"

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.engine.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  apply_immediately = false
  tags              = local.tags

  lifecycle {
    ignore_changes = [auth_token]
  }
}

# ---- CloudWatch logs -----------------------------------------------------
resource "aws_cloudwatch_log_group" "slow" {
  name              = "/aws/elasticache/${local.name}/slow"
  retention_in_days = var.log_retention_d
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "engine" {
  name              = "/aws/elasticache/${local.name}/engine"
  retention_in_days = var.log_retention_d
  tags              = local.tags
}

# ---- Alarm: memory pressure ---------------------------------------------
resource "aws_cloudwatch_metric_alarm" "memory" {
  alarm_name          = "${local.name}-memory-pressure"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Redis memory usage above 85 %"
  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.this.id
  }
  alarm_actions = var.alarm_sns_topic_arns
  ok_actions    = var.alarm_sns_topic_arns
  tags          = local.tags
}
