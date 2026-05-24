# =============================================================================
# GKE module
# =============================================================================
# Regional GKE cluster with separate workload node pool, Workload
# Identity, Shielded Nodes, private nodes, network policy, binary
# authorization, dataplane v2 (Cilium-based), maintenance + release
# channel set to REGULAR.
# =============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 5.30" }
  }
}

locals {
  name = "${var.project_name}-${var.environment}"
  tags = merge(
    {
      project     = var.project_name
      environment = var.environment
      component   = "gke"
      managed-by  = "terraform"
    },
    var.labels,
  )
}

resource "google_container_cluster" "this" {
  name                     = "${local.name}-gke"
  location                 = var.region
  project                  = var.project_id
  remove_default_node_pool = true
  initial_node_count       = 1
  deletion_protection      = var.deletion_protection
  networking_mode          = "VPC_NATIVE"
  network                  = var.network
  subnetwork               = var.subnetwork
  datapath_provider        = "ADVANCED_DATAPATH" # Cilium-based
  enable_shielded_nodes    = true

  ip_allocation_policy {
    cluster_secondary_range_name  = var.cluster_secondary_range_name
    services_secondary_range_name = var.services_secondary_range_name
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = var.enable_private_endpoint
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block
  }

  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = var.master_authorized_networks
      content {
        cidr_block   = cidr_blocks.value.cidr_block
        display_name = cidr_blocks.value.display_name
      }
    }
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  release_channel { channel = var.release_channel }

  addons_config {
    horizontal_pod_autoscaling { disabled = false }
    http_load_balancing        { disabled = false }
    network_policy_config      { disabled = false }
    gce_persistent_disk_csi_driver_config { enabled = true }
    gcp_filestore_csi_driver_config       { enabled = true }
  }

  binary_authorization { evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE" }

  maintenance_policy {
    recurring_window {
      start_time = "2024-01-01T04:00:00Z"
      end_time   = "2024-01-01T07:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SU"
    }
  }

  resource_labels = local.tags

  logging_service    = "logging.googleapis.com/kubernetes"
  monitoring_service = "monitoring.googleapis.com/kubernetes"

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS", "APISERVER", "SCHEDULER", "CONTROLLER_MANAGER"]
    managed_prometheus { enabled = true }
  }

  lifecycle {
    ignore_changes = [initial_node_count]
  }
}

# ---- Workload node pool --------------------------------------------------
resource "google_container_node_pool" "workload" {
  name       = "workload"
  cluster    = google_container_cluster.this.id
  location   = var.region
  node_count = null

  autoscaling {
    min_node_count = var.workload_min_count
    max_node_count = var.workload_max_count
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
    strategy        = "SURGE"
  }

  node_config {
    machine_type    = var.workload_machine_type
    disk_size_gb    = 100
    disk_type       = "pd-balanced"
    image_type      = "COS_CONTAINERD"
    service_account = var.node_service_account_email
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
    workload_metadata_config { mode = "GKE_METADATA" }
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    labels       = local.tags
    tags         = ["${local.name}-workload"]
    metadata     = { "disable-legacy-endpoints" = "true" }
  }
}
