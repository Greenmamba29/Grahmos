#!/bin/bash
# Grahmos V1+V2 Unified - Smoke Tests Script
# Purpose: Validate basic functionality of deployed environment
# Usage: ./smoke-tests.sh <environment_url>

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ENVIRONMENT_URL="${1:-}"
readonly TIMEOUT=30
readonly RETRY_COUNT=3
readonly RETRY_DELAY=5

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Usage function
usage() {
    cat << EOF
Usage: $0 <environment_url>

Run smoke tests against a deployed environment

Arguments:
    environment_url    The base URL of the environment to test (e.g., https://staging.grahmos.com)

Examples:
    $0 https://staging.grahmos.com
    $0 https://grahmos.com
EOF
    exit 1
}

# Validate arguments
if [ -z "$ENVIRONMENT_URL" ]; then
    log_error "Environment URL is required"
    usage
fi

# Function to test endpoint with retries
test_endpoint() {
    local endpoint="$1"
    local expected_status="${2:-200}"
    local description="$3"
    local method="${4:-GET}"
    local data="${5:-}"
    
    log_info "Testing: $description"
    
    for i in $(seq 1 $RETRY_COUNT); do
        local curl_opts="-s -o /dev/null -w %{http_code} -X $method"
        
        # Add data if provided
        if [ -n "$data" ]; then
            curl_opts="$curl_opts -H 'Content-Type: application/json' -d '$data'"
        fi
        
        # Execute curl command
        local status_code=$(curl $curl_opts --connect-timeout $TIMEOUT "$endpoint" || echo "000")
        
        if [ "$status_code" = "$expected_status" ]; then
            log_info "✓ $description - Status: $status_code"
            return 0
        elif [ "$status_code" = "000" ]; then
            log_warning "Connection timeout or failure for $endpoint"
        else
            log_warning "Unexpected status code: $status_code (expected: $expected_status)"
        fi
        
        if [ $i -lt $RETRY_COUNT ]; then
            log_info "Retrying in $RETRY_DELAY seconds... (attempt $i/$RETRY_COUNT)"
            sleep $RETRY_DELAY
        fi
    done
    
    log_error "✗ $description - Failed after $RETRY_COUNT attempts"
    return 1
}

# Function to test WebSocket endpoint
test_websocket() {
    local endpoint="$1"
    local description="$2"
    
    log_info "Testing WebSocket: $description"
    
    # Convert https to wss
    local ws_url=$(echo "$endpoint" | sed 's/^https:/wss:/' | sed 's/^http:/ws:/')
    
    # Test WebSocket connection using curl (if supported) or nc
    if command -v websocat &> /dev/null; then
        if timeout $TIMEOUT websocat -t1 "$ws_url" <<< "ping" 2>/dev/null | grep -q "pong"; then
            log_info "✓ WebSocket $description - Connected successfully"
            return 0
        fi
    else
        log_warning "WebSocket testing skipped (websocat not installed)"
        return 0
    fi
    
    log_error "✗ WebSocket $description - Connection failed"
    return 1
}

# Function to test API response content
test_api_response() {
    local endpoint="$1"
    local expected_field="$2"
    local description="$3"
    
    log_info "Testing API response: $description"
    
    local response=$(curl -s --connect-timeout $TIMEOUT "$endpoint" || echo "{}")
    
    if echo "$response" | jq -e ".$expected_field" &> /dev/null; then
        log_info "✓ $description - Response contains expected field: $expected_field"
        return 0
    else
        log_error "✗ $description - Response missing expected field: $expected_field"
        log_error "Response: $response"
        return 1
    fi
}

# Main smoke test suite
run_smoke_tests() {
    local failed_tests=0
    local total_tests=0
    
    log_info "Starting smoke tests for: $ENVIRONMENT_URL"
    log_info "========================================="
    
    # Health check endpoints
    test_endpoint "$ENVIRONMENT_URL/health" 200 "Main health check" || ((failed_tests++))
    ((total_tests++))
    
    test_endpoint "$ENVIRONMENT_URL/api/health" 200 "API health check" || ((failed_tests++))
    ((total_tests++))
    
    test_endpoint "$ENVIRONMENT_URL/api/v1/status" 200 "API v1 status" || ((failed_tests++))
    ((total_tests++))
    
    # Authentication endpoints
    test_endpoint "$ENVIRONMENT_URL/api/auth/login" 405 "Auth login endpoint (expects POST)" || ((failed_tests++))
    ((total_tests++))
    
    test_endpoint "$ENVIRONMENT_URL/api/auth/register" 405 "Auth register endpoint (expects POST)" || ((failed_tests++))
    ((total_tests++))
    
    # Search endpoints
    test_endpoint "$ENVIRONMENT_URL/api/search" 200 "Search endpoint" || ((failed_tests++))
    ((total_tests++))
    
    test_endpoint "$ENVIRONMENT_URL/api/indexes" 200 "Indexes endpoint" || ((failed_tests++))
    ((total_tests++))
    
    # Static assets
    test_endpoint "$ENVIRONMENT_URL/favicon.ico" 200 "Favicon" || ((failed_tests++))
    ((total_tests++))
    
    test_endpoint "$ENVIRONMENT_URL/robots.txt" 200 "Robots.txt" || ((failed_tests++))
    ((total_tests++))
    
    # API response validation
    test_api_response "$ENVIRONMENT_URL/api/health" "status" "Health check response structure" || ((failed_tests++))
    ((total_tests++))
    
    test_api_response "$ENVIRONMENT_URL/api/v1/status" "version" "API version info" || ((failed_tests++))
    ((total_tests++))
    
    # WebSocket endpoints (if applicable)
    if [[ "$ENVIRONMENT_URL" =~ ^https?:// ]]; then
        test_websocket "$ENVIRONMENT_URL/ws" "Main WebSocket connection" || ((failed_tests++))
        ((total_tests++))
    fi
    
    # Security headers validation
    log_info "Testing security headers..."
    local headers=$(curl -s -I --connect-timeout $TIMEOUT "$ENVIRONMENT_URL" || echo "")
    
    if echo "$headers" | grep -qi "X-Frame-Options"; then
        log_info "✓ X-Frame-Options header present"
    else
        log_warning "✗ X-Frame-Options header missing"
        ((failed_tests++))
    fi
    ((total_tests++))
    
    if echo "$headers" | grep -qi "X-Content-Type-Options"; then
        log_info "✓ X-Content-Type-Options header present"
    else
        log_warning "✗ X-Content-Type-Options header missing"
        ((failed_tests++))
    fi
    ((total_tests++))
    
    if echo "$headers" | grep -qi "Strict-Transport-Security"; then
        log_info "✓ Strict-Transport-Security header present"
    else
        log_warning "✗ Strict-Transport-Security header missing"
        ((failed_tests++))
    fi
    ((total_tests++))
    
    # Summary
    log_info "========================================="
    local passed_tests=$((total_tests - failed_tests))
    
    if [ $failed_tests -eq 0 ]; then
        log_info "✓ All smoke tests passed! ($passed_tests/$total_tests)"
        return 0
    else
        log_error "✗ Smoke tests failed: $failed_tests out of $total_tests tests failed"
        log_info "Passed: $passed_tests/$total_tests"
        return 1
    fi
}

# Performance check
check_response_time() {
    log_info "Checking response times..."
    
    local total_time=$(curl -s -o /dev/null -w '%{time_total}' --connect-timeout $TIMEOUT "$ENVIRONMENT_URL/health" || echo "999")
    
    # Convert to milliseconds using bc for decimal handling
    local time_ms=$(echo "$total_time * 1000" | bc 2>/dev/null || echo "999000")
    
    if [ "${time_ms%.*}" -lt 1000 ]; then
        log_info "✓ Health check response time: ${time_ms%.*}ms (< 1s)"
    else
        log_warning "✗ Health check response time: ${time_ms%.*}ms (> 1s)"
    fi
}

# Main execution
main() {
    # Check for required tools
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed - some tests will be skipped"
    fi
    
    # Run the smoke tests
    run_smoke_tests
    local test_result=$?
    
    # Run performance check
    check_response_time
    
    # Exit with appropriate code
    exit $test_result
}

# Execute main function
main "$@"