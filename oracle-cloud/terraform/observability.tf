# =============================================================================
# OCI observability — Logging + Monitoring + Notifications
# =============================================================================
# Tied together so a single `terraform apply` provisions:
#   * A log group + log objects per workload (frontend / backend / ml).
#   * A notification topic for alarm fan-out.
#   * Two metric alarms covering API latency + 5xx error rate, which are
#     the cheapest, highest-signal SLO probes for the Moodify backend.
# All names are namespaced under `local.name_prefix` so co-tenant deploys
# in the same compartment don't collide.
# =============================================================================

# ---- Log group + per-workload custom log objects --------------------------
resource "oci_logging_log_group" "moodify" {
  compartment_id = var.compartment_ocid
  display_name   = "${local.name_prefix}-logs"
  description    = "Aggregated logs for Moodify (frontend / backend / ml inference)."
  freeform_tags  = local.common_tags
}

resource "oci_logging_log" "backend" {
  log_group_id = oci_logging_log_group.moodify.id
  display_name = "${local.name_prefix}-backend"
  log_type     = "CUSTOM"
  is_enabled   = true
  retention_duration = 90

  configuration {
    source {
      category    = "all"
      resource    = "${local.name_prefix}-backend"
      service     = "custom"
      source_type = "OCISERVICE"
    }
    compartment_id = var.compartment_ocid
  }
}

resource "oci_logging_log" "ml" {
  log_group_id = oci_logging_log_group.moodify.id
  display_name = "${local.name_prefix}-ml"
  log_type     = "CUSTOM"
  is_enabled   = true
  retention_duration = 60

  configuration {
    source {
      category    = "all"
      resource    = "${local.name_prefix}-ml"
      service     = "custom"
      source_type = "OCISERVICE"
    }
    compartment_id = var.compartment_ocid
  }
}

# ---- Notification topic for alarm fan-out --------------------------------
resource "oci_ons_notification_topic" "alarms" {
  compartment_id = var.compartment_ocid
  name           = "${local.name_prefix}-alarms"
  description    = "Receives every Moodify metric-alarm event."
  freeform_tags  = local.common_tags
}

# Optional: pre-subscribe an on-call email when var.oncall_email is set.
resource "oci_ons_subscription" "oncall_email" {
  count          = var.oncall_email == "" ? 0 : 1
  compartment_id = var.compartment_ocid
  topic_id       = oci_ons_notification_topic.alarms.id
  protocol       = "EMAIL"
  endpoint       = var.oncall_email
}

# ---- Metric alarms -------------------------------------------------------
# 1) API p95 latency above 2.5 s for 5 consecutive minutes.
resource "oci_monitoring_alarm" "api_latency_p95" {
  compartment_id        = var.compartment_ocid
  display_name          = "${local.name_prefix}-api-p95-latency"
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_apigateway"
  query                 = "HttpResponses[1m]{httpStatusCategory = \"2xx\"}.percentile(0.95) > 2500"
  severity              = "CRITICAL"
  destinations          = [oci_ons_notification_topic.alarms.id]
  is_enabled            = true
  pending_duration      = "PT5M"
  message_format        = "ONS_OPTIMIZED"
  body                  = "Moodify API p95 latency exceeded 2.5 s for 5 minutes. Investigate Modal cold starts + Mongo connectivity."
  freeform_tags         = local.common_tags
}

# 2) 5xx error rate above 5% for 5 consecutive minutes.
resource "oci_monitoring_alarm" "api_5xx" {
  compartment_id        = var.compartment_ocid
  display_name          = "${local.name_prefix}-api-5xx-rate"
  metric_compartment_id = var.compartment_ocid
  namespace             = "oci_apigateway"
  query                 = "HttpResponses[1m]{httpStatusCategory = \"5xx\"}.rate() > 0.05"
  severity              = "CRITICAL"
  destinations          = [oci_ons_notification_topic.alarms.id]
  is_enabled            = true
  pending_duration      = "PT5M"
  message_format        = "ONS_OPTIMIZED"
  body                  = "Moodify API 5xx rate above 5% for 5 minutes. Page on-call."
  freeform_tags         = local.common_tags
}
