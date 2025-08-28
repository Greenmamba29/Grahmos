#!/usr/bin/env bash

# Grahmos V1+V2 Unified - Deployment Script
# Phase 3: Improve/Deploy - Automated Deployment with Rollback

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Configuration
DEPLOYMENT_LOG="/var/log/grahmos/deployment-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="/opt/grahmos/backups"
TEMP_DIR="/tmp/grahmos-deploy-$$"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Global variables
ENVIRONMENT=""
IMAGE_TAG=""
ROLLBACK_VERSION=""
DRY_RUN=false
FORCE_DEPLOY=false
SKIP_BACKUP=false
DEPLOYMENT_ID=""

# Usage information
usage() {
    cat << EOF
Usage: $0 <environment> <image_tag> [options]

Automated deployment script for Grahmos V1+V2 Unified

ARGUMENTS:
    environment     Target environment (staging, production)
    image_tag       Docker image tag or version to deploy

OPTIONS:
    --dry-run              Show what would be deployed without executing
    --force                Force deployment even if health checks fail
    --skip-backup          Skip pre-deployment backup
    --rollback <version>   Rollback to specified version
    --help                 Display this help message

EXAMPLES:
    $0 staging latest
    $0 production v1.2.3
    $0 production --rollback v1.2.2
    $0 staging main-abc1234-20240828-1430 --dry-run

EOF
}

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        INFO)  echo -e "${BLUE}[INFO]${NC} $message" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $message" ;;
        SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
        HEADER) echo -e "${CYAN}$message${NC}" ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$DEPLOYMENT_LOG"
}

# Pre-flight checks
preflight_checks() {
    log HEADER "🔍 Running pre-flight checks..."
    
    # Check if running as appropriate user
    if [[ "$ENVIRONMENT" == "production" ]] && [[ "$EUID" -eq 0 ]]; then
        log ERROR "Production deployments should not run as root for security"
        exit 1
    fi
    
    # Check required tools
    local missing_tools=()
    for tool in docker docker-compose curl jq; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log ERROR "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        log ERROR "Docker daemon not accessible"
        exit 1
    fi
    
    # Check environment configuration
    local env_file=".env.${ENVIRONMENT}"
    if [[ ! -f "$env_file" ]]; then
        log ERROR "Environment file not found: $env_file"
        exit 1
    fi
    
    # Check deployment key permissions
    if [[ -f "$HOME/.ssh/grahmos_deploy_key" ]]; then
        local key_perms=$(stat -c %a "$HOME/.ssh/grahmos_deploy_key" 2>/dev/null || echo "000")
        if [[ "$key_perms" != "600" ]]; then
            log WARN "Deployment key permissions should be 600"
            chmod 600 "$HOME/.ssh/grahmos_deploy_key"
        fi
    fi
    
    log SUCCESS "Pre-flight checks completed"
}

# Create deployment backup
create_backup() {
    if [[ "$SKIP_BACKUP" == true ]]; then
        log INFO "Skipping backup as requested"
        return 0
    fi
    
    log HEADER "💾 Creating pre-deployment backup..."
    
    local backup_name="grahmos-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    
    mkdir -p "$backup_path"
    
    # Backup current configuration
    cp -r ".env.${ENVIRONMENT}" "$backup_path/"
    cp -r "docker-compose.prod.yml" "$backup_path/"
    cp -r "infra/" "$backup_path/"
    
    # Backup current image tags
    docker images --format "table {{.Repository}}:{{.Tag}}" | grep grahmos > "$backup_path/current_images.txt" || true
    
    # Backup data volumes
    log INFO "Backing up data volumes..."
    if docker volume ls -q | grep -q grahmos-data; then
        docker run --rm \
            -v grahmos-data:/source:ro \
            -v "$backup_path":/backup \
            alpine:latest \
            tar czf /backup/grahmos-data.tar.gz -C /source .
    fi
    
    if docker volume ls -q | grep -q meilisearch-data; then
        docker run --rm \
            -v meilisearch-data:/source:ro \
            -v "$backup_path":/backup \
            alpine:latest \
            tar czf /backup/meilisearch-data.tar.gz -C /source .
    fi
    
    # Store backup metadata
    cat > "$backup_path/backup_info.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "environment": "$ENVIRONMENT",
    "deployment_id": "$DEPLOYMENT_ID",
    "previous_version": "$(docker ps --format '{{.Image}}' | grep grahmos | head -1 || echo 'unknown')",
    "backup_type": "pre-deployment"
}
EOF
    
    # Update latest backup symlink
    ln -sfn "$backup_path" "${BACKUP_DIR}/latest-${ENVIRONMENT}"
    
    log SUCCESS "Backup created: $backup_path"
    echo "$backup_path" > "/tmp/grahmos_last_backup_${ENVIRONMENT}"
}

# Health check function
health_check() {
    local url="$1"
    local timeout="${2:-30}"
    local retries="${3:-10}"
    
    log INFO "Performing health check: $url"
    
    for ((i=1; i<=retries; i++)); do
        if curl -k -s --max-time "$timeout" "$url/health" | grep -q "healthy"; then
            log SUCCESS "Health check passed (attempt $i/$retries)"
            return 0
        else
            log WARN "Health check failed (attempt $i/$retries)"
            if [[ $i -lt $retries ]]; then
                sleep 5
            fi
        fi
    done
    
    log ERROR "Health check failed after $retries attempts"
    return 1
}

# Deploy function
deploy() {
    log HEADER "🚀 Starting deployment to $ENVIRONMENT..."
    
    # Set environment-specific variables
    export COMPOSE_FILE="docker-compose.prod.yml"
    export COMPOSE_PROJECT_NAME="grahmos-${ENVIRONMENT}"
    
    # Load environment configuration
    set -a
    source ".env.${ENVIRONMENT}"
    set +a
    
    # Override image tag if specified
    if [[ -n "$IMAGE_TAG" ]]; then
        export EDGE_API_IMAGE_TAG="$IMAGE_TAG"
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log INFO "DRY RUN: Would deploy with the following configuration:"
        docker-compose config
        return 0
    fi
    
    # Pull latest images
    log INFO "Pulling container images..."
    docker-compose pull
    
    # Perform rolling update
    log INFO "Performing rolling update..."
    
    # Update services one by one for zero-downtime deployment
    local services=("edge-api" "nginx-proxy" "meilisearch" "redis-cache")
    
    for service in "${services[@]}"; do
        log INFO "Updating service: $service"
        
        # Scale up new instance
        docker-compose up -d --no-deps --scale "$service=2" "$service"
        
        # Wait for new instance to be healthy
        sleep 10
        
        # Remove old instance
        docker-compose up -d --no-deps --scale "$service=1" "$service"
        
        # Verify service is still healthy
        sleep 5
        if ! health_check "https://localhost:8443"; then
            if [[ "$FORCE_DEPLOY" != true ]]; then
                log ERROR "Health check failed after updating $service"
                rollback_deployment
                exit 1
            else
                log WARN "Health check failed but continuing due to --force flag"
            fi
        fi
    done
    
    # Start monitoring services
    log INFO "Starting monitoring stack..."
    docker-compose up -d prometheus grafana fluent-bit
    
    # Wait for all services to be ready
    sleep 30
    
    # Final health checks
    log INFO "Running final health checks..."
    if health_check "https://localhost:8443"; then
        log SUCCESS "Deployment completed successfully!"
    else
        log ERROR "Final health check failed"
        if [[ "$FORCE_DEPLOY" != true ]]; then
            rollback_deployment
            exit 1
        fi
    fi
    
    # Update deployment tracking
    update_deployment_tracking
    
    # Send deployment notification
    send_deployment_notification "success"
}

# Rollback function
rollback_deployment() {
    if [[ -n "$ROLLBACK_VERSION" ]]; then
        log HEADER "⏪ Rolling back to version: $ROLLBACK_VERSION"
        IMAGE_TAG="$ROLLBACK_VERSION"
    else
        log HEADER "⏪ Rolling back to previous version..."
        
        # Find last backup
        local last_backup
        if [[ -f "/tmp/grahmos_last_backup_${ENVIRONMENT}" ]]; then
            last_backup=$(cat "/tmp/grahmos_last_backup_${ENVIRONMENT}")
        else
            last_backup="${BACKUP_DIR}/latest-${ENVIRONMENT}"
        fi
        
        if [[ ! -d "$last_backup" ]]; then
            log ERROR "No backup found for rollback"
            return 1
        fi
        
        log INFO "Using backup: $last_backup"
        
        # Restore configuration
        cp "$last_backup/.env.${ENVIRONMENT}" "./"
        
        # Get previous image version
        if [[ -f "$last_backup/backup_info.json" ]]; then
            local previous_version
            previous_version=$(jq -r '.previous_version' "$last_backup/backup_info.json")
            if [[ "$previous_version" != "unknown" ]] && [[ "$previous_version" != "null" ]]; then
                IMAGE_TAG=$(echo "$previous_version" | cut -d: -f2)
            fi
        fi
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log INFO "DRY RUN: Would rollback to image tag: $IMAGE_TAG"
        return 0
    fi
    
    # Stop current services
    docker-compose down --remove-orphans
    
    # Deploy previous version
    export EDGE_API_IMAGE_TAG="$IMAGE_TAG"
    docker-compose up -d
    
    # Wait and verify
    sleep 30
    if health_check "https://localhost:8443"; then
        log SUCCESS "Rollback completed successfully!"
        send_deployment_notification "rollback"
    else
        log ERROR "Rollback failed - manual intervention required!"
        send_deployment_notification "rollback_failed"
        exit 1
    fi
}

# Update deployment tracking
update_deployment_tracking() {
    local deployment_file="/var/lib/grahmos/deployments.json"
    local deployment_info
    
    deployment_info=$(cat << EOF
{
    "deployment_id": "$DEPLOYMENT_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "environment": "$ENVIRONMENT",
    "image_tag": "$IMAGE_TAG",
    "deployed_by": "$(whoami)",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
    "status": "success"
}
EOF
    )
    
    mkdir -p "$(dirname "$deployment_file")"
    
    # Add to deployments history
    if [[ -f "$deployment_file" ]]; then
        jq --argjson new_deployment "$deployment_info" '. + [$new_deployment]' "$deployment_file" > "${deployment_file}.tmp"
        mv "${deployment_file}.tmp" "$deployment_file"
    else
        echo "[$deployment_info]" > "$deployment_file"
    fi
    
    log INFO "Deployment tracking updated: $deployment_file"
}

# Send deployment notification
send_deployment_notification() {
    local status="$1"
    
    # Slack notification (if configured)
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        local color="good"
        local icon=":rocket:"
        local title="Deployment Successful"
        
        case "$status" in
            success)
                color="good"
                icon=":rocket:"
                title="Deployment Successful"
                ;;
            rollback)
                color="warning"
                icon=":arrows_counterclockwise:"
                title="Rollback Successful"
                ;;
            rollback_failed)
                color="danger"
                icon=":rotating_light:"
                title="Rollback Failed"
                ;;
            failed)
                color="danger"
                icon=":x:"
                title="Deployment Failed"
                ;;
        esac
        
        local payload=$(cat << EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "$title",
            "fields": [
                {"title": "Environment", "value": "$ENVIRONMENT", "short": true},
                {"title": "Image Tag", "value": "$IMAGE_TAG", "short": true},
                {"title": "Deployment ID", "value": "$DEPLOYMENT_ID", "short": true},
                {"title": "Deployed By", "value": "$(whoami)", "short": true}
            ],
            "footer": "Grahmos V1+V2 Unified",
            "ts": $(date +%s)
        }
    ]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$payload" \
            "$SLACK_WEBHOOK" > /dev/null 2>&1 || true
    fi
    
    # Discord notification (if configured)
    if [[ -n "${DISCORD_WEBHOOK:-}" ]]; then
        local embed_color
        case "$status" in
            success) embed_color=3066993 ;;      # Green
            rollback) embed_color=16776960 ;;    # Yellow  
            *) embed_color=15158332 ;;           # Red
        esac
        
        local discord_payload=$(cat << EOF
{
    "embeds": [
        {
            "title": "$title - $ENVIRONMENT",
            "color": $embed_color,
            "fields": [
                {"name": "Image Tag", "value": "$IMAGE_TAG", "inline": true},
                {"name": "Deployment ID", "value": "$DEPLOYMENT_ID", "inline": true},
                {"name": "Deployed By", "value": "$(whoami)", "inline": true}
            ],
            "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
        }
    ]
}
EOF
        )
        
        curl -X POST -H 'Content-Type: application/json' \
            --data "$discord_payload" \
            "$DISCORD_WEBHOOK" > /dev/null 2>&1 || true
    fi
}

# Cleanup function
cleanup() {
    if [[ -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}

# Signal handlers
trap cleanup EXIT
trap 'log ERROR "Deployment interrupted"; send_deployment_notification "failed"; exit 130' INT TERM

# Main function
main() {
    # Generate deployment ID
    DEPLOYMENT_ID="deploy-$(date +%Y%m%d-%H%M%S)-$(uuidgen | cut -d- -f1)"
    
    # Create log directory
    mkdir -p "$(dirname "$DEPLOYMENT_LOG")"
    
    log HEADER "🚀 Grahmos V1+V2 Unified - Deployment Script"
    log INFO "Deployment ID: $DEPLOYMENT_ID"
    log INFO "Logging to: $DEPLOYMENT_LOG"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE_DEPLOY=true
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --rollback)
                ROLLBACK_VERSION="$2"
                shift 2
                ;;
            --help)
                usage
                exit 0
                ;;
            -*)
                log ERROR "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                if [[ -z "$ENVIRONMENT" ]]; then
                    ENVIRONMENT="$1"
                elif [[ -z "$IMAGE_TAG" ]]; then
                    IMAGE_TAG="$1"
                else
                    log ERROR "Too many arguments"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Validate arguments
    if [[ -z "$ENVIRONMENT" ]]; then
        log ERROR "Environment argument is required"
        usage
        exit 1
    fi
    
    if [[ "$ENVIRONMENT" != "staging" ]] && [[ "$ENVIRONMENT" != "production" ]]; then
        log ERROR "Environment must be 'staging' or 'production'"
        exit 1
    fi
    
    if [[ -n "$ROLLBACK_VERSION" ]]; then
        log INFO "Rollback mode: Rolling back to version $ROLLBACK_VERSION"
        rollback_deployment
    else
        if [[ -z "$IMAGE_TAG" ]]; then
            log ERROR "Image tag argument is required for deployment"
            usage
            exit 1
        fi
        
        # Run deployment process
        preflight_checks
        create_backup
        deploy
    fi
    
    log SUCCESS "Deployment process completed successfully!"
}

# Run main function
main "$@"
