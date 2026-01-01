resource "oci_core_vcn" "moodify" {
  compartment_id = var.compartment_ocid
  cidr_block     = var.vcn_cidr
  display_name   = "${local.name_prefix}-vcn"
  dns_label      = "moodify"
  freeform_tags  = local.common_tags
}

resource "oci_core_internet_gateway" "moodify" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.moodify.id
  display_name   = "${local.name_prefix}-igw"
  enabled        = true
  freeform_tags  = local.common_tags
}

resource "oci_core_nat_gateway" "moodify" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.moodify.id
  display_name   = "${local.name_prefix}-nat"
  freeform_tags  = local.common_tags
}

resource "oci_core_service_gateway" "moodify" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.moodify.id
  display_name   = "${local.name_prefix}-sgw"
  services {
    service_id = data.oci_core_services.all.services[0].id
  }
  freeform_tags = local.common_tags
}

data "oci_core_services" "all" {}

resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.moodify.id
  display_name   = "${local.name_prefix}-public-rt"
  freeform_tags  = local.common_tags

  route_rules {
    network_entity_id = oci_core_internet_gateway.moodify.id
    destination       = "0.0.0.0/0"
  }
}

resource "oci_core_route_table" "private" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.moodify.id
  display_name   = "${local.name_prefix}-private-rt"
  freeform_tags  = local.common_tags

  route_rules {
    network_entity_id = oci_core_nat_gateway.moodify.id
    destination       = "0.0.0.0/0"
  }

  route_rules {
    network_entity_id = oci_core_service_gateway.moodify.id
    destination       = data.oci_core_services.all.services[0].cidr_block
  }
}

resource "oci_core_network_security_group" "oke_nodes" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.moodify.id
  display_name   = "${local.name_prefix}-oke-nodes-nsg"
  freeform_tags  = local.common_tags
}

resource "oci_core_network_security_group" "public_lb" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.moodify.id
  display_name   = "${local.name_prefix}-public-lb-nsg"
  freeform_tags  = local.common_tags
}

resource "oci_core_network_security_group_security_rule" "lb_ingress_https" {
  network_security_group_id = oci_core_network_security_group.public_lb.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                     = "0.0.0.0/0"
  tcp_options {
    destination_port_range {
      min = 443
      max = 443
    }
  }
}

resource "oci_core_network_security_group_security_rule" "lb_ingress_http" {
  network_security_group_id = oci_core_network_security_group.public_lb.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                     = "0.0.0.0/0"
  tcp_options {
    destination_port_range {
      min = 80
      max = 80
    }
  }
}

resource "oci_core_network_security_group_security_rule" "nodes_ingress_lb" {
  network_security_group_id = oci_core_network_security_group.oke_nodes.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                     = oci_core_network_security_group.public_lb.id
  source_type                = "NETWORK_SECURITY_GROUP"
  tcp_options {
    destination_port_range {
      min = 30000
      max = 32767
    }
  }
}

resource "oci_core_network_security_group_security_rule" "nodes_ingress_internal" {
  network_security_group_id = oci_core_network_security_group.oke_nodes.id
  direction                 = "INGRESS"
  protocol                  = "all"
  source                     = var.private_subnet_cidr
}

resource "oci_core_network_security_group_security_rule" "nodes_egress_all" {
  network_security_group_id = oci_core_network_security_group.oke_nodes.id
  direction                 = "EGRESS"
  protocol                  = "all"
  destination               = "0.0.0.0/0"
}

resource "oci_core_subnet" "public" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.moodify.id
  cidr_block                 = var.public_subnet_cidr
  display_name               = "${local.name_prefix}-public-subnet"
  dns_label                  = "public"
  route_table_id             = oci_core_route_table.public.id
  prohibit_public_ip_on_vnic  = false
  security_list_ids          = []
  freeform_tags              = local.common_tags
}

resource "oci_core_subnet" "private" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.moodify.id
  cidr_block                 = var.private_subnet_cidr
  display_name               = "${local.name_prefix}-private-subnet"
  dns_label                  = "private"
  route_table_id             = oci_core_route_table.private.id
  prohibit_public_ip_on_vnic  = true
  security_list_ids          = []
  freeform_tags              = local.common_tags
}
