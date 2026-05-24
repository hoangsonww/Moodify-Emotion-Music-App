variable "project_name"      { type = string }
variable "environment"       { type = string }
variable "vpc_id"            { type = string }
variable "subnet_ids"        { type = list(string) }
variable "allowed_security_group_ids" {
  type        = list(string)
  default     = []
  description = "Security groups allowed to talk to Postgres on 5432."
}

variable "engine_version"       { type = string, default = "16.3" }
variable "engine_major_version" { type = string, default = "16"  }

variable "instance_class"  { type = string, default = "db.t3.small" }
variable "storage_gb"      { type = number, default = 20 }
variable "max_storage_gb"  { type = number, default = 200 }

variable "db_name"          { type = string, default = "moodify" }
variable "master_username"  { type = string, default = "moodify" }

variable "multi_az"             { type = bool,   default = false }
variable "backup_retention_d"   { type = number, default = 7 }
variable "deletion_protection"  { type = bool,   default = true }

variable "alarm_sns_topic_arns" {
  type        = list(string)
  default     = []
  description = "SNS topic ARNs that receive low-storage alarms."
}

variable "tags" {
  type    = map(string)
  default = {}
}
