#!/bin/bash
# Security monitoring script for Grahmos production deployment
# Usage: ./security-monitoring.sh <base_url>

set -euo pipefail

BASE_URL=${1:-"https://grahmos.com"}
RESULTS_DIR="./security-monitoring-results"
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)

echo "🔒 Running security monitoring for: $BASE_URL"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create results directory
mkdir -p "$RESULTS_DIR"

# Check if required tools are available
check_tool() {
    local tool=$1
    local install_cmd=$2
    
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Installing $tool...${NC}"
        eval "$install_cmd"
    fi
}

check_tool "nmap" "sudo apt-get update && sudo apt-get install -y nmap"
check_tool "sslscan" "sudo apt-get install -y sslscan"
check_tool "curl" "sudo apt-get install -y curl"

# Extract domain from URL
DOMAIN=$(echo "$BASE_URL" | sed 's|https\?://||' | sed 's|/.*||')

echo -e "${BLUE}📊 Security Assessment Report - $TIMESTAMP${NC}"
echo "======================================================"

# Test 1: SSL/TLS Configuration
echo -n "🔐 Testing SSL/TLS configuration... "
sslscan_output="$RESULTS_DIR/sslscan-$TIMESTAMP.txt"
if sslscan --no-colour "$DOMAIN:443" > "$sslscan_output" 2>&1; then
    if grep -q "SSL Certificate" "$sslscan_output" && ! grep -q "SSLv2\|SSLv3" "$sslscan_output"; then
        echo -e "${GREEN}✅ SECURE${NC}"
    else
        echo -e "${YELLOW}⚠️  WARNINGS${NC}"
    fi
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test 2: Security Headers
echo -n "🛡️  Testing security headers... "
headers_output="$RESULTS_DIR/headers-$TIMESTAMP.txt"
curl -k -s -I --max-time 30 "$BASE_URL/" > "$headers_output" 2>&1

security_score=0
required_headers=(
    "strict-transport-security"
    "x-frame-options"
    "x-content-type-options"
    "content-security-policy"
    "x-xss-protection"
    "referrer-policy"
)

for header in "${required_headers[@]}"; do
    if grep -qi "$header" "$headers_output"; then
        ((security_score++))
    fi
done

if [ $security_score -eq ${#required_headers[@]} ]; then
    echo -e "${GREEN}✅ EXCELLENT${NC} ($security_score/${#required_headers[@]})"
elif [ $security_score -gt 3 ]; then
    echo -e "${YELLOW}⚠️  GOOD${NC} ($security_score/${#required_headers[@]})"
else
    echo -e "${RED}❌ POOR${NC} ($security_score/${#required_headers[@]})"
fi

# Test 3: Port Scanning
echo -n "🔍 Scanning open ports... "
nmap_output="$RESULTS_DIR/nmap-$TIMESTAMP.txt"
if nmap -p 80,443,8080,8443,3000,5000 "$DOMAIN" > "$nmap_output" 2>&1; then
    open_ports=$(grep "open" "$nmap_output" | wc -l)
    if [ $open_ports -le 2 ]; then
        echo -e "${GREEN}✅ MINIMAL${NC} ($open_ports ports)"
    elif [ $open_ports -le 4 ]; then
        echo -e "${YELLOW}⚠️  MODERATE${NC} ($open_ports ports)"
    else
        echo -e "${RED}❌ EXCESSIVE${NC} ($open_ports ports)"
    fi
else
    echo -e "${YELLOW}⚠️  SKIPPED${NC} (scan failed)"
fi

# Test 4: Authentication Endpoints
echo -n "🔑 Testing authentication security... "
auth_tests=(
    "/admin:401"
    "/api/v1/admin:401"
    "/.env:404"
    "/config:404"
    "/wp-admin:404"
)

auth_score=0
for test in "${auth_tests[@]}"; do
    endpoint=$(echo "$test" | cut -d: -f1)
    expected_status=$(echo "$test" | cut -d: -f2)
    
    actual_status=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL$endpoint" 2>/dev/null || echo "000")
    
    if [ "$actual_status" = "$expected_status" ]; then
        ((auth_score++))
    fi
done

if [ $auth_score -eq ${#auth_tests[@]} ]; then
    echo -e "${GREEN}✅ SECURE${NC} ($auth_score/${#auth_tests[@]})"
elif [ $auth_score -gt 2 ]; then
    echo -e "${YELLOW}⚠️  MOSTLY SECURE${NC} ($auth_score/${#auth_tests[@]})"
else
    echo -e "${RED}❌ VULNERABLE${NC} ($auth_score/${#auth_tests[@]})"
fi

# Test 5: Rate Limiting
echo -n "⏱️  Testing rate limiting... "
rate_limit_test() {
    local status_codes=()
    for i in {1..20}; do
        status_codes+=($(curl -k -s -o /dev/null -w "%{http_code}" --max-time 5 "$BASE_URL/api/v1/search?q=test" 2>/dev/null || echo "000"))
    done
    
    # Check if we got any 429 (Too Many Requests) responses
    if printf '%s\n' "${status_codes[@]}" | grep -q "429"; then
        echo -e "${GREEN}✅ ACTIVE${NC}"
    else
        echo -e "${YELLOW}⚠️  NOT DETECTED${NC}"
    fi
}
rate_limit_test

# Test 6: Content Security
echo -n "📋 Testing content security... "
content_output="$RESULTS_DIR/content-$TIMESTAMP.txt"
curl -k -s --max-time 30 "$BASE_URL/" > "$content_output" 2>&1

content_issues=0
if grep -qi "password\|secret\|key\|token" "$content_output"; then
    ((content_issues++))
fi
if grep -qi "debug\|development\|test" "$content_output"; then
    ((content_issues++))
fi

if [ $content_issues -eq 0 ]; then
    echo -e "${GREEN}✅ CLEAN${NC}"
elif [ $content_issues -eq 1 ]; then
    echo -e "${YELLOW}⚠️  MINOR ISSUES${NC}"
else
    echo -e "${RED}❌ MAJOR ISSUES${NC}"
fi

# Test 7: API Security
echo -n "🔌 Testing API security... "
api_endpoints=(
    "/api/v1/health:200"
    "/api/v1/search:400"
    "/api/v1/admin:401"
    "/api/v1/config:401"
)

api_score=0
for test in "${api_endpoints[@]}"; do
    endpoint=$(echo "$test" | cut -d: -f1)
    expected_status=$(echo "$test" | cut -d: -f2)
    
    actual_status=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL$endpoint" 2>/dev/null || echo "000")
    
    if [ "$actual_status" = "$expected_status" ]; then
        ((api_score++))
    fi
done

if [ $api_score -eq ${#api_endpoints[@]} ]; then
    echo -e "${GREEN}✅ SECURE${NC} ($api_score/${#api_endpoints[@]})"
elif [ $api_score -gt 2 ]; then
    echo -e "${YELLOW}⚠️  MOSTLY SECURE${NC} ($api_score/${#api_endpoints[@]})"
else
    echo -e "${RED}❌ INSECURE${NC} ($api_score/${#api_endpoints[@]})"
fi

# Generate summary report
echo ""
echo -e "${BLUE}📊 Security Monitoring Summary${NC}"
echo "=============================="
echo "Timestamp: $TIMESTAMP"
echo "Target: $BASE_URL"
echo "Results stored in: $RESULTS_DIR"
echo ""

# Calculate overall security score
overall_score=$(( (security_score * 100 / ${#required_headers[@]}) + \
                  (auth_score * 100 / ${#auth_tests[@]}) + \
                  (api_score * 100 / ${#api_endpoints[@]}) ))
overall_score=$(( overall_score / 3 ))

if [ $overall_score -ge 90 ]; then
    echo -e "Overall Security Score: ${GREEN}$overall_score%${NC} - Excellent"
elif [ $overall_score -ge 70 ]; then
    echo -e "Overall Security Score: ${YELLOW}$overall_score%${NC} - Good"
else
    echo -e "Overall Security Score: ${RED}$overall_score%${NC} - Needs Improvement"
fi

echo ""
echo "🔒 Security monitoring completed."