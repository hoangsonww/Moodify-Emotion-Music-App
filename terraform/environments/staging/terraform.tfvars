# =============================================================================
# Staging environment overrides
# =============================================================================
# Mid-size HA, mirrors prod's topology at half the scale.
# =============================================================================

environment = "staging"
aws_region  = "us-east-1"

# Cluster sizing — mid + on-demand for stability
eks_node_instance_types = ["t3.large"]
eks_node_desired_size   = 3
eks_node_min_size       = 2
eks_node_max_size       = 6
eks_node_capacity_type  = "ON_DEMAND"

# Database — Multi-AZ for parity with prod, smaller class
rds_instance_class      = "db.t3.small"
rds_multi_az            = true
rds_storage_gb          = 50
rds_backup_retention_d  = 7

# Redis — replication group, 2 nodes
redis_node_type         = "cache.t3.small"
redis_num_cache_nodes   = 2

# Observability — full stack
prometheus_retention    = "14d"
prometheus_storage_size = "50Gi"
loki_enabled            = true
jaeger_enabled          = true
alertmanager_enabled    = true
