resource "oci_artifacts_container_repository" "frontend" {
  compartment_id = var.compartment_ocid
  display_name   = "moodify-frontend"
  is_public      = false
  freeform_tags  = local.common_tags
}

resource "oci_artifacts_container_repository" "backend" {
  compartment_id = var.compartment_ocid
  display_name   = "moodify-backend"
  is_public      = false
  freeform_tags  = local.common_tags
}

resource "oci_artifacts_container_repository" "ai_ml" {
  compartment_id = var.compartment_ocid
  display_name   = "moodify-ai-ml"
  is_public      = false
  freeform_tags  = local.common_tags
}
