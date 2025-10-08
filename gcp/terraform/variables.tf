# Moodify GCP Infrastructure - Variables

# General Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
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

# Network Variables
variable "private_subnet_cidr" {
  description = "CIDR block for private subnet"
  type        = string
  default     = "10.0.0.0/20"
}

variable "pods_cidr" {
  description = "CIDR block for GKE pods"
  type        = string
  default     = "10.4.0.0/14"
}

variable "services_cidr" {
  description = "CIDR block for GKE services"
  type        = string
  default     = "10.8.0.0/20"
}

# GKE Variables
variable "gke_machine_type" {
  description = "Machine type for GKE nodes"
  type        = string
  default     = "n1-standard-4"
}

variable "gke_node_count" {
  description = "Initial number of GKE nodes"
  type        = number
  default     = 3
}

variable "gke_min_nodes" {
  description = "Minimum number of GKE nodes"
  type        = number
  default     = 2
}

variable "gke_max_nodes" {
  description = "Maximum number of GKE nodes"
  type        = number
  default     = 10
}

variable "use_preemptible_nodes" {
  description = "Use preemptible nodes for cost savings"
  type        = bool
  default     = false
}

# Redis Variables
variable "redis_memory_size_gb" {
  description = "Memory size in GB for Redis instance"
  type        = number
  default     = 5

  validation {
    condition     = var.redis_memory_size_gb >= 1 && var.redis_memory_size_gb <= 300
    error_message = "Redis memory size must be between 1 and 300 GB."
  }
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

# Tags/Labels
variable "additional_labels" {
  description = "Additional labels to apply to resources"
  type        = map(string)
  default     = {}
}
