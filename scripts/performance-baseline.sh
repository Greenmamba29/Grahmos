#!/bin/bash
# Performance baseline tests for Grahmos
# Usage: ./performance-baseline.sh <base_url>

set -euo pipefail

BASE_URL=${1:-"https://localhost:8443"}
RESULTS_FILE="performance-results.json"
CONCURRENT_USERS=10
TEST_DURATION=30
REQUESTS_PER_USER=100

echo "🚀 Running performance baseline tests against: $BASE_URL"

# Check if required tools are available
command -v ab >/dev/null 2>&1 || { echo "Apache Bench (ab) is required but not installed. Installing..."; sudo apt-get update && sudo apt-get install -y apache2-utils; }
command -v curl >/dev/null 2>&1 || { echo "curl is required but not installed. Aborting."; exit 1; }

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Initialize results
cat > "$RESULTS_FILE" << 'EOF'
{
  "timestamp": "",
  "baseUrl": "",
  "tests": []
}
EOF

# Update timestamp and base URL
jq --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   --arg baseUrl "$BASE_URL" \
   '.timestamp = $timestamp | .baseUrl = $baseUrl' \
   "$RESULTS_FILE" > tmp.json && mv tmp.json "$RESULTS_FILE"

# Function to run performance test
run_performance_test() {
    local endpoint=$1
    local test_name=$2
    local description=$3
    
    echo -n "Testing $description... "
    
    # Run Apache Bench test
    ab_output=$(ab -n $REQUESTS_PER_USER -c $CONCURRENT_USERS -k -s 30 "$BASE_URL$endpoint" 2>/dev/null || echo "FAILED")
    
    if [ "$ab_output" = "FAILED" ]; then
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
    
    # Parse results
    requests_per_sec=$(echo "$ab_output" | grep "Requests per second" | awk '{print $4}')
    time_per_request=$(echo "$ab_output" | grep "Time per request" | head -1 | awk '{print $4}')
    transfer_rate=$(echo "$ab_output" | grep "Transfer rate" | awk '{print $3}')
    
    # Get percentiles
    p50=$(echo "$ab_output" | grep "50%" | awk '{print $2}')
    p95=$(echo "$ab_output" | grep "95%" | awk '{print $2}')
    p99=$(echo "$ab_output" | grep "99%" | awk '{print $2}')
    
    # Add to results
    jq --arg name "$test_name" \
       --arg description "$description" \
       --arg rps "$requests_per_sec" \
       --arg time_per_req "$time_per_request" \
       --arg transfer_rate "$transfer_rate" \
       --arg p50 "$p50" \
       --arg p95 "$p95" \
       --arg p99 "$p99" \
       '.tests += [{
           "name": $name,
           "description": $description,
           "requestsPerSecond": ($rps | tonumber),
           "timePerRequest": ($time_per_req | tonumber),
           "transferRate": ($transfer_rate | tonumber),
           "percentiles": {
               "p50": ($p50 | tonumber),
               "p95": ($p95 | tonumber),
               "p99": ($p99 | tonumber)
           }
       }]' "$RESULTS_FILE" > tmp.json && mv tmp.json "$RESULTS_FILE"
    
    # Determine status based on performance
    if (( $(echo "$requests_per_sec > 50" | bc -l) )); then
        echo -e "${GREEN}✅ PASS${NC} (${requests_per_sec} req/s)"
    elif (( $(echo "$requests_per_sec > 20" | bc -l) )); then
        echo -e "${YELLOW}⚠️  SLOW${NC} (${requests_per_sec} req/s)"
    else
        echo -e "${RED}❌ FAIL${NC} (${requests_per_sec} req/s)"
    fi
}

# Wait for service to be ready
echo "Waiting for service to be ready..."
timeout 60s bash -c "until curl -k -s $BASE_URL/health > /dev/null 2>&1; do sleep 2; done" || {
    echo -e "${RED}❌ Service not ready after 60 seconds${NC}"
    exit 1
}

# Run performance tests
run_performance_test "/health" "health_check" "Health endpoint performance"
run_performance_test "/" "root_page" "Root page performance"
run_performance_test "/api/v1/ready" "api_ready" "API readiness performance"

# Memory usage test
echo -n "Testing memory usage... "
memory_info=$(curl -k -s "$BASE_URL/api/v1/stats" 2>/dev/null || echo '{"memory": {"rss": 0}}')
memory_rss=$(echo "$memory_info" | jq -r '.memory.rss // 0')

if [ "$memory_rss" -gt 0 ] && [ "$memory_rss" -lt 536870912 ]; then  # < 512MB
    echo -e "${GREEN}✅ PASS${NC} (${memory_rss} bytes)"
else
    echo -e "${YELLOW}⚠️  HIGH${NC} (${memory_rss} bytes)"
fi

# CPU usage simulation
echo -n "Testing CPU under load... "
start_time=$(date +%s)
for i in {1..5}; do
    curl -k -s "$BASE_URL/api/v1/search?q=test" > /dev/null 2>&1 &
done
wait
end_time=$(date +%s)
cpu_test_duration=$((end_time - start_time))

if [ $cpu_test_duration -lt 10 ]; then
    echo -e "${GREEN}✅ PASS${NC} (${cpu_test_duration}s)"
else
    echo -e "${YELLOW}⚠️  SLOW${NC} (${cpu_test_duration}s)"
fi

echo ""
echo "📊 Performance baseline completed. Results saved to $RESULTS_FILE"
echo "Summary:"
jq -r '.tests[] | "  \(.name): \(.requestsPerSecond) req/s (p95: \(.percentiles.p95)ms)"' "$RESULTS_FILE"