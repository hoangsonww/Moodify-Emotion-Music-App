# Argo CD Applications

One file per Argo CD `Application`. Each Application is a Git → cluster
binding: which manifest path in this repo Argo CD watches, which
cluster + namespace to deploy into, and what sync policy to use.

```
applications/
└── moodify-backend.yaml    Moodify Django backend (Helm chart in ../../helm/moodify-backend)
```

## Add a new app

1. Create `<app>.yaml` here.
2. Point its `spec.source.path` at the manifest dir or Helm chart.
3. Set `spec.destination` + sync policy.
4. `kubectl apply -f <app>.yaml` (or commit + let Argo CD reconcile).

## App-of-apps pattern

Replace individual `kubectl apply` with a single root Application that
points at this `applications/` directory:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: moodify-root
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/hoangsonww/Moodify-Emotion-Music-App
    targetRevision: master
    path: argocd/applications
    directory:
      recurse: true
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Apply once + Argo CD picks up every new app file automatically.
