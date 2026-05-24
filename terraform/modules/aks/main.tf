# =============================================================================
# Azure Kubernetes Service (AKS) module
# =============================================================================
# Parity with the EKS module: managed control plane + system + workload
# node pools, RBAC + Azure AD integration, OIDC issuer for workload
# identity, network policy (Calico), Log Analytics + Azure Monitor
# add-on, automatic SKU upgrade.
# =============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.95" }
  }
}

locals {
  name = "${var.project_name}-${var.environment}-aks"
  tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      Component   = "aks"
      ManagedBy   = "terraform"
    },
    var.tags,
  )
}

# ---- Log Analytics workspace ---------------------------------------------
resource "azurerm_log_analytics_workspace" "this" {
  name                = "${local.name}-logs"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_d
  tags                = local.tags
}

# ---- Cluster -------------------------------------------------------------
resource "azurerm_kubernetes_cluster" "this" {
  name                = local.name
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = local.name
  kubernetes_version  = var.kubernetes_version
  sku_tier            = var.sku_tier
  oidc_issuer_enabled       = true
  workload_identity_enabled = true
  azure_policy_enabled      = true
  role_based_access_control_enabled = true
  local_account_disabled            = true

  default_node_pool {
    name                = "system"
    node_count          = var.system_node_count
    vm_size             = var.system_vm_size
    os_disk_size_gb     = 64
    type                = "VirtualMachineScaleSets"
    vnet_subnet_id      = var.subnet_id
    zones               = var.availability_zones
    only_critical_addons_enabled = true
    enable_auto_scaling = true
    min_count           = var.system_min_count
    max_count           = var.system_max_count
    tags                = local.tags
    upgrade_settings { max_surge = "33%" }
  }

  identity { type = "SystemAssigned" }

  network_profile {
    network_plugin    = "azure"
    network_policy    = "calico"
    load_balancer_sku = "standard"
    outbound_type     = "loadBalancer"
  }

  azure_active_directory_role_based_access_control {
    managed                = true
    azure_rbac_enabled     = true
    admin_group_object_ids = var.admin_group_object_ids
  }

  oms_agent {
    log_analytics_workspace_id      = azurerm_log_analytics_workspace.this.id
    msi_auth_for_monitoring_enabled = true
  }

  microsoft_defender { log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id }
  auto_scaler_profile { balance_similar_node_groups = true }
  maintenance_window {
    allowed { day = "Sunday", hours = [4, 5, 6] }
  }

  tags = local.tags
}

# ---- Workload node pool --------------------------------------------------
resource "azurerm_kubernetes_cluster_node_pool" "workload" {
  name                  = "workload"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.this.id
  vm_size               = var.workload_vm_size
  enable_auto_scaling   = true
  min_count             = var.workload_min_count
  max_count             = var.workload_max_count
  node_count            = var.workload_node_count
  os_disk_size_gb       = 128
  vnet_subnet_id        = var.subnet_id
  zones                 = var.availability_zones
  mode                  = "User"
  node_labels = {
    "workload" = "moodify"
  }
  tags = local.tags
  upgrade_settings { max_surge = "33%" }
}
