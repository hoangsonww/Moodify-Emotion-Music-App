provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

data "oci_objectstorage_namespace" "namespace" {
  compartment_id = var.compartment_ocid
}

locals {
  name_prefix = "moodify-${var.environment}"

  common_tags = {
    Project     = "Moodify"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
}
