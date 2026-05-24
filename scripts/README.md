# Moodify scripts

Operational helper scripts. Subdirectories group scripts by purpose.

```
scripts/
└── deployment/      blue/green + canary + rollback + smoke-tests for K8s deploys
```

## Conventions

* All scripts are bash, `#!/bin/bash` with `set -euo pipefail`.
* CLI flags follow GNU convention (`--long-form`, `-s` short form).
* Idempotent — re-running with the same args is safe.
* Exit codes follow `sysexits(3)` family: `0` ok, `2` usage, `3+` runtime.
* Logs go to stdout, errors to stderr, structured logs (when needed) to
  `/tmp/<script>-<timestamp>.log`.
* Every long-running script supports `--dry-run` to print the kubectl /
  helm commands without executing them.

## When to reach for each script

| Script                                                | What it does                                          | When you run it                                 |
| ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| [`deployment/blue-green-deploy.sh`](deployment/blue-green-deploy.sh) | Deploy to inactive color, health-check, switch traffic | Major release where atomic cutover matters       |
| [`deployment/canary-deploy.sh`](deployment/canary-deploy.sh)         | Gradual 10 → 25 → 50 → 100 % traffic shift            | Risky change you want to ramp slowly             |
| [`deployment/rollback.sh`](deployment/rollback.sh)                   | Roll back blue/green / canary / specific version       | Post-incident or smoke-test failure              |
| [`deployment/smoke-tests.sh`](deployment/smoke-tests.sh)             | Post-deploy health probes against staging/prod/canary  | Run automatically after every deploy             |

## Hook into the Makefile

```bash
make deploy-bluegreen     # → scripts/deployment/blue-green-deploy.sh
make deploy-canary        # → scripts/deployment/canary-deploy.sh
make rollback             # → scripts/deployment/rollback.sh
make smoke                # → scripts/deployment/smoke-tests.sh
```

## Hook into CI

`Jenkinsfile` already references these scripts in the deploy stage; for
GitHub Actions, see `.github/workflows/deploy.yml`. Each script returns
non-zero on any failure so the pipeline halts at the bad stage.

## Adding a new script

1. Drop it under the appropriate subdir (or create one).
2. `chmod +x scripts/<group>/<name>.sh`.
3. Add a `--help` block that documents flags + env vars.
4. Add a row to the table above.
5. Optionally surface it as a `make` target.
