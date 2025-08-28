#!/usr/bin/env bash

# Edge Security Verification Test Suite
# Tests mTLS authentication, JWT PoP validation, container security, and access controls

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Test configuration
EDGE_URL="https://edge.grahmos.local"
CERTS_DIR="./certs"
TEST_RESULTS="./test-results-security.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo "🔐 Edge Security Verification Test Suite"
echo "========================================"
echo "Start Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "" | tee "$TEST_RESULTS"

# Utility functions
log_test() {
    local test_name="$1"
    local result="$2"
    local details="${3:-}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ "$result" == "PASS" ]]; then
        echo -e "✅ ${GREEN}PASS${NC} - $test_name" | tee -a "$TEST_RESULTS"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "❌ ${RED}FAIL${NC} - $test_name" | tee -a "$TEST_RESULTS"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    if [[ -n "$details" ]]; then
        echo "   $details" | tee -a "$TEST_RESULTS"
    fi
    echo "" | tee -a "$TEST_RESULTS"
}

# Test 1: Docker Compose Configuration Security
echo "🐳 Testing Docker Compose Security Configuration..."

test_docker_compose_security() {
    local test_name="Docker Compose Security Settings"
    local result="PASS"
    local details=""
    
    # Check if file exists
    if [[ ! -f "docker-compose.edge.yml" ]]; then
        result="FAIL"
        details="docker-compose.edge.yml not found"
        log_test "$test_name" "$result" "$details"
        return
    fi
    
    # Test rootless user configuration
    if ! grep -q "user.*10001:10001" docker-compose.edge.yml; then
        result="FAIL"
        details="Rootless user configuration not found"
    fi
    
    # Test read-only filesystem
    if ! grep -q "read_only: true" docker-compose.edge.yml; then
        result="FAIL"
        details="Read-only filesystem not configured"
    fi
    
    # Test capability dropping
    if ! grep -q "cap_drop.*ALL" docker-compose.edge.yml; then
        result="FAIL"
        details="Capabilities not dropped"
    fi
    
    # Test no-new-privileges
    if ! grep -q "no-new-privileges:true" docker-compose.edge.yml; then
        result="FAIL"
        details="no-new-privileges not set"
    fi
    
    # Test tmpfs mounts
    if ! grep -q "tmpfs:" docker-compose.edge.yml; then
        result="FAIL"
        details="Tmpfs mounts not configured"
    fi
    
    if [[ "$result" == "PASS" ]]; then
        details="All security hardening options present"
    fi
    
    log_test "$test_name" "$result" "$details"
}

test_docker_compose_security

# Test 2: NGINX Configuration Security
echo "🌐 Testing NGINX Security Configuration..."

test_nginx_security() {
    local test_name="NGINX Security Configuration"
    local result="PASS"
    local details=""
    
    if [[ ! -f "ops/nginx.conf" ]]; then
        result="FAIL"
        details="nginx.conf not found"
        log_test "$test_name" "$result" "$details"
        return
    fi
    
    local nginx_conf="ops/nginx.conf"
    
    # Test mTLS configuration
    if ! grep -q "ssl_verify_client on" "$nginx_conf"; then
        result="FAIL"
        details="mTLS not enforced"
    fi
    
    # Test TLS protocols
    if ! grep -q "ssl_protocols TLSv1.2 TLSv1.3" "$nginx_conf"; then
        result="FAIL"
        details="Insecure TLS protocols allowed"
    fi
    
    # Test security headers
    if ! grep -q "X-Content-Type-Options nosniff" "$nginx_conf"; then
        result="FAIL"
        details="Security headers missing"
    fi
    
    # Test rate limiting
    if ! grep -q "limit_req_zone" "$nginx_conf"; then
        result="FAIL"
        details="Rate limiting not configured"
    fi
    
    # Test Unix domain socket proxy
    if ! grep -q "proxy_pass http://unix:/var/run/edge/edge.sock" "$nginx_conf"; then
        result="FAIL"
        details="Unix domain socket proxy not configured"
    fi
    
    if [[ "$result" == "PASS" ]]; then
        details="All security configurations present"
    fi
    
    log_test "$test_name" "$result" "$details"
}

test_nginx_security

# Test 3: Edge API Security Implementation
echo "⚡ Testing Edge API Security Implementation..."

test_edge_api_security() {
    local test_name="Edge API Security Implementation"
    local result="PASS"
    local details=""
    
    # Check TypeScript compilation
    if [[ ! -f "edge-api/dist/server.js" ]]; then
        result="FAIL"
        details="Edge API not compiled"
        log_test "$test_name" "$result" "$details"
        return
    fi
    
    # Test JWT implementation
    if ! grep -q "verifyJwt" edge-api/dist/server.js; then
        result="FAIL"
        details="JWT verification not implemented"
    fi
    
    # Test PoP validation
    if ! grep -q "cnf.*x5t" edge-api/dist/server.js; then
        result="FAIL"
        details="PoP validation not implemented"
    fi
    
    # Test mTLS header validation
    if ! grep -q "X-Client-Verify" edge-api/dist/server.js; then
        result="FAIL"
        details="mTLS header validation not implemented"
    fi
    
    # Test security middleware
    if ! grep -q "x-powered-by" edge-api/dist/server.js; then
        result="FAIL"
        details="Security headers not disabled"
    fi
    
    if [[ "$result" == "PASS" ]]; then
        details="All security implementations present"
    fi
    
    log_test "$test_name" "$result" "$details"
}

test_edge_api_security

# Test 4: Certificate Management Security
echo "🔐 Testing Certificate Management..."

test_certificate_security() {
    local test_name="Certificate Management Security"
    local result="PASS"
    local details=""
    
    # Check if certificate generation script exists
    if [[ ! -f "ops/generate-certs.sh" ]]; then
        result="FAIL"
        details="Certificate generation script not found"
        log_test "$test_name" "$result" "$details"
        return
    fi
    
    # Test script permissions
    if [[ ! -x "ops/generate-certs.sh" ]]; then
        result="FAIL"
        details="Certificate script not executable"
    fi
    
    # Test certificate generation logic
    if ! grep -q "4096" ops/generate-certs.sh; then
        result="FAIL"
        details="Strong key generation not configured (4096 bits)"
    fi
    
    # Test client certificate extensions
    if ! grep -q "clientAuth" ops/generate-certs.sh; then
        result="FAIL"
        details="Client certificate extensions not configured"
    fi
    
    # Test certificate validation periods
    if ! grep -q "3650" ops/generate-certs.sh; then
        result="FAIL"
        details="CA certificate validity period not set (10 years)"
    fi
    
    if [[ "$result" == "PASS" ]]; then
        details="Certificate generation meets security requirements"
    fi
    
    log_test "$test_name" "$result" "$details"
}

test_certificate_security

# Test 5: Update System Security
echo "🔄 Testing Update System Security..."

test_update_security() {
    local test_name="Update System Security"
    local result="PASS"
    local details=""
    
    # Check update scripts
    if [[ ! -f "updates/update.sh" ]] || [[ ! -f "updates/sign.sh" ]]; then
        result="FAIL"
        details="Update scripts not found"
        log_test "$test_name" "$result" "$details"
        return
    fi
    
    # Test signature verification
    if ! grep -q "openssl dgst -sha256 -verify" updates/update.sh; then
        result="FAIL"
        details="Signature verification not implemented"
    fi
    
    # Test hash verification
    if ! grep -q "sha256" updates/update.sh; then
        result="FAIL"
        details="File hash verification not implemented"
    fi
    
    # Test atomic operations
    if ! grep -q "atomic" updates/update.sh; then
        result="FAIL"
        details="Atomic update operations not implemented"
    fi
    
    # Test rollback capability
    if ! grep -q "rollback" updates/update.sh; then
        result="FAIL"
        details="Rollback functionality not implemented"
    fi
    
    if [[ "$result" == "PASS" ]]; then
        details="All update security mechanisms present"
    fi
    
    log_test "$test_name" "$result" "$details"
}

test_update_security

# Test 6: JWT Implementation Security
echo "🎫 Testing JWT Security Implementation..."

test_jwt_security() {
    local test_name="JWT Security Implementation"
    local result="PASS"
    local details=""
    
    # Check JWT source files
    if [[ ! -f "edge-api/src/jwt.ts" ]]; then
        result="FAIL"
        details="JWT implementation not found"
        log_test "$test_name" "$result" "$details"
        return
    fi
    
    # Test HS512 algorithm
    if ! grep -q "HS512" edge-api/src/jwt.ts; then
        result="FAIL"
        details="Strong HMAC algorithm not used"
    fi
    
    # Test token expiration
    if ! grep -q "exp.*TTL" edge-api/src/jwt.ts; then
        result="FAIL"
        details="Token expiration not implemented"
    fi
    
    # Test PoP binding (check types definition)
    if ! grep -q "'x5t#S256'" edge-api/src/types.ts; then
        result="FAIL"
        details="PoP binding not implemented in JWT structure"
    fi
    
    # Test key management warning
    if ! grep -q "change.*production" edge-api/src/jwt.ts; then
        result="FAIL"
        details="Production key warning not present"
    fi
    
    if [[ "$result" == "PASS" ]]; then
        details="JWT implementation follows security best practices"
    fi
    
    log_test "$test_name" "$result" "$details"
}

test_jwt_security

# Test 7: File Permissions and Security
echo "📁 Testing File Permissions and Security..."

test_file_permissions() {
    local test_name="File Permissions and Security"
    local result="PASS"
    local details=""
    
    # Test script permissions
    local scripts=("ops/generate-certs.sh" "updates/update.sh" "updates/sign.sh")
    for script in "${scripts[@]}"; do
        if [[ -f "$script" ]] && [[ ! -x "$script" ]]; then
            result="FAIL"
            details="Script $script is not executable"
            break
        fi
    done
    
    # Test directory structure
    local required_dirs=("ops" "edge-api" "data" "updates" "certs")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            result="FAIL"
            details="Required directory $dir is missing"
            break
        fi
    done
    
    # Test configuration files
    local config_files=("docker-compose.edge.yml" "ops/nginx.conf" "edge-api/package.json")
    for file in "${config_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            result="FAIL"
            details="Configuration file $file is missing"
            break
        fi
    done
    
    if [[ "$result" == "PASS" ]]; then
        details="All files and directories have correct permissions"
    fi
    
    log_test "$test_name" "$result" "$details"
}

test_file_permissions

# Test 8: Environment Security
echo "🌍 Testing Environment Security Configuration..."

test_environment_security() {
    local test_name="Environment Security Configuration"
    local result="PASS" 
    local details=""
    
    # Test environment variable usage in Docker Compose
    if ! grep -q "JWT_HS512_KEY" docker-compose.edge.yml; then
        result="FAIL"
        details="JWT key not configurable via environment"
    fi
    
    # Test production environment settings
    if ! grep -q "NODE_ENV: production" docker-compose.edge.yml; then
        result="FAIL"
        details="Production environment not set"
    fi
    
    # Test default key override
    if ! grep -q "default-dev-key-change-in-production" docker-compose.edge.yml; then
        result="FAIL"
        details="Default key warning not present"
    fi
    
    if [[ "$result" == "PASS" ]]; then
        details="Environment security properly configured"
    fi
    
    log_test "$test_name" "$result" "$details"
}

test_environment_security

# Final Report
echo "📊 Security Verification Summary"
echo "================================"
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo "Success Rate: $(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%"
echo ""
echo "End Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Write summary to log
{
    echo "================================"
    echo "SECURITY VERIFICATION SUMMARY"
    echo "================================"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Success Rate: $(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%"
    echo "End Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
} >> "$TEST_RESULTS"

# Exit with error code if any tests failed
if [[ $FAILED_TESTS -gt 0 ]]; then
    echo ""
    echo -e "${RED}❌ Security verification completed with failures${NC}"
    echo "Check $TEST_RESULTS for detailed results"
    exit 1
else
    echo ""
    echo -e "${GREEN}✅ All security verification tests passed!${NC}"
    echo "Detailed results saved to: $TEST_RESULTS"
    exit 0
fi
