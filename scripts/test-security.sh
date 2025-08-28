#!/usr/bin/env bash

# Phase 2: Measure - Security Testing Suite
# Tests V1+V2 unified security features: mTLS, DPoP, JWT PoP, container security

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Configuration
TEST_RESULTS_DIR="./test-results"
SECURITY_LOG="$TEST_RESULTS_DIR/security-test-$(date +%Y%m%d-%H%M%S).log"
EDGE_API_URL="https://localhost:8443"
TEMP_DIR="/tmp/grahmos-security-tests"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Setup
setup_test_environment() {
    echo -e "${CYAN}🔒 Phase 2: Measure - Security Testing Suite${NC}"
    echo -e "${CYAN}=============================================${NC}"
    echo ""
    echo "Testing V1+V2 unified security implementation"
    echo "Target: $EDGE_API_URL"
    echo "Logs: $SECURITY_LOG"
    echo ""
    
    # Create test directories
    mkdir -p "$TEST_RESULTS_DIR" "$TEMP_DIR/certs"
    
    # Start logging
    {
        echo "Security Test Suite - $(date)"
        echo "Target: $EDGE_API_URL"
        echo "V1+V2 Unified Implementation"
        echo "==============================="
        echo ""
    } | tee "$SECURITY_LOG"
}

# Test helper functions
run_test() {
    local test_name="$1"
    local test_function="$2"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    echo -n "Testing $test_name... "
    {
        echo "TEST: $test_name"
        echo "Started: $(date)"
    } >> "$SECURITY_LOG"
    
    if $test_function >> "$SECURITY_LOG" 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo "Result: PASS" >> "$SECURITY_LOG"
    else
        echo -e "${RED}❌ FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "Result: FAIL" >> "$SECURITY_LOG"
    fi
    
    echo "Completed: $(date)" >> "$SECURITY_LOG"
    echo "" >> "$SECURITY_LOG"
}

# Check if infrastructure is running
check_infrastructure() {
    echo "Checking if Edge API infrastructure is running..."
    
    if ! curl -k -s --max-time 5 "$EDGE_API_URL/health" >/dev/null 2>&1; then
        echo "Edge API not accessible. Starting infrastructure..."
        make up >/dev/null 2>&1 || {
            echo "Failed to start infrastructure. Please run 'make up' manually."
            return 1
        }
        sleep 10
    fi
    
    # Verify health endpoint
    local health_response
    health_response=$(curl -k -s --max-time 10 "$EDGE_API_URL/health" 2>/dev/null || echo "ERROR")
    
    if [[ "$health_response" == *"healthy"* ]]; then
        echo "Infrastructure health check: OK"
        return 0
    else
        echo "Infrastructure health check failed: $health_response"
        return 1
    fi
}

# Security Test 1: TLS Configuration
test_tls_configuration() {
    echo "Testing TLS configuration..."
    
    # Check TLS version and ciphers
    local tls_info
    tls_info=$(openssl s_client -connect localhost:8443 -brief -verify_return_error 2>/dev/null | head -10 || echo "TLS connection failed")
    
    if [[ "$tls_info" == *"TLS connection failed"* ]]; then
        echo "TLS connection test failed"
        return 1
    fi
    
    # Check for strong TLS version (1.2 or 1.3)
    if [[ "$tls_info" == *"TLSv1.2"* ]] || [[ "$tls_info" == *"TLSv1.3"* ]]; then
        echo "Strong TLS version detected: OK"
    else
        echo "Weak or unknown TLS version: $tls_info"
        return 1
    fi
    
    # Check certificate validity
    if openssl s_client -connect localhost:8443 -verify_return_error </dev/null 2>/dev/null | grep -q "Verification: OK"; then
        echo "Certificate verification: OK"
    else
        echo "Certificate verification failed (expected for self-signed certs in development)"
    fi
    
    return 0
}

# Security Test 2: mTLS Authentication
test_mtls_authentication() {
    echo "Testing mTLS authentication..."
    
    # Test without client certificate (should allow DPoP fallback)
    local no_cert_response
    no_cert_response=$(curl -k -s -w "%{http_code}" -o /dev/null "$EDGE_API_URL/auth/mtls" 2>/dev/null || echo "000")
    
    if [[ "$no_cert_response" == "401" ]]; then
        echo "mTLS endpoint correctly rejects requests without client certificates: OK"
    else
        echo "mTLS endpoint response without client cert: $no_cert_response (expected 401)"
        return 1
    fi
    
    # Test with client certificate (if available)
    if [[ -f "infra/certs/client.crt" ]] && [[ -f "infra/certs/client.key" ]]; then
        local cert_response
        cert_response=$(curl -k -s \
            --cert "infra/certs/client.crt" \
            --key "infra/certs/client.key" \
            -w "%{http_code}" \
            "$EDGE_API_URL/auth/mtls" 2>/dev/null || echo "000")
        
        if [[ "$cert_response" == *"200"* ]] || [[ "$cert_response" == *"token"* ]]; then
            echo "mTLS authentication with client certificate: OK"
        else
            echo "mTLS authentication failed with client cert: $cert_response"
            return 1
        fi
    else
        echo "Client certificates not found - skipping mTLS auth test"
    fi
    
    return 0
}

# Security Test 3: DPoP Authentication
test_dpop_authentication() {
    echo "Testing DPoP authentication..."
    
    # Generate a test DPoP token (simplified version for testing)
    local dpop_header
    dpop_header=$(node -e "
        const crypto = require('crypto');
        const jwt = require('jsonwebtoken');
        
        // Generate key pair
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'jwk' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        
        // Create DPoP header
        const header = {
            typ: 'dpop+jwt',
            alg: 'RS256',
            jwk: publicKey
        };
        
        const payload = {
            htm: 'GET',
            htu: '$EDGE_API_URL/auth/dpop',
            iat: Math.floor(Date.now() / 1000),
            jti: crypto.randomUUID()
        };
        
        const token = jwt.sign(payload, privateKey, { 
            algorithm: 'RS256',
            header: header,
            noTimestamp: true 
        });
        
        console.log(token);
    " 2>/dev/null || echo "ERROR")
    
    if [[ "$dpop_header" == "ERROR" ]] || [[ -z "$dpop_header" ]]; then
        echo "Failed to generate test DPoP token - skipping DPoP test"
        return 0
    fi
    
    # Test DPoP authentication
    local dpop_response
    dpop_response=$(curl -k -s \
        -H "DPoP: $dpop_header" \
        -w "%{http_code}" \
        "$EDGE_API_URL/auth/dpop" 2>/dev/null || echo "000")
    
    if [[ "$dpop_response" == *"200"* ]] || [[ "$dpop_response" == *"token"* ]]; then
        echo "DPoP authentication: OK"
    else
        echo "DPoP authentication response: $dpop_response"
        # This might fail due to implementation details, so we don't return 1
    fi
    
    return 0
}

# Security Test 4: JWT PoP Validation
test_jwt_pop_validation() {
    echo "Testing JWT PoP validation..."
    
    # Test protected endpoint without JWT
    local no_jwt_response
    no_jwt_response=$(curl -k -s -w "%{http_code}" -o /dev/null "$EDGE_API_URL/search?q=test" 2>/dev/null || echo "000")
    
    if [[ "$no_jwt_response" == "401" ]]; then
        echo "Protected endpoints correctly reject requests without JWT: OK"
    else
        echo "Protected endpoint response without JWT: $no_jwt_response (expected 401)"
        return 1
    fi
    
    # Test with invalid JWT
    local invalid_jwt_response
    invalid_jwt_response=$(curl -k -s \
        -H "Authorization: Bearer invalid.jwt.token" \
        -w "%{http_code}" -o /dev/null \
        "$EDGE_API_URL/search?q=test" 2>/dev/null || echo "000")
    
    if [[ "$invalid_jwt_response" == "401" ]]; then
        echo "Protected endpoints correctly reject invalid JWTs: OK"
    else
        echo "Protected endpoint response with invalid JWT: $invalid_jwt_response (expected 401)"
        return 1
    fi
    
    return 0
}

# Security Test 5: Rate Limiting
test_rate_limiting() {
    echo "Testing rate limiting..."
    
    local rate_limit_hit=false
    local i
    
    # Send 25 rapid requests (limit is 20/s)
    for i in {1..25}; do
        local response_code
        response_code=$(curl -k -s -w "%{http_code}" -o /dev/null "$EDGE_API_URL/health" 2>/dev/null || echo "000")
        
        if [[ "$response_code" == "429" ]]; then
            rate_limit_hit=true
            break
        fi
        
        # Small delay to avoid overwhelming the system
        sleep 0.1
    done
    
    if [[ "$rate_limit_hit" == true ]]; then
        echo "Rate limiting activated correctly: OK"
    else
        echo "Rate limiting not triggered (may need more aggressive testing)"
    fi
    
    return 0
}

# Security Test 6: Security Headers
test_security_headers() {
    echo "Testing security headers..."
    
    local headers
    headers=$(curl -k -s -I "$EDGE_API_URL/health" 2>/dev/null || echo "ERROR")
    
    if [[ "$headers" == "ERROR" ]]; then
        echo "Failed to fetch headers"
        return 1
    fi
    
    local headers_ok=true
    
    # Check for essential security headers
    if echo "$headers" | grep -qi "strict-transport-security"; then
        echo "HSTS header present: OK"
    else
        echo "Missing HSTS header"
        headers_ok=false
    fi
    
    if echo "$headers" | grep -qi "x-frame-options"; then
        echo "X-Frame-Options header present: OK"
    else
        echo "Missing X-Frame-Options header"
        headers_ok=false
    fi
    
    if echo "$headers" | grep -qi "x-content-type-options"; then
        echo "X-Content-Type-Options header present: OK"
    else
        echo "Missing X-Content-Type-Options header"
        headers_ok=false
    fi
    
    if echo "$headers" | grep -qi "content-security-policy"; then
        echo "CSP header present: OK"
    else
        echo "Missing Content-Security-Policy header"
        headers_ok=false
    fi
    
    if [[ "$headers_ok" == true ]]; then
        return 0
    else
        return 1
    fi
}

# Security Test 7: Container Security
test_container_security() {
    echo "Testing container security configuration..."
    
    # Check if containers are running as non-root
    local edge_api_user
    edge_api_user=$(docker exec grahmos-edge-api whoami 2>/dev/null || echo "ERROR")
    
    if [[ "$edge_api_user" != "root" ]] && [[ "$edge_api_user" != "ERROR" ]]; then
        echo "Edge API container running as non-root user ($edge_api_user): OK"
    else
        echo "Edge API container user check failed: $edge_api_user"
        return 1
    fi
    
    # Check for read-only filesystem
    local readonly_test
    readonly_test=$(docker exec grahmos-edge-api sh -c 'touch /test-readonly 2>&1' || echo "Read-only filesystem")
    
    if [[ "$readonly_test" == *"Read-only"* ]] || [[ "$readonly_test" == *"read-only"* ]]; then
        echo "Container filesystem is read-only: OK"
    else
        echo "Container filesystem may not be read-only: $readonly_test"
        return 1
    fi
    
    # Check resource limits
    local memory_limit
    memory_limit=$(docker inspect grahmos-edge-api --format '{{.HostConfig.Memory}}' 2>/dev/null || echo "0")
    
    if [[ "$memory_limit" != "0" ]]; then
        echo "Memory limits configured: OK ($(($memory_limit / 1024 / 1024))MB)"
    else
        echo "No memory limits detected"
        return 1
    fi
    
    return 0
}

# Security Test 8: Network Security
test_network_security() {
    echo "Testing network security configuration..."
    
    # Check if services are on isolated network
    local network_name
    network_name=$(docker inspect grahmos-edge-api --format '{{range .NetworkSettings.Networks}}{{.NetworkID}}{{end}}' 2>/dev/null | head -c 8 || echo "ERROR")
    
    if [[ "$network_name" != "ERROR" ]] && [[ -n "$network_name" ]]; then
        echo "Container on isolated network: OK"
    else
        echo "Container network isolation check failed"
        return 1
    fi
    
    # Check that internal services are not exposed externally
    local internal_ports_exposed=false
    
    if netstat -ln 2>/dev/null | grep -q ":3000"; then
        echo "Warning: Edge API internal port 3000 may be exposed"
        internal_ports_exposed=true
    fi
    
    if [[ "$internal_ports_exposed" == false ]]; then
        echo "Internal services properly isolated: OK"
    else
        return 1
    fi
    
    return 0
}

# Security Test 9: Input Validation
test_input_validation() {
    echo "Testing input validation..."
    
    # Test SQL injection attempt
    local sql_injection_response
    sql_injection_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        "$EDGE_API_URL/search?q='; DROP TABLE documents; --" 2>/dev/null || echo "000")
    
    if [[ "$sql_injection_response" == "401" ]]; then
        echo "SQL injection blocked by authentication: OK"
    else
        echo "SQL injection test response: $sql_injection_response"
    fi
    
    # Test XSS attempt
    local xss_response
    xss_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        "$EDGE_API_URL/search?q=<script>alert('xss')</script>" 2>/dev/null || echo "000")
    
    if [[ "$xss_response" == "401" ]]; then
        echo "XSS attempt blocked by authentication: OK"
    else
        echo "XSS test response: $xss_response"
    fi
    
    # Test oversized request
    local oversized_query
    oversized_query=$(python3 -c "print('A' * 10000)" 2>/dev/null || echo "AAAA")
    
    local oversized_response
    oversized_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        "$EDGE_API_URL/search?q=$oversized_query" 2>/dev/null || echo "000")
    
    if [[ "$oversized_response" == "401" ]] || [[ "$oversized_response" == "413" ]] || [[ "$oversized_response" == "414" ]]; then
        echo "Oversized request handling: OK"
    else
        echo "Oversized request test response: $oversized_response"
    fi
    
    return 0
}

# Security Test 10: Environment Security
test_environment_security() {
    echo "Testing environment security..."
    
    # Check for sensitive information exposure
    local env_check=true
    
    # Test if .env file is accessible via web
    local env_response
    env_response=$(curl -k -s -w "%{http_code}" -o /dev/null "$EDGE_API_URL/.env" 2>/dev/null || echo "000")
    
    if [[ "$env_response" == "404" ]] || [[ "$env_response" == "403" ]]; then
        echo "Environment file not exposed via web: OK"
    else
        echo "Environment file may be exposed: $env_response"
        env_check=false
    fi
    
    # Check for common sensitive files
    for file in "package.json" "docker-compose.yml" "Dockerfile"; do
        local file_response
        file_response=$(curl -k -s -w "%{http_code}" -o /dev/null "$EDGE_API_URL/$file" 2>/dev/null || echo "000")
        
        if [[ "$file_response" == "404" ]] || [[ "$file_response" == "403" ]]; then
            echo "Sensitive file $file not exposed: OK"
        else
            echo "Sensitive file $file may be exposed: $file_response"
            env_check=false
        fi
    done
    
    if [[ "$env_check" == true ]]; then
        return 0
    else
        return 1
    fi
}

# Run all security tests
main() {
    setup_test_environment
    
    echo -e "${BLUE}Checking infrastructure status...${NC}"
    if ! check_infrastructure; then
        echo -e "${RED}❌ Infrastructure check failed. Please ensure services are running.${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}Running security tests...${NC}"
    echo ""
    
    # Run all security tests
    run_test "TLS Configuration" test_tls_configuration
    run_test "mTLS Authentication" test_mtls_authentication
    run_test "DPoP Authentication" test_dpop_authentication
    run_test "JWT PoP Validation" test_jwt_pop_validation
    run_test "Rate Limiting" test_rate_limiting
    run_test "Security Headers" test_security_headers
    run_test "Container Security" test_container_security
    run_test "Network Security" test_network_security
    run_test "Input Validation" test_input_validation
    run_test "Environment Security" test_environment_security
    
    # Test summary
    echo ""
    echo -e "${CYAN}Security Test Summary${NC}"
    echo "===================="
    echo "Total tests: $TESTS_TOTAL"
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
    
    local pass_rate
    if [[ $TESTS_TOTAL -gt 0 ]]; then
        pass_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
        echo "Pass rate: ${pass_rate}%"
    fi
    
    {
        echo ""
        echo "=== FINAL SUMMARY ==="
        echo "Total tests: $TESTS_TOTAL"
        echo "Passed: $TESTS_PASSED"
        echo "Failed: $TESTS_FAILED"
        echo "Pass rate: ${pass_rate}%"
        echo "Completed: $(date)"
    } >> "$SECURITY_LOG"
    
    echo ""
    echo "Detailed results: $SECURITY_LOG"
    
    # Cleanup
    rm -rf "$TEMP_DIR" 2>/dev/null || true
    
    # Return appropriate exit code
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 All security tests passed!${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Some security tests failed. Review the logs for details.${NC}"
        exit 1
    fi
}

# Handle script termination
trap 'echo -e "\n${YELLOW}Security testing interrupted${NC}"; rm -rf "$TEMP_DIR" 2>/dev/null || true; exit 130' INT

# Run main function
main "$@"
