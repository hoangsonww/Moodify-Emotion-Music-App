resource "oci_identity_dynamic_group" "oke_nodes" {
  compartment_id = var.tenancy_ocid
  name           = "${local.name_prefix}-oke-nodes"
  description    = "Dynamic group for Moodify OKE worker nodes"
  matching_rule  = "ALL {instance.compartment.id = '${var.compartment_ocid}'}"
}

resource "oci_identity_policy" "oke_nodes" {
  compartment_id = var.compartment_ocid
  name           = "${local.name_prefix}-oke-nodes-policy"
  description    = "Allow OKE nodes to pull images and access Object Storage"

  statements = [
    "Allow dynamic-group ${oci_identity_dynamic_group.oke_nodes.name} to read repos in tenancy",
    "Allow dynamic-group ${oci_identity_dynamic_group.oke_nodes.name} to manage objects in compartment id ${var.compartment_ocid}",
    "Allow dynamic-group ${oci_identity_dynamic_group.oke_nodes.name} to read buckets in compartment id ${var.compartment_ocid}",
    "Allow dynamic-group ${oci_identity_dynamic_group.oke_nodes.name} to use logging-family in compartment id ${var.compartment_ocid}"
  ]
}
