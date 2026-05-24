# `aws/terraform`

Self-contained Terraform root for the AWS deployment of Moodify. Stands
up a 3-AZ VPC, an EKS cluster, RDS Postgres, ElastiCache Redis, the
app S3 buckets, the kube-prometheus-stack monitoring layer, and an
Argo CD install for GitOps — all in one `terraform apply`.

```
aws/terraform/
├── main.tf                root composition
├── variables.tf           inputs (env, region, sizing, secrets)
├── outputs.tf             every key downstream automation needs
├── terraform.tfvars.example
└── backend.hcl.example
```

## Bootstrap (one-time per account)

```bash
# 1. State bucket + lock table
aws s3api create-bucket --bucket moodify-terraform-state --region us-east-1
aws s3api put-bucket-versioning --bucket moodify-terraform-state \
  --versioning-configuration Status=Enabled
aws dynamodb create-table \
  --table-name moodify-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# 2. Copy + fill the example files
cp terraform.tfvars.example terraform.tfvars
cp backend.hcl.example backend.hcl
$EDITOR terraform.tfvars backend.hcl

# 3. Init + plan + apply
terraform init -backend-config=backend.hcl
terraform plan -out=tfplan.bin
terraform apply tfplan.bin
```

## Useful outputs

```bash
terraform output -json | jq .

aws eks update-kubeconfig --name $(terraform output -raw eks_cluster_name) \
  --region $(terraform output -raw aws_region)

kubectl get nodes
```

## See also

* [`../README.md`](../README.md) — AWS deployment guide (full walkthrough)
* [`../../terraform/modules/`](../../terraform/modules/) — reusable building blocks (vpc, eks, rds, redis, s3, monitoring, argocd)
* [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md) — deploy procedures (blue/green, canary)
* [`../../INFRASTRUCTURE_SETUP.md`](../../INFRASTRUCTURE_SETUP.md) — infra walkthrough
