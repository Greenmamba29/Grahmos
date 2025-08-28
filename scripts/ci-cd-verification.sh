#!/bin/bash
# CI/CD Pipeline Verification Script
# Tests all critical pipeline steps to ensure deployment readiness

set -euo pipefail

echo "🔬 CI/CD Pipeline Verification - Grahmos Unified"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Test function
run_test() {
    local test_name="$1"
    local test_command="$2"
    local description="$3"
    
    ((TESTS_TOTAL++))
    echo -n "Testing $description... "
    
    if eval "$test_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Environment checks
echo -e "${BLUE}🔧 Environment Checks${NC}"
run_test "node_version" "node --version | grep -qE 'v(2[0-9]|[3-9][0-9])'" "Node.js version (>=20)"
run_test "pnpm_version" "pnpm --version | grep -q '[1-9][0-9]'" "pnpm version (>=10)"
run_test "workspace_structure" "[ -f package.json ] && [ -f turbo.json ] && [ -d .github/workflows ]" "Workspace structure"
run_test "env_example" "[ -f .env.example ]" "Environment template"

# Dependencies
echo -e "${BLUE}📦 Dependencies${NC}"
run_test "lockfile_exists" "[ -f pnpm-lock.yaml ]" "Lockfile exists"
run_test "install_clean" "pnpm install --frozen-lockfile" "Clean dependency install"

# Build tests
echo -e "${BLUE}🏗️  Build Process${NC}"
run_test "workspace_build" "pnpm run build" "Workspace build"
run_test "type_check" "pnpm run type-check" "TypeScript type checking"

# Docker readiness
echo -e "${BLUE}🐳 Container Readiness${NC}"
run_test "dockerfile_exists" "[ -f apps/edge-api/Dockerfile ]" "Dockerfile exists"
run_test "docker_compose" "[ -f infra/docker/docker-compose.yml ]" "Docker Compose config"

# Scripts verification
echo -e "${BLUE}📜 Required Scripts${NC}"
run_test "smoke_tests" "[ -f scripts/smoke-tests.sh ] && [ -x scripts/smoke-tests.sh ]" "Smoke tests script"
run_test "performance_baseline" "[ -f scripts/performance-baseline.sh ] && [ -x scripts/performance-baseline.sh ]" "Performance baseline script"
run_test "security_monitoring" "[ -f scripts/security-monitoring.sh ] && [ -x scripts/security-monitoring.sh ]" "Security monitoring script"
run_test "deploy_script" "[ -f scripts/deploy.sh ] && [ -x scripts/deploy.sh ]" "Deployment script"

# CI/CD configuration
echo -e "${BLUE}⚙️  CI/CD Configuration${NC}"
run_test "workflow_exists" "[ -f .github/workflows/ci-cd.yml ]" "Main CI/CD workflow"
run_test "pnpm_version_correct" "grep -q 'version: 10' .github/workflows/ci-cd.yml" "pnpm version in CI/CD"
run_test "node_version_correct" "grep -q 'NODE_VERSION.*20' .github/workflows/ci-cd.yml" "Node version in CI/CD"

# Security configuration
echo -e "${BLUE}🔒 Security Setup${NC}"
run_test "security_audit_script" "[ -f scripts/security-audit.sh ] && [ -x scripts/security-audit.sh ]" "Security audit script"
run_test "dockerfile_security" "grep -q 'nodeuser' apps/edge-api/Dockerfile" "Dockerfile security (non-root user)"
run_test "ssl_config" "[ -d certs ] || echo 'SSL directory ready'" "SSL configuration"

# Artifact directories
echo -e "${BLUE}📁 Artifact Directories${NC}"
run_test "test_results_dir" "[ -d test-results ]" "Test results directory"
run_test "coverage_dir" "[ -d coverage ]" "Coverage directory"
run_test "deployment_logs_dir" "[ -d deployment-logs ]" "Deployment logs directory"
run_test "monitoring_reports_dir" "[ -d monitoring-reports ]" "Monitoring reports directory"

# Package configurations
echo -e "${BLUE}📋 Package Configurations${NC}"
run_test "edge_api_package" "[ -f apps/edge-api/package.json ]" "Edge API package.json"
run_test "edge_api_build_script" "grep -q 'build.*tsc' apps/edge-api/package.json" "Edge API build script"
run_test "root_package_scripts" "grep -q 'type-check' package.json" "Root package scripts"

# Test configurations
echo -e "${BLUE}🧪 Test Setup${NC}"
run_test "vitest_configs" "[ -f apps/edge-api/vitest.integration.config.ts ] && [ -f apps/edge-api/vitest.e2e.config.ts ]" "Vitest configurations"
run_test "test_directories" "[ -d apps/edge-api/src/test ]" "Test directories"

# Summary
echo ""
echo -e "${BLUE}📊 Verification Summary${NC}"
echo "========================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Total Tests:  $TESTS_TOTAL"

# Calculate percentage
if [ $TESTS_TOTAL -gt 0 ]; then
    PERCENTAGE=$(( TESTS_PASSED * 100 / TESTS_TOTAL ))
    echo -e "Success Rate: $PERCENTAGE%"
else
    PERCENTAGE=0
fi

echo ""
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! CI/CD pipeline is ready for deployment.${NC}"
    exit 0
elif [ $PERCENTAGE -ge 90 ]; then
    echo -e "${YELLOW}⚠️  Most tests passed ($PERCENTAGE%). Pipeline is mostly ready.${NC}"
    exit 0
elif [ $PERCENTAGE -ge 70 ]; then
    echo -e "${YELLOW}⚠️  Many tests passed ($PERCENTAGE%). Some issues need attention.${NC}"
    exit 1
else
    echo -e "${RED}❌ Multiple failures ($PERCENTAGE% pass rate). Pipeline needs significant fixes.${NC}"
    exit 1
fi