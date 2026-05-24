output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "cluster_arn" {
  description = "EKS cluster ARN"
  value       = aws_eks_cluster.main.arn
}

output "cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_version" {
  description = "Running cluster Kubernetes version"
  value       = aws_eks_cluster.main.version
}

output "cluster_certificate_authority_data" {
  description = "Base64 cluster CA — required for kubeconfig generation"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_security_group_id" {
  description = "Cluster ENI security group"
  value       = aws_security_group.cluster.id
}

output "oidc_provider_arn" {
  description = "IAM OIDC provider ARN — pass to IRSA module"
  value       = aws_iam_openid_connect_provider.cluster.arn
}

output "oidc_issuer_url" {
  description = "OIDC issuer URL — used by IRSA trust policy"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "node_group_iam_role_arn" {
  description = "IAM role ARN attached to managed node groups"
  value       = aws_iam_role.node_group.arn
}

output "kms_key_arn" {
  description = "KMS key encrypting secrets at rest"
  value       = aws_kms_key.eks.arn
}

output "cloudwatch_log_group_name" {
  description = "Cluster control-plane log group"
  value       = aws_cloudwatch_log_group.cluster.name
}
