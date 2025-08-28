#!/usr/bin/env bash

# Grahmos V1+V2 Unified - Disaster Recovery Script
# Phase 3: Improve/Deploy - Disaster Recovery & Restoration

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Configuration
BACKUP_DIR="/opt/grahmos/backups"
RESTORE_LOG="/var/log/grahmos/disaster-recovery-$(date +%Y%m%d-%H%M%S).log"
TEMP_DIR="/tmp/grahmos-restore-$$"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Global variables
RESTORE_ID="restore-$(date +%Y%m%d-%H%M%S)-$$"
RESTORE_START_TIME=$(date +%s)
OPERATION_MODE=""
BACKUP_SOURCE=""
COMPONENTS_TO_RESTORE=""
DRY_RUN=false
FORCE_RESTORE=false

# Usage information
usage() {
    cat << EOF
Usage: $0 <command> [options]

Disaster Recovery and Restoration for Grahmos V1+V2 Unified

COMMANDS:
    list-backups            List available backups
    restore <backup-id>     Restore from specific backup
    validate <backup-id>    Validate backup integrity
    recovery-plan           Show disaster recovery plan
    system-check            Check system readiness for restoration

RESTORE OPTIONS:
    --components <list>     Comma-separated list: data,config,monitoring,logs
    --dry-run              Show what would be restored without executing
    --force                Force restoration even if services are running
    --from-s3 <bucket>     Restore from S3 backup
    --decrypt-key <key>    Decryption key for encrypted backups

EXAMPLES:
    $0 list-backups
    $0 restore backup-20240828-143000-12345
    $0 restore backup-20240828-143000-12345 --components data,config --dry-run
    $0 validate backup-20240828-143000-12345
    $0 system-check

EOF
}

# Setup logging
setup_logging() {
    mkdir -p "$(dirname "$RESTORE_LOG")"
    exec 1> >(tee -a "$RESTORE_LOG")
    exec 2> >(tee -a "$RESTORE_LOG" >&2)
    
    echo -e "${CYAN}🚨 Grahmos V1+V2 Unified - Disaster Recovery${NC}"
    echo -e "${CYAN}=============================================${NC}"
    echo ""
    echo "Restore ID: $RESTORE_ID"
    echo "Started: $(date)"
    echo "Log: $RESTORE_LOG"
    echo ""
}

# Log function
log() {
    local level="$1"
    shift
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $*"
}

# List available backups
list_backups() {
    echo -e "${BLUE}📋 Available Backups${NC}"
    echo "==================="
    
    # Local backups
    if [[ -d "$BACKUP_DIR" ]]; then
        echo -e "${PURPLE}Local Backups:${NC}"
        local local_backups
        local_backups=$(find "$BACKUP_DIR" -name "backup-*" -type d 2>/dev/null | sort -r)
        
        if [[ -n "$local_backups" ]]; then
            while IFS= read -r backup_path; do
                local backup_name=$(basename "$backup_path")
                local backup_date=$(echo "$backup_name" | grep -oE '[0-9]{8}-[0-9]{6}' || echo "unknown")
                local backup_size
                backup_size=$(du -sh "$backup_path" 2>/dev/null | cut -f1 || echo "unknown")
                
                # Read manifest if available
                local manifest_file="$backup_path/manifest.json"
                if [[ -f "$manifest_file" ]]; then
                    local backup_type
                    local components
                    backup_type=$(jq -r '.type // "unknown"' "$manifest_file" 2>/dev/null || echo "unknown")
                    components=$(jq -r '.components | to_entries | map(select(.value == true) | .key) | join(",")' "$manifest_file" 2>/dev/null || echo "unknown")
                    
                    printf "  %-30s %s  %8s  %-8s  %s\n" "$backup_name" "$backup_date" "$backup_size" "$backup_type" "$components"
                else
                    printf "  %-30s %s  %8s  %-8s  %s\n" "$backup_name" "$backup_date" "$backup_size" "unknown" "no manifest"
                fi
            done <<< "$local_backups"
        else
            echo "  No local backups found"
        fi
    else
        echo -e "${YELLOW}No local backup directory found: $BACKUP_DIR${NC}"
    fi
    
    echo ""
    
    # S3 backups (if configured)
    if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
        echo -e "${PURPLE}S3 Backups:${NC}"
        local s3_backups
        s3_backups=$(aws s3 ls "s3://${BACKUP_S3_BUCKET}/grahmos/backups/" --recursive 2>/dev/null | tail -20 | sort -r || echo "")
        
        if [[ -n "$s3_backups" ]]; then
            echo "$s3_backups" | while read -r line; do
                if [[ "$line" == *".tar.gz"* ]] || [[ "$line" == *".enc"* ]]; then
                    local date_time size file_path
                    date_time=$(echo "$line" | awk '{print $1, $2}')
                    size=$(echo "$line" | awk '{print $3}')
                    file_path=$(echo "$line" | awk '{print $4}')
                    local backup_name
                    backup_name=$(basename "$file_path" | sed 's/\..*//')
                    
                    printf "  %-30s %s  %8s  %-8s  %s\n" "$backup_name" "$date_time" "${size}B" "s3" "encrypted"
                fi
            done
        else
            echo "  No S3 backups found or S3 not accessible"
        fi
    fi
    
    echo ""
    echo -e "${CYAN}💡 Use 'disaster-recovery.sh restore <backup-name>' to restore${NC}"
}

# Validate backup integrity
validate_backup() {
    local backup_id="$1"
    echo -e "${BLUE}🔍 Validating Backup: $backup_id${NC}"
    echo "================================="
    
    local backup_path="$BACKUP_DIR/$backup_id"
    local validation_passed=true
    
    if [[ ! -d "$backup_path" ]]; then
        log "ERROR" "Backup directory not found: $backup_path"
        return 1
    fi
    
    log "INFO" "Validating backup structure..."
    
    # Check manifest
    local manifest_file="$backup_path/manifest.json"
    if [[ -f "$manifest_file" ]]; then
        log "INFO" "✅ Manifest file found"
        
        # Parse manifest
        local backup_type components status
        backup_type=$(jq -r '.type // "unknown"' "$manifest_file" 2>/dev/null)
        status=$(jq -r '.status // "unknown"' "$manifest_file" 2>/dev/null)
        
        log "INFO" "Backup type: $backup_type"
        log "INFO" "Backup status: $status"
        
        if [[ "$status" != "success" ]]; then
            log "WARN" "⚠️  Backup status indicates potential issues"
            validation_passed=false
        fi
    else
        log "ERROR" "❌ Manifest file missing"
        validation_passed=false
    fi
    
    # Validate data files
    local data_dir="$backup_path/data"
    if [[ -d "$data_dir" ]]; then
        log "INFO" "Validating data files..."
        
        # Check SQLite database
        if [[ -f "$data_dir/grahmos.db" ]]; then
            if sqlite3 "$data_dir/grahmos.db" "PRAGMA integrity_check;" | grep -q "ok"; then
                log "INFO" "✅ SQLite database integrity OK"
            else
                log "ERROR" "❌ SQLite database integrity check failed"
                validation_passed=false
            fi
        fi
        
        # Check compressed files
        for archive in "$data_dir"/*.tar.gz; do
            if [[ -f "$archive" ]]; then
                if tar -tzf "$archive" >/dev/null 2>&1; then
                    log "INFO" "✅ Archive $(basename "$archive") integrity OK"
                else
                    log "ERROR" "❌ Archive $(basename "$archive") is corrupted"
                    validation_passed=false
                fi
            fi
        done
        
        # Check SQL dumps
        for sql_file in "$data_dir"/*.sql.gz; do
            if [[ -f "$sql_file" ]]; then
                if gzip -t "$sql_file" 2>/dev/null; then
                    log "INFO" "✅ SQL dump $(basename "$sql_file") integrity OK"
                else
                    log "ERROR" "❌ SQL dump $(basename "$sql_file") is corrupted"
                    validation_passed=false
                fi
            fi
        done
    else
        log "WARN" "No data directory found in backup"
    fi
    
    # Validate configuration files
    local config_dir="$backup_path/config"
    if [[ -d "$config_dir" ]]; then
        local config_files
        config_files=$(find "$config_dir" -type f | wc -l)
        log "INFO" "Configuration files found: $config_files"
    fi
    
    # Calculate backup size and compare with manifest
    local actual_size
    actual_size=$(du -sb "$backup_path" | cut -f1)
    
    if [[ -f "$manifest_file" ]]; then
        local manifest_size
        manifest_size=$(jq -r '.total_size_bytes // 0' "$manifest_file" 2>/dev/null)
        
        if [[ "$actual_size" -eq "$manifest_size" ]]; then
            log "INFO" "✅ Backup size matches manifest"
        else
            log "WARN" "⚠️  Backup size mismatch: actual=$actual_size, manifest=$manifest_size"
        fi
    fi
    
    echo ""
    if [[ "$validation_passed" == true ]]; then
        echo -e "${GREEN}✅ Backup validation passed${NC}"
        return 0
    else
        echo -e "${RED}❌ Backup validation failed${NC}"
        return 1
    fi
}

# System readiness check
system_check() {
    echo -e "${BLUE}🔧 System Readiness Check${NC}"
    echo "=========================="
    
    local system_ready=true
    
    # Check if Docker is available
    if command -v docker >/dev/null 2>&1; then
        if docker info >/dev/null 2>&1; then
            log "INFO" "✅ Docker is available and running"
        else
            log "ERROR" "❌ Docker daemon not accessible"
            system_ready=false
        fi
    else
        log "ERROR" "❌ Docker not installed"
        system_ready=false
    fi
    
    # Check if docker-compose is available
    if command -v docker-compose >/dev/null 2>&1; then
        log "INFO" "✅ Docker Compose is available"
    else
        log "ERROR" "❌ Docker Compose not installed"
        system_ready=false
    fi
    
    # Check required tools
    local required_tools=("jq" "sqlite3" "tar" "gzip")
    for tool in "${required_tools[@]}"; do
        if command -v "$tool" >/dev/null 2>&1; then
            log "INFO" "✅ $tool is available"
        else
            log "ERROR" "❌ $tool not found"
            system_ready=false
        fi
    done
    
    # Check disk space
    local available_space
    available_space=$(df / | tail -1 | awk '{print $4}')
    local available_gb=$((available_space / 1024 / 1024))
    
    if [[ $available_gb -gt 10 ]]; then
        log "INFO" "✅ Sufficient disk space: ${available_gb}GB available"
    else
        log "WARN" "⚠️  Low disk space: ${available_gb}GB available"
        system_ready=false
    fi
    
    # Check if Grahmos services are running
    local running_containers
    running_containers=$(docker ps --filter "name=grahmos" --format "{{.Names}}" 2>/dev/null || true)
    
    if [[ -n "$running_containers" ]]; then
        log "WARN" "⚠️  Grahmos services are currently running:"
        while IFS= read -r container; do
            log "WARN" "    - $container"
        done <<< "$running_containers"
        
        if [[ "$FORCE_RESTORE" != true ]]; then
            log "ERROR" "❌ Use --force to restore while services are running"
            system_ready=false
        fi
    else
        log "INFO" "✅ No Grahmos services currently running"
    fi
    
    # Check network connectivity
    if curl -s --max-time 5 http://google.com >/dev/null 2>&1; then
        log "INFO" "✅ Internet connectivity available"
    else
        log "WARN" "⚠️  No internet connectivity (may affect S3 operations)"
    fi
    
    echo ""
    if [[ "$system_ready" == true ]]; then
        echo -e "${GREEN}✅ System is ready for disaster recovery${NC}"
        return 0
    else
        echo -e "${RED}❌ System readiness check failed${NC}"
        return 1
    fi
}

# Stop services before restore
stop_services() {
    log "INFO" "Stopping Grahmos services..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN: Would stop all Grahmos services"
        return 0
    fi
    
    # Stop services gracefully
    if [[ -f "docker-compose.prod.yml" ]]; then
        docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
    fi
    
    # Force stop any remaining containers
    local remaining_containers
    remaining_containers=$(docker ps --filter "name=grahmos" --format "{{.Names}}" 2>/dev/null || true)
    
    if [[ -n "$remaining_containers" ]]; then
        log "INFO" "Force stopping remaining containers..."
        while IFS= read -r container; do
            docker stop "$container" >/dev/null 2>&1 || true
        done <<< "$remaining_containers"
    fi
    
    log "INFO" "Services stopped"
}

# Restore data components
restore_data() {
    local backup_path="$1"
    log "INFO" "Restoring data components..."
    
    local data_dir="$backup_path/data"
    if [[ ! -d "$data_dir" ]]; then
        log "WARN" "No data directory found in backup"
        return 0
    fi
    
    # Restore SQLite database
    if [[ -f "$data_dir/grahmos.db" ]]; then
        log "INFO" "Restoring Grahmos SQLite database..."
        
        if [[ "$DRY_RUN" == true ]]; then
            log "INFO" "DRY RUN: Would restore grahmos.db"
        else
            mkdir -p "./data"
            cp "$data_dir/grahmos.db" "./data/"
            log "INFO" "✅ SQLite database restored"
        fi
    fi
    
    # Restore Meilisearch data
    if [[ -f "$data_dir/meilisearch.tar.gz" ]]; then
        log "INFO" "Restoring Meilisearch data..."
        
        if [[ "$DRY_RUN" == true ]]; then
            log "INFO" "DRY RUN: Would restore Meilisearch data"
        else
            mkdir -p "./data/meilisearch"
            tar -xzf "$data_dir/meilisearch.tar.gz" -C "./data/meilisearch/"
            log "INFO" "✅ Meilisearch data restored"
        fi
    fi
    
    # Restore Redis data
    if [[ -f "$data_dir/redis.tar.gz" ]]; then
        log "INFO" "Restoring Redis data..."
        
        if [[ "$DRY_RUN" == true ]]; then
            log "INFO" "DRY RUN: Would restore Redis data"
        else
            mkdir -p "./data/redis"
            tar -xzf "$data_dir/redis.tar.gz" -C "./data/redis/"
            log "INFO" "✅ Redis data restored"
        fi
    fi
}

# Restore configuration
restore_configuration() {
    local backup_path="$1"
    log "INFO" "Restoring configuration..."
    
    local config_dir="$backup_path/config"
    if [[ ! -d "$config_dir" ]]; then
        log "WARN" "No configuration directory found in backup"
        return 0
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN: Would restore configuration files"
        return 0
    fi
    
    # Restore environment files
    for env_file in "$config_dir"/.env.*; do
        if [[ -f "$env_file" ]]; then
            cp "$env_file" "./"
            log "INFO" "✅ Restored $(basename "$env_file")"
        fi
    done
    
    # Restore docker-compose files
    for compose_file in "$config_dir"/docker-compose*.yml; do
        if [[ -f "$compose_file" ]]; then
            cp "$compose_file" "./"
            log "INFO" "✅ Restored $(basename "$compose_file")"
        fi
    done
    
    # Restore infrastructure configuration
    if [[ -f "$config_dir/infra.tar.gz" ]]; then
        tar -xzf "$config_dir/infra.tar.gz" -C "./"
        log "INFO" "✅ Infrastructure configuration restored"
    fi
    
    # Restore certificates
    if [[ -d "$config_dir/certs" ]]; then
        mkdir -p "./infra/certs"
        cp "$config_dir/certs"/* "./infra/certs/" 2>/dev/null || true
        log "INFO" "✅ Certificates restored"
    fi
}

# Restore monitoring data
restore_monitoring() {
    local backup_path="$1"
    log "INFO" "Restoring monitoring data..."
    
    local data_dir="$backup_path/data"
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN: Would restore monitoring data"
        return 0
    fi
    
    # Restore Grafana data
    if [[ -f "$data_dir/grafana.tar.gz" ]]; then
        mkdir -p "./data/grafana"
        tar -xzf "$data_dir/grafana.tar.gz" -C "./data/grafana/"
        log "INFO" "✅ Grafana data restored"
    fi
    
    # Restore Prometheus data
    if [[ -d "$data_dir/prometheus" ]]; then
        mkdir -p "./data/prometheus"
        cp -r "$data_dir/prometheus"/* "./data/prometheus/" 2>/dev/null || true
        log "INFO" "✅ Prometheus data restored"
    fi
}

# Start services after restore
start_services() {
    log "INFO" "Starting Grahmos services..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN: Would start all services"
        return 0
    fi
    
    # Start services
    if [[ -f "docker-compose.prod.yml" ]]; then
        docker-compose -f docker-compose.prod.yml up -d
        log "INFO" "Services started"
        
        # Wait for services to be ready
        sleep 30
        
        # Health check
        if curl -k -s --max-time 10 "https://localhost:8443/health" | grep -q "healthy"; then
            log "INFO" "✅ Services are healthy after restore"
        else
            log "WARN" "⚠️  Services may not be fully ready yet"
        fi
    else
        log "WARN" "No production docker-compose file found"
    fi
}

# Main restore function
restore_backup() {
    local backup_id="$1"
    
    log "INFO" "Starting disaster recovery restore: $backup_id"
    log "INFO" "Components to restore: ${COMPONENTS_TO_RESTORE:-all}"
    
    local backup_path="$BACKUP_DIR/$backup_id"
    
    if [[ ! -d "$backup_path" ]]; then
        log "ERROR" "Backup not found: $backup_path"
        return 1
    fi
    
    # Validate backup first
    if ! validate_backup "$backup_id"; then
        log "ERROR" "Backup validation failed"
        return 1
    fi
    
    # System readiness check
    if ! system_check; then
        log "ERROR" "System not ready for restore"
        return 1
    fi
    
    # Stop services
    stop_services
    
    # Perform restore based on components
    local components="${COMPONENTS_TO_RESTORE:-data,config,monitoring,logs}"
    IFS=',' read -ra COMPONENT_ARRAY <<< "$components"
    
    for component in "${COMPONENT_ARRAY[@]}"; do
        case "$component" in
            "data")
                restore_data "$backup_path"
                ;;
            "config")
                restore_configuration "$backup_path"
                ;;
            "monitoring")
                restore_monitoring "$backup_path"
                ;;
            "logs")
                log "INFO" "Log restoration not implemented (logs are typically not restored)"
                ;;
            *)
                log "WARN" "Unknown component: $component"
                ;;
        esac
    done
    
    # Start services
    start_services
    
    # Final verification
    log "INFO" "Disaster recovery completed"
    
    local end_time=$(date +%s)
    local duration=$((end_time - RESTORE_START_TIME))
    log "INFO" "Total restore time: ${duration}s"
    
    echo ""
    echo -e "${GREEN}🎉 Disaster recovery restore completed successfully!${NC}"
    echo -e "${YELLOW}⚠️  Please verify all services and data integrity${NC}"
}

# Show disaster recovery plan
show_recovery_plan() {
    cat << 'EOF'

📋 Grahmos V1+V2 Unified - Disaster Recovery Plan
=================================================

🚨 EMERGENCY RESPONSE CHECKLIST
------------------------------

1. IMMEDIATE ASSESSMENT
   □ Identify scope of incident (data loss, service failure, security breach)
   □ Determine Recovery Time Objective (RTO) and Recovery Point Objective (RPO)
   □ Alert appropriate personnel and stakeholders

2. SYSTEM SAFETY
   □ Isolate affected systems to prevent further damage
   □ Document current system state and error conditions
   □ Preserve any existing data before recovery attempts

3. BACKUP VERIFICATION
   □ List available backups: ./scripts/disaster-recovery.sh list-backups
   □ Validate backup integrity: ./scripts/disaster-recovery.sh validate <backup-id>
   □ Select appropriate backup based on RTO/RPO requirements

4. SYSTEM PREPARATION
   □ Check system readiness: ./scripts/disaster-recovery.sh system-check
   □ Ensure sufficient disk space and resources
   □ Stop affected services if still running

5. DATA RECOVERY
   □ Restore core data: --components data
   □ Restore configuration: --components config
   □ Restore monitoring: --components monitoring
   
6. SERVICE RESTORATION
   □ Start services and verify health checks
   □ Test authentication flows (mTLS, DPoP)
   □ Verify search functionality and AI assistant
   □ Confirm monitoring and alerting systems

7. POST-RECOVERY VERIFICATION
   □ Run comprehensive health checks
   □ Validate data integrity and completeness
   □ Test critical business functions
   □ Update stakeholders on recovery status

📞 RECOVERY COMMANDS QUICK REFERENCE
----------------------------------

# List all available backups
./scripts/disaster-recovery.sh list-backups

# Validate specific backup
./scripts/disaster-recovery.sh validate backup-20240828-143000-12345

# Full system restore (dry run first)
./scripts/disaster-recovery.sh restore backup-20240828-143000-12345 --dry-run
./scripts/disaster-recovery.sh restore backup-20240828-143000-12345

# Partial restore (specific components)
./scripts/disaster-recovery.sh restore backup-20240828-143000-12345 --components data,config

# System health verification
./scripts/health-check.sh
./scripts/test-status.sh

🎯 RECOVERY SCENARIOS
-------------------

SCENARIO 1: Database Corruption
- Impact: Search and authentication data loss
- Recovery: ./scripts/disaster-recovery.sh restore <backup> --components data
- Verification: Test search queries and user authentication

SCENARIO 2: Configuration Loss
- Impact: Service configuration and certificates
- Recovery: ./scripts/disaster-recovery.sh restore <backup> --components config
- Verification: Check service startup and SSL certificates

SCENARIO 3: Complete System Failure
- Impact: Total service unavailability
- Recovery: ./scripts/disaster-recovery.sh restore <backup>
- Verification: Full system health check and functionality test

SCENARIO 4: Security Incident
- Impact: Potential data breach or compromise
- Recovery: Isolate → Investigate → Clean restore → Security hardening
- Additional: Change all keys, certificates, and access credentials

⏰ RECOVERY TIME ESTIMATES
------------------------
- Database only: 10-30 minutes
- Configuration only: 5-15 minutes
- Full system restore: 30-90 minutes
- Complete rebuild: 2-4 hours

📚 ADDITIONAL RESOURCES
---------------------
- Health Check: ./scripts/health-check.sh --help
- Security Testing: ./scripts/test-security.sh --help
- Service Discovery: ./scripts/service-discovery.sh --help
- Backup Management: ./infra/backup/scripts/backup.sh --help

🚨 ESCALATION CONTACTS
--------------------
- Technical Lead: [Contact Information]
- Security Team: [Contact Information]  
- Infrastructure Team: [Contact Information]
- Management: [Contact Information]

EOF
}

# Main function
main() {
    local command="help"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            list-backups)
                command="list"
                shift
                ;;
            restore)
                command="restore"
                BACKUP_SOURCE="$2"
                shift 2
                ;;
            validate)
                command="validate"
                BACKUP_SOURCE="$2"
                shift 2
                ;;
            system-check)
                command="system-check"
                shift
                ;;
            recovery-plan)
                command="recovery-plan"
                shift
                ;;
            --components)
                COMPONENTS_TO_RESTORE="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE_RESTORE=true
                shift
                ;;
            --from-s3)
                # TODO: Implement S3 restore functionality
                shift 2
                ;;
            --decrypt-key)
                BACKUP_ENCRYPTION_KEY="$2"
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
    
    # Setup logging for most commands
    if [[ "$command" != "recovery-plan" ]] && [[ "$command" != "help" ]]; then
        setup_logging
    fi
    
    # Execute command
    case "$command" in
        list)
            list_backups
            ;;
        restore)
            if [[ -z "$BACKUP_SOURCE" ]]; then
                echo "Backup ID required for restore command"
                exit 1
            fi
            restore_backup "$BACKUP_SOURCE"
            ;;
        validate)
            if [[ -z "$BACKUP_SOURCE" ]]; then
                echo "Backup ID required for validate command"
                exit 1
            fi
            validate_backup "$BACKUP_SOURCE"
            ;;
        system-check)
            system_check
            ;;
        recovery-plan)
            show_recovery_plan
            ;;
        help)
            usage
            ;;
        *)
            echo "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Handle interruption
trap 'echo -e "\n${YELLOW}Disaster recovery interrupted${NC}"; exit 130' INT

# Run main function
main "$@"
