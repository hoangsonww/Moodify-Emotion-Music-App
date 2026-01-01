resource "oci_objectstorage_bucket" "models" {
  compartment_id = var.compartment_ocid
  namespace      = data.oci_objectstorage_namespace.namespace.namespace
  name           = "${var.object_storage_bucket_prefix}-models"
  access_type    = "NoPublicAccess"
  freeform_tags  = local.common_tags
}

resource "oci_objectstorage_bucket" "assets" {
  compartment_id = var.compartment_ocid
  namespace      = data.oci_objectstorage_namespace.namespace.namespace
  name           = "${var.object_storage_bucket_prefix}-assets"
  access_type    = "NoPublicAccess"
  freeform_tags  = local.common_tags
}

resource "oci_objectstorage_bucket" "logs" {
  compartment_id = var.compartment_ocid
  namespace      = data.oci_objectstorage_namespace.namespace.namespace
  name           = "${var.object_storage_bucket_prefix}-logs"
  access_type    = "NoPublicAccess"
  freeform_tags  = local.common_tags
}
