# Staging overlay

Kustomize overlay that re-uses the production manifests in `../` and
patches in staging-specific values: smaller replica counts, smaller
resource asks, debug-level logging, and the staging hostnames /
image tags.

## Apply

```bash
# Validate locally first
kubectl kustomize kubernetes/staging/ | less

# Apply
kubectl apply -k kubernetes/staging/
```

## Diff vs production

| Field                | Prod                          | Staging                              |
| -------------------- | ----------------------------- | ------------------------------------ |
| Namespace            | `moodify`                     | `moodify-staging`                    |
| Backend replicas     | 3                             | 2                                    |
| Frontend replicas    | 2                             | 1                                    |
| Backend cpu request  | 250m                          | 100m                                 |
| Image tag            | semver / git SHA              | `staging` (rolling)                  |
| Hostnames            | `moodify.example.com` etc.    | `staging.moodify.example.com` etc.   |
| `DEBUG`              | `false`                       | `true`                               |
| `LOG_LEVEL`          | `INFO`                        | `DEBUG`                              |
| TLS                  | `letsencrypt-prod` ClusterIssuer | same (or `-staging` for cert-manager staging) |

## Promotion to prod

Once staging soaks for ≥ 24 h with no SLO breaches, bump the prod image
tag and `kubectl apply -f kubernetes/` (or use Argo CD / Helm). The
overlay never deploys to the `moodify` namespace by design.
