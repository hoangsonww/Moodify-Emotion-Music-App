# AWS production Kubernetes overlays

Manifests applied to the EKS cluster after the Terraform infra is up.
Kept under `aws/kubernetes/` rather than the cross-cloud
`../../kubernetes/` so the AWS-specific bits (ALB ingress annotations,
EBS storage classes, IRSA on service accounts) don't leak into other
clouds.

## Files

| File                       | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `namespaces.yaml`          | `moodify`, `moodify-staging`, `moodify-canary` with PSA labels |
| `configmap.yaml`           | App config (DJANGO_SETTINGS_MODULE, MODAL_INFERENCE_URL, etc.) |
| `backend-deployment.yaml`  | Backend Deployment + Service + HPA + PDB w/ AWS-isms          |

## Apply order

```bash
# 1. Get a kubeconfig from the EKS cluster
aws eks update-kubeconfig \
  --name $(cd ../../terraform && terraform output -raw eks_cluster_name) \
  --region us-east-1

# 2. Apply namespaces first (PSA labels gate everything else)
kubectl apply -f namespaces.yaml

# 3. Config + workloads
kubectl apply -f configmap.yaml
kubectl apply -f backend-deployment.yaml

# 4. Wire ingress + secrets via the cross-cloud manifests in ../../kubernetes/common/
kubectl apply -f ../../kubernetes/common/
```

## AWS-specific knobs

| Where                    | What to expect                                                  |
| ------------------------ | --------------------------------------------------------------- |
| Service annotations      | `service.beta.kubernetes.io/aws-load-balancer-type: nlb`        |
| Ingress annotations      | `alb.ingress.kubernetes.io/scheme: internet-facing`             |
| ServiceAccount           | IRSA: `eks.amazonaws.com/role-arn: arn:aws:iam::…:role/moodify-backend` |
| StorageClass             | `ebs-sc-gp3` (created by Terraform via the EBS CSI add-on)      |
| Image registry           | `<account>.dkr.ecr.<region>.amazonaws.com/moodify-backend`      |

## See also

* [`../README.md`](../README.md) — full AWS deployment guide
* [`../terraform/`](../terraform/) — IaC that provisions the underlying cluster
* [`../../kubernetes/`](../../kubernetes/) — cross-cloud base manifests
