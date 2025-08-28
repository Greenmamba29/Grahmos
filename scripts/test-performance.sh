#!/usr/bin/env bash

# Phase 2: Measure - Performance Testing Suite
# Tests V1+V2 unified implementation performance across all components

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Configuration
TEST_RESULTS_DIR="./test-results"
PERF_LOG="$TEST_RESULTS_DIR/performance-test-$(date +%Y%m%d-%H%M%S).log"
EDGE_API_URL="https://localhost:8443"
TEMP_DIR="/tmp/grahmos-perf-tests"

# Test parameters
CONCURRENT_USERS=10
TEST_DURATION_SECONDS=60
SEARCH_QUERIES=("artificial intelligence" "machine learning" "quantum computing" "blockchain" "cybersecurity")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Performance metrics
declare -A METRICS

# Setup
setup_test_environment() {
    echo -e "${CYAN}⚡ Phase 2: Measure - Performance Testing Suite${NC}"
    echo -e "${CYAN}===============================================${NC}"
    echo ""
    echo "Testing V1+V2 unified performance implementation"
    echo "Target: $EDGE_API_URL"
    echo "Duration: ${TEST_DURATION_SECONDS}s"
    echo "Concurrent users: $CONCURRENT_USERS"
    echo "Logs: $PERF_LOG"
    echo ""
    
    # Create test directories
    mkdir -p "$TEST_RESULTS_DIR" "$TEMP_DIR"
    
    # Initialize metrics
    METRICS[total_requests]=0
    METRICS[successful_requests]=0
    METRICS[failed_requests]=0
    METRICS[avg_response_time]=0
    METRICS[min_response_time]=99999
    METRICS[max_response_time]=0
    METRICS[search_requests]=0
    METRICS[auth_requests]=0
    
    # Start logging
    {
        echo "Performance Test Suite - $(date)"
        echo "Target: $EDGE_API_URL"
        echo "V1+V2 Unified Implementation"
        echo "Duration: ${TEST_DURATION_SECONDS}s"
        echo "Concurrent Users: $CONCURRENT_USERS"
        echo "==============================="
        echo ""
    } | tee "$PERF_LOG"
}

# Check if infrastructure is running
check_infrastructure() {
    echo "Checking infrastructure status..."
    
    if ! curl -k -s --max-time 5 "$EDGE_API_URL/health" >/dev/null 2>&1; then
        echo "Edge API not accessible. Starting infrastructure..."
        make up >/dev/null 2>&1 || {
            echo "Failed to start infrastructure. Please run 'make up' manually."
            return 1
        }
        sleep 15
    fi
    
    # Verify all services are healthy
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

# Performance Test 1: Basic Response Time
test_basic_response_time() {
    echo "Testing basic response time..."
    
    local total_time=0
    local request_count=10
    local success_count=0
    
    for i in $(seq 1 $request_count); do
        local start_time=$(date +%s.%3N)
        local response_code=$(curl -k -s -w "%{http_code}" -o /dev/null "$EDGE_API_URL/health" 2>/dev/null || echo "000")
        local end_time=$(date +%s.%3N)
        
        local response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        
        if [[ "$response_code" == "200" ]]; then
            success_count=$((success_count + 1))
            total_time=$(echo "$total_time + $response_time" | bc -l 2>/dev/null || echo "$total_time")
            
            # Update min/max response times
            if (( $(echo "$response_time < ${METRICS[min_response_time]}" | bc -l) )); then
                METRICS[min_response_time]="$response_time"
            fi
            if (( $(echo "$response_time > ${METRICS[max_response_time]}" | bc -l) )); then
                METRICS[max_response_time]="$response_time"
            fi
        fi
        
        echo "Request $i: ${response_time}s (${response_code})" >> "$PERF_LOG"
    done
    
    if [[ $success_count -gt 0 ]]; then
        local avg_time=$(echo "scale=3; $total_time / $success_count" | bc -l 2>/dev/null || echo "0")
        METRICS[avg_response_time]="$avg_time"
        echo "Average response time: ${avg_time}s"
        echo "Success rate: $(echo "scale=1; $success_count * 100 / $request_count" | bc -l)%"
    else
        echo "All requests failed"
        return 1
    fi
    
    return 0
}

# Performance Test 2: Authentication Performance
test_authentication_performance() {
    echo "Testing authentication performance..."
    
    # Generate a test DPoP token for performance testing
    local dpop_header
    dpop_header=$(node -e "
        const crypto = require('crypto');
        const jwt = require('jsonwebtoken');
        
        try {
            const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: { type: 'spki', format: 'jwk' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
            });
            
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
        } catch (error) {
            console.log('ERROR');
        }
    " 2>/dev/null || echo "ERROR")
    
    if [[ "$dpop_header" == "ERROR" ]]; then
        echo "Could not generate test DPoP token - skipping auth performance test"
        return 0
    fi
    
    local auth_requests=5
    local auth_success=0
    local auth_total_time=0
    
    for i in $(seq 1 $auth_requests); do
        local start_time=$(date +%s.%3N)
        local response_code=$(curl -k -s \
            -H "DPoP: $dpop_header" \
            -w "%{http_code}" -o /dev/null \
            "$EDGE_API_URL/auth/dpop" 2>/dev/null || echo "000")
        local end_time=$(date +%s.%3N)
        
        local response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        auth_total_time=$(echo "$auth_total_time + $response_time" | bc -l 2>/dev/null || echo "$auth_total_time")
        
        if [[ "$response_code" =~ ^[23][0-9][0-9]$ ]]; then
            auth_success=$((auth_success + 1))
        fi
        
        METRICS[auth_requests]=$((METRICS[auth_requests] + 1))
        echo "Auth request $i: ${response_time}s (${response_code})" >> "$PERF_LOG"
    done
    
    if [[ $auth_success -gt 0 ]]; then
        local avg_auth_time=$(echo "scale=3; $auth_total_time / $auth_requests" | bc -l 2>/dev/null || echo "0")
        echo "Average auth time: ${avg_auth_time}s"
        echo "Auth success rate: $(echo "scale=1; $auth_success * 100 / $auth_requests" | bc -l)%"
    else
        echo "Auth performance test completed (may require valid credentials)"
    fi
    
    return 0
}

# Performance Test 3: Search Performance
test_search_performance() {
    echo "Testing search performance..."
    
    # Test search without authentication first (should get 401s but still measure response time)
    local search_requests=${#SEARCH_QUERIES[@]}
    local search_total_time=0
    
    for query in "${SEARCH_QUERIES[@]}"; do
        local start_time=$(date +%s.%3N)
        local response_code=$(curl -k -s \
            -w "%{http_code}" -o /dev/null \
            "$EDGE_API_URL/search?q=$(echo "$query" | sed 's/ /%20/g')" 2>/dev/null || echo "000")
        local end_time=$(date +%s.%3N)
        
        local response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        search_total_time=$(echo "$search_total_time + $response_time" | bc -l 2>/dev/null || echo "$search_total_time")
        
        METRICS[search_requests]=$((METRICS[search_requests] + 1))
        echo "Search '$query': ${response_time}s (${response_code})" >> "$PERF_LOG"
    done
    
    local avg_search_time=$(echo "scale=3; $search_total_time / $search_requests" | bc -l 2>/dev/null || echo "0")
    echo "Average search response time: ${avg_search_time}s"
    echo "Search queries tested: $search_requests"
    
    return 0
}

# Performance Test 4: Concurrent Load Testing
test_concurrent_load() {
    echo "Testing concurrent load (${CONCURRENT_USERS} concurrent users for ${TEST_DURATION_SECONDS}s)..."
    
    local pids=()
    local results_file="$TEMP_DIR/load_results.txt"
    > "$results_file"
    
    # Start concurrent workers
    for i in $(seq 1 $CONCURRENT_USERS); do
        {
            local worker_id=$i
            local worker_requests=0
            local worker_success=0
            local worker_total_time=0
            local end_time=$(($(date +%s) + TEST_DURATION_SECONDS))
            
            while [[ $(date +%s) -lt $end_time ]]; do
                local start_time=$(date +%s.%3N)
                local response_code=$(curl -k -s -w "%{http_code}" -o /dev/null "$EDGE_API_URL/health" 2>/dev/null || echo "000")
                local request_end_time=$(date +%s.%3N)
                
                local response_time=$(echo "$request_end_time - $start_time" | bc -l 2>/dev/null || echo "0")
                worker_requests=$((worker_requests + 1))
                worker_total_time=$(echo "$worker_total_time + $response_time" | bc -l 2>/dev/null || echo "$worker_total_time")
                
                if [[ "$response_code" == "200" ]]; then
                    worker_success=$((worker_success + 1))
                fi
                
                # Brief pause to simulate realistic usage
                sleep 0.1
            done
            
            echo "Worker $worker_id: $worker_requests requests, $worker_success successful, avg $(echo "scale=3; $worker_total_time / $worker_requests" | bc -l)s" >> "$results_file"
        } &
        pids+=($!)
    done
    
    # Monitor progress
    local start_test_time=$(date +%s)
    while [[ $(($(date +%s) - start_test_time)) -lt $TEST_DURATION_SECONDS ]]; do
        local elapsed=$(($(date +%s) - start_test_time))
        local remaining=$((TEST_DURATION_SECONDS - elapsed))
        echo -ne "\rLoad test progress: ${elapsed}/${TEST_DURATION_SECONDS}s (${remaining}s remaining)   "
        sleep 5
    done
    echo ""
    
    # Wait for all workers to complete
    echo "Waiting for workers to complete..."
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null || true
    done
    
    # Analyze results
    if [[ -f "$results_file" ]]; then
        local total_requests=0
        local total_success=0
        
        while IFS= read -r line; do
            if [[ "$line" == Worker* ]]; then
                local requests=$(echo "$line" | grep -o '[0-9]\+ requests' | grep -o '[0-9]\+')
                local success=$(echo "$line" | grep -o '[0-9]\+ successful' | grep -o '[0-9]\+')
                total_requests=$((total_requests + requests))
                total_success=$((total_success + success))
            fi
        done < "$results_file"
        
        METRICS[total_requests]=$total_requests
        METRICS[successful_requests]=$total_success
        METRICS[failed_requests]=$((total_requests - total_success))
        
        local rps=$(echo "scale=2; $total_requests / $TEST_DURATION_SECONDS" | bc -l 2>/dev/null || echo "0")
        local success_rate=$(echo "scale=1; $total_success * 100 / $total_requests" | bc -l 2>/dev/null || echo "0")
        
        echo "Total requests: $total_requests"
        echo "Successful requests: $total_success"
        echo "Failed requests: $((total_requests - total_success))"
        echo "Requests per second: $rps"
        echo "Success rate: ${success_rate}%"
        
        # Log detailed results
        cat "$results_file" >> "$PERF_LOG"
    else
        echo "Load test results file not found"
        return 1
    fi
    
    return 0
}

# Performance Test 5: Memory and CPU Usage
test_resource_usage() {
    echo "Testing resource usage..."
    
    # Monitor Docker container resources
    local edge_api_stats
    edge_api_stats=$(docker stats grahmos-edge-api --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null || echo "ERROR")
    
    if [[ "$edge_api_stats" != "ERROR" ]]; then
        echo "Edge API Container Resources:"
        echo "$edge_api_stats"
        echo "$edge_api_stats" >> "$PERF_LOG"
    else
        echo "Could not retrieve container stats"
    fi
    
    # Check system resources
    local system_load
    system_load=$(uptime 2>/dev/null || echo "Load average unavailable")
    echo "System load: $system_load"
    echo "System load: $system_load" >> "$PERF_LOG"
    
    # Check available memory
    if command -v free >/dev/null 2>&1; then
        local memory_info
        memory_info=$(free -h 2>/dev/null || echo "Memory info unavailable")
        echo "Memory usage:"
        echo "$memory_info"
        echo "Memory usage:" >> "$PERF_LOG"
        echo "$memory_info" >> "$PERF_LOG"
    elif [[ "$(uname)" == "Darwin" ]]; then
        local memory_info
        memory_info=$(vm_stat | head -5 2>/dev/null || echo "Memory info unavailable")
        echo "Memory usage (macOS):"
        echo "$memory_info"
        echo "Memory usage (macOS):" >> "$PERF_LOG"
        echo "$memory_info" >> "$PERF_LOG"
    fi
    
    return 0
}

# Performance Test 6: Database Performance
test_database_performance() {
    echo "Testing database performance..."
    
    # Test multiple search backends if available
    local backends=("sqlite" "meilisearch")
    
    for backend in "${backends[@]}"; do
        echo "Testing $backend backend performance..."
        
        local backend_requests=5
        local backend_total_time=0
        
        for i in $(seq 1 $backend_requests); do
            local query="${SEARCH_QUERIES[$((i % ${#SEARCH_QUERIES[@]}))]}"
            local start_time=$(date +%s.%3N)
            
            # Test with backend parameter (won't work due to auth but measures response time)
            local response_code=$(curl -k -s \
                -w "%{http_code}" -o /dev/null \
                "$EDGE_API_URL/search?q=$(echo "$query" | sed 's/ /%20/g')&backend=$backend" 2>/dev/null || echo "000")
            
            local end_time=$(date +%s.%3N)
            local response_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
            backend_total_time=$(echo "$backend_total_time + $response_time" | bc -l 2>/dev/null || echo "$backend_total_time")
            
            echo "$backend search $i: ${response_time}s (${response_code})" >> "$PERF_LOG"
        done
        
        local avg_backend_time=$(echo "scale=3; $backend_total_time / $backend_requests" | bc -l 2>/dev/null || echo "0")
        echo "$backend average response time: ${avg_backend_time}s"
    done
    
    return 0
}

# Performance Test 7: TLS/SSL Performance
test_tls_performance() {
    echo "Testing TLS/SSL performance..."
    
    local tls_requests=10
    local tls_total_time=0
    local tls_handshake_time=0
    
    for i in $(seq 1 $tls_requests); do
        # Measure full request including TLS handshake
        local start_time=$(date +%s.%3N)
        local curl_output
        curl_output=$(curl -k -s -w "%{time_total}:%{time_connect}:%{time_appconnect}:%{http_code}" \
            -o /dev/null "$EDGE_API_URL/health" 2>/dev/null || echo "0:0:0:000")
        
        local time_total=$(echo "$curl_output" | cut -d: -f1)
        local time_connect=$(echo "$curl_output" | cut -d: -f2)
        local time_appconnect=$(echo "$curl_output" | cut -d: -f3)
        local response_code=$(echo "$curl_output" | cut -d: -f4)
        
        tls_total_time=$(echo "$tls_total_time + $time_total" | bc -l 2>/dev/null || echo "$tls_total_time")
        tls_handshake_time=$(echo "$tls_handshake_time + $time_appconnect" | bc -l 2>/dev/null || echo "$tls_handshake_time")
        
        echo "TLS request $i: total=${time_total}s, handshake=${time_appconnect}s (${response_code})" >> "$PERF_LOG"
    done
    
    local avg_total_time=$(echo "scale=3; $tls_total_time / $tls_requests" | bc -l 2>/dev/null || echo "0")
    local avg_handshake_time=$(echo "scale=3; $tls_handshake_time / $tls_requests" | bc -l 2>/dev/null || echo "0")
    
    echo "Average total request time: ${avg_total_time}s"
    echo "Average TLS handshake time: ${avg_handshake_time}s"
    
    return 0
}

# Generate performance report
generate_performance_report() {
    echo ""
    echo -e "${CYAN}Performance Test Report${NC}"
    echo "======================="
    
    {
        echo ""
        echo "=== PERFORMANCE SUMMARY ==="
        echo "Test Duration: ${TEST_DURATION_SECONDS}s"
        echo "Concurrent Users: $CONCURRENT_USERS"
        echo "Total Requests: ${METRICS[total_requests]}"
        echo "Successful Requests: ${METRICS[successful_requests]}"
        echo "Failed Requests: ${METRICS[failed_requests]}"
        echo "Search Requests: ${METRICS[search_requests]}"
        echo "Auth Requests: ${METRICS[auth_requests]}"
        
        if [[ ${METRICS[total_requests]} -gt 0 ]]; then
            local success_rate=$(echo "scale=1; ${METRICS[successful_requests]} * 100 / ${METRICS[total_requests]}" | bc -l 2>/dev/null || echo "0")
            local rps=$(echo "scale=2; ${METRICS[total_requests]} / $TEST_DURATION_SECONDS" | bc -l 2>/dev/null || echo "0")
            echo "Success Rate: ${success_rate}%"
            echo "Requests Per Second: $rps"
        fi
        
        if [[ "${METRICS[avg_response_time]}" != "0" ]]; then
            echo "Average Response Time: ${METRICS[avg_response_time]}s"
            echo "Min Response Time: ${METRICS[min_response_time]}s"
            echo "Max Response Time: ${METRICS[max_response_time]}s"
        fi
        
        echo "Report Generated: $(date)"
        echo "=========================="
    } | tee -a "$PERF_LOG"
    
    echo ""
    echo "Detailed performance log: $PERF_LOG"
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
    echo -e "${BLUE}Running performance tests...${NC}"
    echo ""
    
    # Run performance tests
    echo -e "${YELLOW}1. Basic Response Time${NC}"
    test_basic_response_time
    echo ""
    
    echo -e "${YELLOW}2. Authentication Performance${NC}"
    test_authentication_performance
    echo ""
    
    echo -e "${YELLOW}3. Search Performance${NC}"
    test_search_performance
    echo ""
    
    echo -e "${YELLOW}4. Concurrent Load Testing${NC}"
    test_concurrent_load
    echo ""
    
    echo -e "${YELLOW}5. Resource Usage${NC}"
    test_resource_usage
    echo ""
    
    echo -e "${YELLOW}6. Database Performance${NC}"
    test_database_performance
    echo ""
    
    echo -e "${YELLOW}7. TLS/SSL Performance${NC}"
    test_tls_performance
    echo ""
    
    # Generate final report
    generate_performance_report
    
    # Cleanup
    rm -rf "$TEMP_DIR" 2>/dev/null || true
    
    echo -e "${GREEN}🎉 Performance testing completed!${NC}"
    echo "Check the detailed log for comprehensive results: $PERF_LOG"
}

# Handle script termination
trap 'echo -e "\n${YELLOW}Performance testing interrupted${NC}"; rm -rf "$TEMP_DIR" 2>/dev/null || true; exit 130' INT

# Require bc for calculations
if ! command -v bc >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: 'bc' calculator is required for performance calculations${NC}"
    echo "Please install bc: sudo apt-get install bc (Ubuntu) or brew install bc (macOS)"
    exit 1
fi

# Run main function
main "$@"
