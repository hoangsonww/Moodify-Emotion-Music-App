#!/usr/bin/env bash
# =============================================================================
# Moodify NGINX edge — convenience wrapper around docker compose
# =============================================================================
# Usage: ./start_nginx.sh <build|start|stop|restart|logs|status|reload|clean|test>
# -----------------------------------------------------------------------------
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
readonly SERVICE_NAME="nginx"

# Pick the right compose binary: prefer Docker CLI plugin (v2), fall back
# to legacy docker-compose, fail loudly if neither is installed.
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "✗ Neither 'docker compose' nor 'docker-compose' is installed." >&2
  exit 1
fi

usage() {
  cat <<EOF
Moodify NGINX edge — Docker compose wrapper

Usage: $(basename "$0") <command>

Commands:
  build      Build the image
  start      Start the container (detached)
  stop       Stop and remove the container
  restart    stop + start
  logs       Tail logs (Ctrl-C to detach)
  status     Show container + health status
  reload     Hot-reload nginx config inside the running container
  test       'nginx -t' inside the container to validate the config
  clean      Stop + remove container and volumes (destructive)
  help       This message
EOF
}

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "✗ ${COMPOSE_FILE} not found" >&2
  exit 1
fi

cmd="${1:-help}"
case "${cmd}" in
  build)
    "${COMPOSE[@]}" -f "${COMPOSE_FILE}" build --pull
    ;;
  start)
    "${COMPOSE[@]}" -f "${COMPOSE_FILE}" up -d --remove-orphans
    "${COMPOSE[@]}" -f "${COMPOSE_FILE}" ps
    ;;
  stop)
    "${COMPOSE[@]}" -f "${COMPOSE_FILE}" down
    ;;
  restart)
    "${COMPOSE[@]}" -f "${COMPOSE_FILE}" down
    "${COMPOSE[@]}" -f "${COMPOSE_FILE}" up -d --remove-orphans
    ;;
  logs)
    "${COMPOSE[@]}" -f "${COMPOSE_FILE}" logs -f --tail=200
    ;;
  status)
    "${COMPOSE[@]}" -f "${COMPOSE_FILE}" ps
    ;;
  reload)
    "${COMPOSE[@]}" -f "${COMPOSE_FILE}" exec "${SERVICE_NAME}" nginx -s reload
    ;;
  test)
    "${COMPOSE[@]}" -f "${COMPOSE_FILE}" exec "${SERVICE_NAME}" nginx -t
    ;;
  clean)
    "${COMPOSE[@]}" -f "${COMPOSE_FILE}" down -v --remove-orphans
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "✗ Unknown command: ${cmd}" >&2
    usage
    exit 2
    ;;
esac
