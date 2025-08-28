#!/bin/bash
# Smoke tests for Grahmos deployment verification
# Usage: ./smoke-tests.sh <base_url>

set -euo pipefail

BASE_URL=${1:-"https://localhost:8443"}
TIMEOUT=30
RETRY_COUNT=3

echo "🔍 Running smoke tests against: $BASE_URL"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function with retry logic
test_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    local retry_count=0
    
    echo -n "Testing $description... "
    
    while [ $retry_count -lt $RETRY_COUNT ]; do
        if response=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL$endpoint" 2>/dev/null); then
            if [ "$response" = "$expected_status" ]; then
                echo -e "${GREEN}✅ PASS${NC} (HTTP $response)"
                return 0
            fi
        fi
        
        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $RETRY_COUNT ]; then
            echo -n "retrying... "
            sleep 2
        fi
    done
    
    echo -e "${RED}❌ FAIL${NC} (Expected: $expected_status, Got: ${response:-'timeout'})"
    return 1
}

# Test health endpoint
test_endpoint "/health" "200" "Health check"

# Test API readiness
test_endpoint "/api/v1/ready" "200" "API readiness"

# Test search functionality (should be accessible)
test_endpoint "/api/v1/search" "400" "Search endpoint (expects 400 for missing query)"

# Test static assets
test_endpoint "/" "200" "Root page"

# Test WebSocket endpoint availability (should return HTTP method not allowed)
test_endpoint "/ws" "405" "WebSocket endpoint"

# Test security headers
echo -n "Testing security headers... "
headers=$(curl -k -s -I --max-time $TIMEOUT "$BASE_URL/" 2>/dev/null || echo "")
if echo "$headers" | grep -qi "content-security-policy" && \
   echo "$headers" | grep -qi "x-frame-options" && \
   echo "$headers" | grep -qi "x-content-type-options"; then
    echo -e "${GREEN}✅ PASS${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Some security headers missing"
fi

# Test TLS configuration
echo -n "Testing TLS configuration... "
if openssl s_client -connect "${BASE_URL#https://}" -servername "${BASE_URL#https://}" </dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
    echo -e "${GREEN}✅ PASS${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - TLS verification issues (expected for self-signed certs)"
fi

# Performance check - response time
echo -n "Testing response time... "
start_time=$(date +%s%N)
curl -k -s --max-time $TIMEOUT "$BASE_URL/health" > /dev/null 2>&1
end_time=$(date +%s%N)
response_time=$(( (end_time - start_time) / 1000000 ))

if [ $response_time -lt 2000 ]; then
    echo -e "${GREEN}✅ PASS${NC} (${response_time}ms)"
elif [ $response_time -lt 5000 ]; then
    echo -e "${YELLOW}⚠️  SLOW${NC} (${response_time}ms)"
else
    echo -e "${RED}❌ FAIL${NC} (${response_time}ms - too slow)"
fi

echo ""
echo "🎉 Smoke tests completed for $BASE_URL"