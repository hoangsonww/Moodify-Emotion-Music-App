# =============================================================================
# Moodify — root Makefile
# =============================================================================
# A single, opinionated entry point for every common dev/ops task in the
# repo. Run `make help` for the full menu. Everything is idempotent and safe
# to re-run; targets that require credentials fail loudly with a clear hint
# instead of silently doing the wrong thing.
#
# Conventions:
#   * Phony targets only — Make is the runner, not a dep tracker here.
#   * Each target prints a one-line banner so CI logs read well.
#   * `?=` for env vars so callers can override on the command line.
#   * Toolchain checks live in `tools-check`; every long target depends on it.
# =============================================================================

SHELL          := bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help
.ONESHELL:

# ---- Project layout ---------------------------------------------------------
ROOT_DIR       := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
FRONTEND_DIR   := $(ROOT_DIR)/frontend
MOBILE_DIR     := $(ROOT_DIR)/mobile
BACKEND_DIR    := $(ROOT_DIR)/backend
MODAL_DIR      := $(ROOT_DIR)/modal_inference
K8S_DIR        := $(ROOT_DIR)/kubernetes
TF_DIR         := $(ROOT_DIR)/terraform
HELM_DIR       := $(ROOT_DIR)/helm
PERF_DIR       := $(ROOT_DIR)/performance-tests
SCRIPTS_DIR    := $(ROOT_DIR)/scripts/deployment

# ---- Versioning + image names ----------------------------------------------
GIT_SHA        := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
GIT_BRANCH     := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
VERSION        ?= $(GIT_SHA)
REGISTRY       ?= ghcr.io/hoangsonww
BACKEND_IMAGE  ?= $(REGISTRY)/moodify-backend:$(VERSION)
FRONTEND_IMAGE ?= $(REGISTRY)/moodify-frontend:$(VERSION)
NGINX_IMAGE    ?= $(REGISTRY)/moodify-nginx:$(VERSION)

# ---- Environment knobs ------------------------------------------------------
ENV            ?= dev
NAMESPACE      ?= moodify
KUBE_CONTEXT   ?=
TF_BACKEND     ?= local

# ---- Colors (no-op when not a TTY) -----------------------------------------
ifeq ($(shell test -t 1 && echo tty),tty)
  CYAN := \033[36m
  GREEN:= \033[32m
  YEL  := \033[33m
  RED  := \033[31m
  DIM  := \033[2m
  RST  := \033[0m
else
  CYAN :=
  GREEN:=
  YEL  :=
  RED  :=
  DIM  :=
  RST  :=
endif

define banner
@printf "\n$(CYAN)▶ %s$(RST) $(DIM)[%s]$(RST)\n" "$(1)" "$(GIT_SHA)/$(GIT_BRANCH)"
endef

define require
@command -v $(1) >/dev/null 2>&1 || { printf "$(RED)✗ missing tool: $(1)$(RST)\n"; exit 1; }
endef

# ============================================================================
# HELP
# ============================================================================
.PHONY: help
help: ## Show this menu
	@printf "$(CYAN)Moodify Makefile$(RST)  $(DIM)version=$(VERSION) env=$(ENV)$(RST)\n\n"
	@printf "$(YEL)Usage:$(RST) make $(GREEN)<target>$(RST) [VAR=value ...]\n\n"
	@awk 'BEGIN{FS=":.*##"; printf "$(YEL)Targets:$(RST)\n"} \
	      /^[a-zA-Z0-9_.-]+:.*##/ {printf "  $(GREEN)%-26s$(RST) %s\n", $$1, $$2}' \
	      $(MAKEFILE_LIST) | sort -u

# ============================================================================
# TOOLCHAIN
# ============================================================================
.PHONY: tools-check
tools-check: ## Verify required CLI tools are installed
	$(call banner,Tooling sanity check)
	@for t in git docker node npm python3 jq curl; do \
	  command -v $$t >/dev/null 2>&1 || { printf "$(RED)✗ %s$(RST)\n" "$$t"; missing=1; }; \
	done; [ -z "$$missing" ] && printf "$(GREEN)✓ basic toolchain ok$(RST)\n"

# ============================================================================
# DEV — install + run
# ============================================================================
.PHONY: install
install: install-frontend install-mobile install-backend install-modal ## Install all workspaces

install-frontend: ## npm install frontend
	$(call banner,Install frontend)
	@cd $(FRONTEND_DIR) && npm ci --no-audit --no-fund

install-mobile: ## npm install mobile
	$(call banner,Install mobile)
	@cd $(MOBILE_DIR) && npm ci --no-audit --no-fund

install-backend: ## Create venv + install backend Python deps
	$(call banner,Install backend)
	@cd $(BACKEND_DIR) && python3 -m venv .venv && \
	  . .venv/bin/activate && pip install -q -U pip && pip install -q -r requirements.txt

install-modal: ## Create venv + install modal_inference dev deps
	$(call banner,Install modal_inference)
	@cd $(MODAL_DIR) && python3 -m venv .venv && \
	  . .venv/bin/activate && pip install -q -U pip && pip install -q -r requirements-dev.txt

.PHONY: dev dev-frontend dev-backend dev-mobile dev-modal
dev: ## Run frontend + backend together
	$(call banner,Dev stack)
	@(trap 'kill 0' SIGINT; \
	  $(MAKE) -s dev-backend & \
	  $(MAKE) -s dev-frontend & \
	  wait)

dev-frontend: ## Run CRA dev server
	@cd $(FRONTEND_DIR) && npm start

dev-backend: ## Run Django runserver
	@cd $(BACKEND_DIR) && . .venv/bin/activate && python manage.py runserver 0.0.0.0:8000

dev-mobile: ## Run Expo dev server
	@cd $(MOBILE_DIR) && npx expo start

dev-modal: ## Run Modal app locally
	@cd $(MODAL_DIR) && . .venv/bin/activate && modal serve modal_app.py

# ============================================================================
# QUALITY — lint + format + test
# ============================================================================
.PHONY: lint fmt test test-frontend test-backend test-modal test-coverage
lint: ## Run all linters
	$(call banner,Lint)
	@cd $(FRONTEND_DIR) && npx eslint --max-warnings=0 src || true
	@cd $(BACKEND_DIR) && . .venv/bin/activate && ruff check . || true
	@cd $(MODAL_DIR) && . .venv/bin/activate && ruff check . || true

fmt: ## Format all code
	$(call banner,Format)
	@cd $(FRONTEND_DIR) && npx prettier -w "src/**/*.{js,jsx,ts,tsx,json,css}" || true
	@cd $(BACKEND_DIR) && . .venv/bin/activate && ruff format . || true
	@cd $(MODAL_DIR) && . .venv/bin/activate && ruff format . || true

test: test-frontend test-backend test-modal ## Run every test suite

test-frontend: ## Jest tests
	$(call banner,Jest frontend)
	@cd $(FRONTEND_DIR) && CI=true npm test -- --watchAll=false

test-backend: ## Django tests
	$(call banner,Django backend)
	@cd $(BACKEND_DIR) && . .venv/bin/activate && python manage.py test --noinput

test-modal: ## pytest for modal_inference
	$(call banner,pytest modal_inference)
	@cd $(MODAL_DIR) && . .venv/bin/activate && pytest -q

test-coverage: ## Frontend coverage report
	$(call banner,Frontend coverage)
	@cd $(FRONTEND_DIR) && CI=true npm test -- --coverage --watchAll=false

# ============================================================================
# DOCKER
# ============================================================================
.PHONY: docker-build docker-build-backend docker-build-frontend docker-build-nginx docker-push
docker-build: docker-build-backend docker-build-frontend docker-build-nginx ## Build all images

docker-build-backend:
	$(call banner,docker build backend → $(BACKEND_IMAGE))
	@docker build -t $(BACKEND_IMAGE) -f $(BACKEND_DIR)/Dockerfile $(BACKEND_DIR)

docker-build-frontend:
	$(call banner,docker build frontend → $(FRONTEND_IMAGE))
	@docker build -t $(FRONTEND_IMAGE) -f $(FRONTEND_DIR)/Dockerfile $(FRONTEND_DIR)

docker-build-nginx:
	$(call banner,docker build nginx → $(NGINX_IMAGE))
	@docker build -t $(NGINX_IMAGE) -f $(ROOT_DIR)/nginx/Dockerfile $(ROOT_DIR)/nginx

docker-push: ## Push built images to $(REGISTRY)
	$(call banner,docker push)
	@docker push $(BACKEND_IMAGE)
	@docker push $(FRONTEND_IMAGE)
	@docker push $(NGINX_IMAGE)

.PHONY: compose-up compose-down compose-logs
compose-up: ## docker compose up (full stack)
	$(call banner,Compose up)
	@docker compose -f $(ROOT_DIR)/docker-compose.yml up -d

compose-down: ## docker compose down
	@docker compose -f $(ROOT_DIR)/docker-compose.yml down

compose-logs: ## tail compose logs
	@docker compose -f $(ROOT_DIR)/docker-compose.yml logs -f --tail=200

# ============================================================================
# KUBERNETES
# ============================================================================
.PHONY: k8s-apply k8s-delete k8s-status k8s-logs k8s-rollout
KCTX := $(if $(KUBE_CONTEXT),--context=$(KUBE_CONTEXT),)

k8s-apply: ## kubectl apply -f kubernetes/
	$(call banner,kubectl apply [$(NAMESPACE)])
	$(call require,kubectl)
	@kubectl $(KCTX) apply -f $(K8S_DIR)/configmap.yaml -n $(NAMESPACE) || true
	@kubectl $(KCTX) apply -f $(K8S_DIR)/backend-deployment.yaml -n $(NAMESPACE)
	@kubectl $(KCTX) apply -f $(K8S_DIR)/backend-service.yaml -n $(NAMESPACE)
	@kubectl $(KCTX) apply -f $(K8S_DIR)/frontend-deployment.yaml -n $(NAMESPACE)
	@kubectl $(KCTX) apply -f $(K8S_DIR)/frontend-service.yaml -n $(NAMESPACE)

k8s-delete: ## kubectl delete -f kubernetes/
	@kubectl $(KCTX) delete -f $(K8S_DIR) -n $(NAMESPACE) || true

k8s-status: ## Show pods / svc / hpa status
	@kubectl $(KCTX) get pods,svc,hpa -n $(NAMESPACE) -o wide

k8s-logs: ## Tail backend logs
	@kubectl $(KCTX) logs -f deploy/moodify-backend -n $(NAMESPACE) --tail=200

k8s-rollout: ## Restart deployments to pull new image
	@kubectl $(KCTX) rollout restart deploy -n $(NAMESPACE)
	@kubectl $(KCTX) rollout status deploy/moodify-backend -n $(NAMESPACE)

# ---- Helm ------------------------------------------------------------------
.PHONY: helm-lint helm-template helm-install helm-upgrade helm-uninstall
helm-lint: ## helm lint moodify-backend chart
	@helm lint $(HELM_DIR)/moodify-backend

helm-template: ## Render the chart locally
	@helm template moodify $(HELM_DIR)/moodify-backend --namespace=$(NAMESPACE)

helm-install: ## helm install/upgrade
	@helm upgrade --install moodify $(HELM_DIR)/moodify-backend -n $(NAMESPACE) --create-namespace

helm-upgrade: helm-install ## alias

helm-uninstall:
	@helm uninstall moodify -n $(NAMESPACE) || true

# ---- Deployment strategies -------------------------------------------------
.PHONY: deploy-bluegreen deploy-canary rollback smoke
deploy-bluegreen: ## Blue/green deploy via scripts/deployment
	@bash $(SCRIPTS_DIR)/blue-green-deploy.sh

deploy-canary: ## Canary deploy
	@bash $(SCRIPTS_DIR)/canary-deploy.sh

rollback: ## Roll back to previous stable revision
	@bash $(SCRIPTS_DIR)/rollback.sh

smoke: ## Run post-deploy smoke tests
	@bash $(SCRIPTS_DIR)/smoke-tests.sh

# ============================================================================
# PRODUCTION DEPLOY — Vercel (web + api) + Modal (inference)
# ============================================================================
# The live deploys this repo is wired to:
#   * https://moodify-app.vercel.app                      (marketing / SPA)
#   * https://moodify-backend-api.vercel.app             (Django REST)
#   * hoangsonww--moodify-inference-inferenceservice-web.modal.run (ML)
# Everything else under aws/ gcp/ oracle-cloud/ kubernetes/ helm/ is
# explicit OPTIONAL self-host paths. Vercel + Modal IS the prod target.

.PHONY: deploy-vercel deploy-vercel-frontend deploy-vercel-backend deploy-modal deploy-prod

deploy-prod: deploy-modal deploy-vercel ## Full prod deploy (Modal then Vercel)

deploy-vercel: deploy-vercel-backend deploy-vercel-frontend ## Deploy both Vercel projects

deploy-vercel-frontend: ## Deploy frontend SPA to Vercel
	$(call banner,vercel deploy frontend)
	$(call require,vercel)
	@cd $(FRONTEND_DIR) && vercel deploy --prod --yes

deploy-vercel-backend: ## Deploy Django API to Vercel
	$(call banner,vercel deploy backend)
	$(call require,vercel)
	@cd $(BACKEND_DIR) && vercel deploy --prod --yes

deploy-modal: ## Deploy Modal inference service
	$(call banner,modal deploy)
	$(call require,modal)
	@cd $(MODAL_DIR) && . .venv/bin/activate 2>/dev/null || true; \
	  modal deploy modal_app.py

.PHONY: modal-download-models modal-stats modal-logs
modal-download-models: ## Populate Modal Volume with model weights (once)
	@cd $(MODAL_DIR) && modal run modal_app.py::download_models

modal-stats: ## Show Modal app stats
	@modal app stats moodify-inference || true

modal-logs: ## Tail Modal logs
	@modal app logs moodify-inference -f

# ============================================================================
# TERRAFORM
# ============================================================================
TF_ENV_DIR := $(TF_DIR)/environments/$(ENV)

.PHONY: tf-init tf-plan tf-apply tf-destroy tf-fmt tf-validate
tf-init: ## terraform init for ENV
	@cd $(TF_ENV_DIR) && terraform init -upgrade

tf-plan: tf-init ## terraform plan
	@cd $(TF_ENV_DIR) && terraform plan -out=tfplan.bin

tf-apply: ## terraform apply tfplan.bin
	@cd $(TF_ENV_DIR) && terraform apply -auto-approve tfplan.bin

tf-destroy: ## terraform destroy (PROD blocked by guard)
	@[ "$(ENV)" != "production" ] || { printf "$(RED)refuse to destroy production$(RST)\n"; exit 2; }
	@cd $(TF_ENV_DIR) && terraform destroy -auto-approve

tf-fmt: ## terraform fmt -recursive
	@terraform fmt -recursive $(TF_DIR)

tf-validate: tf-init ## terraform validate
	@cd $(TF_ENV_DIR) && terraform validate

# ============================================================================
# ARGOCD
# ============================================================================
.PHONY: argocd-install argocd-sync argocd-status
argocd-install: ## Install Argo CD into cluster
	@kubectl $(KCTX) apply -f $(ROOT_DIR)/argocd/install-argocd.yaml

argocd-sync: ## Sync the moodify application
	@argocd app sync moodify-backend

argocd-status: ## Show app health
	@argocd app get moodify-backend

# ============================================================================
# PERFORMANCE TESTS
# ============================================================================
.PHONY: perf-smoke perf-load
perf-smoke: ## k6 smoke test
	@k6 run $(PERF_DIR)/smoke-test.js

perf-load: ## k6 load test
	@k6 run $(PERF_DIR)/load-test.js

# ============================================================================
# SECURITY
# ============================================================================
.PHONY: sec-audit sec-trivy sec-trufflehog
sec-audit: ## npm audit + pip-audit
	@cd $(FRONTEND_DIR) && npm audit --omit=dev || true
	@cd $(BACKEND_DIR) && . .venv/bin/activate && pip install -q pip-audit && pip-audit || true

sec-trivy: ## Trivy scan local images
	@trivy image --severity HIGH,CRITICAL $(BACKEND_IMAGE) || true
	@trivy image --severity HIGH,CRITICAL $(FRONTEND_IMAGE) || true

sec-trufflehog: ## Secret scan
	@trufflehog filesystem --no-update --only-verified $(ROOT_DIR) || true

# ============================================================================
# CLEAN
# ============================================================================
.PHONY: clean clean-deep
clean: ## Remove build artifacts (safe)
	@find . -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name .pytest_cache -prune -exec rm -rf {} + 2>/dev/null || true
	@rm -rf $(FRONTEND_DIR)/build $(FRONTEND_DIR)/coverage $(BACKEND_DIR)/staticfiles

clean-deep: clean ## Also drop venvs + node_modules (destructive)
	@rm -rf $(FRONTEND_DIR)/node_modules $(MOBILE_DIR)/node_modules
	@rm -rf $(BACKEND_DIR)/.venv $(MODAL_DIR)/.venv

# ============================================================================
# INFO
# ============================================================================
.PHONY: print-vars version
print-vars: ## Print resolved variables
	@printf "ROOT_DIR=$(ROOT_DIR)\nVERSION=$(VERSION)\nENV=$(ENV)\nNAMESPACE=$(NAMESPACE)\nREGISTRY=$(REGISTRY)\nGIT_SHA=$(GIT_SHA)\nGIT_BRANCH=$(GIT_BRANCH)\n"

version: ## Print version
	@printf "$(VERSION)\n"
