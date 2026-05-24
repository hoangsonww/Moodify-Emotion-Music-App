variable "project_name" { type = string }
variable "environment"  { type = string }
variable "project_id"   { type = string }
variable "region"       { type = string }

variable "network"                       { type = string }
variable "subnetwork"                    { type = string }
variable "cluster_secondary_range_name"  { type = string, default = "pods" }
variable "services_secondary_range_name" { type = string, default = "services" }

variable "release_channel"        { type = string, default = "REGULAR" }
variable "enable_private_endpoint"{ type = bool,   default = false }
variable "master_ipv4_cidr_block" { type = string, default = "172.16.0.0/28" }
variable "deletion_protection"    { type = bool,   default = true }

variable "master_authorized_networks" {
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = []
}

variable "workload_machine_type" { type = string, default = "e2-standard-4" }
variable "workload_min_count"    { type = number, default = 2 }
variable "workload_max_count"    { type = number, default = 12 }

variable "node_service_account_email" {
  type        = string
  description = "GCP SA email node pool runs as (least-privileged)."
}

variable "labels" {
  type    = map(string)
  default = {}
}
