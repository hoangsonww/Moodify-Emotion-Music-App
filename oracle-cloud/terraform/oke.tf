data "oci_core_images" "oke" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Oracle Linux"
  operating_system_version = "8"
  shape                    = var.node_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_containerengine_cluster" "moodify" {
  compartment_id     = var.compartment_ocid
  kubernetes_version = var.oke_k8s_version
  name               = var.oke_cluster_name
  vcn_id             = oci_core_vcn.moodify.id

  endpoint_config {
    is_public_ip_enabled = true
    subnet_id            = oci_core_subnet.public.id
  }

  options {
    service_lb_subnet_ids = [oci_core_subnet.public.id]
  }

  freeform_tags = local.common_tags
}

resource "oci_containerengine_node_pool" "moodify" {
  cluster_id         = oci_containerengine_cluster.moodify.id
  compartment_id     = var.compartment_ocid
  kubernetes_version = var.oke_k8s_version
  name               = "${local.name_prefix}-node-pool"
  node_shape         = var.node_shape

  node_shape_config {
    ocpus         = var.node_ocpus
    memory_in_gbs = var.node_memory_gbs
  }

  node_config_details {
    size = var.node_pool_size
    nsg_ids = [
      oci_core_network_security_group.oke_nodes.id
    ]
    placement_configs {
      availability_domain = local.availability_domain
      subnet_id           = oci_core_subnet.private.id
    }
  }

  node_source_details {
    source_type = "IMAGE"
    image_id    = data.oci_core_images.oke.images[0].id
  }

  ssh_public_key = var.node_pool_ssh_public_key

  freeform_tags = local.common_tags
}
