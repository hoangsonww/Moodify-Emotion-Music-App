variable "project_name" { type = string }
variable "environment"  { type = string }
variable "namespace"    { type = string, default = "argocd" }
variable "chart_version" { type = string, default = "7.4.4" }

variable "domain"            { type = string, default = "argocd.example.com" }
variable "ingress_enabled"   { type = bool,   default = true }
variable "admin_group"       { type = string, default = "moodify-platform-admins" }
variable "controller_replicas" {
  type    = number
  default = 2
}
variable "notifications_enabled" {
  type    = bool
  default = false
}

variable "initial_admin_password_hash" {
  type        = string
  default     = ""
  description = "bcrypt hash; leave empty to use the auto-generated secret."
  sensitive   = true
}

variable "repo_url"      { type = string, default = "" }
variable "repo_revision" { type = string, default = "master" }
variable "apps_path"     { type = string, default = "argocd/applications" }
