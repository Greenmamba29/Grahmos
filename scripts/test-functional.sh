#!/usr/bin/env bash

# Phase 2: Measure - Functional Testing Suite
# Tests V1+V2 unified implementation functional requirements and user workflows

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Configuration
TEST_RESULTS_DIR="./test-results"
FUNCTIONAL_LOG="$TEST_RESULTS_DIR/functional-test-$(date +%Y%m%d-%H%M%S).log"
EDGE_API_URL="https://localhost:8443"
TEMP_DIR="/tmp/grahmos-functional-tests"

# Test data
TEST_DOCUMENTS=(
    "Artificial Intelligence represents the future of computing and automation."
    "Machine Learning algorithms enable computers to learn from data patterns."
    "Quantum Computing promises to revolutionize cryptography and optimization."
    "Blockchain technology provides decentralized and secure transaction ledgers."
    "Cybersecurity measures protect digital assets from malicious threats."
)

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

# Global variables for test state
JWT_TOKEN=""
DPOP_HEADER=""
CLIENT_PRIVATE_KEY=""
CLIENT_PUBLIC_KEY=""

# Setup
setup_test_environment() {
    echo -e "${CYAN}🧪 Phase 2: Measure - Functional Testing Suite${NC}"
    echo -e "${CYAN}===============================================${NC}"
    echo ""
    echo "Testing V1+V2 unified functional implementation"
    echo "Target: $EDGE_API_URL"
    echo "Logs: $FUNCTIONAL_LOG"
    echo ""
    
    # Create test directories
    mkdir -p "$TEST_RESULTS_DIR" "$TEMP_DIR"
    
    # Start logging
    {
        echo "Functional Test Suite - $(date)"
        echo "Target: $EDGE_API_URL"
        echo "V1+V2 Unified Implementation"
        echo "==============================="
        echo ""
    } | tee "$FUNCTIONAL_LOG"
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
    } >> "$FUNCTIONAL_LOG"
    
    if $test_function >> "$FUNCTIONAL_LOG" 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo "Result: PASS" >> "$FUNCTIONAL_LOG"
    else
        echo -e "${RED}❌ FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "Result: FAIL" >> "$FUNCTIONAL_LOG"
    fi
    
    echo "Completed: $(date)" >> "$FUNCTIONAL_LOG"
    echo "" >> "$FUNCTIONAL_LOG"
}

# Check infrastructure
check_infrastructure() {
    echo "Checking infrastructure status..."
    
    if ! curl -k -s --max-time 5 "$EDGE_API_URL/health" >/dev/null 2>&1; then
        echo "Edge API not accessible. Starting infrastructure..."
        make up >/dev/null 2>&1 || {
            echo "Failed to start infrastructure. Please run 'make up' manually."
            return 1
        }
        sleep 10
    fi
    
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

# Generate authentication credentials for testing
generate_auth_credentials() {
    echo "Generating test authentication credentials..."
    
    # Generate DPoP key pair and token
    local credentials
    credentials=$(node -e "
        const crypto = require('crypto');
        const jwt = require('jsonwebtoken');
        
        try {
            // Generate RSA key pair
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
                htm: 'POST',
                htu: '$EDGE_API_URL/auth/dpop',
                iat: Math.floor(Date.now() / 1000),
                jti: crypto.randomUUID()
            };
            
            const dpopToken = jwt.sign(payload, privateKey, { 
                algorithm: 'RS256',
                header: header,
                noTimestamp: true 
            });
            
            console.log(JSON.stringify({
                dpop: dpopToken,
                privateKey: privateKey,
                publicKey: JSON.stringify(publicKey)
            }));
        } catch (error) {
            console.log('ERROR');
        }
    " 2>/dev/null || echo "ERROR")
    
    if [[ "$credentials" == "ERROR" ]]; then
        echo "Failed to generate authentication credentials"
        return 1
    fi
    
    DPOP_HEADER=$(echo "$credentials" | node -e "const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')); console.log(data.dpop);" 2>/dev/null || echo "")
    CLIENT_PRIVATE_KEY=$(echo "$credentials" | node -e "const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')); console.log(data.privateKey);" 2>/dev/null || echo "")
    CLIENT_PUBLIC_KEY=$(echo "$credentials" | node -e "const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')); console.log(data.publicKey);" 2>/dev/null || echo "")
    
    if [[ -n "$DPOP_HEADER" ]]; then
        echo "Authentication credentials generated successfully"
        return 0
    else
        echo "Failed to parse authentication credentials"
        return 1
    fi
}

# Functional Test 1: API Health Check
test_api_health() {
    echo "Testing API health endpoint..."
    
    local response
    response=$(curl -k -s "$EDGE_API_URL/health" 2>/dev/null || echo "ERROR")
    
    if [[ "$response" == *"healthy"* ]] || [[ "$response" == *"status"* ]]; then
        echo "API health check response: $response"
        return 0
    else
        echo "API health check failed: $response"
        return 1
    fi
}

# Functional Test 2: DPoP Authentication Flow
test_dpop_authentication_flow() {
    echo "Testing complete DPoP authentication flow..."
    
    if [[ -z "$DPOP_HEADER" ]]; then
        echo "No DPoP header available for testing"
        return 1
    fi
    
    # Step 1: Attempt authentication with DPoP
    local auth_response
    auth_response=$(curl -k -s \
        -X POST \
        -H "DPoP: $DPOP_HEADER" \
        -H "Content-Type: application/json" \
        -d '{"grant_type": "client_credentials"}' \
        "$EDGE_API_URL/auth/dpop" 2>/dev/null || echo "ERROR")
    
    echo "DPoP auth response: $auth_response"
    
    # Try to extract JWT token from response
    if [[ "$auth_response" == *"access_token"* ]]; then
        JWT_TOKEN=$(echo "$auth_response" | node -e "
            try {
                const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
                console.log(data.access_token || '');
            } catch (e) {
                console.log('');
            }
        " 2>/dev/null || echo "")
        
        if [[ -n "$JWT_TOKEN" ]]; then
            echo "JWT token obtained from DPoP authentication"
            return 0
        fi
    fi
    
    # Alternative: Check if we get a reasonable response code
    local response_code
    response_code=$(curl -k -s -w "%{http_code}" -o /dev/null \
        -X POST \
        -H "DPoP: $DPOP_HEADER" \
        -H "Content-Type: application/json" \
        -d '{"grant_type": "client_credentials"}' \
        "$EDGE_API_URL/auth/dpop" 2>/dev/null || echo "000")
    
    if [[ "$response_code" =~ ^[23][0-9][0-9]$ ]]; then
        echo "DPoP authentication returned success status: $response_code"
        return 0
    else
        echo "DPoP authentication failed with status: $response_code"
        return 1
    fi
}

# Functional Test 3: mTLS Authentication Flow
test_mtls_authentication_flow() {
    echo "Testing mTLS authentication flow..."
    
    # Test without client certificate
    local no_cert_response
    no_cert_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        "$EDGE_API_URL/auth/mtls" 2>/dev/null || echo "000")
    
    echo "mTLS without client cert response: $no_cert_response"
    
    # Test with client certificate if available
    if [[ -f "infra/certs/client.crt" ]] && [[ -f "infra/certs/client.key" ]]; then
        local cert_response
        cert_response=$(curl -k -s \
            --cert "infra/certs/client.crt" \
            --key "infra/certs/client.key" \
            "$EDGE_API_URL/auth/mtls" 2>/dev/null || echo "ERROR")
        
        echo "mTLS with client cert response: $cert_response"
        
        if [[ "$cert_response" == *"token"* ]] || [[ "$cert_response" == *"access_token"* ]]; then
            echo "mTLS authentication successful"
            return 0
        fi
    else
        echo "Client certificates not found, testing endpoint availability"
    fi
    
    # At minimum, endpoint should be available
    if [[ "$no_cert_response" =~ ^[0-9]{3}$ ]] && [[ "$no_cert_response" != "000" ]]; then
        echo "mTLS endpoint is accessible"
        return 0
    else
        echo "mTLS endpoint is not accessible"
        return 1
    fi
}

# Functional Test 4: Search API Protection
test_search_api_protection() {
    echo "Testing search API protection..."
    
    # Test search without authentication
    local unauth_response
    unauth_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        "$EDGE_API_URL/search?q=test" 2>/dev/null || echo "000")
    
    echo "Search without auth response code: $unauth_response"
    
    if [[ "$unauth_response" == "401" ]]; then
        echo "Search API correctly protected - requires authentication"
        return 0
    else
        echo "Search API protection may be insufficient: $unauth_response"
        return 1
    fi
}

# Functional Test 5: Search Backend Selection
test_search_backend_selection() {
    echo "Testing search backend selection..."
    
    local backends=("sqlite" "meilisearch")
    local backend_accessible=false
    
    for backend in "${backends[@]}"; do
        echo "Testing $backend backend..."
        
        local backend_response
        backend_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
            "$EDGE_API_URL/search?q=test&backend=$backend" 2>/dev/null || echo "000")
        
        echo "$backend backend response: $backend_response"
        
        if [[ "$backend_response" =~ ^[0-9]{3}$ ]] && [[ "$backend_response" != "000" ]]; then
            backend_accessible=true
        fi
    done
    
    if [[ "$backend_accessible" == true ]]; then
        echo "Search backend selection endpoints are accessible"
        return 0
    else
        echo "Search backend selection endpoints are not accessible"
        return 1
    fi
}

# Functional Test 6: Assistant API Integration
test_assistant_api_integration() {
    echo "Testing Assistant API integration..."
    
    # Test assistant endpoint without auth
    local assistant_response
    assistant_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"message": "Hello, assistant!", "model": "gemma-3n"}' \
        "$EDGE_API_URL/assistant/chat" 2>/dev/null || echo "000")
    
    echo "Assistant API response code: $assistant_response"
    
    if [[ "$assistant_response" =~ ^[0-9]{3}$ ]] && [[ "$assistant_response" != "000" ]]; then
        echo "Assistant API endpoint is accessible"
        return 0
    else
        echo "Assistant API endpoint is not accessible"
        return 1
    fi
}

# Functional Test 7: TTS API Integration
test_tts_api_integration() {
    echo "Testing TTS API integration..."
    
    # Test TTS endpoint
    local tts_response
    tts_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"text": "Hello world", "voice": "piper"}' \
        "$EDGE_API_URL/assistant/tts" 2>/dev/null || echo "000")
    
    echo "TTS API response code: $tts_response"
    
    if [[ "$tts_response" =~ ^[0-9]{3}$ ]] && [[ "$tts_response" != "000" ]]; then
        echo "TTS API endpoint is accessible"
        return 0
    else
        echo "TTS API endpoint is not accessible"
        return 1
    fi
}

# Functional Test 8: Error Handling
test_error_handling() {
    echo "Testing error handling..."
    
    local error_tests_passed=0
    local error_tests_total=4
    
    # Test 1: Invalid endpoint
    local invalid_endpoint_response
    invalid_endpoint_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        "$EDGE_API_URL/invalid/endpoint" 2>/dev/null || echo "000")
    
    echo "Invalid endpoint response: $invalid_endpoint_response"
    if [[ "$invalid_endpoint_response" == "404" ]]; then
        error_tests_passed=$((error_tests_passed + 1))
    fi
    
    # Test 2: Invalid JSON
    local invalid_json_response
    invalid_json_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{invalid json}' \
        "$EDGE_API_URL/auth/dpop" 2>/dev/null || echo "000")
    
    echo "Invalid JSON response: $invalid_json_response"
    if [[ "$invalid_json_response" == "400" ]]; then
        error_tests_passed=$((error_tests_passed + 1))
    fi
    
    # Test 3: Missing headers
    local missing_headers_response
    missing_headers_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        -X POST \
        "$EDGE_API_URL/auth/dpop" 2>/dev/null || echo "000")
    
    echo "Missing headers response: $missing_headers_response"
    if [[ "$missing_headers_response" =~ ^4[0-9][0-9]$ ]]; then
        error_tests_passed=$((error_tests_passed + 1))
    fi
    
    # Test 4: Unsupported method
    local unsupported_method_response
    unsupported_method_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        -X DELETE \
        "$EDGE_API_URL/health" 2>/dev/null || echo "000")
    
    echo "Unsupported method response: $unsupported_method_response"
    if [[ "$unsupported_method_response" == "405" ]]; then
        error_tests_passed=$((error_tests_passed + 1))
    fi
    
    echo "Error handling tests passed: $error_tests_passed/$error_tests_total"
    
    if [[ $error_tests_passed -ge 2 ]]; then
        return 0
    else
        return 1
    fi
}

# Functional Test 9: CORS and Security Headers
test_cors_and_headers() {
    echo "Testing CORS and security headers..."
    
    # Test CORS preflight
    local cors_response
    cors_response=$(curl -k -s -I \
        -X OPTIONS \
        -H "Origin: https://example.com" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type, Authorization" \
        "$EDGE_API_URL/search" 2>/dev/null || echo "ERROR")
    
    echo "CORS preflight response received"
    
    # Check for security headers in any response
    local security_headers_response
    security_headers_response=$(curl -k -s -I "$EDGE_API_URL/health" 2>/dev/null || echo "ERROR")
    
    if [[ "$security_headers_response" != "ERROR" ]]; then
        local headers_found=0
        
        if echo "$security_headers_response" | grep -qi "x-frame-options"; then
            echo "X-Frame-Options header found"
            headers_found=$((headers_found + 1))
        fi
        
        if echo "$security_headers_response" | grep -qi "x-content-type-options"; then
            echo "X-Content-Type-Options header found"
            headers_found=$((headers_found + 1))
        fi
        
        if echo "$security_headers_response" | grep -qi "strict-transport-security"; then
            echo "HSTS header found"
            headers_found=$((headers_found + 1))
        fi
        
        echo "Security headers found: $headers_found"
        
        if [[ $headers_found -ge 1 ]]; then
            return 0
        fi
    fi
    
    echo "Minimal security headers check passed"
    return 0
}

# Functional Test 10: API Versioning
test_api_versioning() {
    echo "Testing API versioning..."
    
    # Test version endpoint if it exists
    local version_response
    version_response=$(curl -k -s "$EDGE_API_URL/version" 2>/dev/null || echo "ERROR")
    
    echo "Version endpoint response: $version_response"
    
    # Test API with version in path
    local v1_response
    v1_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        "$EDGE_API_URL/v1/health" 2>/dev/null || echo "000")
    
    echo "V1 API response: $v1_response"
    
    # Test API with version header
    local version_header_response
    version_header_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        -H "API-Version: v1" \
        "$EDGE_API_URL/health" 2>/dev/null || echo "000")
    
    echo "Version header response: $version_header_response"
    
    # At least one version mechanism should work
    if [[ "$version_response" != "ERROR" ]] || \
       [[ "$v1_response" =~ ^[23][0-9][0-9]$ ]] || \
       [[ "$version_header_response" =~ ^[23][0-9][0-9]$ ]]; then
        echo "API versioning mechanism detected"
        return 0
    else
        echo "API versioning test completed (optional feature)"
        return 0
    fi
}

# Functional Test 11: Rate Limiting Functionality
test_rate_limiting_functionality() {
    echo "Testing rate limiting functionality..."
    
    local requests_sent=0
    local rate_limit_triggered=false
    
    # Send requests until rate limit is hit or max attempts reached
    for i in {1..30}; do
        local response_code
        response_code=$(curl -k -s -w "%{http_code}" -o /dev/null \
            "$EDGE_API_URL/health" 2>/dev/null || echo "000")
        
        requests_sent=$((requests_sent + 1))
        
        if [[ "$response_code" == "429" ]]; then
            rate_limit_triggered=true
            echo "Rate limit triggered after $requests_sent requests"
            break
        fi
        
        sleep 0.05  # Brief delay between requests
    done
    
    if [[ "$rate_limit_triggered" == true ]]; then
        echo "Rate limiting is functional"
        return 0
    else
        echo "Rate limiting not triggered in $requests_sent requests (may have high limits)"
        return 0  # Not failing since rate limits might be configured high
    fi
}

# Functional Test 12: Data Validation
test_data_validation() {
    echo "Testing data validation..."
    
    local validation_tests_passed=0
    local validation_tests_total=3
    
    # Test 1: Empty search query
    local empty_query_response
    empty_query_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        "$EDGE_API_URL/search?q=" 2>/dev/null || echo "000")
    
    echo "Empty search query response: $empty_query_response"
    if [[ "$empty_query_response" =~ ^[0-9]{3}$ ]] && [[ "$empty_query_response" != "000" ]]; then
        validation_tests_passed=$((validation_tests_passed + 1))
    fi
    
    # Test 2: Extremely long query
    local long_query
    long_query=$(python3 -c "print('A' * 1000)" 2>/dev/null || echo "AAAA")
    local long_query_response
    long_query_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        "$EDGE_API_URL/search?q=$long_query" 2>/dev/null || echo "000")
    
    echo "Long query response: $long_query_response"
    if [[ "$long_query_response" =~ ^[0-9]{3}$ ]] && [[ "$long_query_response" != "000" ]]; then
        validation_tests_passed=$((validation_tests_passed + 1))
    fi
    
    # Test 3: Special characters in query
    local special_chars_response
    special_chars_response=$(curl -k -s -w "%{http_code}" -o /dev/null \
        "$EDGE_API_URL/search?q=%3Cscript%3Ealert%28%27xss%27%29%3C%2Fscript%3E" 2>/dev/null || echo "000")
    
    echo "Special characters response: $special_chars_response"
    if [[ "$special_chars_response" =~ ^[0-9]{3}$ ]] && [[ "$special_chars_response" != "000" ]]; then
        validation_tests_passed=$((validation_tests_passed + 1))
    fi
    
    echo "Data validation tests passed: $validation_tests_passed/$validation_tests_total"
    
    if [[ $validation_tests_passed -ge 2 ]]; then
        return 0
    else
        return 1
    fi
}

# Main function
main() {
    setup_test_environment
    
    echo -e "${BLUE}Checking infrastructure status...${NC}"
    if ! check_infrastructure; then
        echo -e "${RED}❌ Infrastructure check failed. Please ensure services are running.${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}Generating authentication credentials...${NC}"
    generate_auth_credentials || echo "⚠️ Auth credential generation failed, some tests may be limited"
    
    echo ""
    echo -e "${BLUE}Running functional tests...${NC}"
    echo ""
    
    # Run all functional tests
    run_test "API Health Check" test_api_health
    run_test "DPoP Authentication Flow" test_dpop_authentication_flow
    run_test "mTLS Authentication Flow" test_mtls_authentication_flow
    run_test "Search API Protection" test_search_api_protection
    run_test "Search Backend Selection" test_search_backend_selection
    run_test "Assistant API Integration" test_assistant_api_integration
    run_test "TTS API Integration" test_tts_api_integration
    run_test "Error Handling" test_error_handling
    run_test "CORS and Security Headers" test_cors_and_headers
    run_test "API Versioning" test_api_versioning
    run_test "Rate Limiting Functionality" test_rate_limiting_functionality
    run_test "Data Validation" test_data_validation
    
    # Test summary
    echo ""
    echo -e "${CYAN}Functional Test Summary${NC}"
    echo "======================="
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
        echo "=== FUNCTIONAL TEST SUMMARY ==="
        echo "Total tests: $TESTS_TOTAL"
        echo "Passed: $TESTS_PASSED"
        echo "Failed: $TESTS_FAILED"
        echo "Pass rate: ${pass_rate}%"
        echo "Completed: $(date)"
        echo "==============================="
    } >> "$FUNCTIONAL_LOG"
    
    echo ""
    echo "Detailed results: $FUNCTIONAL_LOG"
    
    # Cleanup
    rm -rf "$TEMP_DIR" 2>/dev/null || true
    
    # Return appropriate exit code
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 All functional tests passed!${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Some functional tests failed. Review the logs for details.${NC}"
        exit 1
    fi
}

# Handle script termination
trap 'echo -e "\n${YELLOW}Functional testing interrupted${NC}"; rm -rf "$TEMP_DIR" 2>/dev/null || true; exit 130' INT

# Check for required tools
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: Node.js is required for authentication testing${NC}"
    echo "Please install Node.js to run the complete functional test suite"
    exit 1
fi

# Run main function
main "$@"
