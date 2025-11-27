#!/bin/bash

################################################################################
# Blue-Green Deployment Script for Moodify
#
# This script performs a blue-green deployment by:
# 1. Deploying to the inactive environment (green)
# 2. Running health checks and smoke tests
# 3. Switching traffic from blue to green
# 4. Keeping blue as backup for quick rollback
#
# Usage: ./blue-green-deploy.sh [OPTIONS]
#   -e, --environment    Environment (staging|production)
#   -v, --version        Image version/tag to deploy
#   -r, --registry       Docker registry URL
#   -t, --test           Run in test mode (no traffic switch)
#   -h, --help           Show this help message
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NAMESPACE="${NAMESPACE:-moodify-production}"
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=10
SMOKE_TEST_TIMEOUT=300

# Default values
ENVIRONMENT=""
IMAGE_VERSION=""
IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"
TEST_MODE=false

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
Blue-Green Deployment Script for Moodify

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENV    Target environment (staging|production)
    -v, --version VERSION    Image version/tag to deploy
    -r, --registry URL       Docker registry URL
    -t, --test               Test mode - deploy but don't switch traffic
    -h, --help               Show this help message

Examples:
    # Deploy version v1.2.3 to production
    $0 -e production -v v1.2.3

    # Test deployment without switching traffic
    $0 -e production -v v1.2.3 -t

    # Deploy with custom registry
    $0 -e production -v v1.2.3 -r myregistry.azurecr.io

Environment Variables:
    NAMESPACE           Kubernetes namespace (default: moodify-production)
    IMAGE_REGISTRY      Docker registry URL
    KUBECONFIG          Path to kubeconfig file

EOF
}

get_active_environment() {
    local selector=$(kubectl get service backend-service -n "$NAMESPACE" \
        -o jsonpath='{.spec.selector.environment}' 2>/dev/null || echo "blue")
    echo "$selector"
}

get_inactive_environment() {
    local active=$(get_active_environment)
    if [ "$active" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_tools=()

    if ! command -v kubectl &> /dev/null; then
        missing_tools+=("kubectl")
    fi

    if ! command -v envsubst &> /dev/null; then
        missing_tools+=("envsubst (gettext package)")
    fi

    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi

    # Verify kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Verify namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

deploy_to_environment() {
    local env=$1
    local version=$2

    log_info "Deploying version $version to $env environment..."

    # Export variables for envsubst
    export IMAGE_REGISTRY="$IMAGE_REGISTRY"
    export IMAGE_TAG="$version"
    export NAMESPACE="$NAMESPACE"

    # Apply deployment
    envsubst < "$PROJECT_ROOT/kubernetes/blue-green/backend-$env.yaml" | \
        kubectl apply -f - -n "$NAMESPACE"

    log_success "Deployment manifest applied for $env environment"
}

wait_for_rollout() {
    local env=$1

    log_info "Waiting for rollout to complete for $env environment..."

    if kubectl rollout status deployment/backend-$env \
        -n "$NAMESPACE" \
        --timeout=600s; then
        log_success "Rollout completed successfully"
        return 0
    else
        log_error "Rollout failed or timed out"
        return 1
    fi
}

run_health_checks() {
    local env=$1

    log_info "Running health checks for $env environment..."

    local retries=0
    local pod_name

    while [ $retries -lt $HEALTH_CHECK_RETRIES ]; do
        # Get a pod from the environment
        pod_name=$(kubectl get pods -n "$NAMESPACE" \
            -l "app=moodify,component=backend,environment=$env" \
            -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

        if [ -z "$pod_name" ]; then
            log_warning "No pods found for $env environment (attempt $((retries+1))/$HEALTH_CHECK_RETRIES)"
            sleep $HEALTH_CHECK_INTERVAL
            ((retries++))
            continue
        fi

        # Check if pod is ready
        local ready=$(kubectl get pod "$pod_name" -n "$NAMESPACE" \
            -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")

        if [ "$ready" = "True" ]; then
            # Additional health check via HTTP
            if kubectl exec "$pod_name" -n "$NAMESPACE" -- \
                wget -q -O- http://localhost:8000/health/ready &>/dev/null; then
                log_success "Health checks passed for $env environment"
                return 0
            fi
        fi

        log_warning "Health check failed (attempt $((retries+1))/$HEALTH_CHECK_RETRIES)"
        sleep $HEALTH_CHECK_INTERVAL
        ((retries++))
    done

    log_error "Health checks failed after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

run_smoke_tests() {
    local env=$1

    log_info "Running smoke tests for $env environment..."

    # Get service endpoint
    local service_name="backend-${env}-service"
    local service_ip=$(kubectl get service "$service_name" -n "$NAMESPACE" \
        -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")

    if [ -z "$service_ip" ]; then
        log_error "Could not get service IP for $service_name"
        return 1
    fi

    # Run smoke tests in a temporary pod
    log_info "Testing endpoints via $service_ip:8000..."

    local test_pod="smoke-test-$$"
    kubectl run "$test_pod" \
        --image=curlimages/curl:latest \
        --rm -i \
        --restart=Never \
        --timeout="${SMOKE_TEST_TIMEOUT}s" \
        -n "$NAMESPACE" \
        -- /bin/sh -c "
            echo 'Testing health endpoint...'
            curl -f -s http://${service_ip}:8000/health/ready || exit 1

            echo 'Testing metrics endpoint...'
            curl -f -s http://${service_ip}:8000/metrics || exit 1

            echo 'All smoke tests passed!'
        " 2>&1

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        log_success "Smoke tests passed"
        return 0
    else
        log_error "Smoke tests failed"
        return 1
    fi
}

switch_traffic() {
    local target_env=$1

    log_info "Switching traffic to $target_env environment..."

    # Update service selector
    kubectl patch service backend-service \
        -n "$NAMESPACE" \
        -p "{\"spec\":{\"selector\":{\"environment\":\"$target_env\"}}}"

    log_success "Traffic switched to $target_env environment"

    # Verify the switch
    local current_env=$(get_active_environment)
    if [ "$current_env" = "$target_env" ]; then
        log_success "Traffic switch verified: now serving from $target_env"
    else
        log_error "Traffic switch verification failed"
        return 1
    fi
}

verify_deployment() {
    local env=$1

    log_info "Verifying deployment in $env environment..."

    # Check pod count
    local desired=$(kubectl get deployment backend-$env -n "$NAMESPACE" \
        -o jsonpath='{.spec.replicas}')
    local ready=$(kubectl get deployment backend-$env -n "$NAMESPACE" \
        -o jsonpath='{.status.readyReplicas}')

    log_info "Pods: $ready/$desired ready"

    if [ "$ready" != "$desired" ]; then
        log_warning "Not all pods are ready"
        return 1
    fi

    # Check pod status
    local pod_status=$(kubectl get pods -n "$NAMESPACE" \
        -l "app=moodify,component=backend,environment=$env" \
        -o jsonpath='{range .items[*]}{.status.phase}{"\n"}{end}' | sort | uniq -c)

    log_info "Pod status distribution:"
    echo "$pod_status"

    log_success "Deployment verification complete"
}

print_deployment_summary() {
    local active_env=$(get_active_environment)
    local inactive_env=$(get_inactive_environment)

    cat << EOF

${GREEN}═══════════════════════════════════════════════════════════════${NC}
${GREEN}              Blue-Green Deployment Summary${NC}
${GREEN}═══════════════════════════════════════════════════════════════${NC}

Environment:        $NAMESPACE
Active Environment: $active_env
Standby Environment: $inactive_env
Deployed Version:   $IMAGE_VERSION
Registry:           $IMAGE_REGISTRY

Active Environment Details:
$(kubectl get deployment backend-$active_env -n "$NAMESPACE" 2>/dev/null || echo "  Not deployed")

Standby Environment Details:
$(kubectl get deployment backend-$inactive_env -n "$NAMESPACE" 2>/dev/null || echo "  Not deployed")

${GREEN}═══════════════════════════════════════════════════════════════${NC}

EOF
}

################################################################################
# Main Execution
################################################################################

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -v|--version)
                IMAGE_VERSION="$2"
                shift 2
                ;;
            -r|--registry)
                IMAGE_REGISTRY="$2"
                shift 2
                ;;
            -t|--test)
                TEST_MODE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Validate required arguments
    if [ -z "$IMAGE_VERSION" ]; then
        log_error "Image version is required (-v or --version)"
        show_help
        exit 1
    fi

    log_info "Starting blue-green deployment..."
    log_info "Environment: $NAMESPACE"
    log_info "Version: $IMAGE_VERSION"
    log_info "Test Mode: $TEST_MODE"

    # Check prerequisites
    check_prerequisites

    # Determine active and inactive environments
    ACTIVE_ENV=$(get_active_environment)
    INACTIVE_ENV=$(get_inactive_environment)

    log_info "Current active environment: $ACTIVE_ENV"
    log_info "Deploying to inactive environment: $INACTIVE_ENV"

    # Deploy to inactive environment
    deploy_to_environment "$INACTIVE_ENV" "$IMAGE_VERSION"

    # Wait for rollout
    if ! wait_for_rollout "$INACTIVE_ENV"; then
        log_error "Deployment failed during rollout"
        exit 1
    fi

    # Run health checks
    if ! run_health_checks "$INACTIVE_ENV"; then
        log_error "Deployment failed health checks"
        exit 1
    fi

    # Run smoke tests
    if ! run_smoke_tests "$INACTIVE_ENV"; then
        log_error "Deployment failed smoke tests"
        exit 1
    fi

    # Verify deployment
    verify_deployment "$INACTIVE_ENV"

    # Switch traffic (unless in test mode)
    if [ "$TEST_MODE" = true ]; then
        log_warning "Test mode enabled - skipping traffic switch"
        log_info "You can manually switch traffic with:"
        log_info "  kubectl patch service backend-service -n $NAMESPACE -p '{\"spec\":{\"selector\":{\"environment\":\"$INACTIVE_ENV\"}}}'"
    else
        if ! switch_traffic "$INACTIVE_ENV"; then
            log_error "Traffic switch failed"
            exit 1
        fi

        # Final verification after traffic switch
        sleep 10
        run_health_checks "$INACTIVE_ENV"
    fi

    # Print summary
    print_deployment_summary

    log_success "Blue-green deployment completed successfully!"
    log_info "Previous environment ($ACTIVE_ENV) is still running and can be used for quick rollback"
}

# Run main function
main "$@"
