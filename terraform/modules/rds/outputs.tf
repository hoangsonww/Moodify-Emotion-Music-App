output "endpoint" {
  description = "Connection endpoint (host:port)."
  value       = aws_db_instance.this.endpoint
}

output "address" {
  description = "Hostname only."
  value       = aws_db_instance.this.address
}

output "port" {
  description = "Listening port (always 5432)."
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Database name."
  value       = aws_db_instance.this.db_name
}

output "secret_arn" {
  description = "Secrets Manager ARN holding the master credentials."
  value       = aws_secretsmanager_secret.master.arn
}

output "security_group_id" {
  description = "DB security group ID — pass to app SGs for ingress rules."
  value       = aws_security_group.this.id
}

output "kms_key_arn" {
  description = "KMS key ARN used for storage encryption."
  value       = aws_kms_key.rds.arn
}
