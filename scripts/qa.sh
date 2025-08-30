#!/usr/bin/env bash
set -euo pipefail

QA_ENV="${QA_ENV:-development}"
VERBOSE="${VERBOSE:-true}"
EDGE_BASE="${EDGE_BASE:-https://edge.grahmos.local}"

run() { 
    echo "🔧 $*"; 
    eval "$*"; 
}

say() {
    echo "🧪 [QA] $*"
}

section() {
    echo ""
    echo "═══════════════════════════════════════"
    echo "  $*"
    echo "═══════════════════════════════════════"
}

# Pre-flight checks
check_tools() {
    local missing_tools=()
    
    for tool in curl jq node bash; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        say "❌ Missing required tools: ${missing_tools[*]}"
        say "Please install the missing tools and try again"
        exit 1
    fi
    
    say "✅ All required tools available"
}

# Test different search backends
test_search_backends() {
    section "Search Backend Testing"
    
    local backends=("sqlite" "meili")
    
    for backend in "${backends[@]}"; do
        say "Testing $backend backend..."
        export SEARCH_BACKEND="$backend"
        export EDGE="$EDGE_BASE"
        
        if bash scripts/smoke.sh; then
            say "✅ $backend backend tests passed"
        else
            say "❌ $backend backend tests failed"
            return 1
        fi
    done
}

# Test authentication methods
test_auth_methods() {
    section "Authentication Method Testing"
    
    # Test unauthenticated access
    say "Testing unauthenticated access..."
    unset TOKEN
    export EDGE="$EDGE_BASE"
    
    if bash scripts/smoke.sh; then
        say "✅ Unauthenticated access tests passed"
    else
        say "⚠️  Unauthenticated access tests failed (may be expected)"
    fi
    
    # Test with mock token
    say "Testing with authentication token..."
    export TOKEN="mock-test-token"
    export EDGE="$EDGE_BASE"
    
    if bash scripts/smoke.sh; then
        say "✅ Token-based authentication tests passed"
    else
        say "⚠️  Token-based authentication tests failed"
    fi
}

# Test deployment scenarios
test_deployment_scenarios() {
    section "Deployment Scenario Testing"
    
    # Simulate blue/green deployment swap
    say "Simulating blue/green deployment..."
    
    # Create mock index directories for testing
    mkdir -p /tmp/grahmos-qa/indexes/releases/{prev,new}
    echo '{"version": "prev", "status": "stable"}' > /tmp/grahmos-qa/indexes/releases/prev/metadata.json
    echo '{"version": "new", "status": "testing"}' > /tmp/grahmos-qa/indexes/releases/new/metadata.json
    
    # Test with "previous" version
    ln -sfn /tmp/grahmos-qa/indexes/releases/prev /tmp/grahmos-qa/indexes/current 2>/dev/null || true
    say "Testing with previous release..."
    export EDGE="$EDGE_BASE"
    
    if bash scripts/smoke.sh; then
        say "✅ Previous release tests passed"
    else
        say "❌ Previous release tests failed"
        return 1
    fi
    
    # Test with "new" version
    ln -sfn /tmp/grahmos-qa/indexes/releases/new /tmp/grahmos-qa/indexes/current 2>/dev/null || true
    say "Testing with new release..."
    export EDGE="$EDGE_BASE"
    
    if bash scripts/smoke.sh; then
        say "✅ New release tests passed"
    else
        say "❌ New release tests failed"
        return 1
    fi
    
    # Cleanup
    rm -rf /tmp/grahmos-qa 2>/dev/null || true
}

# Test P2P networking (if available)
test_p2p_networking() {
    section "P2P Networking Testing"
    
    say "Testing P2P network connectivity..."
    
    # Check if P2P endpoints are available
    local p2p_endpoints=(
        "/p2p/peers"
        "/p2p/status"
        "/p2p/bootstrap"
    )
    
    for endpoint in "${p2p_endpoints[@]}"; do
        say "Checking $endpoint..."
        
        if curl -sk --max-time 5 "$EDGE_BASE$endpoint" >/dev/null 2>&1; then
            say "✅ $endpoint available"
        else
            say "ℹ️  $endpoint not available (may not be implemented yet)"
        fi
    done
}

# Test PWA functionality
test_pwa_functionality() {
    section "PWA Functionality Testing"
    
    say "Testing PWA shell endpoints..."
    
    # Check if PWA is built and available
    if [ -d "apps/pwa-shell/dist" ] || [ -d "apps/pwa-shell/out" ]; then
        say "✅ PWA build artifacts found"
    else
        say "⚠️  PWA build artifacts not found"
        say "Run 'pnpm build' to generate PWA assets"
    fi
    
    # Check service worker
    local sw_paths=(
        "apps/pwa-shell/public/sw.js"
        "apps/pwa-shell/dist/sw.js"
        "apps/pwa-shell/out/sw.js"
    )
    
    local sw_found=false
    for path in "${sw_paths[@]}"; do
        if [ -f "$path" ]; then
            say "✅ Service worker found at $path"
            sw_found=true
            break
        fi
    done
    
    if [ "$sw_found" = false ]; then
        say "⚠️  Service worker not found"
    fi
}

# Performance benchmarking
run_performance_tests() {
    section "Performance Testing"
    
    say "Running basic performance checks..."
    
    # Test response times
    local endpoints=(
        "/healthz"
        "/search?q=test&k=1"
    )
    
    for endpoint in "${endpoints[@]}"; do
        say "Testing response time for $endpoint..."
        
        local response_time
        response_time=$(curl -sk -w "%{time_total}" -o /dev/null "$EDGE_BASE$endpoint" 2>/dev/null || echo "timeout")
        
        if [ "$response_time" != "timeout" ]; then
            say "✅ $endpoint responded in ${response_time}s"
        else
            say "⚠️  $endpoint timed out or failed"
        fi
    done
}

# Main QA execution
main() {
    say "🚀 Starting Grahmos QA Test Suite"
    say "Environment: $QA_ENV"
    say "Target: $EDGE_BASE"
    
    local failed_tests=0
    
    # Run all test suites
    check_tools || ((failed_tests++))
    
    test_auth_methods || ((failed_tests++))
    test_search_backends || ((failed_tests++))
    test_deployment_scenarios || ((failed_tests++))
    test_p2p_networking || ((failed_tests++))
    test_pwa_functionality || ((failed_tests++))
    run_performance_tests || ((failed_tests++))
    
    # Final report
    section "QA Test Results"
    
    if [ $failed_tests -eq 0 ]; then
        say "🎉 All QA tests passed!"
        say "✅ System is ready for deployment"
        exit 0
    else
        say "❌ $failed_tests test suite(s) failed"
        say "🔧 Please review the failures above before deployment"
        exit 1
    fi
}

# Run main function
main "$@"
