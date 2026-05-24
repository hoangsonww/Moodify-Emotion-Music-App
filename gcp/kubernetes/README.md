# GCP production Kubernetes overlays

GCP-specific manifests applied to the GKE cluster after the Terraform
infra is up. Pairs with the cross-cloud base manifests in
[`../../kubernetes/`](../../kubernetes/).

## Files

| File                       | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `storageclass.yaml`        | `pd-ssd` (default) + `pd-balanced` StorageClasses, WaitForFirstConsumer |
| `managedcertificate.yaml`  | Google-managed TLS for apex + api hostnames                    |
| `backend-config.yaml`      | GCLB BackendConfig (health checks, Cloud Armor, CDN, session affinity) |
| `ingress.yaml`             | GKE Ingress + FrontendConfig (HTTPS redirect, SSL policy)      |
| `external-secrets.yaml`    | Workload-Identity-bound ESO store fetching Google Secret Manager |

## Apply

```bash
# 1. Kubeconfig
gcloud container clusters get-credentials \
  $(cd ../terraform && terraform output -raw gke_cluster_name) \
  --region  $(cd ../terraform && terraform output -raw region) \
  --project $(cd ../terraform && terraform output -raw project_id)

# 2. Static IP for the LB (one-time)
gcloud compute addresses create moodify-static-ip --global

# 3. (Optional) Cloud Armor security policy
gcloud compute security-policies create moodify-armor \
  --description "Moodify WAF"
gcloud compute security-policies rules create 1000 \
  --security-policy moodify-armor \
  --src-ip-ranges "*" \
  --action throttle \
  --rate-limit-threshold-count 100 \
  --rate-limit-threshold-interval-sec 60 \
  --conform-action allow \
  --exceed-action deny-429 \
  --enforce-on-key IP

# 4. Storage + ingress + cert
kubectl apply -f storageclass.yaml
kubectl apply -f managedcertificate.yaml
kubectl apply -f backend-config.yaml
kubectl apply -f ingress.yaml

# 5. Secrets (after installing external-secrets-operator)
kubectl apply -f external-secrets.yaml

# 6. App from the cross-cloud base manifests
kubectl apply -f ../../kubernetes/common/
kubectl apply -f ../../kubernetes/
```

## GCP specifics

* **Workload Identity** — annotate ServiceAccounts with
  `iam.gke.io/gcp-service-account: <sa>@<project>.iam.gserviceaccount.com`
  so Pods get GCP IAM creds without secrets.
* **Container image registry** — push to Artifact Registry
  `${REGION}-docker.pkg.dev/${PROJECT}/moodify`.
* **TLS** — use `ManagedCertificate` (Google-managed) for simple cases,
  cert-manager + Let's Encrypt when you need wildcards or DNS-01.
* **HTTPS redirect** — handled at the LB via `FrontendConfig`. The Service
  itself only listens on plain HTTP inside the cluster.
* **CDN** — Frontend `BackendConfig.cdn.enabled: true` turns on Cloud CDN
  for the SPA bundle. API backend deliberately leaves it off.
* **Cloud Armor** — referenced as `securityPolicy.name`. Create with the
  `gcloud` commands above before applying `backend-config.yaml`.

## Wiring to the Terraform module

`gcp/terraform/` emits everything you need:

```bash
terraform output -raw gke_workload_pool   # used in ESO ClusterSecretStore
terraform output -raw gke_cluster_name    # ditto
terraform output -raw region              # ditto
terraform output -raw project_id          # everywhere
```

Run `sed -i '' "s/REPLACE_PROJECT/$(terraform output -raw project_id)/g" *.yaml`
once after first deploy to fill in the placeholders.
