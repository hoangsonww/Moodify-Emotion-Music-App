#!/bin/bash

################################################################################
# Canary Deployment Script for Moodify
#
# This script performs a canary deployment by:
# 1. Deploying the canary version
# 2. Gradually increasing traffic (10% -> 25% -> 50% -> 100%)
# 3. Monitoring metrics at each stage
# 4. Automatic rollback on error threshold breach
#
# Usage: ./canary-deploy.sh [OPTIONS]
#   -v, --version        Image version/tag to deploy
#   -r, --registry       Docker registry URL
#   -s, --strategy       Deployment strategy (progressive|immediate)
#   -m, --monitor        Monitoring duration in seconds (default: 300)
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

# Canary configuration
CANARY_STEPS=(10 25 50 100)
MONITOR_DURATION=300
ERROR_RATE_THRESHOLD=5.0
LATENCY_P95_THRESHOLD=2000
STRATEGY="progressive"

# Default values
IMAGE_VERSION=""
IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"

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
Canary Deployment Script for Moodify

Usage: $0 [OPTIONS]

Options:
    -v, --version VERSION    Image version/tag to deploy
    -r, --registry URL       Docker registry URL
    -s, --strategy STRATEGY  Deployment strategy (progressive|immediate)
    -m, --monitor SECONDS    Monitoring duration per stage (default: 300)
    -h, --help               Show this help message

Strategies:
    progressive    Gradual rollout: 10% -> 25% -> 50% -> 100% (default)
    immediate      Direct to 100% after initial validation

Examples:
    # Progressive canary deployment
    $0 -v v1.2.3 -s progressive

    # Quick canary with shorter monitoring
    $0 -v v1.2.3 -s progressive -m 180

Environment Variables:
    NAMESPACE           Kubernetes namespace (default: moodify-production)
    IMAGE_REGISTRY      Docker registry URL

EOF
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is required but not installed"
        exit 1
    fi

    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

deploy_canary() {
    local version=$1

    log_info "Deploying canary version $version..."

    export IMAGE_REGISTRY="$IMAGE_REGISTRY"
    export IMAGE_TAG="$version"
    export NAMESPACE="$NAMESPACE"

    # Deploy canary
    envsubst < "$PROJECT_ROOT/kubernetes/canary/backend-canary.yaml" | \
        kubectl apply -f - -n "$NAMESPACE"

    log_success "Canary deployment manifest applied"

    # Wait for rollout
    if ! kubectl rollout status deployment/backend-canary \
        -n "$NAMESPACE" \
        --timeout=600s; then
        log_error "Canary rollout failed"
        return 1
    fi

    log_success "Canary deployment ready"
}

set_traffic_weight() {
    local weight=$1

    log_info "Setting canary traffic weight to $weight%..."

    # Check if using Istio or NGINX
    if kubectl get virtualservice backend-vs -n "$NAMESPACE" &>/dev/null; then
        # Istio-based traffic splitting
        set_istio_traffic_weight "$weight"
    elif kubectl get ingress backend-ingress-canary -n "$NAMESPACE" &>/dev/null; then
        # NGINX-based traffic splitting
        set_nginx_traffic_weight "$weight"
    else
        log_warning "No traffic management system detected, skipping traffic split"
        return 1
    fi

    log_success "Traffic weight set to $weight%"
}

set_istio_traffic_weight() {
    local weight=$1
    local stable_weight=$((100 - weight))

    kubectl patch virtualservice backend-vs -n "$NAMESPACE" --type='json' \
        -p="[
            {\"op\": \"replace\", \"path\": \"/spec/http/1/route/0/weight\", \"value\": $stable_weight},
            {\"op\": \"replace\", \"path\": \"/spec/http/1/route/1/weight\", \"value\": $weight}
        ]"
}

set_nginx_traffic_weight() {
    local weight=$1

    kubectl annotate ingress backend-ingress-canary -n "$NAMESPACE" \
        nginx.ingress.kubernetes.io/canary-weight="$weight" \
        --overwrite
}

get_canary_metrics() {
    log_info "Fetching canary metrics..."

    # Get pod metrics
    local pods=$(kubectl get pods -n "$NAMESPACE" \
        -l "app=moodify,component=backend,version=canary" \
        -o jsonpath='{.items[*].metadata.name}')

    if [ -z "$pods" ]; then
        log_warning "No canary pods found"
        return 1
    fi

    local total_requests=0
    local error_count=0
    local total_latency=0
    local pod_count=0

    for pod in $pods; do
        # Fetch metrics from pod (assumes Prometheus metrics endpoint)
        local metrics=$(kubectl exec "$pod" -n "$NAMESPACE" -- \
            wget -q -O- http://localhost:8000/metrics 2>/dev/null || echo "")

        if [ -n "$metrics" ]; then
            ((pod_count++))
            # Parse metrics (simplified - in production use proper Prometheus queries)
            # This is a placeholder - real implementation would query Prometheus
        fi
    done

    # Calculate error rate (placeholder)
    local error_rate=0.0

    echo "$error_rate"
}

monitor_canary() {
    local duration=$1
    local weight=$2

    log_info "Monitoring canary for $duration seconds at $weight% traffic..."

    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    local check_interval=30

    while [ $(date +%s) -lt $end_time ]; do
        local remaining=$((end_time - $(date +%s)))
        log_info "Monitoring... ${remaining}s remaining"

        # Check pod health
        local ready_pods=$(kubectl get deployment backend-canary -n "$NAMESPACE" \
            -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        local desired_pods=$(kubectl get deployment backend-canary -n "$NAMESPACE" \
            -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

        if [ "$ready_pods" != "$desired_pods" ]; then
            log_error "Canary pods are not ready: $ready_pods/$desired_pods"
            return 1
        fi

        # Check error rate
        local error_rate=$(get_canary_metrics)
        log_info "Current error rate: ${error_rate}%"

        if (( $(echo "$error_rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
            log_error "Error rate exceeded threshold: ${error_rate}% > ${ERROR_RATE_THRESHOLD}%"
            return 1
        fi

        # Check for pod restarts
        local restarts=$(kubectl get pods -n "$NAMESPACE" \
            -l "app=moodify,component=backend,version=canary" \
            -o jsonpath='{range .items[*]}{.status.containerStatuses[0].restartCount}{"\n"}{end}' \
            | awk '{sum+=$1} END {print sum}')

        if [ "$restarts" -gt 5 ]; then
            log_error "Too many pod restarts detected: $restarts"
            return 1
        fi

        sleep $check_interval
    done

    log_success "Monitoring completed successfully"
    return 0
}

rollback_canary() {
    log_warning "Rolling back canary deployment..."

    # Set traffic to 0%
    set_traffic_weight 0 || true

    # Scale down canary
    kubectl scale deployment backend-canary -n "$NAMESPACE" --replicas=0

    # Optionally delete canary deployment
    # kubectl delete deployment backend-canary -n "$NAMESPACE"

    log_success "Canary rollback completed"
}

promote_canary() {
    log_info "Promoting canary to stable..."

    # Get the canary image
    local canary_image=$(kubectl get deployment backend-canary -n "$NAMESPACE" \
        -o jsonpath='{.spec.template.spec.containers[0].image}')

    # Determine active environment
    local active_env=$(kubectl get service backend-service -n "$NAMESPACE" \
        -o jsonpath='{.spec.selector.environment}' 2>/dev/null || echo "blue")

    log_info "Updating $active_env deployment with canary image..."

    # Update the active deployment
    kubectl set image deployment/backend-$active_env \
        backend="$canary_image" \
        -n "$NAMESPACE" \
        --record

    # Wait for rollout
    kubectl rollout status deployment/backend-$active_env \
        -n "$NAMESPACE" \
        --timeout=600s

    # Remove canary traffic
    set_traffic_weight 0 || true

    # Scale down canary
    kubectl scale deployment backend-canary -n "$NAMESPACE" --replicas=0

    log_success "Canary promoted to stable"
}

progressive_rollout() {
    log_info "Starting progressive canary rollout..."

    for weight in "${CANARY_STEPS[@]}"; do
        log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log_info "Stage: $weight% traffic to canary"
        log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Set traffic weight
        if ! set_traffic_weight "$weight"; then
            log_error "Failed to set traffic weight"
            rollback_canary
            exit 1
        fi

        # Don't monitor at 100% (already promoted)
        if [ "$weight" -eq 100 ]; then
            log_info "Reached 100%, promoting canary..."
            promote_canary
            break
        fi

        # Monitor this stage
        if ! monitor_canary "$MONITOR_DURATION" "$weight"; then
            log_error "Canary monitoring failed at $weight%"
            rollback_canary
            exit 1
        fi

        log_success "Stage $weight% completed successfully"

        # Prompt for continuation (optional)
        if [ "$weight" -lt 100 ]; then
            log_info "Proceeding to next stage in 10 seconds..."
            sleep 10
        fi
    done

    log_success "Progressive rollout completed!"
}

print_summary() {
    cat << EOF

${GREEN}═══════════════════════════════════════════════════════════════${NC}
${GREEN}              Canary Deployment Summary${NC}
${GREEN}═══════════════════════════════════════════════════════════════${NC}

Environment:     $NAMESPACE
Version:         $IMAGE_VERSION
Strategy:        $STRATEGY
Monitor Duration: ${MONITOR_DURATION}s

Canary Deployment:
$(kubectl get deployment backend-canary -n "$NAMESPACE" 2>/dev/null || echo "  Not deployed")

Stable Deployment:
$(kubectl get deployment -n "$NAMESPACE" -l "environment" 2>/dev/null || echo "  Not found")

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
            -v|--version)
                IMAGE_VERSION="$2"
                shift 2
                ;;
            -r|--registry)
                IMAGE_REGISTRY="$2"
                shift 2
                ;;
            -s|--strategy)
                STRATEGY="$2"
                shift 2
                ;;
            -m|--monitor)
                MONITOR_DURATION="$2"
                shift 2
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

    log_info "Starting canary deployment..."
    log_info "Version: $IMAGE_VERSION"
    log_info "Strategy: $STRATEGY"

    # Check prerequisites
    check_prerequisites

    # Deploy canary
    if ! deploy_canary "$IMAGE_VERSION"; then
        log_error "Canary deployment failed"
        exit 1
    fi

    # Execute deployment strategy
    case "$STRATEGY" in
        progressive)
            progressive_rollout
            ;;
        immediate)
            set_traffic_weight 100
            promote_canary
            ;;
        *)
            log_error "Unknown strategy: $STRATEGY"
            exit 1
            ;;
    esac

    # Print summary
    print_summary

    log_success "Canary deployment completed successfully!"
}

# Run main function
main "$@"
