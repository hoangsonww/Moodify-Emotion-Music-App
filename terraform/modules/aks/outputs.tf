output "cluster_id" {
  description = "AKS cluster resource ID."
  value       = azurerm_kubernetes_cluster.this.id
}

output "cluster_name" {
  description = "AKS cluster name."
  value       = azurerm_kubernetes_cluster.this.name
}

output "kube_config" {
  description = "Raw kubeconfig (sensitive). Prefer az aks get-credentials."
  value       = azurerm_kubernetes_cluster.this.kube_config_raw
  sensitive   = true
}

output "oidc_issuer_url" {
  description = "OIDC issuer URL for workload identity."
  value       = azurerm_kubernetes_cluster.this.oidc_issuer_url
}

output "node_resource_group" {
  description = "Implicit RG for cluster nodes / disks / LBs."
  value       = azurerm_kubernetes_cluster.this.node_resource_group
}

output "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID (for diagnostic settings)."
  value       = azurerm_log_analytics_workspace.this.id
}
