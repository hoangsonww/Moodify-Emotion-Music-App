# =============================================================================
# RDS Postgres module
# =============================================================================
# Provisions a Multi-AZ-capable Postgres instance with:
#   * Encryption at rest (KMS-managed) + encrypted backups
#   * Performance Insights (free tier) + enhanced monitoring
#   * Automated snapshots w/ configurable retention
#   * Sane parameter group tuned for Django + read-heavy workloads
#   * Subnet group sourced from the VPC module's DB subnets
#   * Random master password stored in Secrets Manager
# =============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.5" }
  }
}

locals {
  name = "${var.project_name}-${var.environment}-pg"
  tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      Component   = "rds"
      ManagedBy   = "terraform"
    },
    var.tags,
  )
}

# ---- KMS key for storage encryption --------------------------------------
resource "aws_kms_key" "rds" {
  description             = "KMS key for Moodify RDS encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  tags                    = local.tags
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.rds.id
}

# ---- Master password -----------------------------------------------------
resource "random_password" "master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "master" {
  name        = "${local.name}-master"
  description = "Master password for ${local.name}"
  kms_key_id  = aws_kms_key.rds.arn
  tags        = local.tags
}

resource "aws_secretsmanager_secret_version" "master" {
  secret_id = aws_secretsmanager_secret.master.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
    engine   = "postgres"
    host     = aws_db_instance.this.address
    port     = aws_db_instance.this.port
    dbname   = var.db_name
  })
}

# ---- Subnet + parameter groups ------------------------------------------
resource "aws_db_subnet_group" "this" {
  name       = local.name
  subnet_ids = var.subnet_ids
  tags       = local.tags
}

resource "aws_db_parameter_group" "this" {
  name        = local.name
  family      = "postgres${var.engine_major_version}"
  description = "Moodify Postgres tuning"
  tags        = local.tags

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "500"      # log queries > 500 ms
  }
  parameter {
    name  = "log_connections"
    value = "1"
  }
  parameter {
    name  = "log_disconnections"
    value = "1"
  }
  parameter {
    name  = "log_lock_waits"
    value = "1"
  }
  parameter {
    name  = "log_temp_files"
    value = "0"
  }
}

# ---- Security group ------------------------------------------------------
resource "aws_security_group" "this" {
  name        = local.name
  description = "Moodify RDS access"
  vpc_id      = var.vpc_id
  tags        = local.tags

  egress {
    description = "egress any"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group_rule" "ingress_from_cluster" {
  count                    = length(var.allowed_security_group_ids)
  type                     = "ingress"
  description              = "Postgres from EKS node SG #${count.index}"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = var.allowed_security_group_ids[count.index]
  security_group_id        = aws_security_group.this.id
}

# ---- The instance --------------------------------------------------------
resource "aws_db_instance" "this" {
  identifier = local.name

  engine               = "postgres"
  engine_version       = var.engine_version
  instance_class       = var.instance_class
  allocated_storage    = var.storage_gb
  max_allocated_storage = var.max_storage_gb
  storage_type         = "gp3"
  storage_encrypted    = true
  kms_key_id           = aws_kms_key.rds.arn

  db_name  = var.db_name
  username = var.master_username
  password = random_password.master.result
  port     = 5432

  multi_az               = var.multi_az
  publicly_accessible    = false
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.this.id]
  parameter_group_name   = aws_db_parameter_group.this.name

  backup_retention_period   = var.backup_retention_d
  backup_window             = "03:00-04:00"
  maintenance_window        = "sun:04:30-sun:05:30"
  delete_automated_backups  = false
  copy_tags_to_snapshot     = true
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.deletion_protection ? false : true
  final_snapshot_identifier = var.deletion_protection ? "${local.name}-final-${formatdate("YYYYMMDD-hhmm", timestamp())}" : null

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.monitoring.arn
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]

  auto_minor_version_upgrade = true
  apply_immediately          = false

  tags = local.tags

  lifecycle {
    ignore_changes = [password] # rotation handled out-of-band
  }
}

# ---- Enhanced monitoring IAM ---------------------------------------------
data "aws_iam_policy_document" "monitoring_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "monitoring" {
  name               = "${local.name}-monitoring"
  assume_role_policy = data.aws_iam_policy_document.monitoring_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "monitoring" {
  role       = aws_iam_role.monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ---- CloudWatch alarm: storage exhaustion --------------------------------
resource "aws_cloudwatch_metric_alarm" "low_storage" {
  alarm_name          = "${local.name}-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.storage_gb * 1024 * 1024 * 1024 * 0.1   # 10 %
  alarm_description   = "Postgres free storage dropped below 10 %"
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.id
  }
  alarm_actions = var.alarm_sns_topic_arns
  ok_actions    = var.alarm_sns_topic_arns
  tags          = local.tags
}
