# `nginx/snippets/` — reusable include fragments

Tiny config fragments that vhosts pull in via `include snippets/<name>.conf;`.
Keeps `nginx.conf` slim and gives you a single source of truth for things
that should not drift between server blocks (TLS, security headers, CORS).

| File | Pulls in | When to include |
| --- | --- | --- |
| `security-headers.conf` | HSTS, CSP, X-Frame-Options, Permissions-Policy, COOP, CORP, X-Request-ID | Every `server {}` |
| `ssl-params.conf` | Mozilla Intermediate cipher suite, OCSP stapling, session cache, 0-RTT | Every HTTPS `server {}` |
| `proxy-common.conf` | `proxy_set_header` block + sane timeouts + `proxy_next_upstream` | Every `location` that proxies upstream |
| `cors.conf` | Origin allowlist + preflight handling + Vary | API `location` blocks reachable from browsers |
| `well-known.conf` | ACME challenge + security.txt + Android/iOS deep-link manifests | Port-80 redirect server + main HTTPS server |
| `maintenance.conf` | 503 drain flag + branded maintenance page | Optional, wraps every vhost |

## Convention

* Snippets contain only directives that are safe to load multiple times.
* No `listen` / `server_name` / `ssl_certificate` lines live in snippets —
  those stay per-vhost so individual sites can override.
* The Dockerfile copies the whole directory to `/etc/nginx/snippets/`.

## Adding a new snippet

1. Drop the file into this directory.
2. Reference it from `nginx.conf` (or a per-vhost file) with
   `include snippets/<name>.conf;`.
3. Update the table above and run `nginx -t` (or
   `./scripts/test-config.sh` from the parent directory).
