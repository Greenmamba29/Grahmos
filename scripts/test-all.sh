#!/usr/bin/env bash

# Phase 2: Measure - Master Test Runner
# Orchestrates Security, Performance, and Functional testing suites

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Configuration
TEST_RESULTS_DIR="./test-results"
MASTER_LOG="$TEST_RESULTS_DIR/master-test-$(date +%Y%m%d-%H%M%S).log"
REPORT_FILE="$TEST_RESULTS_DIR/comprehensive-test-report-$(date +%Y%m%d-%H%M%S).md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test suite results
SECURITY_RESULT=""
PERFORMANCE_RESULT=""
FUNCTIONAL_RESULT=""
SECURITY_EXIT_CODE=0
PERFORMANCE_EXIT_CODE=0
FUNCTIONAL_EXIT_CODE=0

# Setup
setup_master_test() {
    echo -e "${CYAN}🚀 Phase 2: Measure - Master Test Runner${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo "Running comprehensive V1+V2 unified test suite"
    echo "Security, Performance, and Functional testing"
    echo ""
    echo "Master Log: $MASTER_LOG"
    echo "Report: $REPORT_FILE"
    echo ""
    
    # Create test results directory
    mkdir -p "$TEST_RESULTS_DIR"
    
    # Initialize master log
    {
        echo "Master Test Suite - $(date)"
        echo "V1+V2 Unified Implementation Testing"
        echo "===================================="
        echo ""
        echo "Test Suites:"
        echo "- Security Testing (mTLS, DPoP, JWT PoP, Container Security)"
        echo "- Performance Testing (Load, Concurrency, Response Time)"
        echo "- Functional Testing (API Endpoints, Error Handling, Workflows)"
        echo ""
    } > "$MASTER_LOG"
}

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"
    
    local missing_deps=()
    
    # Check for required commands
    if ! command -v curl >/dev/null 2>&1; then
        missing_deps+=("curl")
    fi
    
    if ! command -v node >/dev/null 2>&1; then
        missing_deps+=("node (Node.js)")
    fi
    
    if ! command -v bc >/dev/null 2>&1; then
        missing_deps+=("bc (calculator)")
    fi
    
    if ! command -v docker >/dev/null 2>&1; then
        missing_deps+=("docker")
    fi
    
    if ! command -v make >/dev/null 2>&1; then
        missing_deps+=("make")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        echo -e "${RED}❌ Missing dependencies:${NC}"
        for dep in "${missing_deps[@]}"; do
            echo "  - $dep"
        done
        echo ""
        echo "Please install the missing dependencies before running tests."
        return 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites satisfied${NC}"
    return 0
}

# Run security test suite
run_security_tests() {
    echo ""
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}              SECURITY TESTING SUITE                        ${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    {
        echo "SECURITY TEST SUITE"
        echo "Started: $(date)"
        echo "==================="
    } >> "$MASTER_LOG"
    
    if "$SCRIPT_DIR/test-security.sh"; then
        SECURITY_RESULT="PASSED"
        SECURITY_EXIT_CODE=0
        echo -e "${GREEN}🔒 Security tests completed successfully${NC}"
    else
        SECURITY_RESULT="FAILED"
        SECURITY_EXIT_CODE=$?
        echo -e "${RED}🔒 Security tests failed${NC}"
    fi
    
    {
        echo "Security Test Result: $SECURITY_RESULT"
        echo "Exit Code: $SECURITY_EXIT_CODE"
        echo "Completed: $(date)"
        echo ""
    } >> "$MASTER_LOG"
}

# Run performance test suite
run_performance_tests() {
    echo ""
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}             PERFORMANCE TESTING SUITE                      ${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    {
        echo "PERFORMANCE TEST SUITE"
        echo "Started: $(date)"
        echo "======================"
    } >> "$MASTER_LOG"
    
    if "$SCRIPT_DIR/test-performance.sh"; then
        PERFORMANCE_RESULT="PASSED"
        PERFORMANCE_EXIT_CODE=0
        echo -e "${GREEN}⚡ Performance tests completed successfully${NC}"
    else
        PERFORMANCE_RESULT="FAILED"
        PERFORMANCE_EXIT_CODE=$?
        echo -e "${RED}⚡ Performance tests failed${NC}"
    fi
    
    {
        echo "Performance Test Result: $PERFORMANCE_RESULT"
        echo "Exit Code: $PERFORMANCE_EXIT_CODE"
        echo "Completed: $(date)"
        echo ""
    } >> "$MASTER_LOG"
}

# Run functional test suite
run_functional_tests() {
    echo ""
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}             FUNCTIONAL TESTING SUITE                       ${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    {
        echo "FUNCTIONAL TEST SUITE"
        echo "Started: $(date)"
        echo "===================="
    } >> "$MASTER_LOG"
    
    if "$SCRIPT_DIR/test-functional.sh"; then
        FUNCTIONAL_RESULT="PASSED"
        FUNCTIONAL_EXIT_CODE=0
        echo -e "${GREEN}🧪 Functional tests completed successfully${NC}"
    else
        FUNCTIONAL_RESULT="FAILED"
        FUNCTIONAL_EXIT_CODE=$?
        echo -e "${RED}🧪 Functional tests failed${NC}"
    fi
    
    {
        echo "Functional Test Result: $FUNCTIONAL_RESULT"
        echo "Exit Code: $FUNCTIONAL_EXIT_CODE"
        echo "Completed: $(date)"
        echo ""
    } >> "$MASTER_LOG"
}

# Generate comprehensive test report
generate_comprehensive_report() {
    echo ""
    echo -e "${CYAN}Generating comprehensive test report...${NC}"
    
    # Calculate overall results
    local total_suites=3
    local passed_suites=0
    
    if [[ "$SECURITY_RESULT" == "PASSED" ]]; then
        passed_suites=$((passed_suites + 1))
    fi
    
    if [[ "$PERFORMANCE_RESULT" == "PASSED" ]]; then
        passed_suites=$((passed_suites + 1))
    fi
    
    if [[ "$FUNCTIONAL_RESULT" == "PASSED" ]]; then
        passed_suites=$((passed_suites + 1))
    fi
    
    local pass_rate=$((passed_suites * 100 / total_suites))
    
    # Generate markdown report
    cat > "$REPORT_FILE" << EOF
# Grahmos V1+V2 Unified - Comprehensive Test Report

**Generated:** $(date)  
**Test Environment:** V1+V2 Unified Implementation  
**Phase:** 2 - Measure  

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall Pass Rate** | **${pass_rate}%** |
| **Total Test Suites** | ${total_suites} |
| **Passed Suites** | ${passed_suites} |
| **Failed Suites** | $((total_suites - passed_suites)) |

## Test Suite Results

### 🔒 Security Testing Suite
- **Status:** ${SECURITY_RESULT}
- **Exit Code:** ${SECURITY_EXIT_CODE}
- **Focus Areas:**
  - mTLS Client Authentication
  - DPoP (Demonstration of Proof-of-Possession)
  - JWT PoP Token Validation
  - Container Security Configuration
  - Network Security & Isolation
  - Input Validation & Sanitization
  - Security Headers Implementation
  - Environment Security

### ⚡ Performance Testing Suite
- **Status:** ${PERFORMANCE_RESULT}
- **Exit Code:** ${PERFORMANCE_EXIT_CODE}
- **Focus Areas:**
  - Response Time Analysis
  - Concurrent Load Testing
  - Authentication Performance
  - Search Backend Performance
  - TLS/SSL Handshake Performance
  - Resource Usage Monitoring
  - Database Performance Testing

### 🧪 Functional Testing Suite
- **Status:** ${FUNCTIONAL_RESULT}
- **Exit Code:** ${FUNCTIONAL_EXIT_CODE}
- **Focus Areas:**
  - API Endpoint Functionality
  - Authentication Flow Testing
  - Search Backend Integration
  - Assistant API Integration
  - TTS API Integration
  - Error Handling Validation
  - CORS & Security Headers
  - Data Validation & Sanitization

## Architecture Overview

The V1+V2 unified implementation combines:

- **V1 Features:** mTLS authentication, basic search capabilities
- **V2 Enhancements:** DPoP authentication, advanced AI assistant, TTS support
- **Unified Edge API:** Single endpoint with backend swapping capabilities
- **Multi-Backend Search:** SQLite FTS and Meilisearch support
- **Advanced Security:** Multi-layer authentication with PoP binding

## Test Environment Details

- **Edge API URL:** https://localhost:8443
- **Test Duration:** Variable (60s for performance tests)
- **Concurrent Users:** 10 (performance testing)
- **Authentication Methods:** mTLS + DPoP
- **Search Backends:** SQLite, Meilisearch
- **Container Runtime:** Docker with security constraints

## Security Assessment

$(if [[ "$SECURITY_RESULT" == "PASSED" ]]; then
echo "✅ **Security posture is strong** with proper implementation of:"
echo "- Multi-layer authentication (mTLS + DPoP)"
echo "- Proper JWT PoP token validation"  
echo "- Secure container configuration"
echo "- Input validation and sanitization"
echo "- Appropriate security headers"
else
echo "⚠️ **Security concerns detected** - review detailed logs for:"
echo "- Authentication mechanism issues"
echo "- Container security misconfigurations"
echo "- Missing security headers"
echo "- Input validation gaps"
fi)

## Performance Assessment

$(if [[ "$PERFORMANCE_RESULT" == "PASSED" ]]; then
echo "✅ **Performance is acceptable** with:"
echo "- Responsive API endpoints"
echo "- Adequate concurrent user handling"
echo "- Efficient authentication processing"
echo "- Reasonable TLS handshake times"
else
echo "⚠️ **Performance issues identified** - review detailed logs for:"
echo "- Slow response times"
echo "- Concurrent load handling problems"
echo "- Authentication performance bottlenecks"
echo "- Resource utilization concerns"
fi)

## Functional Assessment

$(if [[ "$FUNCTIONAL_RESULT" == "PASSED" ]]; then
echo "✅ **Functional requirements met** with:"
echo "- All API endpoints operational"
echo "- Proper authentication flows"
echo "- Backend integration working"
echo "- Error handling implemented correctly"
else
echo "⚠️ **Functional issues found** - review detailed logs for:"
echo "- API endpoint failures"
echo "- Authentication flow problems"
echo "- Backend integration issues"
echo "- Inadequate error handling"
fi)

## Recommendations

### Immediate Actions Required
$(if [[ $pass_rate -lt 100 ]]; then
echo "1. **Address Failed Test Suites:** Review detailed logs for specific failures"
echo "2. **Fix Critical Issues:** Prioritize security and functional problems"
echo "3. **Performance Optimization:** Address any performance bottlenecks"
else
echo "1. **Maintain Current Standards:** Continue monitoring and testing"
echo "2. **Performance Monitoring:** Set up ongoing performance tracking"
echo "3. **Security Updates:** Keep security measures current"
fi)

### Next Phase Preparation
1. **Deploy Phase Ready:** $(if [[ $pass_rate -ge 80 ]]; then echo "✅ System ready for deployment"; else echo "❌ Address issues before deployment"; fi)
2. **Production Hardening:** Implement additional production security measures
3. **Monitoring Setup:** Configure comprehensive monitoring and alerting
4. **Documentation Update:** Ensure all changes are properly documented

## Detailed Log Files

- **Master Log:** \`$(basename "$MASTER_LOG")\`
- **Security Test Log:** \`test-results/security-test-*.log\`
- **Performance Test Log:** \`test-results/performance-test-*.log\`
- **Functional Test Log:** \`test-results/functional-test-*.log\`

## Test Execution Summary

**Total Execution Time:** Started at test initiation  
**Infrastructure Status:** $(if curl -k -s --max-time 5 "https://localhost:8443/health" >/dev/null 2>&1; then echo "✅ Running"; else echo "❌ Not accessible"; fi)  
**Test Coverage:** Comprehensive across Security, Performance, and Functional domains

---

*This report was generated automatically by the Grahmos V1+V2 Unified Test Suite*  
*For detailed analysis, refer to individual test suite logs*
EOF

    echo -e "${GREEN}📄 Comprehensive report generated: $(basename "$REPORT_FILE")${NC}"
}

# Display final summary
display_final_summary() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    FINAL TEST SUMMARY                      ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Test results table
    printf "%-20s | %-10s | %-10s\n" "Test Suite" "Result" "Exit Code"
    printf "%-20s-+-%-10s-+-%-10s\n" "--------------------" "----------" "----------"
    
    # Security results
    if [[ "$SECURITY_RESULT" == "PASSED" ]]; then
        printf "%-20s | ${GREEN}%-10s${NC} | %-10s\n" "Security" "$SECURITY_RESULT" "$SECURITY_EXIT_CODE"
    else
        printf "%-20s | ${RED}%-10s${NC} | %-10s\n" "Security" "$SECURITY_RESULT" "$SECURITY_EXIT_CODE"
    fi
    
    # Performance results
    if [[ "$PERFORMANCE_RESULT" == "PASSED" ]]; then
        printf "%-20s | ${GREEN}%-10s${NC} | %-10s\n" "Performance" "$PERFORMANCE_RESULT" "$PERFORMANCE_EXIT_CODE"
    else
        printf "%-20s | ${RED}%-10s${NC} | %-10s\n" "Performance" "$PERFORMANCE_RESULT" "$PERFORMANCE_EXIT_CODE"
    fi
    
    # Functional results
    if [[ "$FUNCTIONAL_RESULT" == "PASSED" ]]; then
        printf "%-20s | ${GREEN}%-10s${NC} | %-10s\n" "Functional" "$FUNCTIONAL_RESULT" "$FUNCTIONAL_EXIT_CODE"
    else
        printf "%-20s | ${RED}%-10s${NC} | %-10s\n" "Functional" "$FUNCTIONAL_RESULT" "$FUNCTIONAL_EXIT_CODE"
    fi
    
    echo ""
    
    # Overall assessment
    local total_suites=3
    local passed_suites=0
    
    if [[ "$SECURITY_RESULT" == "PASSED" ]]; then passed_suites=$((passed_suites + 1)); fi
    if [[ "$PERFORMANCE_RESULT" == "PASSED" ]]; then passed_suites=$((passed_suites + 1)); fi
    if [[ "$FUNCTIONAL_RESULT" == "PASSED" ]]; then passed_suites=$((passed_suites + 1)); fi
    
    local pass_rate=$((passed_suites * 100 / total_suites))
    
    echo "Overall Results:"
    echo "  Total Suites: $total_suites"
    echo "  Passed: $passed_suites"
    echo "  Failed: $((total_suites - passed_suites))"
    echo "  Pass Rate: ${pass_rate}%"
    echo ""
    
    # Final recommendation
    if [[ $pass_rate -eq 100 ]]; then
        echo -e "${GREEN}🎉 EXCELLENT: All test suites passed! System is ready for deployment.${NC}"
    elif [[ $pass_rate -ge 80 ]]; then
        echo -e "${YELLOW}✅ GOOD: Most tests passed. Review failed tests before deployment.${NC}"
    elif [[ $pass_rate -ge 60 ]]; then
        echo -e "${YELLOW}⚠️  CAUTION: Several issues detected. Address failures before proceeding.${NC}"
    else
        echo -e "${RED}❌ CRITICAL: Major issues detected. System not ready for deployment.${NC}"
    fi
    
    echo ""
    echo "Detailed reports available at:"
    echo "  Master Log: $MASTER_LOG"
    echo "  Comprehensive Report: $REPORT_FILE"
    echo ""
    
    {
        echo "FINAL SUMMARY"
        echo "============="
        echo "Security: $SECURITY_RESULT (Exit: $SECURITY_EXIT_CODE)"
        echo "Performance: $PERFORMANCE_RESULT (Exit: $PERFORMANCE_EXIT_CODE)"
        echo "Functional: $FUNCTIONAL_RESULT (Exit: $FUNCTIONAL_EXIT_CODE)"
        echo "Pass Rate: ${pass_rate}%"
        echo "Completed: $(date)"
    } >> "$MASTER_LOG"
}

# Main execution
main() {
    local start_time
    start_time=$(date +%s)
    
    setup_master_test
    
    # Check prerequisites
    if ! check_prerequisites; then
        echo -e "${RED}❌ Prerequisites not met. Aborting test execution.${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Starting comprehensive test suite execution...${NC}"
    echo "This may take several minutes to complete."
    echo ""
    
    # Run test suites
    run_security_tests
    run_performance_tests
    run_functional_tests
    
    # Generate reports
    generate_comprehensive_report
    
    # Display final summary
    display_final_summary
    
    # Calculate total execution time
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    echo "Total execution time: ${minutes}m ${seconds}s"
    
    # Return appropriate exit code
    if [[ "$SECURITY_RESULT" == "PASSED" ]] && \
       [[ "$PERFORMANCE_RESULT" == "PASSED" ]] && \
       [[ "$FUNCTIONAL_RESULT" == "PASSED" ]]; then
        exit 0
    else
        exit 1
    fi
}

# Handle script termination
trap 'echo -e "\n${YELLOW}Master test execution interrupted${NC}"; exit 130' INT

# Run main function
main "$@"
