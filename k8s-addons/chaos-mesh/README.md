# Chaos Mesh

CNCF chaos-engineering operator. Lets you inject pod / network / IO /
DNS faults to validate that the Moodify stack survives realistic
failures.

## Install

```bash
kubectl apply -f install-chaos-mesh.yaml
```

Installs Chaos Mesh into the `chaos-mesh` namespace with the dashboard
exposed via a ClusterIP service. Port-forward to view:

```bash
kubectl port-forward -n chaos-mesh svc/chaos-dashboard 2333:2333
# → open http://localhost:2333
```

## Sample experiments

Keep these under `k8s-addons/chaos-mesh/experiments/` and apply during
chaos game days. **Always scope by namespace selector — never run chaos
against prod from a dev cluster.**

### 1. Kill 30 % of backend pods every 5 min

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: kill-backend-pods
  namespace: moodify-staging
spec:
  action: pod-kill
  mode: fixed-percent
  value: "30"
  selector:
    namespaces: [moodify-staging]
    labelSelectors:
      app.kubernetes.io/name: moodify-backend
  scheduler:
    cron: "@every 5m"
```

### 2. Add 200 ms of network latency to Mongo

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: slow-mongo
  namespace: moodify-staging
spec:
  action: delay
  mode: all
  selector:
    namespaces: [moodify-staging]
    labelSelectors:
      app.kubernetes.io/name: moodify-backend
  delay:
    latency: 200ms
    jitter: 50ms
  duration: 10m
  direction: to
  target:
    selector:
      namespaces: [moodify-staging]
      labelSelectors:
        app.kubernetes.io/name: mongo
    mode: all
```

### 3. Memory pressure on the backend

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: backend-mem-pressure
  namespace: moodify-staging
spec:
  mode: one
  selector:
    namespaces: [moodify-staging]
    labelSelectors:
      app.kubernetes.io/name: moodify-backend
  stressors:
    memory:
      workers: 1
      size: 256MB
  duration: 5m
```

## Game-day workflow

1. Pick an experiment.
2. Confirm it targets a non-prod namespace.
3. Apply + start a stopwatch.
4. Observe SLOs in Grafana — latency p95, error rate, recovery time.
5. Stop the experiment + confirm recovery.
6. Write up findings: what alerted? What didn't? What needs fixing?
