# `terraform/modules/argocd`

Helm-installs Argo CD into an existing Kubernetes cluster and registers
a root **app-of-apps** Application that points at this repo's
`argocd/applications/` directory. After apply, every Application file
added to that directory reconciles automatically.

## Usage

```hcl
module "argocd" {
  source       = "../../modules/argocd"
  project_name = "moodify"
  environment  = "production"
  domain       = "argocd.moodify.example.com"

  repo_url      = "https://github.com/hoangsonww/Moodify-Emotion-Music-App"
  repo_revision = "master"
  apps_path     = "argocd/applications"

  controller_replicas = 2
}
```

## Outputs

| Output             | Description                          |
| ------------------ | ------------------------------------ |
| `namespace`        | Always `argocd`                      |
| `server_url`       | UI / API endpoint                    |
| `helm_release_name`| Helm release ID for upgrades         |

## Notes

* RBAC defaults to `role:readonly`; `var.admin_group` gets full admin
  via the `policy.csv` block. Wire your IdP group claim to that name.
* `ingress` uses `cert-manager` + `ingress-nginx` with TLS passthrough
  so the gRPC API works for the `argocd` CLI.
* Notifications are off by default; enable + configure
  `argocd-notifications-cm` separately when you need Slack / webhook
  push.
