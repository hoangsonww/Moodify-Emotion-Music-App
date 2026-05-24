# `terraform/modules/s3`

Creates one or more S3 buckets with prod-sensible defaults: SSE
encryption (KMS or S3-managed), versioning, full public-access block,
lifecycle (abort incomplete multipart, expire noncurrent versions,
optional intelligent tiering), TLS-only bucket policy, and optional
access logging to a central bucket.

## Usage

```hcl
module "buckets" {
  source       = "../../modules/s3"
  project_name = "moodify"
  environment  = "production"
  bucket_names = [
    "moodify-prod-uploads",
    "moodify-prod-backups",
    "moodify-prod-static",
  ]
  kms_key_arn          = aws_kms_key.app.arn
  intelligent_tiering  = true
  access_log_target_bucket = "moodify-prod-access-logs"
}

# Use outputs in app IRSA role policies
data "aws_iam_policy_document" "app_reads_uploads" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${module.buckets.bucket_arns["moodify-prod-uploads"]}/*"]
  }
}
```

## Notes

* Versioning is **mandatory** — ransomware recovery + accidental
  delete safety. Combined with the 90-day noncurrent-version
  expiration, storage stays bounded.
* TLS-only bucket policy applies even if the IAM caller is allowed —
  HTTPS or 403.
* `force_destroy = false` by default. Flip only in ephemeral envs.
