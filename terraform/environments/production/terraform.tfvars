# =============================================================================
# Production environment overrides
# =============================================================================
# Full HA, 3-AZ, larger nodes, longer retention. Treat changes here as
# release-gated: every diff should go through code review + a sandboxed
# `terraform plan` artifact before apply.
# =============================================================================

environment = "production"
aws_region  = "us-east-1"

# Cluster sizing — production workloads, on-demand only, autoscale to 12
eks_node_instance_types = ["m5.large", "m5a.large"]
eks_node_desired_size   = 4
eks_node_min_size       = 3
eks_node_max_size       = 12
eks_node_capacity_type  = "ON_DEMAND"

# Database — Multi-AZ + larger instance + 30 d retention
rds_instance_class      = "db.m5.large"
rds_multi_az            = true
rds_storage_gb          = 200
rds_backup_retention_d  = 30
rds_deletion_protection = true

# Redis — 3-node replication group, automatic failover
redis_node_type         = "cache.m5.large"
redis_num_cache_nodes   = 3
redis_automatic_failover_enabled = true

# Observability — long retention, full stack, alerting on
prometheus_retention    = "45d"
prometheus_storage_size = "200Gi"
loki_enabled            = true
jaeger_enabled          = true
alertmanager_enabled    = true
