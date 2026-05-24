# `nginx/scripts/` — operator helpers

Small bash helpers for the edge container. Every script is idempotent and
exits non-zero on failure so a `set -e` parent recipe (Makefile, CI) catches
problems.

| Script | One-line | Common invocation |
| --- | --- | --- |
| `generate-dev-tls.sh` | Self-signed RSA + DH params for local HTTPS | `DOMAIN=moodify.local ./generate-dev-tls.sh` |
| `test-config.sh`      | `nginx -t` inside a throwaway container       | `./test-config.sh` |
| `reload.sh`           | Validate + `SIGHUP` running container         | `CONTAINER=moodify-nginx ./reload.sh` |
| `healthcheck.sh`      | External probe + TLS expiry guard             | `./healthcheck.sh https://moodify.example.com` |
| `renew-certs.sh`      | Cron-friendly certbot + reload                | `0 3 * * * /opt/moodify/nginx/scripts/renew-certs.sh` |
| `maintenance.sh`      | Flip drain flag (`on` / `off` / `status`)     | `./maintenance.sh on` |

All scripts honour environment variables for paths / container names so they
work both on the host and inside a sidecar.
