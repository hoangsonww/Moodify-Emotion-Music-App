# External Secrets Operator

Pulls secret material from an external store (HashiCorp Vault, AWS
Secrets Manager, GCP Secret Manager, Azure Key Vault) and projects it
into native Kubernetes `Secret` objects. Lets you keep ALL secrets out
of Git.

## Install

```bash
kubectl apply -f install-external-secrets.yaml
```

Installs the operator into the `external-secrets` namespace + CRDs:
`SecretStore`, `ClusterSecretStore`, `ExternalSecret`, `PushSecret`.

## Wire to your backend

Per backend, the same shape:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: moodify-aws
  namespace: moodify
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: moodify-backend
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: moodify-secrets
  namespace: moodify
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: moodify-aws
    kind: SecretStore
  target:
    name: moodify-secrets       # the K8s Secret the workload mounts
    creationPolicy: Owner
  data:
    - secretKey: MONGO_URI
      remoteRef:
        key: moodify/prod
        property: mongo_uri
    - secretKey: JWT_SIGNING_KEY
      remoteRef:
        key: moodify/prod
        property: jwt_signing_key
    - secretKey: MODAL_SERVICE_TOKEN
      remoteRef:
        key: moodify/prod
        property: modal_service_token
```

The Helm chart already references `moodify-secrets` via `envFrom`, so
once the `ExternalSecret` reconciles the backend pods see the new env
on next restart (or you can scale to 0 + back to N).

## Backends (pick one)

| Backend                | `provider` block keyword | Common auth          |
| ---------------------- | ------------------------ | -------------------- |
| AWS Secrets Manager    | `aws`                    | IRSA service account |
| GCP Secret Manager     | `gcpsm`                  | Workload Identity    |
| Azure Key Vault        | `azurekv`                | Workload Identity    |
| HashiCorp Vault        | `vault`                  | Kubernetes auth      |
| Vault Agent Injector   | sidecar instead          | n/a                  |

## Rotation

* Rotate the backend secret (AWS/GCP/Azure/Vault).
* External Secrets re-fetches on the `refreshInterval` cadence (default
  1h). Force a re-sync with:

  ```bash
  kubectl annotate externalsecret moodify-secrets force-sync=$(date +%s) --overwrite
  ```

* The pod doesn't restart automatically — pair with a Reloader operator
  or restart the deployment after rotation.
