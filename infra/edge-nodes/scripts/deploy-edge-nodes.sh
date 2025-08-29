#!/bin/bash
# Grahmos Edge Node Deployment Script
# Automated deployment for stadium and emergency testbed environments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../" && pwd)"
DEPLOYMENT_CONFIG_DIR="$SCRIPT_DIR/../configs"

# Default values
DEPLOYMENT_TYPE="${1:-stadium}"
NODE_COUNT="${2:-1}"
ENVIRONMENT="${3:-staging}"
PLATFORM="${4:-auto}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    local missing_tools=()
    
    # Required tools
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")
    command -v docker-compose >/dev/null 2>&1 || missing_tools+=("docker-compose")
    command -v curl >/dev/null 2>&1 || missing_tools+=("curl")
    command -v jq >/dev/null 2>&1 || missing_tools+=("jq")
    command -v ssh >/dev/null 2>&1 || missing_tools+=("ssh")
    
    # Platform-specific tools
    if [[ "$PLATFORM" == "nixos" || "$PLATFORM" == "auto" ]]; then
        command -v nix >/dev/null 2>&1 || missing_tools+=("nix (for NixOS deployment)")
    fi
    
    if [[ "$PLATFORM" == "ubuntu-core" || "$PLATFORM" == "auto" ]]; then
        command -v snapcraft >/dev/null 2>&1 || missing_tools+=("snapcraft (for Ubuntu Core)")
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        error "Missing required tools: ${missing_tools[*]}"
        echo "Please install missing tools and try again."
        exit 1
    fi
    
    success "All prerequisites met"
}

# Detect platform automatically
detect_platform() {
    if [[ "$PLATFORM" != "auto" ]]; then
        echo "$PLATFORM"
        return
    fi
    
    log "Auto-detecting deployment platform..."
    
    if command -v nix >/dev/null 2>&1 && [[ -f /etc/nixos/configuration.nix ]]; then
        echo "nixos"
    elif command -v snap >/dev/null 2>&1 && [[ -f /etc/ubuntu-release ]] && snap list core22 >/dev/null 2>&1; then
        echo "ubuntu-core"
    elif command -v docker >/dev/null 2>&1; then
        echo "docker"
    else
        error "Unable to detect suitable deployment platform"
        exit 1
    fi
}

# Load deployment configuration
load_deployment_config() {
    local deployment_type="$1"
    local config_file="$DEPLOYMENT_CONFIG_DIR/${deployment_type}-deployment.json"
    
    if [[ ! -f "$config_file" ]]; then
        error "Deployment configuration not found: $config_file"
        exit 1
    fi
    
    log "Loading deployment configuration: $config_file"
    
    # Parse configuration
    BOOTSTRAP_NODES=$(jq -r '.p2p.bootstrap_nodes[]' "$config_file" | tr '\n' ',' | sed 's/,$//')
    NETWORK_CONFIG=$(jq -r '.network' "$config_file")
    MONITORING_ENABLED=$(jq -r '.monitoring.enabled' "$config_file")
    BACKUP_ENABLED=$(jq -r '.backup.enabled // true' "$config_file")
    
    # Export for use in other functions
    export BOOTSTRAP_NODES NETWORK_CONFIG MONITORING_ENABLED BACKUP_ENABLED
}

# Generate node configuration
generate_node_config() {
    local node_id="$1"
    local node_ip="$2"
    local config_dir="$3"
    
    log "Generating configuration for node $node_id ($node_ip)..."
    
    mkdir -p "$config_dir"
    
    # Generate unique node identity
    local node_identity
    node_identity=$(openssl rand -hex 32)
    
    # Create node-specific configuration
    cat > "$config_dir/gateway-$node_id.json" << EOF
{
  "node": {
    "id": "$node_id",
    "identity": "$node_identity",
    "environment": "$ENVIRONMENT",
    "deployment_type": "$DEPLOYMENT_TYPE"
  },
  "network": {
    "listen_ip": "$node_ip",
    "listen_port": 8080,
    "p2p_port": 4001,
    "metrics_port": 9090
  },
  "p2p": {
    "bootstrap_nodes": [$(echo "$BOOTSTRAP_NODES" | sed 's/,/", "/g' | sed 's/^/"/;s/$/"/')],
    "enable_mdns": true,
    "enable_upnp": true,
    "max_peers": 100,
    "min_peers": 5
  },
  "storage": {
    "data_dir": "/var/lib/grahmos/data",
    "log_dir": "/var/log/grahmos",
    "max_log_size": "100MB",
    "log_retention_days": 30
  },
  "monitoring": {
    "enabled": $MONITORING_ENABLED,
    "prometheus_endpoint": "http://monitoring.grahmos.io:9090",
    "health_check_interval": 30,
    "metrics_collection_interval": 15
  },
  "security": {
    "auto_update_enabled": true,
    "signature_verification": true,
    "tls_enabled": true,
    "firewall_enabled": true
  },
  "features": {
    "offline_content": true,
    "emergency_mode": true,
    "mesh_networking": true,
    "content_distribution": true
  }
}
EOF
    
    success "Generated configuration for node $node_id"
}

# Deploy NixOS edge node
deploy_nixos_node() {
    local node_id="$1"
    local node_ip="$2"
    local config_dir="$3"
    
    log "Deploying NixOS edge node $node_id to $node_ip..."
    
    # Copy NixOS configuration
    local nix_config_dir="/tmp/grahmos-deploy-$node_id"
    mkdir -p "$nix_config_dir"
    
    cp "$SCRIPT_DIR/../nixos/edge-gateway.nix" "$nix_config_dir/"
    cp "$config_dir/gateway-$node_id.json" "$nix_config_dir/gateway-config.json"
    
    # Create deployment-specific configuration
    cat > "$nix_config_dir/deployment.nix" << EOF
# Node-specific deployment configuration
{ config, pkgs, ... }:

{
  imports = [ ./edge-gateway.nix ];
  
  # Override network configuration
  networking.interfaces.eth0.ipv4.addresses = [{
    address = "$node_ip";
    prefixLength = 24;
  }];
  
  # Load gateway configuration
  environment.etc."grahmos/gateway.json".source = ./gateway-config.json;
}
EOF
    
    # Build and deploy
    if command -v nixos-rebuild >/dev/null 2>&1; then
        # Local deployment
        log "Building NixOS configuration locally..."
        nixos-rebuild build -I nixos-config="$nix_config_dir/deployment.nix"
        
        if [[ "$ENVIRONMENT" != "test" ]]; then
            nixos-rebuild switch -I nixos-config="$nix_config_dir/deployment.nix"
        fi
    else
        # Remote deployment
        log "Deploying to remote NixOS host $node_ip..."
        
        # Copy configuration to remote host
        scp -r "$nix_config_dir" "root@$node_ip:/tmp/"
        
        # Build and activate on remote host
        ssh "root@$node_ip" "
            cd /tmp/grahmos-deploy-$node_id
            nixos-rebuild switch -I nixos-config=deployment.nix
        "
    fi
    
    # Cleanup
    rm -rf "$nix_config_dir"
    
    success "NixOS deployment completed for node $node_id"
}

# Deploy Ubuntu Core snap
deploy_ubuntu_core_node() {
    local node_id="$1"
    local node_ip="$2"
    local config_dir="$3"
    
    log "Deploying Ubuntu Core edge node $node_id to $node_ip..."
    
    # Build snap package
    local snap_build_dir="/tmp/grahmos-snap-build-$node_id"
    mkdir -p "$snap_build_dir"
    
    cp -r "$SCRIPT_DIR/../ubuntu-core/"* "$snap_build_dir/"
    cp "$config_dir/gateway-$node_id.json" "$snap_build_dir/config/"
    
    cd "$snap_build_dir"
    
    # Build snap
    log "Building snap package..."
    snapcraft --destructive-mode
    
    local snap_file
    snap_file=$(ls grahmos-edge-gateway_*.snap | head -1)
    
    if [[ -z "$snap_file" ]]; then
        error "Snap build failed - no snap file found"
        exit 1
    fi
    
    # Deploy to target device
    if [[ "$node_ip" == "localhost" || "$node_ip" == "127.0.0.1" ]]; then
        # Local installation
        sudo snap install --dangerous "$snap_file"
    else
        # Remote installation
        log "Deploying snap to remote Ubuntu Core device $node_ip..."
        
        scp "$snap_file" "ubuntu@$node_ip:/tmp/"
        ssh "ubuntu@$node_ip" "
            sudo snap install --dangerous /tmp/$snap_file
            sudo snap start grahmos-edge-gateway
        "
    fi
    
    # Cleanup
    cd - > /dev/null
    rm -rf "$snap_build_dir"
    
    success "Ubuntu Core deployment completed for node $node_id"
}

# Deploy Docker-based node
deploy_docker_node() {
    local node_id="$1"
    local node_ip="$2"
    local config_dir="$3"
    
    log "Deploying Docker edge node $node_id to $node_ip..."
    
    # Create Docker Compose configuration
    local compose_dir="/tmp/grahmos-docker-$node_id"
    mkdir -p "$compose_dir"
    
    cat > "$compose_dir/docker-compose.yml" << EOF
version: '3.8'

services:
  grahmos-edge:
    build:
      context: $PROJECT_ROOT/apps/edge-api
      dockerfile: Dockerfile
    container_name: grahmos-edge-$node_id
    restart: unless-stopped
    
    environment:
      NODE_ENV: $ENVIRONMENT
      NODE_ID: $node_id
      CONFIG_FILE: /app/config/gateway.json
    
    ports:
      - "$node_ip:8080:8080"
      - "$node_ip:4001:4001"
      - "$node_ip:9090:9090"
    
    volumes:
      - ./config:/app/config:ro
      - grahmos-data-$node_id:/var/lib/grahmos
      - grahmos-logs-$node_id:/var/log/grahmos
    
    networks:
      - grahmos-network
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  grahmos-network:
    driver: bridge

volumes:
  grahmos-data-$node_id:
  grahmos-logs-$node_id:
EOF
    
    # Copy configuration
    mkdir -p "$compose_dir/config"
    cp "$config_dir/gateway-$node_id.json" "$compose_dir/config/gateway.json"
    
    # Deploy
    cd "$compose_dir"
    
    if [[ "$node_ip" == "localhost" || "$node_ip" == "127.0.0.1" ]]; then
        # Local deployment
        docker-compose up -d
    else
        # Remote deployment
        log "Deploying to remote Docker host $node_ip..."
        
        # Copy compose configuration
        scp -r . "ubuntu@$node_ip:/tmp/grahmos-docker-$node_id/"
        
        # Deploy on remote host
        ssh "ubuntu@$node_ip" "
            cd /tmp/grahmos-docker-$node_id
            docker-compose up -d
        "
    fi
    
    # Cleanup
    cd - > /dev/null
    rm -rf "$compose_dir"
    
    success "Docker deployment completed for node $node_id"
}

# Health check for deployed nodes
health_check_node() {
    local node_id="$1"
    local node_ip="$2"
    local max_retries=30
    local retry_count=0
    
    log "Running health check for node $node_id ($node_ip)..."
    
    while [[ $retry_count -lt $max_retries ]]; do
        if curl -sf "http://$node_ip:8080/health" >/dev/null 2>&1; then
            success "Node $node_id is healthy"
            return 0
        fi
        
        ((retry_count++))
        log "Health check attempt $retry_count/$max_retries for node $node_id..."
        sleep 5
    done
    
    error "Node $node_id failed health check after $max_retries attempts"
    return 1
}

# Generate monitoring configuration
setup_monitoring() {
    if [[ "$MONITORING_ENABLED" != "true" ]]; then
        log "Monitoring disabled, skipping setup"
        return
    fi
    
    log "Setting up monitoring for deployed nodes..."
    
    local monitoring_config="$DEPLOYMENT_CONFIG_DIR/monitoring-$DEPLOYMENT_TYPE.yml"
    
    # Generate Prometheus configuration
    cat > "$monitoring_config" << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "grahmos-edge-rules.yml"

scrape_configs:
  - job_name: 'grahmos-edge-nodes'
    static_configs:
EOF
    
    # Add all deployed nodes to monitoring
    for ((i=1; i<=NODE_COUNT; i++)); do
        local node_ip
        node_ip=$(get_node_ip "$i")
        echo "      - targets: ['$node_ip:9090']" >> "$monitoring_config"
        echo "        labels:" >> "$monitoring_config"
        echo "          node_id: 'edge-$i'" >> "$monitoring_config"
        echo "          deployment: '$DEPLOYMENT_TYPE'" >> "$monitoring_config"
        echo "          environment: '$ENVIRONMENT'" >> "$monitoring_config"
    done
    
    success "Monitoring configuration generated: $monitoring_config"
}

# Get node IP based on deployment type and index
get_node_ip() {
    local node_index="$1"
    
    case "$DEPLOYMENT_TYPE" in
        stadium)
            # Stadium deployment uses 10.0.x.x network
            echo "10.0.1.$((100 + node_index))"
            ;;
        emergency)
            # Emergency deployment uses 192.168.x.x network  
            echo "192.168.100.$((10 + node_index))"
            ;;
        test)
            # Test deployment uses localhost with port offset
            echo "127.0.0.1"
            ;;
        *)
            error "Unknown deployment type: $DEPLOYMENT_TYPE"
            exit 1
            ;;
    esac
}

# Main deployment function
main() {
    log "Starting Grahmos Edge Node Deployment"
    log "Deployment Type: $DEPLOYMENT_TYPE"
    log "Node Count: $NODE_COUNT"
    log "Environment: $ENVIRONMENT"
    log "Platform: $PLATFORM"
    
    # Preliminary checks
    check_prerequisites
    
    # Detect platform if auto
    PLATFORM=$(detect_platform)
    log "Using platform: $PLATFORM"
    
    # Load deployment configuration
    load_deployment_config "$DEPLOYMENT_TYPE"
    
    # Create temporary configuration directory
    local temp_config_dir
    temp_config_dir=$(mktemp -d)
    trap "rm -rf $temp_config_dir" EXIT
    
    # Deploy nodes
    local failed_nodes=()
    
    for ((i=1; i<=NODE_COUNT; i++)); do
        local node_id="edge-$i"
        local node_ip
        node_ip=$(get_node_ip "$i")
        
        log "Deploying node $i of $NODE_COUNT: $node_id ($node_ip)"
        
        # Generate node configuration
        generate_node_config "$node_id" "$node_ip" "$temp_config_dir"
        
        # Deploy based on platform
        case "$PLATFORM" in
            nixos)
                if ! deploy_nixos_node "$node_id" "$node_ip" "$temp_config_dir"; then
                    failed_nodes+=("$node_id")
                fi
                ;;
            ubuntu-core)
                if ! deploy_ubuntu_core_node "$node_id" "$node_ip" "$temp_config_dir"; then
                    failed_nodes+=("$node_id")
                fi
                ;;
            docker)
                if ! deploy_docker_node "$node_id" "$node_ip" "$temp_config_dir"; then
                    failed_nodes+=("$node_id")
                fi
                ;;
            *)
                error "Unsupported platform: $PLATFORM"
                failed_nodes+=("$node_id")
                ;;
        esac
        
        # Health check
        if ! health_check_node "$node_id" "$node_ip"; then
            warn "Node $node_id failed health check"
        fi
        
        log "Completed deployment for node $node_id"
    done
    
    # Setup monitoring
    setup_monitoring
    
    # Final report
    local successful_nodes=$((NODE_COUNT - ${#failed_nodes[@]}))
    
    log "Deployment Summary:"
    log "  Total nodes: $NODE_COUNT"
    log "  Successful: $successful_nodes"
    log "  Failed: ${#failed_nodes[@]}"
    
    if [[ ${#failed_nodes[@]} -gt 0 ]]; then
        warn "Failed nodes: ${failed_nodes[*]}"
        exit 1
    else
        success "All nodes deployed successfully!"
    fi
}

# Show usage information
usage() {
    cat << EOF
Usage: $0 [DEPLOYMENT_TYPE] [NODE_COUNT] [ENVIRONMENT] [PLATFORM]

DEPLOYMENT_TYPE: stadium, emergency, test (default: stadium)
NODE_COUNT:      Number of edge nodes to deploy (default: 1)
ENVIRONMENT:     staging, production, test (default: staging)
PLATFORM:        nixos, ubuntu-core, docker, auto (default: auto)

Examples:
  $0 stadium 3 production nixos     # Deploy 3 NixOS nodes for stadium
  $0 emergency 1 staging docker     # Deploy 1 Docker node for emergency
  $0 test 2 test auto               # Deploy 2 test nodes, auto-detect platform

EOF
}

# Parse command line arguments
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Run main deployment
main "$@"
