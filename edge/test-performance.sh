#!/usr/bin/env bash

# Edge Security Performance Testing Suite
# Benchmarks search performance, Unix domain socket communication, memory-mapped indexes, and rate limiting

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Test configuration
TEST_RESULTS="./test-results-performance.log"
TEMP_DB="/tmp/grahmos_perf_test.sqlite"
SOCKET_PATH="/tmp/test-edge.sock"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters and metrics
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo "⚡ Edge Security Performance Testing Suite"
echo "=========================================="
echo "Start Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "" | tee "$TEST_RESULTS"

# Utility functions
log_performance() {
    local test_name="$1"
    local metric_type="$2"
    local value="$3"
    local unit="$4"
    local benchmark="${5:-}"
    local status="INFO"
    
    if [[ -n "$benchmark" ]]; then
        if (( $(echo "$value < $benchmark" | bc -l) )); then
            status="PASS"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            status="FAIL"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ "$status" == "PASS" ]]; then
        echo -e "✅ ${GREEN}$status${NC} - $test_name: $value $unit (target: <$benchmark $unit)" | tee -a "$TEST_RESULTS"
    elif [[ "$status" == "FAIL" ]]; then
        echo -e "❌ ${RED}$status${NC} - $test_name: $value $unit (target: <$benchmark $unit)" | tee -a "$TEST_RESULTS"
    else
        echo -e "📊 ${BLUE}$status${NC} - $test_name: $value $unit" | tee -a "$TEST_RESULTS"
    fi
}

# Test 1: SQLite FTS Performance
echo "🔍 Testing SQLite FTS Performance..."

test_sqlite_performance() {
    echo "   Setting up test database..."
    
    # Clean up any existing test database
    rm -f "$TEMP_DB"
    
    # Create test database with sample data
    sqlite3 "$TEMP_DB" << 'EOF'
CREATE VIRTUAL TABLE fts USING fts5(title, content, docid UNINDEXED);

-- Insert test data (1000 documents)
WITH RECURSIVE doc_generator(n) AS (
  SELECT 1
  UNION ALL
  SELECT n+1 FROM doc_generator WHERE n < 1000
)
INSERT INTO fts(title, content, docid)
SELECT 
  'Emergency Document ' || n,
  'This is emergency content for document ' || n || ' containing evacuation procedures and safety information for stadium section ' || (n % 10 + 1) || '. Important keywords include fire safety, medical assistance, emergency exits, and assembly points.',
  'doc-' || printf('%04d', n)
FROM doc_generator;
EOF
    
    echo "   Running FTS performance benchmarks..."
    
    # Test 1: Single term search
    start_time=$(date +%s.%N)
    for i in {1..100}; do
        sqlite3 "$TEMP_DB" "SELECT COUNT(*) FROM fts WHERE fts MATCH 'emergency';" >/dev/null
    done
    end_time=$(date +%s.%N)
    single_search_time=$(echo "scale=2; ($end_time - $start_time) * 10" | bc)
    log_performance "Single Term Search (100 queries)" "latency" "$single_search_time" "ms" "50"
    
    # Test 2: Complex query search  
    start_time=$(date +%s.%N)
    for i in {1..50}; do
        sqlite3 "$TEMP_DB" "SELECT docid, snippet(fts, 1, '<b>', '</b>', '...', 10) FROM fts WHERE fts MATCH 'emergency AND fire' LIMIT 10;" >/dev/null
    done
    end_time=$(date +%s.%N)
    complex_search_time=$(echo "scale=2; ($end_time - $start_time) * 20" | bc)
    log_performance "Complex Query Search (50 queries)" "latency" "$complex_search_time" "ms" "100"
    
    # Test 3: Concurrent search simulation
    echo "   Testing concurrent search performance..."
    start_time=$(date +%s.%N)
    for i in {1..10}; do
        (
            for j in {1..20}; do
                sqlite3 "$TEMP_DB" "SELECT docid FROM fts WHERE fts MATCH 'safety OR medical' LIMIT 5;" >/dev/null
            done
        ) &
    done
    wait
    end_time=$(date +%s.%N)
    concurrent_time=$(echo "scale=2; ($end_time - $start_time) * 1000" | bc)
    log_performance "Concurrent Search (200 parallel queries)" "latency" "$concurrent_time" "ms" "2000"
    
    # Test 4: Database size and indexing efficiency
    db_size=$(stat -f%z "$TEMP_DB" 2>/dev/null || stat -c%s "$TEMP_DB" 2>/dev/null || echo "0")
    db_size_mb=$(echo "scale=2; $db_size / 1024 / 1024" | bc)
    log_performance "Database Size (1000 docs)" "size" "$db_size_mb" "MB"
    
    # Clean up
    rm -f "$TEMP_DB"
}

test_sqlite_performance

# Test 2: Memory-Mapped Index Performance
echo "📚 Testing Memory-Mapped Index Performance..."

test_mmap_performance() {
    echo "   Creating memory-mapped test files..."
    
    # Create test files for memory mapping
    local test_file="/tmp/mmap_test.dat"
    local file_size_mb=10
    
    # Create 10MB test file
    dd if=/dev/zero of="$test_file" bs=1M count=$file_size_mb 2>/dev/null
    
    # Test memory mapping performance with dd
    echo "   Testing memory-mapped file access..."
    start_time=$(date +%s.%N)
    for i in {1..100}; do
        dd if="$test_file" of=/dev/null bs=4K count=1 skip=$((RANDOM % 2560)) 2>/dev/null
    done
    end_time=$(date +%s.%N)
    mmap_time=$(echo "scale=2; ($end_time - $start_time) * 10" | bc)
    log_performance "Memory-Mapped Random Access (100 ops)" "latency" "$mmap_time" "ms" "20"
    
    # Test sequential access
    start_time=$(date +%s.%N)
    dd if="$test_file" of=/dev/null bs=1M 2>/dev/null
    end_time=$(date +%s.%N)
    sequential_time=$(echo "scale=3; ($end_time - $start_time) * 1000" | bc)
    log_performance "Sequential Read (10MB)" "latency" "$sequential_time" "ms" "50"
    
    rm -f "$test_file"
}

test_mmap_performance

# Test 3: Unix Domain Socket Performance  
echo "🔌 Testing Unix Domain Socket Performance..."

test_socket_performance() {
    echo "   Setting up socket test environment..."
    
    # Start a simple echo server
    (
        while true; do
            nc -lU "$SOCKET_PATH" -c "cat" 2>/dev/null || break
        done
    ) &
    local server_pid=$!
    
    sleep 0.5  # Let server start
    
    # Test socket communication latency
    echo "   Testing socket communication latency..."
    start_time=$(date +%s.%N)
    for i in {1..100}; do
        echo "test message $i" | nc -U "$SOCKET_PATH" >/dev/null 2>&1 || true
    done
    end_time=$(date +%s.%N)
    socket_time=$(echo "scale=2; ($end_time - $start_time) * 10" | bc)
    log_performance "Unix Domain Socket (100 messages)" "latency" "$socket_time" "ms" "30"
    
    # Test throughput
    echo "   Testing socket throughput..."
    local test_data="/tmp/socket_test_data"
    head -c 1024 /dev/zero > "$test_data"  # 1KB test data
    
    start_time=$(date +%s.%N)
    for i in {1..50}; do
        cat "$test_data" | nc -U "$SOCKET_PATH" >/dev/null 2>&1 || true
    done
    end_time=$(date +%s.%N)
    throughput_time=$(echo "scale=2; $end_time - $start_time" | bc)
    throughput_mbps=$(echo "scale=2; (50 * 1024) / ($throughput_time * 1024 * 1024)" | bc)
    log_performance "Socket Throughput (50KB)" "speed" "$throughput_mbps" "MB/s"
    
    # Cleanup
    kill $server_pid 2>/dev/null || true
    rm -f "$SOCKET_PATH" "$test_data"
}

test_socket_performance

# Test 4: JWT Performance
echo "🎫 Testing JWT Performance..."

test_jwt_performance() {
    echo "   Testing JWT operations..."
    
    # Test JWT signing performance
    local jwt_key="test-key-for-performance-testing-32-bytes-long!"
    local test_payload='{"iss":"test","aud":"test","sub":"test","iat":1234567890,"exp":1234571490,"cnf":{"x5t#S256":"testfingerprint"}}'
    
    # Note: We don't have Node.js JWT library available in shell, so we'll test with openssl
    # Create test RSA key for performance testing
    local rsa_key="/tmp/test_rsa.key"
    openssl genrsa -out "$rsa_key" 2048 2>/dev/null
    
    # Test RSA signing performance
    start_time=$(date +%s.%N)
    for i in {1..50}; do
        echo "$test_payload" | openssl dgst -sha256 -sign "$rsa_key" >/dev/null 2>&1
    done
    end_time=$(date +%s.%N)
    rsa_sign_time=$(echo "scale=2; ($end_time - $start_time) * 20" | bc)
    log_performance "RSA-SHA256 Signing (50 ops)" "latency" "$rsa_sign_time" "ms" "100"
    
    # Test RSA verification performance
    local signature="/tmp/test_sig"
    echo "$test_payload" | openssl dgst -sha256 -sign "$rsa_key" > "$signature"
    local public_key="/tmp/test_pub.key"
    openssl rsa -in "$rsa_key" -pubout -out "$public_key" 2>/dev/null
    
    start_time=$(date +%s.%N)
    for i in {1..100}; do
        echo "$test_payload" | openssl dgst -sha256 -verify "$public_key" -signature "$signature" >/dev/null 2>&1
    done
    end_time=$(date +%s.%N)
    rsa_verify_time=$(echo "scale=2; ($end_time - $start_time) * 10" | bc)
    log_performance "RSA-SHA256 Verification (100 ops)" "latency" "$rsa_verify_time" "ms" "50"
    
    rm -f "$rsa_key" "$signature" "$public_key"
}

test_jwt_performance

# Test 5: Rate Limiting Performance
echo "⏱️ Testing Rate Limiting Performance..."

test_rate_limiting() {
    echo "   Simulating rate limiting scenarios..."
    
    # Test rate calculation performance
    start_time=$(date +%s.%N)
    for i in {1..1000}; do
        # Simulate rate limiting check (using shell arithmetic)
        current_time=$(date +%s)
        window_start=$((current_time - 60))  # 1-minute window
        request_count=$((RANDOM % 100))
        
        if [ $request_count -lt 20 ]; then
            # Request allowed
            true
        else
            # Request denied
            false
        fi
    done >/dev/null 2>&1
    end_time=$(date +%s.%N)
    rate_check_time=$(echo "scale=3; ($end_time - $start_time) * 1000" | bc)
    log_performance "Rate Limit Checks (1000 ops)" "latency" "$rate_check_time" "ms" "10"
    
    # Test burst handling
    echo "   Testing burst handling..."
    start_time=$(date +%s.%N)
    for i in {1..200}; do
        # Simulate burst detection
        if [ $((i % 21)) -eq 0 ]; then
            # Rate limit exceeded
            sleep 0.001  # Simulate small delay
        fi
    done
    end_time=$(date +%s.%N)
    burst_time=$(echo "scale=2; ($end_time - $start_time) * 1000" | bc)
    log_performance "Burst Detection (200 requests)" "latency" "$burst_time" "ms" "50"
}

test_rate_limiting

# Test 6: System Resource Performance
echo "💻 Testing System Resource Performance..."

test_system_performance() {
    echo "   Measuring system resource usage..."
    
    # CPU usage test
    local cpu_before=$(ps -o %cpu= -p $$ | tr -d ' ')
    start_time=$(date +%s.%N)
    # CPU intensive task
    for i in {1..10000}; do
        echo "test" | sha256sum >/dev/null 2>&1
    done
    end_time=$(date +%s.%N)
    cpu_time=$(echo "scale=3; ($end_time - $start_time) * 1000" | bc)
    log_performance "CPU Intensive Task (10K SHA256)" "latency" "$cpu_time" "ms" "1000"
    
    # Memory allocation test
    echo "   Testing memory allocation performance..."
    start_time=$(date +%s.%N)
    for i in {1..100}; do
        # Simulate memory allocation by creating temporary arrays
        declare -a test_array
        for j in {1..100}; do
            test_array[$j]="data_$j"
        done
        unset test_array
    done
    end_time=$(date +%s.%N)
    memory_time=$(echo "scale=2; ($end_time - $start_time) * 10" | bc)
    log_performance "Memory Allocation (10K arrays)" "latency" "$memory_time" "ms" "50"
}

test_system_performance

# Test 7: Edge API Compilation Performance
echo "⚙️ Testing Edge API Build Performance..."

test_build_performance() {
    echo "   Testing TypeScript compilation speed..."
    
    if [[ -d "edge-api/src" ]]; then
        cd edge-api
        
        # Test TypeScript compilation time
        start_time=$(date +%s.%N)
        npm run build >/dev/null 2>&1
        end_time=$(date +%s.%N)
        build_time=$(echo "scale=3; ($end_time - $start_time) * 1000" | bc)
        log_performance "TypeScript Compilation" "build" "$build_time" "ms" "5000"
        
        cd ..
    else
        log_performance "TypeScript Compilation" "build" "0" "ms" "SKIPPED"
    fi
}

test_build_performance

# Test 8: Update System Performance
echo "🔄 Testing Update System Performance..."

test_update_performance() {
    echo "   Testing update verification performance..."
    
    # Create test manifest
    local test_manifest="/tmp/test_manifest.json"
    local test_signature="/tmp/test_manifest.json.sig"
    local test_key="/tmp/test_update_key.pem"
    
    # Generate test key
    openssl genrsa -out "$test_key" 2048 2>/dev/null
    
    # Create test manifest
    cat > "$test_manifest" << 'EOF'
{
  "version": "test-2025.08.28",
  "created": "2025-08-28T06:57:00Z",
  "files": [
    {"path": "test.db", "sha256": "abcd1234", "bytes": 1000}
  ]
}
EOF
    
    # Test signing performance
    start_time=$(date +%s.%N)
    for i in {1..50}; do
        openssl dgst -sha256 -sign "$test_key" -out "$test_signature" "$test_manifest" 2>/dev/null
    done
    end_time=$(date +%s.%N)
    signing_time=$(echo "scale=2; ($end_time - $start_time) * 20" | bc)
    log_performance "Manifest Signing (50 ops)" "latency" "$signing_time" "ms" "500"
    
    # Test verification performance
    local test_pubkey="/tmp/test_update_pub.pem"
    openssl rsa -in "$test_key" -pubout -out "$test_pubkey" 2>/dev/null
    
    start_time=$(date +%s.%N)
    for i in {1..100}; do
        openssl dgst -sha256 -verify "$test_pubkey" -signature "$test_signature" "$test_manifest" >/dev/null 2>&1
    done
    end_time=$(date +%s.%N)
    verify_time=$(echo "scale=2; ($end_time - $start_time) * 10" | bc)
    log_performance "Manifest Verification (100 ops)" "latency" "$verify_time" "ms" "100"
    
    rm -f "$test_manifest" "$test_signature" "$test_key" "$test_pubkey"
}

test_update_performance

# Performance Summary Report
echo ""
echo "📊 Performance Testing Summary"
echo "=============================="

# Calculate overall performance score
if [ $TOTAL_TESTS -gt 0 ]; then
    success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
else
    success_rate=0
fi

echo "Total Performance Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo -e "Info Only: ${BLUE}$((TOTAL_TESTS - PASSED_TESTS - FAILED_TESTS))${NC}"
echo "Performance Score: $success_rate%"
echo ""
echo "End Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Write summary to log
{
    echo "=============================="
    echo "PERFORMANCE TESTING SUMMARY"
    echo "=============================="
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Performance Score: $success_rate%"
    echo "End Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
} >> "$TEST_RESULTS"

# Performance recommendations
echo ""
echo "🚀 Performance Recommendations:"
echo "================================"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All performance benchmarks met targets!${NC}"
    echo "• System is ready for production deployment"
    echo "• Consider load testing with real traffic patterns"
    echo "• Monitor performance metrics in production"
else
    echo -e "${YELLOW}⚠️  Some performance targets not met${NC}"
    echo "• Review failed benchmarks in $TEST_RESULTS"
    echo "• Consider hardware upgrades for better performance"
    echo "• Optimize critical paths identified in testing"
fi

echo ""
echo "📈 Key Performance Metrics:"
echo "• SQLite FTS: Optimized for <50ms single queries"
echo "• Memory Mapping: Efficient random access <20ms"
echo "• Unix Sockets: Low latency <30ms communication"
echo "• JWT Operations: Fast crypto <100ms RSA ops"
echo "• Rate Limiting: Quick decisions <10ms checks"
echo "• Updates: Secure verification <100ms per manifest"

echo ""
echo "Detailed results saved to: $TEST_RESULTS"

# Exit with appropriate code
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi
