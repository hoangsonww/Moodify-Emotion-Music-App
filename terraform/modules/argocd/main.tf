# =============================================================================
# Argo CD module
# =============================================================================
# Installs Argo CD into a cluster via Helm and registers a root
# Application (app-of-apps) pointing at the repo's argocd/applications/
# directory. After apply, the controller picks up every new app file
# automatically.
# =============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.23" }
    helm       = { source = "hashicorp/helm",       version = "~> 2.11" }
  }
}

resource "kubernetes_namespace" "argocd" {
  metadata {
    name = var.namespace
    labels = {
      name        = var.namespace
      environment = var.environment
    }
  }
}

resource "helm_release" "argocd" {
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = var.chart_version
  namespace  = kubernetes_namespace.argocd.metadata[0].name

  values = [
    yamlencode({
      global = {
        domain = var.domain
      }
      server = {
        ingress = {
          enabled          = var.ingress_enabled
          ingressClassName = "nginx"
          hosts            = [var.domain]
          annotations = {
            "cert-manager.io/cluster-issuer"                  = "letsencrypt-prod"
            "nginx.ingress.kubernetes.io/backend-protocol"    = "HTTPS"
            "nginx.ingress.kubernetes.io/ssl-passthrough"     = "true"
            "nginx.ingress.kubernetes.io/force-ssl-redirect"  = "true"
          }
          tls = [{
            secretName = "argocd-tls"
            hosts      = [var.domain]
          }]
        }
        config = {
          "exec.enabled"          = "true"
          "admin.enabled"         = "true"
          "statusbadge.enabled"   = "true"
          "url"                   = "https://${var.domain}"
        }
        rbacConfig = {
          "policy.default" = "role:readonly"
          "policy.csv"     = <<-EOT
            p, role:admin, applications, *, */*, allow
            p, role:admin, clusters, *, *, allow
            p, role:admin, repositories, *, *, allow
            g, ${var.admin_group}, role:admin
          EOT
        }
        resources = {
          requests = { cpu = "100m", memory = "256Mi" }
          limits   = { cpu = "500m", memory = "512Mi" }
        }
      }
      controller = {
        replicas = var.controller_replicas
        resources = {
          requests = { cpu = "500m", memory = "1Gi" }
          limits   = { cpu = "2",     memory = "4Gi" }
        }
      }
      repoServer = {
        replicas = 2
        resources = {
          requests = { cpu = "100m", memory = "256Mi" }
          limits   = { cpu = "500m", memory = "512Mi" }
        }
      }
      redis = {
        resources = {
          requests = { cpu = "100m", memory = "128Mi" }
          limits   = { cpu = "200m", memory = "256Mi" }
        }
      }
      configs = {
        secret = {
          # set via Vault/External Secrets in prod; placeholder for first apply
          argocdServerAdminPassword = var.initial_admin_password_hash
        }
      }
      notifications = {
        enabled = var.notifications_enabled
      }
    }),
  ]

  timeout = 600
  wait    = true
}

# ---- App-of-apps root application ---------------------------------------
resource "kubernetes_manifest" "root_app" {
  count    = var.repo_url == "" ? 0 : 1
  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Application"
    metadata = {
      name      = "${var.project_name}-root"
      namespace = kubernetes_namespace.argocd.metadata[0].name
      finalizers = ["resources-finalizer.argocd.argoproj.io"]
    }
    spec = {
      project = "default"
      source = {
        repoURL        = var.repo_url
        targetRevision = var.repo_revision
        path           = var.apps_path
        directory      = { recurse = true }
      }
      destination = {
        server    = "https://kubernetes.default.svc"
        namespace = kubernetes_namespace.argocd.metadata[0].name
      }
      syncPolicy = {
        automated   = { prune = true, selfHeal = true }
        syncOptions = ["CreateNamespace=true", "PruneLast=true"]
        retry = {
          limit = 5
          backoff = {
            duration    = "5s"
            factor      = 2
            maxDuration = "3m"
          }
        }
      }
    }
  }

  depends_on = [helm_release.argocd]
}
