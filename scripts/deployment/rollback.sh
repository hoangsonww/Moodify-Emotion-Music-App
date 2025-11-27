#!/bin/bash

################################################################################
# Rollback Script for Moodify
#
# This script handles rollback scenarios for both blue-green and canary deployments
#
# Usage: ./rollback.sh [OPTIONS]
#   -t, --type           Rollback type (blue-green|canary|version)
#   -v, --version        Target version to rollback to (for version rollback)
#   -r, --revision       Kubernetes revision number (optional)
#   -f, --force          Force rollback without confirmation
#   -h, --help           Show this help message
################################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAMESPACE="${NAMESPACE:-moodify-production}"
ROLLBACK_TYPE=""
TARGET_VERSION=""
REVISION=""
FORCE=false

################################################################################
# Helper Functions
################################################################################

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_help() {
    cat << EOF
Rollback Script for Moodify

Usage: $0 [OPTIONS]

Options:
    -t, --type TYPE         Rollback type (blue-green|canary|version)
    -v, --version VERSION   Target version (for version rollback)
    -r, --revision NUM      Kubernetes revision number
    -f, --force             Force rollback without confirmation
    -h, --help              Show this help message

Examples:
    # Rollback blue-green deployment
    $0 -t blue-green

    # Rollback canary deployment
    $0 -t canary

    # Rollback to specific version
    $0 -t version -v v1.2.2

    # Rollback to specific revision
    $0 -t version -r 5

EOF
}

confirm_rollback() {
    if [ "$FORCE" = true ]; then
        return 0
    fi

    log_warning "You are about to perform a rollback in $NAMESPACE"
    log_warning "Type: $ROLLBACK_TYPE"
    read -p "Are you sure? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Rollback cancelled"
        exit 0
    fi
}

get_deployment_history() {
    local deployment=$1

    log_info "Deployment history for $deployment:"
    kubectl rollout history deployment/"$deployment" -n "$NAMESPACE"
}

rollback_blue_green() {
    log_info "Performing blue-green rollback..."

    # Get current active environment
    local active_env=$(kubectl get service backend-service -n "$NAMESPACE" \
        -o jsonpath='{.spec.selector.environment}' 2>/dev/null || echo "blue")

    local previous_env
    if [ "$active_env" = "blue" ]; then
        previous_env="green"
    else
        previous_env="blue"
    fi

    log_info "Current active: $active_env"
    log_info "Switching to: $previous_env"

    # Check if previous environment is available
    local previous_ready=$(kubectl get deployment backend-$previous_env -n "$NAMESPACE" \
        -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")

    if [ "$previous_ready" = "0" ]; then
        log_error "Previous environment ($previous_env) has no ready pods"
        log_error "Cannot perform blue-green rollback"
        exit 1
    fi

    # Confirm rollback
    confirm_rollback

    # Switch traffic
    log_info "Switching traffic to $previous_env..."
    kubectl patch service backend-service \
        -n "$NAMESPACE" \
        -p "{\"spec\":{\"selector\":{\"environment\":\"$previous_env\"}}}"

    # Verify switch
    sleep 5
    local new_active=$(kubectl get service backend-service -n "$NAMESPACE" \
        -o jsonpath='{.spec.selector.environment}')

    if [ "$new_active" = "$previous_env" ]; then
        log_success "Rollback successful! Now serving from $previous_env"
    else
        log_error "Rollback verification failed"
        exit 1
    fi

    # Health check
    log_info "Running health checks..."
    local retries=10
    local count=0

    while [ $count -lt $retries ]; do
        if kubectl exec -n "$NAMESPACE" \
            deployment/backend-$previous_env -- \
            wget -q -O- http://localhost:8000/health/ready &>/dev/null; then
            log_success "Health checks passed"
            break
        fi
        ((count++))
        sleep 5
    done

    log_success "Blue-green rollback completed"
}

rollback_canary() {
    log_info "Performing canary rollback..."

    # Confirm rollback
    confirm_rollback

    # Set canary traffic to 0%
    log_info "Removing canary traffic..."

    if kubectl get virtualservice backend-vs -n "$NAMESPACE" &>/dev/null; then
        # Istio
        kubectl patch virtualservice backend-vs -n "$NAMESPACE" --type='json' \
            -p='[
                {"op": "replace", "path": "/spec/http/1/route/0/weight", "value": 100},
                {"op": "replace", "path": "/spec/http/1/route/1/weight", "value": 0}
            ]'
    elif kubectl get ingress backend-ingress-canary -n "$NAMESPACE" &>/dev/null; then
        # NGINX
        kubectl annotate ingress backend-ingress-canary -n "$NAMESPACE" \
            nginx.ingress.kubernetes.io/canary-weight="0" \
            --overwrite
    fi

    # Scale down canary
    log_info "Scaling down canary deployment..."
    kubectl scale deployment backend-canary -n "$NAMESPACE" --replicas=0

    # Optional: Delete canary deployment
    read -p "Delete canary deployment completely? (yes/no): " -r
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        kubectl delete deployment backend-canary -n "$NAMESPACE"
        log_success "Canary deployment deleted"
    fi

    log_success "Canary rollback completed"
}

rollback_to_version() {
    log_info "Performing version rollback..."

    local deployment="backend-blue"  # Default to blue

    # Determine active deployment
    local active_env=$(kubectl get service backend-service -n "$NAMESPACE" \
        -o jsonpath='{.spec.selector.environment}' 2>/dev/null || echo "blue")
    deployment="backend-$active_env"

    if [ -n "$REVISION" ]; then
        log_info "Rolling back $deployment to revision $REVISION..."

        # Show revision details
        kubectl rollout history deployment/"$deployment" \
            -n "$NAMESPACE" \
            --revision="$REVISION"

        # Confirm rollback
        confirm_rollback

        # Perform rollback
        kubectl rollout undo deployment/"$deployment" \
            -n "$NAMESPACE" \
            --to-revision="$REVISION"

    elif [ -n "$TARGET_VERSION" ]; then
        log_info "Rolling back $deployment to version $TARGET_VERSION..."

        # Confirm rollback
        confirm_rollback

        # Update image
        local image="${IMAGE_REGISTRY:-moodify}/backend:$TARGET_VERSION"
        kubectl set image deployment/"$deployment" \
            backend="$image" \
            -n "$NAMESPACE" \
            --record

    else
        log_info "Rolling back $deployment to previous revision..."

        # Show current revision
        get_deployment_history "$deployment"

        # Confirm rollback
        confirm_rollback

        # Rollback to previous
        kubectl rollout undo deployment/"$deployment" -n "$NAMESPACE"
    fi

    # Wait for rollout
    log_info "Waiting for rollout to complete..."
    kubectl rollout status deployment/"$deployment" \
        -n "$NAMESPACE" \
        --timeout=600s

    log_success "Version rollback completed"
}

create_rollback_report() {
    local report_file="/tmp/moodify-rollback-$(date +%Y%m%d-%H%M%S).txt"

    cat > "$report_file" << EOF
Moodify Rollback Report
========================

Date: $(date)
Namespace: $NAMESPACE
Rollback Type: $ROLLBACK_TYPE
Performed By: ${USER}

Current State:
--------------
$(kubectl get deployments -n "$NAMESPACE")

Service Configuration:
---------------------
$(kubectl get service backend-service -n "$NAMESPACE" -o yaml)

Pod Status:
-----------
$(kubectl get pods -n "$NAMESPACE" -l "app=moodify,component=backend")

Recent Events:
--------------
$(kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | tail -20)

EOF

    log_success "Rollback report saved to $report_file"
}

################################################################################
# Main Execution
################################################################################

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--type)
                ROLLBACK_TYPE="$2"
                shift 2
                ;;
            -v|--version)
                TARGET_VERSION="$2"
                shift 2
                ;;
            -r|--revision)
                REVISION="$2"
                shift 2
                ;;
            -f|--force)
                FORCE=true
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

    # Validate rollback type
    if [ -z "$ROLLBACK_TYPE" ]; then
        log_error "Rollback type is required"
        show_help
        exit 1
    fi

    log_warning "═══════════════════════════════════════"
    log_warning "  ROLLBACK OPERATION"
    log_warning "═══════════════════════════════════════"
    log_info "Namespace: $NAMESPACE"
    log_info "Type: $ROLLBACK_TYPE"

    # Execute rollback based on type
    case "$ROLLBACK_TYPE" in
        blue-green)
            rollback_blue_green
            ;;
        canary)
            rollback_canary
            ;;
        version)
            rollback_to_version
            ;;
        *)
            log_error "Unknown rollback type: $ROLLBACK_TYPE"
            exit 1
            ;;
    esac

    # Create report
    create_rollback_report

    log_success "═══════════════════════════════════════"
    log_success "  ROLLBACK COMPLETED SUCCESSFULLY"
    log_success "═══════════════════════════════════════"
}

main "$@"
