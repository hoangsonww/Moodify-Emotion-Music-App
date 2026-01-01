output "cluster_id" {
  description = "OKE cluster OCID"
  value       = oci_containerengine_cluster.moodify.id
}

output "kubeconfig_command" {
  description = "Command to fetch kubeconfig for the cluster"
  value       = "oci ce cluster create-kubeconfig --cluster-id ${oci_containerengine_cluster.moodify.id} --file $HOME/.kube/config --region ${var.region} --token-version 2.0.0"
}

output "ocir_repositories" {
  description = "OCIR repositories created for Moodify"
  value = {
    frontend = oci_artifacts_container_repository.frontend.display_name
    backend  = oci_artifacts_container_repository.backend.display_name
    ai_ml    = oci_artifacts_container_repository.ai_ml.display_name
  }
}

output "object_storage_buckets" {
  description = "Object Storage buckets for models, assets, and logs"
  value = {
    models = oci_objectstorage_bucket.models.name
    assets = oci_objectstorage_bucket.assets.name
    logs   = oci_objectstorage_bucket.logs.name
  }
}
