# =============================================================================
# S3 buckets module
# =============================================================================
# Spins up a configurable number of S3 buckets with prod-sensible defaults:
#   * Server-side encryption (SSE-S3 or SSE-KMS depending on `kms_key_arn`)
#   * Versioning enabled (mandatory for compliance + ransomware recovery)
#   * Public access fully blocked
#   * Lifecycle: noncurrent versions expire after 90 d; intelligent tiering
#   * Bucket policy: TLS-only (deny insecure transport)
#   * Optional access logging to a central bucket
# =============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

locals {
  base_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      Component   = "s3"
      ManagedBy   = "terraform"
    },
    var.tags,
  )
}

resource "aws_s3_bucket" "this" {
  for_each      = toset(var.bucket_names)
  bucket        = each.value
  force_destroy = var.force_destroy
  tags          = merge(local.base_tags, { Name = each.value })
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each                = aws_s3_bucket.this
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_arn == "" ? "AES256" : "aws:kms"
      kms_master_key_id = var.kms_key_arn == "" ? null : var.kms_key_arn
    }
    bucket_key_enabled = var.kms_key_arn == "" ? null : true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
    filter {}
  }

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"
    noncurrent_version_expiration { noncurrent_days = var.noncurrent_expiration_d }
    filter {}
  }

  dynamic "rule" {
    for_each = var.intelligent_tiering ? [1] : []
    content {
      id     = "intelligent-tiering"
      status = "Enabled"
      transition {
        days          = 0
        storage_class = "INTELLIGENT_TIERING"
      }
      filter {}
    }
  }
}

# Force HTTPS — deny any request not on TLS.
data "aws_iam_policy_document" "tls_only" {
  for_each = aws_s3_bucket.this
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [each.value.arn, "${each.value.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "tls_only" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  policy   = data.aws_iam_policy_document.tls_only[each.key].json
}

# Optional: access logging fan-out
resource "aws_s3_bucket_logging" "this" {
  for_each      = var.access_log_target_bucket == "" ? {} : aws_s3_bucket.this
  bucket        = each.value.id
  target_bucket = var.access_log_target_bucket
  target_prefix = "${each.value.id}/"
}
