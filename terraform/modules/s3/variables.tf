variable "project_name" { type = string }
variable "environment"  { type = string }

variable "bucket_names" {
  type        = list(string)
  description = "Globally unique S3 bucket names to create."
}

variable "kms_key_arn" {
  type        = string
  default     = ""
  description = "If set, encrypt with SSE-KMS using this key; else SSE-S3."
}

variable "noncurrent_expiration_d" {
  type    = number
  default = 90
}

variable "intelligent_tiering" {
  type    = bool
  default = true
}

variable "force_destroy" {
  type        = bool
  default     = false
  description = "Allow `terraform destroy` even if the bucket is non-empty."
}

variable "access_log_target_bucket" {
  type        = string
  default     = ""
  description = "Name of an existing access-log bucket; empty disables logging."
}

variable "tags" {
  type    = map(string)
  default = {}
}
