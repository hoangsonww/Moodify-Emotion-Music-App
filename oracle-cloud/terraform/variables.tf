variable "tenancy_ocid" {
  type        = string
  description = "OCI tenancy OCID."
}

variable "user_ocid" {
  type        = string
  description = "OCI user OCID."
}

variable "fingerprint" {
  type        = string
  description = "API signing key fingerprint."
}

variable "private_key_path" {
  type        = string
  description = "Path to the OCI API private key."
}

variable "region" {
  type        = string
  description = "OCI region identifier."
}

variable "compartment_ocid" {
  type        = string
  description = "Compartment OCID for Moodify resources."
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Deployment environment name."
}

variable "vcn_cidr" {
  type        = string
  default     = "10.20.0.0/16"
  description = "CIDR block for the VCN."
}

variable "public_subnet_cidr" {
  type        = string
  default     = "10.20.1.0/24"
  description = "CIDR block for the public subnet."
}

variable "private_subnet_cidr" {
  type        = string
  default     = "10.20.2.0/24"
  description = "CIDR block for the private subnet."
}

variable "oke_cluster_name" {
  type        = string
  default     = "moodify-oke"
  description = "OKE cluster name."
}

variable "oke_k8s_version" {
  type        = string
  default     = "v1.28.2"
  description = "Kubernetes version for OKE."
}

variable "node_pool_size" {
  type        = number
  default     = 3
  description = "Number of nodes in the default node pool."
}

variable "node_shape" {
  type        = string
  default     = "VM.Standard.E4.Flex"
  description = "Shape for worker nodes."
}

variable "node_ocpus" {
  type        = number
  default     = 4
  description = "OCPU count per node (Flex shapes only)."
}

variable "node_memory_gbs" {
  type        = number
  default     = 16
  description = "Memory in GB per node (Flex shapes only)."
}

variable "node_pool_ssh_public_key" {
  type        = string
  description = "SSH public key for node access."
}

variable "ocir_namespace" {
  type        = string
  description = "OCIR namespace (tenancy name)."
}

variable "object_storage_bucket_prefix" {
  type        = string
  default     = "moodify"
  description = "Prefix for Object Storage buckets."
}

variable "enable_waf" {
  type        = bool
  default     = true
  description = "Create OCI WAF policy for the load balancer."
}
