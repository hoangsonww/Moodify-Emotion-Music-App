# Moodify GCP Infrastructure - Main Terraform Configuration
# Production-Ready Deployment on Google Cloud Platform

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
  }

  backend "gcs" {
    bucket = "moodify-terraform-state"
    prefix = "production/terraform.tfstate"
  }
}

# Provider Configuration
provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Local Variables
locals {
  name_prefix = "moodify-${var.environment}"

  common_labels = {
    project     = "moodify"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# VPC Network
resource "google_compute_network" "vpc" {
  name                    = "${local.name_prefix}-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"

  project = var.project_id
}

# Subnets
resource "google_compute_subnetwork" "private_subnet" {
  name          = "${local.name_prefix}-private-subnet"
  ip_cidr_range = var.private_subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc.id

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.pods_cidr
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.services_cidr
  }

  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }

  project = var.project_id
}

# Cloud NAT
resource "google_compute_router" "router" {
  name    = "${local.name_prefix}-router"
  region  = var.region
  network = google_compute_network.vpc.id

  bgp {
    asn = 64514
  }

  project = var.project_id
}

resource "google_compute_router_nat" "nat" {
  name                               = "${local.name_prefix}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }

  project = var.project_id
}

# GKE Cluster
resource "google_container_cluster" "primary" {
  name     = "${local.name_prefix}-gke"
  location = var.region

  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.private_subnet.name

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  addons_config {
    http_load_balancing {
      disabled = false
    }

    horizontal_pod_autoscaling {
      disabled = false
    }

    network_policy_config {
      disabled = false
    }

    gcp_filestore_csi_driver_config {
      enabled = true
    }

    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  network_policy {
    enabled  = true
    provider = "PROVIDER_UNSPECIFIED"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"
      display_name = "All networks"
    }
  }

  release_channel {
    channel = "REGULAR"
  }

  maintenance_policy {
    daily_maintenance_window {
      start_time = "03:00"
    }
  }

  resource_labels = local.common_labels

  project = var.project_id
}

# GKE Node Pools
resource "google_container_node_pool" "general" {
  name       = "general-pool"
  location   = var.region
  cluster    = google_container_cluster.primary.name
  node_count = var.gke_node_count

  autoscaling {
    min_node_count = var.gke_min_nodes
    max_node_count = var.gke_max_nodes
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    preemptible  = var.use_preemptible_nodes
    machine_type = var.gke_machine_type

    disk_size_gb = 100
    disk_type    = "pd-standard"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = merge(local.common_labels, {
      role = "general"
    })

    metadata = {
      disable-legacy-endpoints = "true"
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  project = var.project_id
}

# ML Workload Node Pool with GPUs
resource "google_container_node_pool" "ml_workload" {
  name       = "ml-pool"
  location   = var.region
  cluster    = google_container_cluster.primary.name
  node_count = 2

  autoscaling {
    min_node_count = 2
    max_node_count = 5
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type = "n1-standard-4"

    guest_accelerator {
      type  = "nvidia-tesla-t4"
      count = 1
      gpu_driver_installation_config {
        gpu_driver_version = "DEFAULT"
      }
    }

    disk_size_gb = 200
    disk_type    = "pd-ssd"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = merge(local.common_labels, {
      role        = "ml"
      gpu_enabled = "true"
    })

    taint {
      key    = "nvidia.com/gpu"
      value  = "true"
      effect = "NO_SCHEDULE"
    }

    metadata = {
      disable-legacy-endpoints = "true"
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }

  project = var.project_id
}

# Cloud SQL (MongoDB Alternative - Firestore in Datastore mode)
resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = "${local.name_prefix}-firestore"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  concurrency_mode = "OPTIMISTIC"

  app_engine_integration_mode = "DISABLED"
}

# Memorystore Redis
resource "google_redis_instance" "cache" {
  name           = "${local.name_prefix}-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = var.redis_memory_size_gb
  region         = var.region

  authorized_network = google_compute_network.vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version     = "REDIS_7_0"
  display_name      = "Moodify Redis Cache"

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 3
        minutes = 0
      }
    }
  }

  labels = local.common_labels

  project = var.project_id
}

# Cloud Storage Buckets
resource "google_storage_bucket" "models" {
  name          = "${local.name_prefix}-models-${var.project_id}"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  labels = local.common_labels

  project = var.project_id
}

resource "google_storage_bucket" "assets" {
  name          = "${local.name_prefix}-assets-${var.project_id}"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  labels = local.common_labels

  project = var.project_id
}

resource "google_storage_bucket" "logs" {
  name          = "${local.name_prefix}-logs-${var.project_id}"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }

  labels = local.common_labels

  project = var.project_id
}

# Container Registry (Artifact Registry)
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "${local.name_prefix}-docker"
  description   = "Docker container images for Moodify"
  format        = "DOCKER"

  labels = local.common_labels

  project = var.project_id
}

# Cloud Load Balancing
resource "google_compute_global_address" "default" {
  name    = "${local.name_prefix}-lb-ip"
  project = var.project_id
}

# Secret Manager
resource "google_secret_manager_secret" "application_secrets" {
  secret_id = "${local.name_prefix}-secrets"

  replication {
    automatic = true
  }

  labels = local.common_labels

  project = var.project_id
}

resource "google_secret_manager_secret_version" "application_secrets" {
  secret = google_secret_manager_secret.application_secrets.id

  secret_data = jsonencode({
    MONGODB_URI           = "firestore://${var.project_id}"
    REDIS_HOST           = google_redis_instance.cache.host
    REDIS_PORT           = google_redis_instance.cache.port
    JWT_SECRET_KEY       = var.jwt_secret_key
    SPOTIFY_CLIENT_ID    = var.spotify_client_id
    SPOTIFY_CLIENT_SECRET = var.spotify_client_secret
  })
}

# Cloud Monitoring
resource "google_monitoring_notification_channel" "email" {
  display_name = "Email Notification Channel"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }

  project = var.project_id
}

# Cloud Logging
resource "google_logging_project_sink" "application_logs" {
  name        = "${local.name_prefix}-app-logs"
  destination = "storage.googleapis.com/${google_storage_bucket.logs.name}"

  filter = <<-EOT
    resource.type="k8s_container"
    resource.labels.cluster_name="${google_container_cluster.primary.name}"
    resource.labels.namespace_name="moodify-production"
  EOT

  unique_writer_identity = true

  project = var.project_id
}

# IAM Service Account for Workload Identity
resource "google_service_account" "gke_workload" {
  account_id   = "${local.name_prefix}-gke-workload"
  display_name = "GKE Workload Identity Service Account"
  project      = var.project_id
}

# Grant necessary permissions
resource "google_project_iam_member" "gke_workload_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.gke_workload.email}"
}

resource "google_project_iam_member" "gke_workload_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.gke_workload.email}"
}

# Outputs
output "gke_cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.primary.name
}

output "gke_cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = google_container_cluster.primary.endpoint
  sensitive   = true
}

output "redis_host" {
  description = "Redis instance host"
  value       = google_redis_instance.cache.host
  sensitive   = true
}

output "redis_port" {
  description = "Redis instance port"
  value       = google_redis_instance.cache.port
}

output "load_balancer_ip" {
  description = "Load balancer external IP"
  value       = google_compute_global_address.default.address
}

output "artifact_registry_url" {
  description = "Artifact Registry URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}"
}

output "storage_buckets" {
  description = "Storage bucket names"
  value = {
    models = google_storage_bucket.models.name
    assets = google_storage_bucket.assets.name
    logs   = google_storage_bucket.logs.name
  }
}
