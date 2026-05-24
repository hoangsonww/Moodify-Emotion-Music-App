variable "project_name"        { type = string }
variable "environment"         { type = string }
variable "resource_group_name" { type = string }
variable "location"            { type = string, default = "eastus" }
variable "subnet_id"           { type = string }
variable "availability_zones"  { type = list(string), default = ["1", "2", "3"] }

variable "kubernetes_version" { type = string, default = "1.30" }
variable "sku_tier"           { type = string, default = "Standard" }

variable "system_vm_size"     { type = string, default = "Standard_D2s_v5" }
variable "system_node_count"  { type = number, default = 2 }
variable "system_min_count"   { type = number, default = 2 }
variable "system_max_count"   { type = number, default = 4 }

variable "workload_vm_size"     { type = string, default = "Standard_D4s_v5" }
variable "workload_node_count"  { type = number, default = 3 }
variable "workload_min_count"   { type = number, default = 2 }
variable "workload_max_count"   { type = number, default = 12 }

variable "admin_group_object_ids" {
  type        = list(string)
  default     = []
  description = "Azure AD group object IDs that get cluster-admin."
}

variable "log_retention_d" { type = number, default = 30 }
variable "tags"            { type = map(string), default = {} }
