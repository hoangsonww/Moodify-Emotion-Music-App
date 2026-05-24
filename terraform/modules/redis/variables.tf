variable "project_name" { type = string }
variable "environment"  { type = string }
variable "vpc_id"       { type = string }
variable "subnet_ids"   { type = list(string) }
variable "allowed_security_group_ids" {
  type    = list(string)
  default = []
}

variable "engine_version"          { type = string, default = "7.1" }
variable "parameter_group_family"  { type = string, default = "redis7" }
variable "node_type"               { type = string, default = "cache.t3.small" }
variable "num_cache_nodes"         { type = number, default = 2 }
variable "automatic_failover_enabled" {
  type    = bool
  default = true
}
variable "snapshot_retention_d"    { type = number, default = 7 }
variable "log_retention_d"         { type = number, default = 30 }

variable "alarm_sns_topic_arns" {
  type    = list(string)
  default = []
}

variable "tags" {
  type    = map(string)
  default = {}
}
