# OPA Gatekeeper

Open Policy Agent policy enforcement via Kubernetes admission webhooks.
Once installed, every `kubectl apply` is checked against a constraint
library; non-compliant resources are rejected at admission time.

## Install

```bash
kubectl apply -f install-gatekeeper.yaml
```

Installs Gatekeeper into the `gatekeeper-system` namespace + CRDs
(`ConstraintTemplate`, `Constraint`).

## Baseline policy pack

Moodify ships a minimum policy set every cluster should enforce:

| Policy                            | What it blocks                                  |
| --------------------------------- | ----------------------------------------------- |
| `K8sRequiredLabels`               | Pods/Deployments missing `app.kubernetes.io/*`  |
| `K8sPSPAllowedUsers`              | Pods running as root (UID 0)                    |
| `K8sPSPCapabilities`              | Pods that don't drop ALL capabilities           |
| `K8sPSPHostFilesystem`            | hostPath volumes                                |
| `K8sPSPSeLinux` / `K8sPSPSeccomp` | Containers without seccomp / SELinux            |
| `K8sRequiredProbes`               | Pods without liveness + readiness probes        |
| `K8sBlockNodePort`                | NodePort Services in prod namespaces            |
| `K8sImageDigest`                  | Containers referencing `:latest` instead of digest |

Apply the constraint templates + constraints from the
[gatekeeper-library](https://github.com/open-policy-agent/gatekeeper-library)
upstream repo, or write your own under `k8s-addons/opa-gatekeeper/constraints/`.

## Dry-run before enforcing

Every constraint supports `enforcementAction: dryrun` so you can see
which existing resources violate the policy before flipping to `deny`.

```bash
# Get violations without blocking
kubectl get constraints -A
kubectl describe k8srequiredprobes.constraints.gatekeeper.sh require-probes
```

## Mutation (optional)

Gatekeeper can also _mutate_ admissions — e.g. auto-inject
`securityContext.runAsNonRoot: true` into every pod. See the
[Mutations](https://open-policy-agent.github.io/gatekeeper/website/docs/mutation/)
docs for the assign / modify-set / assign-image API.

## Bypass for emergencies

If a constraint blocks a legitimate emergency change, scope an
exception with a namespace label (e.g. `gatekeeper.exempt: "true"`) +
update the constraint's `match.excludedNamespaces`. Always revert the
exemption after the incident.
