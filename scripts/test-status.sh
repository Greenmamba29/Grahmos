#!/usr/bin/env bash

# Quick Test Status Check
# Verifies infrastructure is ready for testing

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Configuration
EDGE_API_URL="https://localhost:8443"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Status check functions
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"
    
    local all_good=true
    
    # Check curl
    if command -v curl >/dev/null 2>&1; then
        echo -e "  curl: ${GREEN}✅ Available${NC}"
    else
        echo -e "  curl: ${RED}❌ Missing${NC}"
        all_good=false
    fi
    
    # Check node
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version 2>/dev/null || echo "unknown")
        echo -e "  Node.js: ${GREEN}✅ Available${NC} ($node_version)"
    else
        echo -e "  Node.js: ${RED}❌ Missing${NC}"
        all_good=false
    fi
    
    # Check bc
    if command -v bc >/dev/null 2>&1; then
        echo -e "  bc (calculator): ${GREEN}✅ Available${NC}"
    else
        echo -e "  bc (calculator): ${RED}❌ Missing${NC}"
        all_good=false
    fi
    
    # Check docker
    if command -v docker >/dev/null 2>&1; then
        echo -e "  Docker: ${GREEN}✅ Available${NC}"
    else
        echo -e "  Docker: ${RED}❌ Missing${NC}"
        all_good=false
    fi
    
    # Check make
    if command -v make >/dev/null 2>&1; then
        echo -e "  Make: ${GREEN}✅ Available${NC}"
    else
        echo -e "  Make: ${RED}❌ Missing${NC}"
        all_good=false
    fi
    
    return $([[ "$all_good" == true ]] && echo 0 || echo 1)
}

check_infrastructure() {
    echo -e "\n${BLUE}Checking infrastructure status...${NC}"
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "  Docker daemon: ${RED}❌ Not running${NC}"
        return 1
    else
        echo -e "  Docker daemon: ${GREEN}✅ Running${NC}"
    fi
    
    # Check if containers are running
    local containers_running=true
    
    if docker ps --filter "name=grahmos" --filter "status=running" | grep -q grahmos; then
        echo -e "  Grahmos containers: ${GREEN}✅ Running${NC}"
        
        # List running containers
        echo "    Running containers:"
        docker ps --filter "name=grahmos" --format "    - {{.Names}} ({{.Status}})" 2>/dev/null || true
    else
        echo -e "  Grahmos containers: ${YELLOW}⚠️  Not running${NC}"
        containers_running=false
    fi
    
    # Check API accessibility
    echo -e "\n  Testing API accessibility..."
    local api_response
    api_response=$(curl -k -s --max-time 5 "$EDGE_API_URL/health" 2>/dev/null || echo "ERROR")
    
    if [[ "$api_response" == "ERROR" ]]; then
        echo -e "    Edge API ($EDGE_API_URL): ${RED}❌ Not accessible${NC}"
        
        if [[ "$containers_running" == false ]]; then
            echo -e "    ${YELLOW}💡 Try running: make up${NC}"
        fi
        return 1
    else
        echo -e "    Edge API ($EDGE_API_URL): ${GREEN}✅ Accessible${NC}"
        if [[ "$api_response" == *"healthy"* ]]; then
            echo -e "    Health status: ${GREEN}✅ Healthy${NC}"
        else
            echo -e "    Health status: ${YELLOW}⚠️  Response: $api_response${NC}"
        fi
    fi
    
    return 0
}

check_test_scripts() {
    echo -e "\n${BLUE}Checking test scripts...${NC}"
    
    local scripts_dir="$SCRIPT_DIR"
    local all_scripts_ok=true
    
    # Check individual test scripts
    for script in "test-security.sh" "test-performance.sh" "test-functional.sh" "test-all.sh"; do
        if [[ -x "$scripts_dir/$script" ]]; then
            echo -e "  $script: ${GREEN}✅ Executable${NC}"
        elif [[ -f "$scripts_dir/$script" ]]; then
            echo -e "  $script: ${YELLOW}⚠️  Not executable${NC}"
            echo -e "    ${YELLOW}💡 Run: chmod +x scripts/$script${NC}"
            all_scripts_ok=false
        else
            echo -e "  $script: ${RED}❌ Missing${NC}"
            all_scripts_ok=false
        fi
    done
    
    # Check test results directory
    if [[ -d "./test-results" ]]; then
        echo -e "  test-results directory: ${GREEN}✅ Exists${NC}"
        
        # Count existing test results
        local result_count
        result_count=$(find ./test-results -name "*.log" -o -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
        
        if [[ "$result_count" -gt 0 ]]; then
            echo -e "    Previous test results: ${YELLOW}$result_count files${NC}"
        fi
    else
        echo -e "  test-results directory: ${YELLOW}⚠️  Will be created${NC}"
    fi
    
    return $([[ "$all_scripts_ok" == true ]] && echo 0 || echo 1)
}

check_certificates() {
    echo -e "\n${BLUE}Checking certificates...${NC}"
    
    local certs_ok=true
    
    # Check server certificates
    if [[ -f "infra/certs/server.crt" ]] && [[ -f "infra/certs/server.key" ]]; then
        echo -e "  Server certificates: ${GREEN}✅ Present${NC}"
        
        # Check certificate expiry if openssl is available
        if command -v openssl >/dev/null 2>&1; then
            local cert_expiry
            cert_expiry=$(openssl x509 -in infra/certs/server.crt -noout -enddate 2>/dev/null | cut -d= -f2 || echo "unknown")
            echo -e "    Expiry: $cert_expiry"
        fi
    else
        echo -e "  Server certificates: ${RED}❌ Missing${NC}"
        echo -e "    ${YELLOW}💡 These will be generated automatically${NC}"
        certs_ok=false
    fi
    
    # Check client certificates (optional)
    if [[ -f "infra/certs/client.crt" ]] && [[ -f "infra/certs/client.key" ]]; then
        echo -e "  Client certificates: ${GREEN}✅ Present${NC}"
    else
        echo -e "  Client certificates: ${YELLOW}⚠️  Optional (mTLS testing limited)${NC}"
    fi
    
    return $([[ "$certs_ok" == true ]] && echo 0 || echo 1)
}

display_summary() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    STATUS SUMMARY                          ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Overall readiness assessment
    local prereqs_ok=false
    local infra_ok=false
    local scripts_ok=false
    local certs_ok=false
    
    check_prerequisites >/dev/null 2>&1 && prereqs_ok=true
    check_infrastructure >/dev/null 2>&1 && infra_ok=true
    check_test_scripts >/dev/null 2>&1 && scripts_ok=true
    check_certificates >/dev/null 2>&1 && certs_ok=true
    
    echo "Component Readiness:"
    echo -e "  Prerequisites:     $(if [[ "$prereqs_ok" == true ]]; then echo "${GREEN}✅ Ready${NC}"; else echo "${RED}❌ Issues${NC}"; fi)"
    echo -e "  Infrastructure:    $(if [[ "$infra_ok" == true ]]; then echo "${GREEN}✅ Ready${NC}"; else echo "${RED}❌ Issues${NC}"; fi)"
    echo -e "  Test Scripts:      $(if [[ "$scripts_ok" == true ]]; then echo "${GREEN}✅ Ready${NC}"; else echo "${YELLOW}⚠️  Minor Issues${NC}"; fi)"
    echo -e "  Certificates:      $(if [[ "$certs_ok" == true ]]; then echo "${GREEN}✅ Ready${NC}"; else echo "${YELLOW}⚠️  Auto-generated${NC}"; fi)"
    echo ""
    
    # Overall assessment
    if [[ "$prereqs_ok" == true ]] && [[ "$infra_ok" == true ]]; then
        echo -e "${GREEN}🎉 READY: System is ready for comprehensive testing${NC}"
        echo ""
        echo "Available test commands:"
        echo -e "  ${CYAN}./scripts/test-security.sh${NC}     - Security testing only"
        echo -e "  ${CYAN}./scripts/test-performance.sh${NC}  - Performance testing only"
        echo -e "  ${CYAN}./scripts/test-functional.sh${NC}   - Functional testing only"
        echo -e "  ${CYAN}./scripts/test-all.sh${NC}          - Full comprehensive test suite"
        echo ""
        return 0
    elif [[ "$prereqs_ok" == true ]]; then
        echo -e "${YELLOW}⚠️  PARTIAL: Prerequisites met, but infrastructure needs attention${NC}"
        echo ""
        echo "To start infrastructure:"
        echo -e "  ${CYAN}make up${NC}"
        echo ""
        return 1
    else
        echo -e "${RED}❌ NOT READY: Prerequisites missing${NC}"
        echo ""
        echo "Install missing dependencies and try again."
        echo ""
        return 2
    fi
}

main() {
    echo -e "${CYAN}🔍 Grahmos V1+V2 Unified - Test Readiness Check${NC}"
    echo -e "${CYAN}================================================${NC}"
    echo ""
    
    # Run all checks
    check_prerequisites
    check_infrastructure
    check_test_scripts
    check_certificates
    
    # Display summary and return appropriate code
    display_summary
}

# Run main function
main "$@"
