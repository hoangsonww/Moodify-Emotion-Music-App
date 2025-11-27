# Moodify Infrastructure as Code - Main Configuration
# This file orchestrates all infrastructure components

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Backend configuration for state management
  backend "s3" {
    bucket         = "moodify-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "moodify-terraform-locks"
  }
}

# Local variables
locals {
  project_name = "moodify"
  environment  = var.environment
  region       = var.aws_region

  common_tags = {
    Project     = local.project_name
    Environment = local.environment
    ManagedBy   = "Terraform"
    Team        = "DevOps"
    CostCenter  = "Engineering"
  }
}

# AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  project_name        = local.project_name
  environment         = local.environment
  vpc_cidr            = var.vpc_cidr
  availability_zones  = slice(data.aws_availability_zones.available.names, 0, 3)
  enable_nat_gateway  = true
  enable_vpn_gateway  = false
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = local.common_tags
}

# EKS Cluster Module
module "eks" {
  source = "./modules/eks"

  project_name       = local.project_name
  environment        = local.environment
  cluster_version    = var.eks_cluster_version
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  node_groups = {
    general = {
      desired_size = var.eks_node_desired_size
      max_size     = var.eks_node_max_size
      min_size     = var.eks_node_min_size
      instance_types = ["t3.large"]
      capacity_type  = "ON_DEMAND"
      labels = {
        role = "general"
      }
    }

    spot = {
      desired_size = 2
      max_size     = 10
      min_size     = 0
      instance_types = ["t3.large", "t3a.large"]
      capacity_type  = "SPOT"
      labels = {
        role = "spot"
      }
      taints = [{
        key    = "spot"
        value  = "true"
        effect = "NoSchedule"
      }]
    }
  }

  tags = local.common_tags
}

# RDS (DocumentDB for MongoDB compatibility)
module "documentdb" {
  source = "./modules/rds"

  project_name      = local.project_name
  environment       = local.environment
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.private_subnet_ids
  instance_class    = var.db_instance_class
  cluster_size      = var.db_cluster_size
  master_username   = var.db_master_username
  master_password   = var.db_master_password

  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"

  enabled_cloudwatch_logs_exports = ["audit", "profiler"]

  tags = local.common_tags
}

# ElastiCache Redis
module "redis" {
  source = "./modules/redis"

  project_name   = local.project_name
  environment    = local.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  node_type      = var.redis_node_type
  num_cache_nodes = var.redis_num_nodes

  automatic_failover_enabled = true
  multi_az_enabled          = true

  snapshot_retention_limit = 5
  snapshot_window         = "03:00-05:00"
  maintenance_window      = "sun:05:00-sun:07:00"

  tags = local.common_tags
}

# S3 Buckets
module "s3" {
  source = "./modules/s3"

  project_name = local.project_name
  environment  = local.environment

  buckets = {
    assets = {
      versioning_enabled = true
      lifecycle_rules    = true
      cors_enabled       = true
    }
    backups = {
      versioning_enabled = true
      lifecycle_rules    = true
      cors_enabled       = false
    }
    logs = {
      versioning_enabled = false
      lifecycle_rules    = true
      cors_enabled       = false
    }
  }

  tags = local.common_tags
}

# Kubernetes Provider (configured after EKS is created)
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.eks.cluster_name
    ]
  }
}

# Helm Provider
provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        module.eks.cluster_name
      ]
    }
  }
}

# Monitoring Stack Module
module "monitoring" {
  source = "./modules/monitoring"

  project_name = local.project_name
  environment  = local.environment

  prometheus_enabled    = true
  grafana_enabled       = true
  alertmanager_enabled  = true
  loki_enabled          = true
  jaeger_enabled        = true

  prometheus_retention  = "15d"
  prometheus_storage_size = "50Gi"
  grafana_admin_password = var.grafana_admin_password

  slack_webhook_url = var.slack_webhook_url
  pagerduty_service_key = var.pagerduty_service_key

  depends_on = [module.eks]
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "documentdb_endpoint" {
  description = "DocumentDB cluster endpoint"
  value       = module.documentdb.cluster_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.redis.primary_endpoint
  sensitive   = true
}

output "s3_buckets" {
  description = "S3 bucket names"
  value       = module.s3.bucket_names
}

output "monitoring_endpoints" {
  description = "Monitoring stack endpoints"
  value = {
    prometheus    = module.monitoring.prometheus_url
    grafana       = module.monitoring.grafana_url
    alertmanager  = module.monitoring.alertmanager_url
    jaeger        = module.monitoring.jaeger_url
  }
}
