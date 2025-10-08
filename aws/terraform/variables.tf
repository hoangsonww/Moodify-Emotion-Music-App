# Moodify AWS Infrastructure - Variables

# General Variables
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "number_of_availability_zones" {
  description = "Number of availability zones to use"
  type        = number
  default     = 3

  validation {
    condition     = var.number_of_availability_zones >= 2 && var.number_of_availability_zones <= 3
    error_message = "Must use 2 or 3 availability zones."
  }
}

# VPC Variables
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
}

# EKS Variables
variable "eks_cluster_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.27"
}

variable "eks_desired_nodes" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 3
}

variable "eks_min_nodes" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 2
}

variable "eks_max_nodes" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 10
}

# DocumentDB Variables
variable "docdb_instance_class" {
  description = "Instance class for DocumentDB"
  type        = string
  default     = "db.r6g.large"
}

variable "docdb_instance_count" {
  description = "Number of DocumentDB instances"
  type        = number
  default     = 3
}

variable "db_master_username" {
  description = "Master username for database"
  type        = string
  sensitive   = true
}

variable "db_master_password" {
  description = "Master password for database"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_master_password) >= 12
    error_message = "Password must be at least 12 characters long."
  }
}

# ElastiCache Variables
variable "redis_node_type" {
  description = "Node type for ElastiCache Redis"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_num_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 3
}

# RDS Variables (Optional)
variable "enable_rds" {
  description = "Enable RDS PostgreSQL for analytics"
  type        = bool
  default     = false
}

variable "rds_instance_class" {
  description = "Instance class for RDS"
  type        = string
  default     = "db.t3.large"
}

variable "rds_master_username" {
  description = "Master username for RDS"
  type        = string
  default     = "moodify"
  sensitive   = true
}

variable "rds_master_password" {
  description = "Master password for RDS"
  type        = string
  sensitive   = true
}

# Domain and DNS Variables
variable "enable_custom_domain" {
  description = "Enable custom domain configuration"
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "moodify.com"
}

variable "cloudfront_distribution_domain" {
  description = "CloudFront distribution domain for frontend"
  type        = string
  default     = ""
}

# WAF Variables
variable "enable_waf" {
  description = "Enable AWS WAF"
  type        = bool
  default     = true
}

variable "waf_blocked_countries" {
  description = "List of country codes to block (ISO 3166-1 alpha-2)"
  type        = list(string)
  default     = []
}

# Application Variables
variable "jwt_secret_key" {
  description = "Secret key for JWT tokens"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.jwt_secret_key) >= 32
    error_message = "JWT secret key must be at least 32 characters long."
  }
}

variable "spotify_client_id" {
  description = "Spotify API client ID"
  type        = string
  sensitive   = true
}

variable "spotify_client_secret" {
  description = "Spotify API client secret"
  type        = string
  sensitive   = true
}

# Monitoring Variables
variable "alert_email" {
  description = "Email address for alerts"
  type        = string
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = true
}

# Backup Variables
variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 7 && var.backup_retention_days <= 35
    error_message = "Backup retention must be between 7 and 35 days."
  }
}

# Cost Optimization Variables
variable "enable_auto_scaling" {
  description = "Enable auto-scaling for EKS node groups"
  type        = bool
  default     = true
}

variable "enable_spot_instances" {
  description = "Enable Spot instances for non-critical workloads"
  type        = bool
  default     = false
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}
