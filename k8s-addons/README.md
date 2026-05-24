# Moodify — Kubernetes add-ons

Cluster-scoped operators / day-2 tooling that wrap around the Moodify
workloads. Each subdirectory is independent — install only what you
need.

```
k8s-addons/
├── external-secrets/   sync secrets from Vault / ASM / GSM into K8s
├── opa-gatekeeper/     OPA policy enforcement (PSA-aware)
├── chaos-mesh/         chaos engineering (network / pod / IO faults)
└── velero/             cluster backup + restore (etcd + PVs)
```

## Install order

1. **External Secrets** first — so other add-ons can pull their own
   credentials from your secret backend.
2. **OPA Gatekeeper** — must be in place before workloads land if you
   want to enforce policies on existing resources.
3. **Velero** — install before you have production data to back up.
4. **Chaos Mesh** — install last; it intentionally breaks things.

## Apply

```bash
kubectl apply -f k8s-addons/external-secrets/install-external-secrets.yaml
kubectl apply -f k8s-addons/opa-gatekeeper/install-gatekeeper.yaml
kubectl apply -f k8s-addons/velero/install-velero.yaml
kubectl apply -f k8s-addons/chaos-mesh/install-chaos-mesh.yaml
```

Each manifest is a single self-contained file that installs the
upstream operator with sane defaults. For per-add-on details (constraint
libraries, secret stores, backup schedules, fault scenarios) see the
README in the respective subdir.

## Why these four?

| Add-on            | Problem it solves                                      |
| ----------------- | ------------------------------------------------------ |
| External Secrets  | Stop committing secrets to Git; sync from Vault / ASM   |
| OPA Gatekeeper    | Enforce "no privileged pods", "must have probes", etc.  |
| Velero            | Snapshot the whole cluster + PVs on a schedule          |
| Chaos Mesh        | Verify the system survives pod / network / IO failures  |

## Production checklist

- [ ] External Secrets points at your actual backend (Vault / AWS Secrets
      Manager / GCP Secret Manager / Azure Key Vault).
- [ ] OPA Gatekeeper has a constraint library that matches your
      compliance baseline (CIS, NIST, your own policy pack).
- [ ] Velero has a target object-storage bucket + IAM role + restic
      DaemonSet for in-cluster PV snapshots.
- [ ] Chaos Mesh experiments are scoped via namespace labels so they
      can't accidentally hit prod from a dev cluster.
