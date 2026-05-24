# `aws/iam/` — IRSA roles for Moodify on EKS

Examples of least-privilege IAM-Role-for-Service-Account (IRSA) bindings.
Each role trusts the EKS cluster's OIDC issuer plus a single Kubernetes
ServiceAccount; nothing in the cluster needs static AWS credentials.

## Files

| File | What it provisions |
| --- | --- |
| `irsa-examples.tf` | Three example IRSA roles: external-secrets-operator, moodify-backend, cluster-autoscaler |

## How to use

```hcl
module "irsa" {
  source                    = "../iam"
  project_name              = var.project_name
  environment               = var.environment
  aws_region                = var.aws_region
  cluster_oidc_provider_arn = module.eks.oidc_provider_arn
  cluster_oidc_issuer_url   = module.eks.oidc_issuer_url
}
```

Then annotate the Kubernetes ServiceAccounts with the role ARNs:

```bash
EXT=$(terraform output -raw external_secrets_role_arn)
kubectl -n moodify annotate sa external-secrets-sa eks.amazonaws.com/role-arn=${EXT}

BE=$(terraform output -raw backend_role_arn)
kubectl -n moodify annotate sa moodify-backend-sa  eks.amazonaws.com/role-arn=${BE}

CA=$(terraform output -raw cluster_autoscaler_role_arn)
kubectl -n kube-system annotate sa cluster-autoscaler eks.amazonaws.com/role-arn=${CA}
```

The `aws/kubernetes/production/external-secrets.yaml` and
`aws/kubernetes/production/cluster-autoscaler.yaml` overlays already have
`eks.amazonaws.com/role-arn: REPLACE_ME` placeholders — swap in the outputs.

## Adding a new IRSA role

1. Copy one of the example blocks.
2. Change the `:sub` condition to your `system:serviceaccount:<ns>:<sa>`.
3. Replace the policy document with the minimum AWS actions the workload
   needs (CloudTrail audit logs are your friend here).
4. `terraform plan` + apply, then annotate the SA.

> Never reuse a single IRSA role across unrelated workloads — each
> ServiceAccount gets its own role so a compromise blast radius stays small.
