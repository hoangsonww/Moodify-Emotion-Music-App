output "project_id" {
  description = "GCP project ID this stack is deployed into."
  value       = var.project_id
}

output "region" {
  description = "Primary region."
  value       = var.region
}

output "vpc_name" {
  description = "VPC self-link."
  value       = try(google_compute_network.vpc.name, null)
}

output "gke_cluster_name" {
  description = "GKE cluster name — feed to `gcloud container clusters get-credentials`."
  value       = try(module.gke.cluster_name, null)
}

output "gke_endpoint" {
  description = "GKE cluster API endpoint."
  value       = try(module.gke.endpoint, null)
  sensitive   = true
}

output "gke_workload_pool" {
  description = "Workload Identity pool for federating Pods to GCP SAs."
  value       = try(module.gke.workload_pool, null)
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL connection string (project:region:instance)."
  value       = try(google_sql_database_instance.postgres.connection_name, null)
}

output "memorystore_host" {
  description = "Memorystore Redis primary host."
  value       = try(google_redis_instance.cache.host, null)
}

output "gcs_app_bucket" {
  description = "Application GCS bucket name."
  value       = try(google_storage_bucket.app.name, null)
}

output "kubeconfig_command" {
  description = "Convenience CLI to update local kubeconfig."
  value       = try("gcloud container clusters get-credentials ${module.gke.cluster_name} --region ${var.region} --project ${var.project_id}", null)
}
