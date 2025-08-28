#!/usr/bin/env bash

# Grahmos V1+V2 Unified - Service Discovery System
# Phase 3: Improve/Deploy - Service Discovery & Registry

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Configuration
SERVICE_REGISTRY_FILE="/var/lib/grahmos/service-registry.json"
SERVICE_DISCOVERY_LOG="/var/log/grahmos/service-discovery-$(date +%Y%m%d).log"
UPDATE_INTERVAL=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Service registry structure
declare -A SERVICES
declare -A SERVICE_STATUS
declare -A SERVICE_HEALTH
declare -A SERVICE_LAST_SEEN

# Setup
setup_service_discovery() {
    echo -e "${CYAN}🔍 Grahmos V1+V2 Unified - Service Discovery${NC}"
    echo -e "${CYAN}=============================================${NC}"
    echo ""
    
    # Create directories
    mkdir -p "$(dirname "$SERVICE_REGISTRY_FILE")" "$(dirname "$SERVICE_DISCOVERY_LOG")"
    
    # Initialize log
    {
        echo "Service Discovery - $(date)"
        echo "V1+V2 Unified Implementation"
        echo "============================="
        echo ""
    } > "$SERVICE_DISCOVERY_LOG"
    
    # Load existing registry if it exists
    if [[ -f "$SERVICE_REGISTRY_FILE" ]]; then
        echo "Loading existing service registry..."
    else
        echo "Creating new service registry..."
        initialize_service_registry
    fi
}

# Initialize service registry
initialize_service_registry() {
    cat > "$SERVICE_REGISTRY_FILE" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "services": {
    "grahmos-edge-api": {
      "name": "grahmos-edge-api",
      "type": "api",
      "version": "v1+v2-unified",
      "container": "grahmos-edge-api",
      "ports": {
        "http": 3000,
        "https": 3443,
        "metrics": 9090
      },
      "endpoints": {
        "health": "/health",
        "auth_mtls": "/auth/mtls",
        "auth_dpop": "/auth/dpop",
        "search": "/search",
        "assistant": "/assistant",
        "metrics": "/metrics"
      },
      "dependencies": ["meilisearch", "redis-cache"],
      "health_check": {
        "type": "http",
        "url": "https://localhost:8443/health",
        "interval": 30,
        "timeout": 10,
        "retries": 3
      }
    },
    "grahmos-nginx-proxy": {
      "name": "grahmos-nginx-proxy",
      "type": "proxy",
      "version": "1.25-alpine",
      "container": "grahmos-nginx-proxy",
      "ports": {
        "http": 80,
        "https": 443,
        "status": 8080
      },
      "endpoints": {
        "health": "/health",
        "status": "/nginx_status"
      },
      "dependencies": ["grahmos-edge-api"],
      "health_check": {
        "type": "http",
        "url": "https://localhost:443/health",
        "interval": 30,
        "timeout": 10,
        "retries": 3
      }
    },
    "grahmos-meilisearch": {
      "name": "grahmos-meilisearch",
      "type": "search",
      "version": "v1.5",
      "container": "grahmos-meilisearch",
      "ports": {
        "http": 7700
      },
      "endpoints": {
        "health": "/health",
        "stats": "/stats",
        "indexes": "/indexes"
      },
      "dependencies": [],
      "health_check": {
        "type": "http",
        "url": "http://localhost:7700/health",
        "interval": 30,
        "timeout": 10,
        "retries": 3
      }
    },
    "grahmos-redis": {
      "name": "grahmos-redis",
      "type": "cache",
      "version": "7.2-alpine",
      "container": "grahmos-redis",
      "ports": {
        "redis": 6379
      },
      "endpoints": {},
      "dependencies": [],
      "health_check": {
        "type": "redis",
        "command": "ping",
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    },
    "grahmos-prometheus": {
      "name": "grahmos-prometheus",
      "type": "monitoring",
      "version": "v2.48.0",
      "container": "grahmos-prometheus",
      "ports": {
        "http": 9090
      },
      "endpoints": {
        "health": "/-/healthy",
        "ready": "/-/ready",
        "targets": "/api/v1/targets"
      },
      "dependencies": [],
      "health_check": {
        "type": "http",
        "url": "http://localhost:9090/-/healthy",
        "interval": 60,
        "timeout": 10,
        "retries": 2
      }
    },
    "grahmos-grafana": {
      "name": "grahmos-grafana",
      "type": "monitoring",
      "version": "10.2.2",
      "container": "grahmos-grafana",
      "ports": {
        "http": 3000
      },
      "endpoints": {
        "health": "/api/health",
        "datasources": "/api/datasources"
      },
      "dependencies": ["grahmos-prometheus"],
      "health_check": {
        "type": "http",
        "url": "http://localhost:3030/api/health",
        "interval": 60,
        "timeout": 10,
        "retries": 2
      }
    }
  }
}
EOF
    
    echo "Service registry initialized: $SERVICE_REGISTRY_FILE"
}

# Discover running services
discover_services() {
    echo -e "${BLUE}🔍 Discovering running services...${NC}"
    
    # Get all running Grahmos containers
    local containers
    containers=$(docker ps --filter "name=grahmos" --format "{{.Names}}" 2>/dev/null || true)
    
    if [[ -z "$containers" ]]; then
        echo "No Grahmos services currently running"
        return 1
    fi
    
    echo "Found running services:"
    
    while IFS= read -r container; do
        if [[ -n "$container" ]]; then
            echo "  - $container"
            discover_service_details "$container"
        fi
    done <<< "$containers"
}

# Discover details for a specific service
discover_service_details() {
    local container="$1"
    
    # Get container information
    local container_info
    container_info=$(docker inspect "$container" 2>/dev/null | jq -r '.[0]' 2>/dev/null || echo '{}')
    
    if [[ "$container_info" == '{}' ]]; then
        echo "    ❌ Could not inspect container $container"
        return 1
    fi
    
    # Extract service information
    local image=$(echo "$container_info" | jq -r '.Config.Image // "unknown"')
    local status=$(echo "$container_info" | jq -r '.State.Status // "unknown"')
    local health=$(echo "$container_info" | jq -r '.State.Health.Status // "none"')
    local started=$(echo "$container_info" | jq -r '.State.StartedAt // "unknown"')
    
    # Get exposed ports
    local ports=()
    while IFS= read -r port_mapping; do
        if [[ -n "$port_mapping" ]] && [[ "$port_mapping" != "null" ]]; then
            ports+=("$port_mapping")
        fi
    done < <(echo "$container_info" | jq -r '.NetworkSettings.Ports | to_entries[] | "\(.key) -> \(.value[0].HostPort // "internal")"' 2>/dev/null || true)
    
    # Get network information
    local networks=()
    while IFS= read -r network; do
        if [[ -n "$network" ]] && [[ "$network" != "null" ]]; then
            networks+=("$network")
        fi
    done < <(echo "$container_info" | jq -r '.NetworkSettings.Networks | keys[]' 2>/dev/null || true)
    
    # Store service information
    SERVICES[$container]="$container"
    SERVICE_STATUS[$container]="$status"
    SERVICE_HEALTH[$container]="$health"
    SERVICE_LAST_SEEN[$container]=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    
    echo "    📊 Status: $status"
    echo "    🏥 Health: $health"
    echo "    🖼️  Image: $image"
    if [[ ${#ports[@]} -gt 0 ]]; then
        echo "    🔌 Ports: ${ports[*]}"
    fi
    if [[ ${#networks[@]} -gt 0 ]]; then
        echo "    🌐 Networks: ${networks[*]}"
    fi
    echo "    ⏰ Started: $started"
}

# Check service health
check_service_health() {
    local service_name="$1"
    
    # Load service configuration
    local service_config
    service_config=$(jq -r --arg name "$service_name" '.services[$name]' "$SERVICE_REGISTRY_FILE" 2>/dev/null || echo 'null')
    
    if [[ "$service_config" == 'null' ]]; then
        echo "Service $service_name not found in registry"
        return 1
    fi
    
    # Get health check configuration
    local health_check_type
    health_check_type=$(echo "$service_config" | jq -r '.health_check.type // "unknown"')
    
    case "$health_check_type" in
        "http")
            check_http_health "$service_name" "$service_config"
            ;;
        "redis")
            check_redis_health_discovery "$service_name" "$service_config"
            ;;
        "tcp")
            check_tcp_health "$service_name" "$service_config"
            ;;
        *)
            echo "Unknown health check type: $health_check_type"
            return 1
            ;;
    esac
}

# HTTP health check
check_http_health() {
    local service_name="$1"
    local service_config="$2"
    
    local url timeout retries
    url=$(echo "$service_config" | jq -r '.health_check.url')
    timeout=$(echo "$service_config" | jq -r '.health_check.timeout // 10')
    retries=$(echo "$service_config" | jq -r '.health_check.retries // 3')
    
    echo "  🌐 HTTP health check: $url"
    
    for ((i=1; i<=retries; i++)); do
        if curl -k -s --max-time "$timeout" "$url" >/dev/null 2>&1; then
            echo "    ✅ Health check passed (attempt $i/$retries)"
            SERVICE_HEALTH[$service_name]="healthy"
            return 0
        else
            if [[ $i -lt $retries ]]; then
                echo "    ⚠️  Health check failed (attempt $i/$retries), retrying..."
                sleep 2
            fi
        fi
    done
    
    echo "    ❌ Health check failed after $retries attempts"
    SERVICE_HEALTH[$service_name]="unhealthy"
    return 1
}

# Redis health check for discovery
check_redis_health_discovery() {
    local service_name="$1"
    local service_config="$2"
    
    local container
    container=$(echo "$service_config" | jq -r '.container')
    
    echo "  🔴 Redis health check: $container"
    
    if docker exec "$container" redis-cli ping | grep -q "PONG"; then
        echo "    ✅ Redis ping successful"
        SERVICE_HEALTH[$service_name]="healthy"
        return 0
    else
        echo "    ❌ Redis ping failed"
        SERVICE_HEALTH[$service_name]="unhealthy"
        return 1
    fi
}

# TCP health check
check_tcp_health() {
    local service_name="$1"
    local service_config="$2"
    
    local host port timeout
    host=$(echo "$service_config" | jq -r '.health_check.host // "localhost"')
    port=$(echo "$service_config" | jq -r '.health_check.port')
    timeout=$(echo "$service_config" | jq -r '.health_check.timeout // 5')
    
    echo "  🔌 TCP health check: $host:$port"
    
    if timeout "$timeout" bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null; then
        echo "    ✅ TCP connection successful"
        SERVICE_HEALTH[$service_name]="healthy"
        return 0
    else
        echo "    ❌ TCP connection failed"
        SERVICE_HEALTH[$service_name]="unhealthy"
        return 1
    fi
}

# Update service registry
update_service_registry() {
    echo -e "${BLUE}📝 Updating service registry...${NC}"
    
    local temp_registry="/tmp/service-registry-temp-$$.json"
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    
    # Load current registry
    local current_registry='{}'
    if [[ -f "$SERVICE_REGISTRY_FILE" ]]; then
        current_registry=$(cat "$SERVICE_REGISTRY_FILE")
    fi
    
    # Update the registry with current service states
    local updated_registry
    updated_registry=$(echo "$current_registry" | jq --arg timestamp "$timestamp" '
        .updated = $timestamp |
        .runtime = {
            "discovered_services": [],
            "service_status": {},
            "last_health_check": $timestamp
        }
    ')
    
    # Add runtime information
    for service in "${!SERVICES[@]}"; do
        updated_registry=$(echo "$updated_registry" | jq --arg service "$service" \
            --arg status "${SERVICE_STATUS[$service]}" \
            --arg health "${SERVICE_HEALTH[$service]}" \
            --arg last_seen "${SERVICE_LAST_SEEN[$service]}" '
            .runtime.discovered_services += [$service] |
            .runtime.service_status[$service] = {
                "status": $status,
                "health": $health,
                "last_seen": $last_seen
            }
        ')
    done
    
    # Write updated registry
    echo "$updated_registry" > "$temp_registry"
    mv "$temp_registry" "$SERVICE_REGISTRY_FILE"
    
    echo "Service registry updated: $SERVICE_REGISTRY_FILE"
}

# Get service information
get_service_info() {
    local service_name="$1"
    
    if [[ ! -f "$SERVICE_REGISTRY_FILE" ]]; then
        echo "Service registry not found"
        return 1
    fi
    
    local service_info
    service_info=$(jq -r --arg name "$service_name" '.services[$name] // empty' "$SERVICE_REGISTRY_FILE" 2>/dev/null)
    
    if [[ -n "$service_info" ]] && [[ "$service_info" != "null" ]]; then
        echo "$service_info" | jq '.'
        return 0
    else
        echo "Service '$service_name' not found in registry"
        return 1
    fi
}

# List all services
list_services() {
    if [[ ! -f "$SERVICE_REGISTRY_FILE" ]]; then
        echo "Service registry not found"
        return 1
    fi
    
    echo -e "${CYAN}📋 Service Registry${NC}"
    echo "=================="
    
    # Get registry info
    local registry_updated
    registry_updated=$(jq -r '.updated // "unknown"' "$SERVICE_REGISTRY_FILE" 2>/dev/null || echo "unknown")
    echo "Last Updated: $registry_updated"
    echo ""
    
    # List configured services
    echo -e "${PURPLE}📋 Configured Services${NC}"
    jq -r '.services | to_entries[] | "\(.key) (\(.value.type)) - \(.value.version)"' "$SERVICE_REGISTRY_FILE" 2>/dev/null || echo "No services configured"
    
    echo ""
    
    # List runtime status
    echo -e "${PURPLE}⚡ Runtime Status${NC}"
    if jq -e '.runtime' "$SERVICE_REGISTRY_FILE" >/dev/null 2>&1; then
        jq -r '.runtime.service_status | to_entries[] | "\(.key): \(.value.status) / \(.value.health)"' "$SERVICE_REGISTRY_FILE" 2>/dev/null || echo "No runtime information available"
    else
        echo "No runtime information available"
    fi
}

# Monitor services continuously
monitor_services() {
    echo -e "${CYAN}🔄 Starting continuous service monitoring...${NC}"
    echo "Update interval: ${UPDATE_INTERVAL}s"
    echo "Press Ctrl+C to stop"
    echo ""
    
    while true; do
        local start_time=$(date)
        
        echo "[$start_time] Monitoring cycle started..."
        
        # Discover services
        discover_services
        
        # Check health for all discovered services
        echo -e "${BLUE}🏥 Checking service health...${NC}"
        for service in "${!SERVICES[@]}"; do
            echo "  Checking $service..."
            check_service_health "$service" || true
        done
        
        # Update registry
        update_service_registry
        
        local end_time=$(date)
        echo "[$end_time] Monitoring cycle completed"
        echo ""
        
        # Wait for next cycle
        sleep "$UPDATE_INTERVAL"
    done
}

# Export service endpoints
export_service_endpoints() {
    local format="${1:-env}"
    
    if [[ ! -f "$SERVICE_REGISTRY_FILE" ]]; then
        echo "Service registry not found"
        return 1
    fi
    
    case "$format" in
        "env")
            echo "# Grahmos Service Endpoints"
            jq -r '.services | to_entries[] | 
                "export " + (.key | ascii_upcase | gsub("-"; "_")) + "_URL=\"" + 
                (if .value.ports.https then "https://localhost:" + (.value.ports.https | tostring)
                 elif .value.ports.http then "http://localhost:" + (.value.ports.http | tostring)
                 else "unknown" end) + "\""' "$SERVICE_REGISTRY_FILE" 2>/dev/null
            ;;
        "json")
            jq '.services | with_entries(.value = {
                "url": (if .value.ports.https then "https://localhost:" + (.value.ports.https | tostring)
                        elif .value.ports.http then "http://localhost:" + (.value.ports.http | tostring)
                        else "unknown" end),
                "type": .value.type,
                "endpoints": .value.endpoints
            })' "$SERVICE_REGISTRY_FILE"
            ;;
        "yaml")
            echo "# Grahmos Service Endpoints"
            echo "services:"
            jq -r '.services | to_entries[] | 
                "  " + .key + ":" + "\n" +
                "    url: " + (if .value.ports.https then "https://localhost:" + (.value.ports.https | tostring)
                             elif .value.ports.http then "http://localhost:" + (.value.ports.http | tostring)
                             else "unknown" end) + "\n" +
                "    type: " + .value.type' "$SERVICE_REGISTRY_FILE" 2>/dev/null
            ;;
        *)
            echo "Unknown format: $format"
            echo "Available formats: env, json, yaml"
            return 1
            ;;
    esac
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [command] [options]

Service Discovery and Registry for Grahmos V1+V2 Unified

COMMANDS:
    discover            Discover currently running services
    monitor             Continuously monitor services (default)
    list                List all registered services
    info <service>      Get detailed information about a service
    health <service>    Check health of a specific service
    export [format]     Export service endpoints (env|json|yaml)
    init                Initialize service registry

OPTIONS:
    --interval <seconds>    Set monitoring interval (default: 30)
    --help                  Show this help message

EXAMPLES:
    $0 discover
    $0 monitor --interval 60
    $0 info grahmos-edge-api
    $0 export json

EOF
}

# Main function
main() {
    local command="monitor"
    local service_name=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            discover)
                command="discover"
                shift
                ;;
            monitor)
                command="monitor"
                shift
                ;;
            list)
                command="list"
                shift
                ;;
            info)
                command="info"
                service_name="$2"
                shift 2
                ;;
            health)
                command="health"
                service_name="$2"
                shift 2
                ;;
            export)
                command="export"
                service_name="${2:-env}"
                shift
                [[ $# -gt 0 ]] && shift
                ;;
            init)
                command="init"
                shift
                ;;
            --interval)
                UPDATE_INTERVAL="$2"
                shift 2
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # Setup
    setup_service_discovery
    
    # Execute command
    case "$command" in
        discover)
            discover_services
            update_service_registry
            ;;
        monitor)
            monitor_services
            ;;
        list)
            list_services
            ;;
        info)
            if [[ -z "$service_name" ]]; then
                echo "Service name required for info command"
                exit 1
            fi
            get_service_info "$service_name"
            ;;
        health)
            if [[ -z "$service_name" ]]; then
                echo "Service name required for health command"
                exit 1
            fi
            check_service_health "$service_name"
            ;;
        export)
            export_service_endpoints "$service_name"
            ;;
        init)
            initialize_service_registry
            ;;
        *)
            echo "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Handle interruption
trap 'echo -e "\n${YELLOW}Service monitoring stopped${NC}"; exit 0' INT

# Run main function
main "$@"
