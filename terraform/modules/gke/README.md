# `terraform/modules/gke`

Regional GKE cluster with the security + observability baseline a
production deploy needs out of the gate.

Features:

* Workload Identity (federated GCP SA per K8s SA, no JSON keys).
* Private nodes + optional private endpoint.
* Shielded Nodes (secure boot, integrity monitoring).
* Binary Authorization enforced.
* Cilium-based dataplane (`ADVANCED_DATAPATH`) for fast network policy.
* Managed Prometheus enabled out of the box.
* Weekly maintenance window Sunday 04:00–07:00 UTC.

## Usage

```hcl
module "gke" {
  source       = "../../modules/gke"
  project_name = "moodify"
  environment  = "production"
  project_id   = var.gcp_project_id
  region       = "us-central1"
  network      = google_compute_network.vpc.id
  subnetwork   = google_compute_subnetwork.gke.id

  workload_machine_type      = "e2-standard-8"
  workload_min_count         = 3
  workload_max_count         = 12
  node_service_account_email = google_service_account.gke_nodes.email
  master_authorized_networks = [
    { cidr_block = "203.0.113.0/24", display_name = "office" },
  ]
}
```

## Outputs

| Output           | Purpose                              |
| ---------------- | ------------------------------------ |
| `cluster_name`   | feed to `gcloud container clusters get-credentials` |
| `endpoint`       | API endpoint (sensitive)              |
| `ca_certificate` | base64 cluster CA cert (sensitive)    |
| `workload_pool`  | use in IAM bindings: `<sa>@<project>.iam.gserviceaccount.com` ↔ K8s SA |

## Notes

* `deletion_protection = true` by default — flip explicitly when
  destroying ephemeral envs.
* Pair with a HashiCorp Vault or Secret Manager backend via External
  Secrets Operator for runtime secrets.
