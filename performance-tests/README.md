# Moodify performance tests

[k6](https://k6.io/) scripts for smoke, load and stress-testing the
Moodify backend. They run against any of the deployed environments
(Vercel preview, prod, or a self-hosted instance) by overriding the
`API_URL` env var.

## Files

```
performance-tests/
├── smoke-test.js     1 VU, 30 s — sanity probe (run on every deploy)
├── load-test.js      multi-stage 0 → 200 VU — capacity baseline
└── stress-test.js    soak + spike — long-tail latency + failure recovery
```

## Quick start

```bash
# Install k6 (macOS / Linux / Windows)
brew install k6           # macOS
# or: https://k6.io/docs/get-started/installation/

# Smoke against prod
API_URL=https://moodify-backend-api.vercel.app k6 run smoke-test.js

# Load test against prod (CAREFUL — ramps to 200 VU)
API_URL=https://moodify-backend-api.vercel.app k6 run load-test.js

# Stress / soak (1 hour run)
API_URL=https://moodify-backend-api.vercel.app k6 run stress-test.js

# Via the root Makefile
make perf-smoke
make perf-load
```

## What each script asserts

| Script        | Profile                                       | Thresholds                                             |
| ------------- | --------------------------------------------- | ------------------------------------------------------ |
| `smoke-test`  | 1 VU, 30 s                                    | p95 < 1 s, error rate < 1 %                            |
| `load-test`   | 10 → 50 → 100 → 200 VU over 20 min            | p95 < 2 s overall; per-endpoint p95s for login/songs/analyze |
| `stress-test` | 50 VU sustained 30 min + 500 VU spike 2 min   | p99 < 5 s; recovery to p95 < 2 s within 60 s of spike    |

The Modal inference endpoints (`/text_emotion`, `/speech_emotion`,
`/facial_emotion`) are intentionally not in the load mix — they're
serverless and scale-to-zero, so a synthetic load test would either
flood the cold-start path or cost real GPU minutes. Use the dedicated
Modal stats dashboard (`make modal-stats`) for inference perf.

## CI usage

```yaml
# .github/workflows/perf.yml
- name: k6 smoke test
  uses: grafana/k6-action@v0.3.1
  with:
    filename: performance-tests/smoke-test.js
  env:
    API_URL: ${{ vars.API_URL }}
```

## Tuning

* **Higher load:** edit `options.stages` in `load-test.js` — increase
  the `target` count gradually; k6 enforces an upper soft limit you can
  raise with `--max-vus`.
* **Custom thresholds:** add to `options.thresholds`. Threshold misses
  fail the run with a non-zero exit so CI catches regressions.
* **Per-endpoint tagging:** wrap requests with `{ tags: { endpoint: ... }}`
  to slice the result UI by endpoint.
