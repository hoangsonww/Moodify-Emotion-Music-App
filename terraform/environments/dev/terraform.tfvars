# =============================================================================
# Dev environment overrides
# =============================================================================
# Cheap, single-AZ, no HA. Use for ephemeral feature branches.
# Run from the repo root:
#   cd terraform
#   terraform init -backend-config=environments/dev/backend.hcl
#   terraform plan -var-file=environments/dev/terraform.tfvars
# =============================================================================

environment = "dev"
aws_region  = "us-east-1"

# Cluster sizing — small + spot-friendly
eks_node_instance_types = ["t3.medium"]
eks_node_desired_size   = 2
eks_node_min_size       = 1
eks_node_max_size       = 4
eks_node_capacity_type  = "SPOT"

# Database — single AZ, smallest instance
rds_instance_class      = "db.t3.micro"
rds_multi_az            = false
rds_storage_gb          = 20
rds_backup_retention_d  = 1

# Redis — single node
redis_node_type         = "cache.t3.micro"
redis_num_cache_nodes   = 1

# Observability — short retention, no PagerDuty
prometheus_retention    = "7d"
prometheus_storage_size = "20Gi"
loki_enabled            = true
jaeger_enabled          = false
alertmanager_enabled    = false
