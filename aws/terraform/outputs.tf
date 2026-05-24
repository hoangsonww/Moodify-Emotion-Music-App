# =============================================================================
# Moodify on AWS — Terraform outputs
# =============================================================================
# Wire these into downstream automation (CI/CD, External Secrets, ArgoCD
# bootstrap, runbooks). Sensitive values are flagged so `terraform output`
# doesn't leak them onto stdout by default.
# =============================================================================

output "vpc_id" {
  description = "ID of the production VPC."
  value       = try(module.vpc.vpc_id, null)
}

output "vpc_cidr" {
  description = "CIDR block of the production VPC."
  value       = try(module.vpc.vpc_cidr_block, null)
}

output "private_subnet_ids" {
  description = "Private subnet IDs (EKS workloads land here)."
  value       = try(module.vpc.private_subnet_ids, [])
}

output "public_subnet_ids" {
  description = "Public subnet IDs (ALBs / NLBs)."
  value       = try(module.vpc.public_subnet_ids, [])
}

output "database_subnet_ids" {
  description = "Database subnet IDs (RDS subnet group)."
  value       = try(module.vpc.database_subnet_ids, [])
}

output "eks_cluster_name" {
  description = "EKS cluster name — feed to `aws eks update-kubeconfig`."
  value       = try(module.eks.cluster_name, null)
}

output "eks_cluster_endpoint" {
  description = "EKS API server endpoint."
  value       = try(module.eks.cluster_endpoint, null)
}

output "eks_oidc_issuer_url" {
  description = "OIDC issuer URL for IRSA."
  value       = try(module.eks.oidc_issuer_url, null)
}

output "eks_node_security_group_id" {
  description = "EKS node SG — pass to RDS/Redis allow-lists."
  value       = try(module.eks.node_security_group_id, null)
}

output "rds_endpoint" {
  description = "Postgres endpoint (host:port)."
  value       = try(module.rds.endpoint, null)
}

output "rds_secret_arn" {
  description = "Secrets Manager ARN holding DB master creds."
  value       = try(module.rds.secret_arn, null)
}

output "redis_endpoint" {
  description = "Redis primary endpoint hostname."
  value       = try(module.redis.primary_endpoint_address, null)
}

output "redis_auth_secret_arn" {
  description = "Secrets Manager ARN holding Redis AUTH token JSON."
  value       = try(module.redis.auth_secret_arn, null)
}

output "app_bucket_arns" {
  description = "Map of bucket-name → ARN created by the s3 module."
  value       = try(module.buckets.bucket_arns, {})
}

output "kubeconfig_command" {
  description = "Convenience CLI to update local kubeconfig."
  value       = try("aws eks update-kubeconfig --name ${module.eks.cluster_name} --region ${var.aws_region}", null)
}

output "grafana_url" {
  description = "In-cluster URL for the Grafana UI."
  value       = try(module.monitoring.grafana_url, null)
}

output "argocd_url" {
  description = "External URL for Argo CD."
  value       = try(module.argocd.server_url, null)
}
