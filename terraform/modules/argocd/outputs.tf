output "namespace" {
  description = "Namespace Argo CD was installed into."
  value       = kubernetes_namespace.argocd.metadata[0].name
}

output "server_url" {
  description = "External URL for the Argo CD UI / API."
  value       = "https://${var.domain}"
}

output "helm_release_name" {
  description = "Helm release name."
  value       = helm_release.argocd.name
}
