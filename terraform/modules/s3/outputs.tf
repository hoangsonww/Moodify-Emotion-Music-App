output "bucket_arns" {
  description = "Map of bucket name → ARN."
  value       = { for k, v in aws_s3_bucket.this : k => v.arn }
}

output "bucket_ids" {
  description = "Map of bucket name → bucket id."
  value       = { for k, v in aws_s3_bucket.this : k => v.id }
}

output "bucket_regional_domain_names" {
  description = "Map of bucket name → regional domain (for CloudFront / direct access)."
  value       = { for k, v in aws_s3_bucket.this : k => v.bucket_regional_domain_name }
}
