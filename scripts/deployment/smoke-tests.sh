#!/bin/bash

################################################################################
# Smoke Tests for Moodify Deployment
#
# Runs basic health checks and smoke tests after deployment
#
# Usage: ./smoke-tests.sh [environment]
#   environment: staging|production|canary
################################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT="${1:-staging}"
NAMESPACE="moodify-${ENVIRONMENT}"
TIMEOUT=300
RETRY_INTERVAL=5

################################################################################
# Helper Functions
################################################################################

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_test() { echo -e "${YELLOW}[TEST]${NC} $1"; }

get_service_url() {
    local service_name=$1

    # Try to get LoadBalancer external IP
    local external_ip=$(kubectl get service "$service_name" -n "$NAMESPACE" \
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")

    if [ -n "$external_ip" ]; then
        echo "http://${external_ip}:8000"
        return
    fi

    # Fallback to ClusterIP with port-forward
    local cluster_ip=$(kubectl get service "$service_name" -n "$NAMESPACE" \
        -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")

    if [ -n "$cluster_ip" ]; then
        echo "http://${cluster_ip}:8000"
        return
    fi

    echo ""
}

test_endpoint() {
    local url=$1
    local expected_code=${2:-200}
    local description=$3

    log_test "$description"

    local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --connect-timeout 10 || echo "000")

    if [ "$response_code" = "$expected_code" ]; then
        log_success "Response code: $response_code (expected $expected_code)"
        return 0
    else
        log_error "Response code: $response_code (expected $expected_code)"
        return 1
    fi
}

################################################################################
# Smoke Tests
################################################################################

run_smoke_tests() {
    log_info "═══════════════════════════════════════════════════════════"
    log_info "  Running Smoke Tests for $ENVIRONMENT Environment"
    log_info "═══════════════════════════════════════════════════════════"

    local failed_tests=0
    local total_tests=0

    # Determine service name based on environment
    local service_name="backend-service"
    if [ "$ENVIRONMENT" = "canary" ]; then
        service_name="backend-canary-service"
    fi

    # Get service URL
    log_info "Getting service URL for $service_name..."
    local base_url=$(get_service_url "$service_name")

    if [ -z "$base_url" ]; then
        log_error "Could not determine service URL"
        log_info "Attempting to use port-forward..."

        # Use port-forward as fallback
        kubectl port-forward -n "$NAMESPACE" service/"$service_name" 8080:8000 &
        local PORT_FORWARD_PID=$!
        sleep 5
        base_url="http://localhost:8080"

        trap "kill $PORT_FORWARD_PID 2>/dev/null || true" EXIT
    fi

    log_info "Testing against: $base_url"
    echo

    # Test 1: Health Check Endpoint
    ((total_tests++))
    if test_endpoint "$base_url/health" 200 "Health check endpoint"; then
        :
    else
        ((failed_tests++))
    fi
    echo

    # Test 2: Readiness Check
    ((total_tests++))
    if test_endpoint "$base_url/health/ready" 200 "Readiness check endpoint"; then
        :
    else
        ((failed_tests++))
    fi
    echo

    # Test 3: Liveness Check
    ((total_tests++))
    if test_endpoint "$base_url/health/live" 200 "Liveness check endpoint"; then
        :
    else
        ((failed_tests++))
    fi
    echo

    # Test 4: Metrics Endpoint
    ((total_tests++))
    if test_endpoint "$base_url/metrics" 200 "Metrics endpoint"; then
        :
    else
        ((failed_tests++))
    fi
    echo

    # Test 5: API Root
    ((total_tests++))
    log_test "API root endpoint"
    if curl -f -s "$base_url/api/v1" &>/dev/null || curl -f -s "$base_url/" &>/dev/null; then
        log_success "API root accessible"
    else
        log_error "API root not accessible"
        ((failed_tests++))
    fi
    echo

    # Test 6: Check Response Time
    ((total_tests++))
    log_test "Response time check (< 2s)"
    local response_time=$(curl -o /dev/null -s -w '%{time_total}' "$base_url/health" || echo "999")
    local response_time_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)

    if [ "$response_time_ms" -lt 2000 ]; then
        log_success "Response time: ${response_time}s"
    else
        log_error "Response time: ${response_time}s (too slow)"
        ((failed_tests++))
    fi
    echo

    # Test 7: Pod Health
    ((total_tests++))
    log_test "Pod health check"
    local ready_pods=$(kubectl get pods -n "$NAMESPACE" \
        -l "app=moodify,component=backend" \
        -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' | wc -w)

    if [ "$ready_pods" -gt 0 ]; then
        log_success "$ready_pods pod(s) running"
    else
        log_error "No pods running"
        ((failed_tests++))
    fi
    echo

    # Test 8: Database Connectivity
    ((total_tests++))
    log_test "Database connectivity"
    local pod_name=$(kubectl get pods -n "$NAMESPACE" \
        -l "app=moodify,component=backend" \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

    if [ -n "$pod_name" ]; then
        if kubectl exec "$pod_name" -n "$NAMESPACE" -- \
            sh -c 'echo "SELECT 1" | timeout 5 nc -z ${DB_HOST:-localhost} ${DB_PORT:-27017}' &>/dev/null; then
            log_success "Database connection successful"
        else
            log_error "Database connection failed"
            ((failed_tests++))
        fi
    else
        log_error "No pods available for testing"
        ((failed_tests++))
    fi
    echo

    # Test 9: Redis Connectivity
    ((total_tests++))
    log_test "Redis connectivity"
    if [ -n "$pod_name" ]; then
        if kubectl exec "$pod_name" -n "$NAMESPACE" -- \
            sh -c 'timeout 5 nc -z ${REDIS_HOST:-localhost} ${REDIS_PORT:-6379}' &>/dev/null; then
            log_success "Redis connection successful"
        else
            log_error "Redis connection failed"
            ((failed_tests++))
        fi
    else
        log_error "No pods available for testing"
        ((failed_tests++))
    fi
    echo

    # Test 10: Check for Pod Errors
    ((total_tests++))
    log_test "Checking for pod errors"
    local error_count=$(kubectl get events -n "$NAMESPACE" \
        --field-selector type=Warning \
        --sort-by='.lastTimestamp' \
        | grep -c "Error\|Failed" || echo "0")

    if [ "$error_count" -eq 0 ]; then
        log_success "No errors found in recent events"
    else
        log_error "$error_count error(s) found in recent events"
        ((failed_tests++))
    fi
    echo

    # Print Summary
    log_info "═══════════════════════════════════════════════════════════"
    log_info "  Smoke Test Summary"
    log_info "═══════════════════════════════════════════════════════════"
    log_info "Total Tests:  $total_tests"
    log_success "Passed:       $((total_tests - failed_tests))"

    if [ "$failed_tests" -gt 0 ]; then
        log_error "Failed:       $failed_tests"
        log_error ""
        log_error "Smoke tests FAILED!"
        return 1
    else
        log_success ""
        log_success "All smoke tests PASSED!"
        return 0
    fi
}

################################################################################
# Extended Tests (Optional)
################################################################################

run_extended_tests() {
    log_info "Running extended tests..."

    # Test data persistence
    log_test "Testing data persistence"
    # Add tests for database operations

    # Test API functionality
    log_test "Testing API endpoints"
    # Add tests for key API endpoints

    # Test authentication
    log_test "Testing authentication"
    # Add authentication tests
}

################################################################################
# Main Execution
################################################################################

main() {
    if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "canary" ]; then
        log_error "Invalid environment: $ENVIRONMENT"
        log_info "Usage: $0 [staging|production|canary]"
        exit 1
    fi

    # Check prerequisites
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is required but not installed"
        exit 1
    fi

    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Run smoke tests
    if run_smoke_tests; then
        exit 0
    else
        exit 1
    fi
}

main "$@"
