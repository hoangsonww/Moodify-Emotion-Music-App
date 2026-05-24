# `terraform/modules/aks`

Production-grade Azure Kubernetes Service cluster. System + user node
pools, Calico network policy, Azure AD RBAC, Workload Identity (OIDC),
Azure Monitor for Containers, Defender add-on, weekly maintenance
window, autoscaling.

## Usage

```hcl
module "aks" {
  source              = "../../modules/aks"
  project_name        = "moodify"
  environment         = "production"
  resource_group_name = azurerm_resource_group.platform.name
  location            = "eastus"
  subnet_id           = azurerm_subnet.aks.id

  workload_vm_size    = "Standard_D8s_v5"
  workload_min_count  = 3
  workload_max_count  = 12
  admin_group_object_ids = [data.azuread_group.platform_admins.object_id]
}
```

## Notes

* `local_account_disabled = true` — admin auth ONLY via Azure AD groups.
* `oidc_issuer_enabled` + `workload_identity_enabled` so Pods can use
  managed identities via federated credentials (no secrets in K8s).
* `oms_agent` ships container logs + metrics to Log Analytics; pair
  with a workbook + alert rule.
* Use `az aks get-credentials --resource-group <rg> --name <cluster>`
  rather than the `kube_config` output (which is sensitive + rotates).
