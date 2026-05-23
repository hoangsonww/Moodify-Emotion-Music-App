# Blue/green deployment manifests

Atomic-cutover deployment strategy. Two identical Deployments run
side-by-side under the labels `color: blue` and `color: green`; a single
Service selects whichever color is currently live by matching its `color`
label. The deploy script swaps the Service's selector to flip traffic
between them.

## Files

| File                    | Purpose                                                 |
| ----------------------- | ------------------------------------------------------- |
| `backend-blue.yaml`     | Blue color Deployment + HPA + PDB                       |
| `backend-green.yaml`    | Green color Deployment + HPA + PDB                      |
| `backend-service.yaml`  | The live Service — its selector is the cutover knob     |

## How it works

```
   ┌─────────────────────┐
   │  moodify-backend    │  (Service, selector: color=<live>)
   └──────────┬──────────┘
              │
   ┌──────────▼──────────────┐         ┌─────────────────────────┐
   │ Deployment color=blue    │         │ Deployment color=green  │
   │ image:tag=N (live)      │  swap   │ image:tag=N+1 (staged)  │
   └─────────────────────────┘ ──────► └─────────────────────────┘
                                          ▲ smoke tested first
```

1. Identify the live color: `kubectl get svc moodify-backend -o jsonpath='{.spec.selector.color}'`.
2. Build + push the new image.
3. Set the new image on the **other** color's Deployment + wait for ready.
4. Smoke test against the staged color's preview Service (a sibling
   `moodify-backend-green` ClusterIP that always selects `color=green`).
5. `kubectl patch svc moodify-backend --type='json' -p='[{"op":"replace","path":"/spec/selector/color","value":"green"}]'`.
6. Keep blue running for fast rollback (`kubectl patch …` back to blue).

## Driven by the deploy script

```bash
make deploy-bluegreen \
  IMAGE_TAG=$(git rev-parse --short HEAD)
```

Internally invokes `scripts/deployment/blue-green-deploy.sh` which
handles every step above + post-deploy smoke tests + rollback on failure.

## When to use

| Use it when                                           | Skip it when                                       |
| ----------------------------------------------------- | -------------------------------------------------- |
| Schema/contract changes that need an atomic flip      | Trivial UI-only bumps (canary is cheaper)          |
| Long warm-up (model load, cache hydration)            | Short-cycle hotfixes (rolling update suffices)     |
| Rollback time must be sub-minute                      | Stateful workloads w/ persistent volumes per color  |

## See also

* [`../canary/`](../canary/) — gradual traffic-shift alternative
* [`../../scripts/deployment/blue-green-deploy.sh`](../../scripts/deployment/blue-green-deploy.sh)
* [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md)
