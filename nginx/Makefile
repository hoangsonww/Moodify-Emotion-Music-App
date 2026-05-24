# =============================================================================
# Moodify nginx edge — convenience targets
# =============================================================================
# Wraps the bash helpers under scripts/ so an operator can stay in one
# directory. `make help` prints every target.
# =============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

CONTAINER ?= moodify-nginx
IMAGE     ?= moodify-nginx:latest
DOMAIN    ?= moodify.local

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "Targets:\n"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: build
build: ## Build the edge image
	docker build -t $(IMAGE) .

.PHONY: up
up: ## docker compose up -d
	docker compose up -d

.PHONY: down
down: ## docker compose down
	docker compose down

.PHONY: logs
logs: ## tail edge logs
	docker compose logs -f --tail=100

.PHONY: reload
reload: ## graceful SIGHUP after `nginx -t`
	./scripts/reload.sh

.PHONY: test
test: ## validate config in a throwaway container
	./scripts/test-config.sh

.PHONY: tls-dev
tls-dev: ## self-signed cert for local dev (DOMAIN=)
	DOMAIN=$(DOMAIN) ./scripts/generate-dev-tls.sh ./tls

.PHONY: tls-renew
tls-renew: ## certbot renewal hook
	./scripts/renew-certs.sh

.PHONY: health
health: ## external probe
	./scripts/healthcheck.sh https://localhost

.PHONY: maintenance-on
maintenance-on: ## drain (return 503 with branded page)
	./scripts/maintenance.sh on

.PHONY: maintenance-off
maintenance-off: ## resume traffic
	./scripts/maintenance.sh off

.PHONY: exporter-up
exporter-up: ## start the prometheus exporter sidecar
	docker compose -f exporter/docker-compose.yml up -d

.PHONY: exporter-down
exporter-down: ## stop the prometheus exporter sidecar
	docker compose -f exporter/docker-compose.yml down

.PHONY: clean
clean: ## remove dev artefacts (tls/, archives)
	rm -rf ./tls /var/log/nginx/archive 2>/dev/null || true
