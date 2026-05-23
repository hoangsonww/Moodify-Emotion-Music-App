# Velero

Cluster backup + restore. Snapshots both Kubernetes object state and
attached persistent volumes; restores either subset or the full cluster.

## Install

```bash
kubectl apply -f install-velero.yaml
```

Installs Velero into the `velero` namespace + CRDs (`Backup`, `Restore`,
`Schedule`, `BackupStorageLocation`, `VolumeSnapshotLocation`).

## Backend bootstrap (AWS example)

```bash
# 1. Bucket + IAM
aws s3api create-bucket --bucket moodify-velero-backups --region us-east-1
aws iam create-role --role-name velero --assume-role-policy-document file://trust.json

# 2. Velero install w/ AWS plugin
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.9.0 \
  --bucket moodify-velero-backups \
  --backup-location-config region=us-east-1 \
  --snapshot-location-config region=us-east-1 \
  --secret-file ./aws-creds
```

For GCP / Azure, swap the plugin + provider + bucket / container.

## Daily schedule (every day at 02:00 UTC, 14 day retention)

```yaml
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: moodify-daily
  namespace: velero
spec:
  schedule: "0 2 * * *"
  template:
    ttl: 336h0m0s          # 14 days
    includedNamespaces:
      - moodify
      - moodify-staging
    snapshotVolumes: true
    storageLocation: default
    volumeSnapshotLocations:
      - default
```

## Restore

```bash
# List backups
velero backup get

# Restore a specific backup into the same namespace
velero restore create --from-backup moodify-daily-20260523020000

# Restore into a different namespace (cross-cluster migration)
velero restore create \
  --from-backup moodify-daily-20260523020000 \
  --namespace-mappings moodify:moodify-dr
```

## Test the backups

Restore quarterly into a sandbox namespace + run smoke tests against
the restored stack. An untested backup is not a backup.
