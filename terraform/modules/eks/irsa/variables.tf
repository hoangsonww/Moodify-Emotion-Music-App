variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "oidc_provider_arn" {
  type = string
}

variable "oidc_provider_url" {
  type = string
}

variable "service_account_name" {
  type = string
}

variable "service_account_namespace" {
  type = string
}

variable "policy_arns" {
  type = list(string)
}

variable "role_name" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
