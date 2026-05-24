# Moodify NGINX edge

Production-grade NGINX **reverse proxy + edge** for self-hosted Moodify
deployments. Optional — the canonical production deploy uses **Vercel**
for the SPA + Django API and **Modal** for ML inference, both of which
provide their own edge. Reach for this directory when you run Moodify on
your own VM, on Kubernetes (as an ingress sidecar), or behind a cloud
load balancer that doesn't terminate TLS for you.

## What's here

```
nginx/
├── nginx.conf                production-tuned http-context config
├── Dockerfile                pinned (nginx:1.27-alpine), non-root, healthcheck
├── docker-compose.yml        local one-shot for self-host smoke tests
├── start_nginx.sh            top-level wrapper (build/start/stop/reload/test/clean)
├── Makefile                  shorthand for every operator action
├── .env.example              env template (DOMAIN, backend, modal, TLS dir)
├── logrotate.conf            daily rotation, 14d retention, USR1 reopen
├── snippets/                 reusable include fragments — see snippets/README.md
│   ├── security-headers.conf HSTS, CSP, X-Frame-Options, Permissions-Policy, COOP, CORP
│   ├── ssl-params.conf       Mozilla Intermediate, OCSP, session cache, 0-RTT
│   ├── proxy-common.conf     proxy_set_header + sane timeouts + failover
│   ├── cors.conf             origin allowlist + preflight short-circuit
│   ├── well-known.conf       ACME challenge, security.txt, app-links manifest
│   └── maintenance.conf      503 drain flag + branded maintenance page
├── scripts/                  bash helpers — see scripts/README.md
│   ├── generate-dev-tls.sh   self-signed cert for local HTTPS
│   ├── test-config.sh        `nginx -t` in a throwaway container
│   ├── reload.sh             validate + SIGHUP running container
│   ├── healthcheck.sh        external probe + TLS expiry guard
│   ├── renew-certs.sh        cron-friendly certbot renewal
│   └── maintenance.sh        flip drain mode on/off/status
├── exporter/                 prometheus-nginx-exporter sidecar
│   ├── docker-compose.yml    pinned, hardened, listens on :9113
│   ├── prometheus-scrape.yml drop-in scrape stanza
│   └── alerts.yml            down / 5xx / connections / cert-expiry rules
├── html/                     custom error + maintenance pages
│   ├── maintenance.html      branded 503 page
│   └── 50x.html              custom upstream-error page
└── well-known/               RFC 8615 assets
    └── security.txt          RFC 9116 contact + policy
```

## What the config does

| Concern              | How it's handled                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| TLS                  | TLS 1.2 + 1.3, strong cipher suite, OCSP stapling, HSTS preload                                                     |
| SPA serving          | `/usr/share/nginx/html` with 30 d cache on hashed assets, no-cache on `service-worker.js` + `manifest.json`         |
| API proxy            | `upstream django_backend` w/ keepalive, retries on 5xx, per-IP rate limit (60 r/s default, 8 r/s for inference)     |
| Modal proxy (opt.)   | `/modal/` location proxies Modal so the SPA never has to hit a second origin (helps when CORS is locked down)        |
| Security headers     | HSTS, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy (cam/mic self), CSP          |
| Compression          | gzip (level 5) on every text-ish MIME; brotli kicks in if the build has `ngx_brotli`                                 |
| Health probe         | `GET /healthz` → `200 ok\n`, `access_log off`                                                                        |
| Observability        | JSON access log w/ request ID, upstream latency + status; `/nginx_status` for prometheus exporter                    |
| Hardening            | `server_tokens off`, `client_max_body_size 12m`, send/recv timeouts, drop SSL session tickets                        |

## Quick start (local Docker)

```bash
# 1. Local TLS material (self-signed for dev only)
make tls-dev DOMAIN=moodify.local
# 2. Build + start
make build && make up
# 3. Smoke test
make test && make health
# 4. Iterate — edit a snippet, then graceful reload
$EDITOR snippets/security-headers.conf && make reload
# 5. Drain for deploy
make maintenance-on   # ... ship new build ...
make maintenance-off
```

`make help` lists every target. Each target wraps a script under `scripts/`,
so the same actions work outside Make (CI, ad-hoc, systemd timers).

The first request to `https://localhost/healthz` should return `ok` (the HTTP
listener also serves `/healthz` for cloud LB probes that don't speak TLS).

## Wiring to your deploy

| Field                                         | Where to change                          |
| --------------------------------------------- | ---------------------------------------- |
| `server_name`                                 | `nginx.conf` (default: `moodify.example.com`) |
| `upstream django_backend`                     | `nginx.conf` (default: cluster DNS at `:8000`) |
| TLS cert path                                 | mount/volume at `/etc/nginx/tls/`         |
| Static SPA root                               | mount React build at `/usr/share/nginx/html/` |
| CSP `connect-src`                             | `nginx.conf` `$csp_default` map           |

## Production tuning checklist

- [ ] Replace `moodify.example.com` with your real domain (in `nginx.conf`
      and `well-known/security.txt`).
- [ ] Replace the upstream `server …` line with your real backend host.
- [ ] Mount valid TLS certs at `/etc/nginx/tls/{fullchain,privkey,chain,dhparam}.pem`.
      For Let's Encrypt, run `scripts/renew-certs.sh` from cron or a systemd timer.
- [ ] Front this image with a cloud LB that adds `X-Forwarded-Proto` (most do).
- [ ] Bring up the `exporter/` sidecar and add `exporter/prometheus-scrape.yml`
      + `exporter/alerts.yml` to your Prometheus.
- [ ] Confirm CSP in `snippets/security-headers.conf` matches the actual
      third-party origins your client uses (Deezer, Modal, Vercel, Fonts).
- [ ] Set a sensible `client_max_body_size` (we ship `12m`, matching the
      inference upload cap).
- [ ] Install `logrotate.conf` on the host (or run a sidecar logrotate)
      so JSON access logs don't fill the disk.
- [ ] Rehearse the drain switch: `make maintenance-on` → verify 503 page →
      `make maintenance-off`.

## Why not use the prod URLs directly?

In the official Moodify deploy you don't need this NGINX — Vercel and
Modal each terminate TLS, set sensible headers, and rate limit on their
edge. Self-hosting this NGINX makes sense when:

1. You're running Moodify on a single VM and need TLS + cache + LB in one binary.
2. You're running on Kubernetes and want a single ingress that owns all
   routes (instead of separate ingress controllers per service).
3. You need a single CORS origin (e.g. enterprise security policy) so the
   browser only ever talks to `*.moodify.example.com`.

For everything else, prefer the Vercel + Modal path documented in
[`../DEPLOYMENT.md`](../DEPLOYMENT.md).
