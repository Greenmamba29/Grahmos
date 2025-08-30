#!/bin/bash
# Comprehensive QA Testing Pipeline for Grahmos Edge OS
# This script runs all tests and validates the system is ready for deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
TEST_RESULTS="./qa-results-$(date +%Y%m%d-%H%M%S).log"

# Start timestamp
START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "🔧 Grahmos Edge OS - QA Testing Pipeline"
echo "========================================"
echo "Start Time: $START_TIME"
echo ""

# Function to log test results
log_test() {
    local test_name=$1
    local result=$2
    local details=${3:-""}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ "$result" == "PASS" ]]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✅ PASS${NC} - $test_name"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}❌ FAIL${NC} - $test_name"
    fi
    
    if [[ -n "$details" ]]; then
        echo "   $details"
    fi
    
    # Log to file
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $result - $test_name: $details" >> "$TEST_RESULTS"
}

# Pre-flight checks
echo -e "${BLUE}📋 Pre-flight Checks${NC}"
echo "===================="

# Check required tools
check_tool() {
    local tool=$1
    if command -v "$tool" >/dev/null 2>&1; then
        log_test "Tool: $tool" "PASS" "Available"
    else
        log_test "Tool: $tool" "FAIL" "Not installed"
    fi
}

check_tool "docker"
check_tool "docker-compose"
check_tool "jq"
check_tool "sqlite3"
check_tool "openssl"
check_tool "pnpm"
check_tool "node"

echo ""
echo -e "${BLUE}🏗️ Build Phase${NC}"
echo "=============="

# Build the entire project
cd /workspace
echo "Building all packages..."
if pnpm run build >/dev/null 2>&1; then
    log_test "Project Build" "PASS" "All packages built successfully"
else
    log_test "Project Build" "FAIL" "Build failed"
fi

# Build edge-api specifically
cd /workspace/edge/edge-api
if pnpm run build >/dev/null 2>&1; then
    log_test "Edge API Build" "PASS" "TypeScript compilation successful"
else
    log_test "Edge API Build" "FAIL" "TypeScript compilation failed"
fi

echo ""
echo -e "${BLUE}🧪 Unit Tests${NC}"
echo "============="

# Run unit tests if available
cd /workspace
if [[ -f "package.json" ]] && grep -q '"test"' package.json; then
    if pnpm test >/dev/null 2>&1; then
        log_test "Unit Tests" "PASS" "All unit tests passed"
    else
        log_test "Unit Tests" "FAIL" "Some unit tests failed"
    fi
else
    log_test "Unit Tests" "PASS" "No unit tests defined (skipped)"
fi

echo ""
echo -e "${BLUE}🔒 Security Tests${NC}"
echo "================="

cd /workspace/edge
if ./test-security.sh >/dev/null 2>&1; then
    log_test "Security Tests" "PASS" "All security checks passed"
else
    log_test "Security Tests" "FAIL" "Security vulnerabilities detected"
fi

# Check for production secrets
if [[ -f ".env.production" ]]; then
    log_test "Production Secrets" "PASS" "Production configuration exists"
else
    log_test "Production Secrets" "FAIL" "Production configuration missing"
fi

# Check for default keys
if grep -q "CHANGE_THIS" .env.production 2>/dev/null || grep -q "super-secret-key" edge-api/src/*.ts 2>/dev/null; then
    log_test "Default Keys Check" "FAIL" "Default keys detected in production config"
else
    log_test "Default Keys Check" "PASS" "No default keys found"
fi

echo ""
echo -e "${BLUE}⚡ Performance Tests${NC}"
echo "==================="

if ./test-performance-lite.sh >/dev/null 2>&1; then
    log_test "Performance Tests" "PASS" "Performance benchmarks met"
else
    log_test "Performance Tests" "FAIL" "Performance below targets"
fi

echo ""
echo -e "${BLUE}🔗 Integration Tests${NC}"
echo "===================="

if ./test-integration.sh >/dev/null 2>&1; then
    log_test "Integration Tests" "PASS" "All components integrated correctly"
else
    log_test "Integration Tests" "FAIL" "Integration issues detected"
fi

echo ""
echo -e "${BLUE}🐳 Docker Tests${NC}"
echo "==============="

# Validate Docker images can be built
cd /workspace
if docker-compose -f docker-compose.yml build --quiet >/dev/null 2>&1; then
    log_test "Docker Build" "PASS" "All images built successfully"
else
    log_test "Docker Build" "FAIL" "Docker build failed"
fi

# Check Docker compose configuration
if docker-compose -f docker-compose.yml config >/dev/null 2>&1; then
    log_test "Docker Compose Config" "PASS" "Configuration valid"
else
    log_test "Docker Compose Config" "FAIL" "Invalid configuration"
fi

echo ""
echo -e "${BLUE}📁 File System Tests${NC}"
echo "===================="

# Check required directories
check_directory() {
    local dir=$1
    if [[ -d "$dir" ]]; then
        log_test "Directory: $dir" "PASS" "Exists"
    else
        log_test "Directory: $dir" "FAIL" "Missing"
    fi
}

check_directory "/workspace/edge/certs"
check_directory "/workspace/edge/updates"
check_directory "/workspace/data"

# Check file permissions
check_file_permissions() {
    local file=$1
    local expected_perms=$2
    if [[ -f "$file" ]]; then
        actual_perms=$(stat -c %a "$file" 2>/dev/null || stat -f %Lp "$file" 2>/dev/null)
        if [[ "$actual_perms" == "$expected_perms" ]]; then
            log_test "Permissions: $file" "PASS" "Correct ($expected_perms)"
        else
            log_test "Permissions: $file" "FAIL" "Expected $expected_perms, got $actual_perms"
        fi
    fi
}

# Check critical file permissions
if [[ -f "/workspace/edge/.env.production" ]]; then
    check_file_permissions "/workspace/edge/.env.production" "600"
fi
if [[ -f "/workspace/edge/keys/update-signing.key" ]]; then
    check_file_permissions "/workspace/edge/keys/update-signing.key" "600"
fi

echo ""
echo -e "${BLUE}🔄 Update System Tests${NC}"
echo "====================="

cd /workspace/edge/updates
if [[ -f "manifest.json" ]]; then
    # Validate manifest structure
    if jq -e '.version' manifest.json >/dev/null 2>&1; then
        log_test "Update Manifest" "PASS" "Valid manifest with version"
    else
        log_test "Update Manifest" "FAIL" "Invalid manifest structure"
    fi
else
    log_test "Update Manifest" "FAIL" "manifest.json not found"
fi

echo ""
echo -e "${BLUE}📊 Code Quality${NC}"
echo "==============="

# Check for TypeScript errors
cd /workspace
tsc_output=$(pnpm run build 2>&1 | grep -E "error TS|Error:" || true)
if [[ -z "$tsc_output" ]]; then
    log_test "TypeScript Compilation" "PASS" "No TypeScript errors"
else
    log_test "TypeScript Compilation" "FAIL" "TypeScript errors found"
fi

# Check for ESLint issues (if configured)
if command -v eslint >/dev/null 2>&1; then
    eslint_output=$(eslint . --ext .ts,.tsx,.js,.jsx 2>&1 | grep -E "error|warning" || true)
    if [[ -z "$eslint_output" ]]; then
        log_test "ESLint" "PASS" "No linting errors"
    else
        log_test "ESLint" "FAIL" "Linting issues found"
    fi
fi

echo ""
echo -e "${BLUE}🌐 API Endpoints${NC}"
echo "================"

# Test critical API endpoints (if services are running)
test_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$endpoint" | grep -q "$expected_status"; then
        log_test "API: $endpoint" "PASS" "$description"
    else
        log_test "API: $endpoint" "FAIL" "$description (service may not be running)"
    fi
}

# Note: These will fail if services aren't running, which is expected in CI
test_endpoint "/healthz" "200" "Health check endpoint"
test_endpoint "/auth/mtls" "401" "Auth endpoint (expects 401 without cert)"

# Summary
echo ""
echo "========================================"
echo -e "${BLUE}📊 QA Pipeline Summary${NC}"
echo "========================================"
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
echo ""

END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "End Time: $END_TIME"
echo "Results saved to: $TEST_RESULTS"
echo ""

# Deployment readiness assessment
if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "${GREEN}✅ SYSTEM READY FOR DEPLOYMENT${NC}"
    echo "All QA checks passed successfully!"
    exit 0
else
    echo -e "${YELLOW}⚠️  SYSTEM NOT READY FOR DEPLOYMENT${NC}"
    echo "Please fix the failed tests before deploying."
    echo ""
    echo "Failed tests summary:"
    grep "FAIL" "$TEST_RESULTS" | tail -10
    exit 1
fi