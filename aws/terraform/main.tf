# Moodify AWS Infrastructure - Main Terraform Configuration
# Production-Ready Deployment for Emotion-Based Music Recommendation System

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
  }

  backend "s3" {
    bucket         = "moodify-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "moodify-terraform-locks"
  }
}

# Provider Configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Moodify"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "DevOps Team"
      CostCenter  = "Engineering"
    }
  }
}

# Data Sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Local Variables
locals {
  name_prefix = "moodify-${var.environment}"

  common_tags = {
    Project     = "Moodify"
    Environment = var.environment
    Terraform   = "true"
  }

  azs = slice(data.aws_availability_zones.available.names, 0, var.number_of_availability_zones)
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  name_prefix = local.name_prefix
  cidr_block  = var.vpc_cidr
  azs         = local.azs

  enable_nat_gateway     = true
  enable_vpn_gateway     = false
  enable_dns_hostnames   = true
  enable_dns_support     = true
  enable_flow_logs       = true
  flow_logs_retention    = 30

  public_subnet_cidrs    = var.public_subnet_cidrs
  private_subnet_cidrs   = var.private_subnet_cidrs
  database_subnet_cidrs  = var.database_subnet_cidrs

  tags = local.common_tags
}

# EKS Cluster Module
module "eks" {
  source = "./modules/eks"

  cluster_name    = "${local.name_prefix}-eks"
  cluster_version = var.eks_cluster_version

  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids

  node_groups = {
    general = {
      desired_size = var.eks_desired_nodes
      min_size     = var.eks_min_nodes
      max_size     = var.eks_max_nodes

      instance_types = ["t3.large"]
      capacity_type  = "ON_DEMAND"
      disk_size      = 50

      labels = {
        role = "general"
      }
    }

    ml_workload = {
      desired_size = 2
      min_size     = 2
      max_size     = 5

      instance_types = ["g4dn.xlarge"]  # GPU instances for ML
      capacity_type  = "ON_DEMAND"
      disk_size      = 100

      labels = {
        role       = "ml"
        gpu_enabled = "true"
      }

      taints = [{
        key    = "nvidia.com/gpu"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }

  enable_irsa                    = true
  enable_cluster_autoscaler      = true
  enable_metrics_server          = true
  enable_aws_load_balancer_controller = true

  tags = local.common_tags
}

# DocumentDB (MongoDB Compatible) Module
module "documentdb" {
  source = "./modules/documentdb"

  cluster_identifier  = "${local.name_prefix}-docdb"
  master_username     = var.db_master_username
  master_password     = var.db_master_password

  instance_class      = var.docdb_instance_class
  instance_count      = var.docdb_instance_count

  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.database_subnet_ids
  allowed_cidr_blocks = module.vpc.private_subnet_cidrs

  backup_retention_period      = 7
  preferred_backup_window      = "03:00-05:00"
  preferred_maintenance_window = "sun:05:00-sun:07:00"

  enabled_cloudwatch_logs_exports = ["profiler", "audit"]

  tags = local.common_tags
}

# ElastiCache Redis Module
module "elasticache" {
  source = "./modules/elasticache"

  cluster_id          = "${local.name_prefix}-redis"
  engine_version      = "7.0"
  node_type           = var.redis_node_type
  num_cache_nodes     = var.redis_num_nodes

  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  allowed_cidr_blocks = module.vpc.private_subnet_cidrs

  parameter_group_family = "redis7"

  snapshot_retention_limit = 5
  snapshot_window         = "03:00-05:00"
  maintenance_window      = "sun:05:00-sun:07:00"

  automatic_failover_enabled = true
  multi_az_enabled          = true

  tags = local.common_tags
}

# S3 Buckets Module
module "s3" {
  source = "./modules/s3"

  name_prefix = local.name_prefix

  buckets = {
    models = {
      versioning_enabled = true
      lifecycle_rules = [{
        id      = "archive-old-models"
        enabled = true
        transitions = [{
          days          = 90
          storage_class = "GLACIER"
        }]
      }]
    }

    assets = {
      versioning_enabled = true
      cors_rules = [{
        allowed_headers = ["*"]
        allowed_methods = ["GET", "HEAD"]
        allowed_origins = ["*"]
        expose_headers  = ["ETag"]
        max_age_seconds = 3600
      }]
    }

    logs = {
      versioning_enabled = false
      lifecycle_rules = [{
        id      = "delete-old-logs"
        enabled = true
        expiration = {
          days = 90
        }
      }]
    }
  }

  tags = local.common_tags
}

# RDS PostgreSQL (Optional - for analytics)
module "rds" {
  source = "./modules/rds"

  count = var.enable_rds ? 1 : 0

  identifier     = "${local.name_prefix}-postgres"
  engine         = "postgres"
  engine_version = "15.3"
  instance_class = var.rds_instance_class

  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true

  db_name  = "moodify"
  username = var.rds_master_username
  password = var.rds_master_password

  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.database_subnet_ids
  allowed_cidr_blocks = module.vpc.private_subnet_cidrs

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  multi_az = true

  tags = local.common_tags
}

# ECR Repositories
resource "aws_ecr_repository" "repositories" {
  for_each = toset(["frontend", "backend", "ai-ml", "nginx"])

  name                 = "${local.name_prefix}-${each.key}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  lifecycle_policy {
    policy = jsonencode({
      rules = [{
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }]
    })
  }

  tags = local.common_tags
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "application_logs" {
  for_each = toset(["frontend", "backend", "ai-ml"])

  name              = "/aws/moodify/${var.environment}/${each.key}"
  retention_in_days = 30

  tags = local.common_tags
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  name       = "${local.name_prefix}-alb"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnet_ids

  enable_deletion_protection = var.environment == "production"
  enable_http2              = true
  enable_cross_zone_load_balancing = true

  access_logs = {
    bucket  = module.s3.bucket_ids["logs"]
    enabled = true
  }

  security_group_rules = {
    ingress_http = {
      type        = "ingress"
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
    ingress_https = {
      type        = "ingress"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  tags = local.common_tags
}

# Route53 DNS
module "route53" {
  source = "./modules/route53"

  count = var.enable_custom_domain ? 1 : 0

  zone_name = var.domain_name

  records = {
    api = {
      type    = "A"
      alias   = {
        name                   = module.alb.dns_name
        zone_id               = module.alb.zone_id
        evaluate_target_health = true
      }
    }
    www = {
      type    = "CNAME"
      ttl     = 300
      records = [var.cloudfront_distribution_domain]
    }
  }

  tags = local.common_tags
}

# CloudFront Distribution
module "cloudfront" {
  source = "./modules/cloudfront"

  aliases = var.enable_custom_domain ? ["www.${var.domain_name}", var.domain_name] : []

  origin = {
    domain_name = module.alb.dns_name
    origin_id   = "moodify-alb"
  }

  default_cache_behavior = {
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "moodify-alb"
    viewer_protocol_policy = "redirect-to-https"
    compress              = true

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  price_class = "PriceClass_100"

  enabled         = true
  is_ipv6_enabled = true

  web_acl_id = var.enable_waf ? module.waf[0].web_acl_id : null

  tags = local.common_tags
}

# WAF
module "waf" {
  source = "./modules/waf"

  count = var.enable_waf ? 1 : 0

  name_prefix = local.name_prefix
  scope       = "CLOUDFRONT"

  rules = {
    rate_limit = {
      priority = 1
      limit    = 2000
    }
    geo_blocking = {
      priority        = 2
      blocked_countries = var.waf_blocked_countries
    }
    sql_injection = {
      priority = 3
      enabled  = true
    }
    xss_protection = {
      priority = 4
      enabled  = true
    }
  }

  tags = local.common_tags
}

# Secrets Manager
resource "aws_secretsmanager_secret" "application_secrets" {
  name_prefix             = "${local.name_prefix}-secrets-"
  recovery_window_in_days = 7

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "application_secrets" {
  secret_id = aws_secretsmanager_secret.application_secrets.id
  secret_string = jsonencode({
    MONGODB_URI         = module.documentdb.endpoint
    REDIS_URI          = module.elasticache.endpoint
    DB_USERNAME        = var.db_master_username
    DB_PASSWORD        = var.db_master_password
    JWT_SECRET_KEY     = var.jwt_secret_key
    SPOTIFY_CLIENT_ID  = var.spotify_client_id
    SPOTIFY_CLIENT_SECRET = var.spotify_client_secret
  })
}

# SNS Topics for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"

  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "email_alerts" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch Alarms
module "cloudwatch_alarms" {
  source = "./modules/cloudwatch_alarms"

  name_prefix      = local.name_prefix
  sns_topic_arn    = aws_sns_topic.alerts.arn

  alb_arn_suffix   = module.alb.arn_suffix
  target_group_arns = module.alb.target_group_arns

  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "documentdb_endpoint" {
  description = "DocumentDB cluster endpoint"
  value       = module.documentdb.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.elasticache.endpoint
  sensitive   = true
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = module.alb.dns_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cloudfront.domain_name
}

output "ecr_repository_urls" {
  description = "ECR repository URLs"
  value = {
    for k, v in aws_ecr_repository.repositories : k => v.repository_url
  }
}

output "s3_bucket_names" {
  description = "S3 bucket names"
  value       = module.s3.bucket_names
}
