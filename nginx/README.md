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
├── nginx.conf            production-tuned http-context config
├── Dockerfile            pinned (nginx:1.27-alpine) + non-root + healthcheck
├── docker-compose.yml    local one-shot for self-host smoke tests
└── start_nginx.sh        wrapper: build/start/stop/restart/reload/test
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
# Build the image
./start_nginx.sh build

# Bring it up on :80 / :443
./start_nginx.sh start

# Validate the config inside the container
./start_nginx.sh test

# Tail logs
./start_nginx.sh logs

# Stop + cleanup
./start_nginx.sh clean
```

The first request to `https://localhost/healthz` should return `ok` (you'll
need a self-signed cert at `./tls/{fullchain,privkey}.pem` for HTTPS — the
HTTP listener also serves `/healthz` for cloud LB probes).

## Wiring to your deploy

| Field                                         | Where to change                          |
| --------------------------------------------- | ---------------------------------------- |
| `server_name`                                 | `nginx.conf` (default: `moodify.example.com`) |
| `upstream django_backend`                     | `nginx.conf` (default: cluster DNS at `:8000`) |
| TLS cert path                                 | mount/volume at `/etc/nginx/tls/`         |
| Static SPA root                               | mount React build at `/usr/share/nginx/html/` |
| CSP `connect-src`                             | `nginx.conf` `$csp_default` map           |

## Production tuning checklist

- [ ] Replace `moodify.example.com` with your real domain.
- [ ] Replace the upstream `server …` line with your real backend host.
- [ ] Mount valid TLS certs at `/etc/nginx/tls/{fullchain,privkey}.pem`.
- [ ] Front this image with a cloud LB that adds `X-Forwarded-Proto` (most do).
- [ ] Wire `/nginx_status` to your prometheus exporter and add a scrape config.
- [ ] Confirm CSP matches the actual third-party origins your client uses
      (Deezer, Modal, Vercel, Fonts).
- [ ] Set a sensible `client_max_body_size` (we ship `12m`, matching the
      inference upload cap).

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
