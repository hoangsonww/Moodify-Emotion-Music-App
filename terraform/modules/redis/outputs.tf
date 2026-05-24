output "primary_endpoint_address" {
  description = "Primary node hostname (writes go here)."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "reader_endpoint_address" {
  description = "Reader endpoint (load-balanced replicas)."
  value       = aws_elasticache_replication_group.this.reader_endpoint_address
}

output "port" {
  description = "Listening port (always 6379)."
  value       = aws_elasticache_replication_group.this.port
}

output "auth_secret_arn" {
  description = "Secrets Manager ARN with the AUTH token JSON blob."
  value       = aws_secretsmanager_secret.auth.arn
}

output "security_group_id" {
  description = "Redis SG — pass to app SGs for ingress."
  value       = aws_security_group.this.id
}

output "kms_key_arn" {
  description = "KMS key ARN used for at-rest encryption."
  value       = aws_kms_key.redis.arn
}
