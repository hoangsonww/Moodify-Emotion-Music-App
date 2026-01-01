resource "oci_logging_log_group" "moodify" {
  compartment_id = var.compartment_ocid
  display_name   = "${local.name_prefix}-logs"
  freeform_tags  = local.common_tags
}
