# =============================================================================
# Moodify NGINX edge image
# =============================================================================
# Pinned major version + non-root runtime + minimal layers. Build with:
#   docker build -t moodify-nginx:latest nginx/
# Run with TLS mounted at /etc/nginx/tls/{fullchain,privkey}.pem.
# =============================================================================

FROM nginx:1.27-alpine

# --- Hardening --------------------------------------------------------------
# Remove the default vhost and replace with our prod config.
RUN rm -f /etc/nginx/conf.d/default.conf

# Make the runtime directory writable by the `nginx` user (UID 101 on
# alpine images). The default pid + cache locations are already owned
# correctly, but we add an explicit chown so a read-only root FS deploy
# still works when /var/cache/nginx is a volume.
RUN install -d -o nginx -g nginx -m 0755 \
    /var/cache/nginx /var/log/nginx /etc/nginx/tls /usr/share/nginx/html

# --- App config -------------------------------------------------------------
COPY nginx.conf /etc/nginx/conf.d/moodify.conf

# Optional: drop pre-built SPA assets in here when bundling the React
# build into the edge image. Empty placeholder otherwise.
# COPY ./html/ /usr/share/nginx/html/

# --- Health probe -----------------------------------------------------------
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/healthz || exit 1

# --- Runtime ----------------------------------------------------------------
USER nginx
EXPOSE 80 443
STOPSIGNAL SIGQUIT
CMD ["nginx", "-g", "daemon off;"]
