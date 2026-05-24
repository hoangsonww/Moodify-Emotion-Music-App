#!/usr/bin/env bash
# =============================================================================
# generate-dev-tls.sh — local self-signed TLS for the nginx edge
# =============================================================================
# Use ONLY in dev. Production must use Let's Encrypt / ACM / cert-manager.
#
# Usage:
#   ./scripts/generate-dev-tls.sh                    # outputs into ./tls/
#   ./scripts/generate-dev-tls.sh /custom/path       # into specified dir
#   DOMAIN=foo.local ./scripts/generate-dev-tls.sh   # override SAN
# =============================================================================

set -euo pipefail

OUT_DIR="${1:-./tls}"
DOMAIN="${DOMAIN:-moodify.local}"
DAYS="${DAYS:-365}"

mkdir -p "$OUT_DIR"
cd "$OUT_DIR"

cat > openssl.cnf <<EOF
[ req ]
default_bits        = 4096
prompt              = no
default_md          = sha256
distinguished_name  = dn
req_extensions      = req_ext
x509_extensions     = v3_ca

[ dn ]
C  = US
ST = NC
L  = Chapel Hill
O  = Moodify Dev
CN = ${DOMAIN}

[ req_ext ]
subjectAltName = @alt_names

[ v3_ca ]
subjectAltName       = @alt_names
basicConstraints     = critical, CA:FALSE
keyUsage             = critical, digitalSignature, keyEncipherment
extendedKeyUsage     = serverAuth, clientAuth

[ alt_names ]
DNS.1 = ${DOMAIN}
DNS.2 = localhost
DNS.3 = *.${DOMAIN}
IP.1  = 127.0.0.1
IP.2  = ::1
EOF

echo ">> generating 4096-bit RSA key + cert for ${DOMAIN} (valid ${DAYS}d)"
openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout privkey.pem -out fullchain.pem \
  -days "$DAYS" -config openssl.cnf

# nginx expects a separate "chain.pem" for OCSP stapling.
cp fullchain.pem chain.pem

# 2048-bit DH params — small for dev speed; prod uses 4096.
echo ">> generating DH params (2048-bit, dev-only)"
openssl dhparam -out dhparam.pem 2048 2>/dev/null

chmod 600 privkey.pem
chmod 644 fullchain.pem chain.pem dhparam.pem

echo "
DONE. Wired in nginx.conf as:
  ssl_certificate     ${OUT_DIR}/fullchain.pem
  ssl_certificate_key ${OUT_DIR}/privkey.pem
  ssl_trusted_certificate ${OUT_DIR}/chain.pem
  ssl_dhparam         ${OUT_DIR}/dhparam.pem

Mount or copy these into the container at /etc/nginx/tls/.
Add an exception for the CN in your browser, or curl with -k.
"
