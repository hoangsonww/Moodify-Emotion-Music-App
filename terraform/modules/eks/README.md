# `terraform/modules/eks`

Production-grade EKS cluster with OIDC issuer for IRSA, managed node
groups (system + workload), kube-proxy / coredns / vpc-cni / ebs-csi
add-ons, control-plane logging, KMS-encrypted etcd secrets, and a
dedicated cluster security group for ingress from app SGs.

## Usage

```hcl
module "eks" {
  source       = "../../modules/eks"
  project_name = "moodify"
  environment  = "production"
  vpc_id       = module.vpc.vpc_id
  subnet_ids   = module.vpc.private_subnet_ids

  cluster_version       = "1.30"
  node_instance_types   = ["m5.large", "m5a.large"]
  node_desired_size     = 4
  node_min_size         = 3
  node_max_size         = 12
  node_capacity_type    = "ON_DEMAND"
  enable_irsa           = true
  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}
```

## Sub-resources

* `irsa/` — IAM-role-for-service-account helper for plumbing pod-level
  AWS permissions (e.g. external-secrets, cluster-autoscaler, ALB
  controller, EBS CSI driver).
* Cluster security group + node security group (so the RDS / Redis
  modules can grant ingress from EKS nodes).

## Notes

* EBS CSI driver, VPC CNI and CoreDNS are installed as managed add-ons
  with auto-resolve on version conflicts.
* Control-plane logs are shipped to CloudWatch (`/aws/eks/<cluster>/cluster`).
* KMS-encrypted etcd secrets — required for compliance baselines.
* For Fargate workloads, add a `fargate_profiles` map (not enabled in
  this module — uncomment if you need it).
