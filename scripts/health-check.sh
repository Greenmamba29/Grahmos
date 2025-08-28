#!/usr/bin/env bash

# Grahmos V1+V2 Unified - Comprehensive Health Check
# Phase 3: Improve/Deploy - Health Checks & Service Discovery

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Configuration
HEALTH_CHECK_LOG="/var/log/grahmos/health-check-$(date +%Y%m%d).log"
HEALTH_RESULTS_DIR="./health-results"
TIMEOUT_SECONDS=30
MAX_RETRIES=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Health check results
declare -A HEALTH_STATUS
declare -A HEALTH_DETAILS
declare -A SERVICE_URLS

# Service endpoints
SERVICE_URLS[edge-api]="https://localhost:8443"
SERVICE_URLS[nginx-proxy]="https://localhost:443"
SERVICE_URLS[meilisearch]="http://localhost:7700"
SERVICE_URLS[redis]="redis://localhost:6379"
SERVICE_URLS[prometheus]="http://localhost:9090"
SERVICE_URLS[grafana]="http://localhost:3030"

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Setup
setup_health_check() {
    echo -e "${CYAN}🏥 Grahmos V1+V2 Unified - Comprehensive Health Check${NC}"
    echo -e "${CYAN}=====================================================${NC}"
    echo ""
    
    # Create directories
    mkdir -p "$HEALTH_RESULTS_DIR" "$(dirname "$HEALTH_CHECK_LOG")"
    
    # Initialize log
    {
        echo "Health Check Report - $(date)"
        echo "V1+V2 Unified Implementation"
        echo "============================="
        echo ""
    } > "$HEALTH_CHECK_LOG"
}

# Logging function
log_health() {
    local level="$1"
    local service="$2"
    local message="$3"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] [$service] $message" >> "$HEALTH_CHECK_LOG"
}

# Run health check for a service
run_health_check() {
    local service="$1"
    local check_function="$2"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    echo -n "  Checking $service... "
    
    if $check_function; then
        echo -e "${GREEN}✅ HEALTHY${NC}"
        HEALTH_STATUS[$service]="HEALTHY"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        log_health "INFO" "$service" "Health check passed"
        return 0
    else
        local exit_code=$?
        if [[ $exit_code -eq 2 ]]; then
            echo -e "${YELLOW}⚠️  WARNING${NC}"
            HEALTH_STATUS[$service]="WARNING"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            log_health "WARN" "$service" "Health check warning: ${HEALTH_DETAILS[$service]}"
        else
            echo -e "${RED}❌ UNHEALTHY${NC}"
            HEALTH_STATUS[$service]="UNHEALTHY"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            log_health "ERROR" "$service" "Health check failed: ${HEALTH_DETAILS[$service]}"
        fi
        return $exit_code
    fi
}

# Docker container health check
check_docker_health() {
    local container_name="$1"
    
    # Check if container exists and is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        HEALTH_DETAILS[$container_name]="Container not running"
        return 1
    fi
    
    # Check container health status
    local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "unknown")
    
    case "$health_status" in
        "healthy")
            HEALTH_DETAILS[$container_name]="Container healthy"
            return 0
            ;;
        "unhealthy")
            HEALTH_DETAILS[$container_name]="Container unhealthy"
            return 1
            ;;
        "starting")
            HEALTH_DETAILS[$container_name]="Container starting"
            return 2
            ;;
        *)
            HEALTH_DETAILS[$container_name]="No health check configured"
            return 2
            ;;
    esac
}

# Edge API health check
check_edge_api_health() {
    local base_url="${SERVICE_URLS[edge-api]}"
    local issues=()
    
    # Basic health endpoint
    if ! curl -k -s --max-time "$TIMEOUT_SECONDS" "$base_url/health" | grep -q "healthy"; then
        issues+=("Health endpoint failed")
    fi
    
    # Check authentication endpoints
    local auth_response=$(curl -k -s -w "%{http_code}" -o /dev/null "$base_url/auth/mtls" 2>/dev/null)
    if [[ "$auth_response" != "401" ]]; then
        issues+=("mTLS auth endpoint unexpected response: $auth_response")
    fi
    
    local dpop_response=$(curl -k -s -w "%{http_code}" -o /dev/null "$base_url/auth/dpop" 2>/dev/null)
    if [[ "$dpop_response" != "400" ]]; then
        issues+=("DPoP auth endpoint unexpected response: $dpop_response")
    fi
    
    # Check search endpoint (should return 401 without auth)
    local search_response=$(curl -k -s -w "%{http_code}" -o /dev/null "$base_url/search?q=test" 2>/dev/null)
    if [[ "$search_response" != "401" ]]; then
        issues+=("Search endpoint unexpected response: $search_response")
    fi
    
    # Check assistant endpoint (should return 401 without auth)
    local assistant_response=$(curl -k -s -w "%{http_code}" -o /dev/null -X POST \
        -H "Content-Type: application/json" \
        -d '{"message": "test"}' \
        "$base_url/assistant/chat" 2>/dev/null)
    if [[ "$assistant_response" != "401" ]]; then
        issues+=("Assistant endpoint unexpected response: $assistant_response")
    fi
    
    # Check metrics endpoint (internal access)
    if curl -k -s --max-time 5 "$base_url/metrics" | grep -q "grahmos_"; then
        # Metrics accessible (might be OK for internal networks)
        true
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        HEALTH_DETAILS[edge-api]="All endpoints responding correctly"
        return 0
    else
        HEALTH_DETAILS[edge-api]="Issues: ${issues[*]}"
        return 1
    fi
}

# NGINX proxy health check
check_nginx_health() {
    local base_url="${SERVICE_URLS[nginx-proxy]}"
    local issues=()
    
    # Check HTTP to HTTPS redirect
    local http_response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost/" 2>/dev/null)
    if [[ "$http_response" != "301" ]]; then
        issues+=("HTTP redirect not working: $http_response")
    fi
    
    # Check HTTPS health endpoint
    if ! curl -k -s --max-time "$TIMEOUT_SECONDS" "$base_url/health" | grep -q "healthy"; then
        issues+=("HTTPS health check failed")
    fi
    
    # Check security headers
    local headers=$(curl -k -s -I "$base_url/health" 2>/dev/null)
    if ! echo "$headers" | grep -qi "x-frame-options"; then
        issues+=("Missing X-Frame-Options header")
    fi
    if ! echo "$headers" | grep -qi "x-content-type-options"; then
        issues+=("Missing X-Content-Type-Options header")
    fi
    
    # Check rate limiting (basic test)
    local rate_test_responses=()
    for i in {1..5}; do
        local response=$(curl -k -s -w "%{http_code}" -o /dev/null "$base_url/health" 2>/dev/null)
        rate_test_responses+=("$response")
        sleep 0.1
    done
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        HEALTH_DETAILS[nginx-proxy]="All checks passed"
        return 0
    else
        HEALTH_DETAILS[nginx-proxy]="Issues: ${issues[*]}"
        return 1
    fi
}

# Meilisearch health check
check_meilisearch_health() {
    local base_url="${SERVICE_URLS[meilisearch]}"
    local issues=()
    
    # Basic health check
    if ! curl -s --max-time "$TIMEOUT_SECONDS" "$base_url/health" | grep -q "available"; then
        issues+=("Health endpoint failed")
    fi
    
    # Check stats endpoint
    if ! curl -s --max-time 10 "$base_url/stats" | grep -q "databaseSize"; then
        issues+=("Stats endpoint failed")
    fi
    
    # Check if indexes exist
    local indexes=$(curl -s --max-time 10 "$base_url/indexes" 2>/dev/null | jq -r '.results | length' 2>/dev/null || echo "0")
    if [[ "$indexes" == "0" ]]; then
        issues+=("No search indexes found")
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        HEALTH_DETAILS[meilisearch]="$indexes indexes available"
        return 0
    else
        HEALTH_DETAILS[meilisearch]="Issues: ${issues[*]}"
        return 1
    fi
}

# Redis health check
check_redis_health() {
    local issues=()
    
    # Basic ping test
    if ! docker exec grahmos-redis redis-cli ping | grep -q "PONG"; then
        issues+=("Redis ping failed")
    fi
    
    # Check memory usage
    local memory_info=$(docker exec grahmos-redis redis-cli info memory 2>/dev/null || echo "")
    if [[ -n "$memory_info" ]]; then
        local used_memory=$(echo "$memory_info" | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
        local max_memory=$(echo "$memory_info" | grep "maxmemory_human" | cut -d: -f2 | tr -d '\r')
        HEALTH_DETAILS[redis]="Memory: $used_memory / $max_memory"
    else
        issues+=("Could not get memory info")
    fi
    
    # Test basic operations
    if ! docker exec grahmos-redis redis-cli set health_test "ok" >/dev/null 2>&1; then
        issues+=("Redis write test failed")
    fi
    
    if ! docker exec grahmos-redis redis-cli get health_test | grep -q "ok"; then
        issues+=("Redis read test failed")
    fi
    
    # Cleanup test key
    docker exec grahmos-redis redis-cli del health_test >/dev/null 2>&1 || true
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        return 0
    else
        HEALTH_DETAILS[redis]="Issues: ${issues[*]}"
        return 1
    fi
}

# Prometheus health check
check_prometheus_health() {
    local base_url="${SERVICE_URLS[prometheus]}"
    local issues=()
    
    # Check if Prometheus is ready
    if ! curl -s --max-time "$TIMEOUT_SECONDS" "$base_url/-/ready" | grep -q "Prometheus Server is Ready"; then
        issues+=("Prometheus not ready")
    fi
    
    # Check if Prometheus is healthy
    if ! curl -s --max-time "$TIMEOUT_SECONDS" "$base_url/-/healthy" | grep -q "Prometheus Server is Healthy"; then
        issues+=("Prometheus not healthy")
    fi
    
    # Check targets
    local targets_up=$(curl -s --max-time 10 "$base_url/api/v1/targets" 2>/dev/null | jq -r '.data.activeTargets | map(select(.health == "up")) | length' 2>/dev/null || echo "0")
    local targets_total=$(curl -s --max-time 10 "$base_url/api/v1/targets" 2>/dev/null | jq -r '.data.activeTargets | length' 2>/dev/null || echo "0")
    
    if [[ "$targets_total" -eq 0 ]]; then
        issues+=("No monitoring targets configured")
    elif [[ "$targets_up" -lt "$((targets_total / 2))" ]]; then
        issues+=("Many targets down: $targets_up/$targets_total up")
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        HEALTH_DETAILS[prometheus]="$targets_up/$targets_total targets up"
        return 0
    else
        HEALTH_DETAILS[prometheus]="Issues: ${issues[*]}"
        return 1
    fi
}

# Grafana health check
check_grafana_health() {
    local base_url="${SERVICE_URLS[grafana]}"
    local issues=()
    
    # Check health endpoint
    if ! curl -s --max-time "$TIMEOUT_SECONDS" "$base_url/api/health" | grep -q "ok"; then
        issues+=("Grafana health check failed")
    fi
    
    # Check datasources
    local datasources=$(curl -s --max-time 10 "$base_url/api/datasources" 2>/dev/null | jq -r '. | length' 2>/dev/null || echo "0")
    if [[ "$datasources" -eq 0 ]]; then
        issues+=("No datasources configured")
    fi
    
    # Check if default datasource is working
    if ! curl -s --max-time 10 "$base_url/api/datasources/proxy/1/api/v1/query?query=up" | grep -q "success"; then
        issues+=("Default datasource not responding")
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        HEALTH_DETAILS[grafana]="$datasources datasources configured"
        return 0
    else
        HEALTH_DETAILS[grafana]="Issues: ${issues[*]}"
        return 1
    fi
}

# Network connectivity check
check_network_connectivity() {
    local issues=()
    
    # Check internal network connectivity
    if ! docker exec grahmos-edge-api ping -c 1 meilisearch >/dev/null 2>&1; then
        issues+=("Edge API cannot reach Meilisearch")
    fi
    
    if ! docker exec grahmos-edge-api ping -c 1 redis-cache >/dev/null 2>&1; then
        issues+=("Edge API cannot reach Redis")
    fi
    
    # Check external connectivity (if needed)
    if ! docker exec grahmos-edge-api ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        issues+=("No external internet connectivity")
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        HEALTH_DETAILS[network]="All network connections working"
        return 0
    else
        HEALTH_DETAILS[network]="Issues: ${issues[*]}"
        return 1
    fi
}

# Certificate health check
check_certificates_health() {
    local issues=()
    
    # Check server certificate
    if [[ -f "infra/certs/server.crt" ]]; then
        local cert_expiry=$(openssl x509 -in infra/certs/server.crt -noout -enddate 2>/dev/null | cut -d= -f2)
        local expiry_epoch=$(date -d "$cert_expiry" +%s 2>/dev/null || echo "0")
        local current_epoch=$(date +%s)
        local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
        
        if [[ $days_until_expiry -lt 30 ]]; then
            issues+=("Server certificate expires in $days_until_expiry days")
        fi
    else
        issues+=("Server certificate not found")
    fi
    
    # Check client certificate (if exists)
    if [[ -f "infra/certs/client.crt" ]]; then
        local client_cert_expiry=$(openssl x509 -in infra/certs/client.crt -noout -enddate 2>/dev/null | cut -d= -f2)
        local client_expiry_epoch=$(date -d "$client_cert_expiry" +%s 2>/dev/null || echo "0")
        local client_days_until_expiry=$(( (client_expiry_epoch - current_epoch) / 86400 ))
        
        if [[ $client_days_until_expiry -lt 30 ]]; then
            issues+=("Client certificate expires in $client_days_until_expiry days")
        fi
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        HEALTH_DETAILS[certificates]="All certificates valid"
        return 0
    else
        HEALTH_DETAILS[certificates]="Issues: ${issues[*]}"
        return 1
    fi
}

# System resources check
check_system_resources() {
    local issues=()
    
    # Check disk space
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 90 ]]; then
        issues+=("High disk usage: ${disk_usage}%")
    fi
    
    # Check memory usage
    if command -v free >/dev/null 2>&1; then
        local memory_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
        if [[ $memory_usage -gt 90 ]]; then
            issues+=("High memory usage: ${memory_usage}%")
        fi
    fi
    
    # Check load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_count=$(nproc 2>/dev/null || echo "1")
    if (( $(echo "$load_avg > $cpu_count * 2" | bc -l 2>/dev/null || echo "0") )); then
        issues+=("High load average: $load_avg (CPUs: $cpu_count)")
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        issues+=("Docker daemon not responding")
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        HEALTH_DETAILS[system]="Resources within normal limits"
        return 0
    else
        HEALTH_DETAILS[system]="Issues: ${issues[*]}"
        return 1
    fi
}

# Generate health report
generate_health_report() {
    local report_file="$HEALTH_RESULTS_DIR/health-report-$(date +%Y%m%d-%H%M%S).json"
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    
    echo "{"
    echo "  \"timestamp\": \"$timestamp\","
    echo "  \"summary\": {"
    echo "    \"total_checks\": $TOTAL_CHECKS,"
    echo "    \"passed\": $PASSED_CHECKS,"
    echo "    \"failed\": $FAILED_CHECKS,"
    echo "    \"warnings\": $WARNING_CHECKS,"
    echo "    \"overall_status\": \"$(if [[ $FAILED_CHECKS -eq 0 ]]; then echo "HEALTHY"; elif [[ $FAILED_CHECKS -lt 3 ]]; then echo "DEGRADED"; else echo "UNHEALTHY"; fi)\""
    echo "  },"
    echo "  \"services\": {"
    
    local first=true
    for service in "${!HEALTH_STATUS[@]}"; do
        if [[ "$first" != true ]]; then
            echo ","
        fi
        first=false
        echo "    \"$service\": {"
        echo "      \"status\": \"${HEALTH_STATUS[$service]}\","
        echo "      \"details\": \"${HEALTH_DETAILS[$service]:-}\","
        echo "      \"url\": \"${SERVICE_URLS[$service]:-}\""
        echo -n "    }"
    done
    
    echo ""
    echo "  }"
    echo "}" > "$report_file"
    
    echo ""
    echo "Health report saved: $report_file"
}

# Display health summary
display_health_summary() {
    echo ""
    echo -e "${CYAN}Health Check Summary${NC}"
    echo "==================="
    echo "Total Checks: $TOTAL_CHECKS"
    echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "Warnings: ${YELLOW}$WARNING_CHECKS${NC}"
    echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
    
    local pass_rate=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    echo "Pass Rate: ${pass_rate}%"
    
    echo ""
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        echo -e "${GREEN}🎉 All health checks passed!${NC}"
        exit 0
    elif [[ $FAILED_CHECKS -lt 3 ]]; then
        echo -e "${YELLOW}⚠️  Some services have issues but system is operational${NC}"
        exit 1
    else
        echo -e "${RED}❌ Multiple critical issues detected${NC}"
        exit 2
    fi
}

# Main health check function
main() {
    setup_health_check
    
    echo -e "${BLUE}Running comprehensive health checks...${NC}"
    echo ""
    
    # Core application services
    echo -e "${PURPLE}📡 Core Services${NC}"
    run_health_check "edge-api" check_edge_api_health
    run_health_check "nginx-proxy" check_nginx_health
    run_health_check "meilisearch" check_meilisearch_health
    run_health_check "redis" check_redis_health
    
    echo ""
    echo -e "${PURPLE}📊 Monitoring Services${NC}"
    run_health_check "prometheus" check_prometheus_health
    run_health_check "grafana" check_grafana_health
    
    echo ""
    echo -e "${PURPLE}🔧 Infrastructure${NC}"
    run_health_check "network" check_network_connectivity
    run_health_check "certificates" check_certificates_health
    run_health_check "system" check_system_resources
    
    # Docker container health checks
    echo ""
    echo -e "${PURPLE}🐳 Container Health${NC}"
    for container in "grahmos-edge-api" "grahmos-nginx-proxy" "grahmos-meilisearch" "grahmos-redis"; do
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            run_health_check "${container}" "check_docker_health ${container}"
        fi
    done
    
    # Generate reports
    generate_health_report
    display_health_summary
}

# Handle script arguments
case "${1:-}" in
    --json)
        # JSON output mode
        main 2>/dev/null
        ;;
    --quiet)
        # Quiet mode - only output summary
        main | grep -E "(Health Check Summary|Total Checks|Passed|Failed|Pass Rate|All health checks|issues detected)"
        ;;
    --continuous)
        # Continuous monitoring mode
        while true; do
            echo "$(date): Running health checks..."
            main
            sleep 300  # Check every 5 minutes
        done
        ;;
    *)
        # Normal mode
        main
        ;;
esac
