# `gcp/terraform`

Self-contained Terraform root for the GCP deployment of Moodify.
Provisions a regional VPC, GKE cluster, Cloud SQL Postgres, Memorystore
Redis, GCS buckets, Workload Identity bindings, and Argo CD — in one
`terraform apply`.

```
gcp/terraform/
├── main.tf
├── variables.tf
├── outputs.tf
└── terraform.tfvars.example
```

## Bootstrap

```bash
# 1. State bucket
gsutil mb -l us-central1 gs://moodify-terraform-state
gsutil versioning set on gs://moodify-terraform-state

# 2. Copy + fill tfvars
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars

# 3. Apply
terraform init
terraform plan -out=tfplan.bin
terraform apply tfplan.bin
```

## Pick up the cluster

```bash
gcloud container clusters get-credentials \
  $(terraform output -raw gke_cluster_name) \
  --region  $(terraform output -raw region) \
  --project $(terraform output -raw project_id)

kubectl get nodes
```

## See also

* [`../README.md`](../README.md) — GCP deployment guide
* [`../../terraform/modules/gke/`](../../terraform/modules/gke/) — reusable GKE module
* [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md)
