#!/usr/bin/env bash

# Grahmos V1+V2 Unified - Comprehensive Backup Script
# Phase 3: Improve/Deploy - Automated Backup & Disaster Recovery

set -euo pipefail

# Configuration
BACKUP_DIR="/backup/data"
LOG_DIR="/var/log/backup"
LOG_FILE="$LOG_DIR/backup-$(date +%Y%m%d-%H%M%S).log"
CONFIG_FILE="/backup/config/backup.conf"

# Load configuration
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Default configuration values
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
BACKUP_TYPE="${1:-full}"
ENCRYPT_BACKUPS="${ENCRYPT_BACKUPS:-true}"
COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-6}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Global variables
BACKUP_ID="backup-$(date +%Y%m%d-%H%M%S)-$$"
BACKUP_START_TIME=$(date +%s)
BACKUP_SUCCESS=true
BACKUP_MANIFEST="/tmp/backup-manifest-$$.json"

# Setup logging
setup_logging() {
    mkdir -p "$LOG_DIR"
    exec 1> >(tee -a "$LOG_FILE")
    exec 2> >(tee -a "$LOG_FILE" >&2)
    
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Starting backup: $BACKUP_ID"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Backup type: $BACKUP_TYPE"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Retention: $RETENTION_DAYS days"
    echo ""
}

# Log function
log() {
    local level="$1"
    shift
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $*"
}

# Error handler
handle_error() {
    local exit_code=$?
    BACKUP_SUCCESS=false
    log "ERROR" "Backup failed with exit code $exit_code"
    cleanup
    exit $exit_code
}

trap handle_error ERR

# Create backup directory structure
setup_backup_structure() {
    local backup_path="$BACKUP_DIR/$BACKUP_ID"
    mkdir -p "$backup_path"/{data,config,logs,metadata}
    echo "$backup_path"
}

# Backup SQLite databases
backup_sqlite() {
    local backup_path="$1"
    log "INFO" "Backing up SQLite databases..."
    
    # Backup main Grahmos database
    if [[ -f "/data/grahmos.db" ]]; then
        log "INFO" "Backing up main Grahmos database"
        sqlite3 /data/grahmos.db ".backup '$backup_path/data/grahmos.db'"
        sqlite3 /data/grahmos.db ".dump" | gzip -${COMPRESSION_LEVEL} > "$backup_path/data/grahmos.sql.gz"
        
        # Get database statistics
        local db_size=$(stat -f%z /data/grahmos.db 2>/dev/null || stat -c%s /data/grahmos.db 2>/dev/null || echo "0")
        local table_count=$(sqlite3 /data/grahmos.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" || echo "0")
        
        echo "{\"size\": $db_size, \"tables\": $table_count, \"backup_time\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"}" > "$backup_path/metadata/grahmos-db.json"
        
        log "INFO" "Grahmos database backup completed (Size: $((db_size / 1024 / 1024))MB, Tables: $table_count)"
    else
        log "WARN" "Grahmos database not found at /data/grahmos.db"
    fi
    
    return 0
}

# Backup Meilisearch data
backup_meilisearch() {
    local backup_path="$1"
    log "INFO" "Backing up Meilisearch data..."
    
    if [[ -d "/meilisearch" ]]; then
        log "INFO" "Creating Meilisearch data archive"
        tar czf "$backup_path/data/meilisearch.tar.gz" -C /meilisearch . 2>/dev/null || {
            log "WARN" "Failed to backup Meilisearch data"
            return 1
        }
        
        # Get statistics via API if available
        local stats_file="$backup_path/metadata/meilisearch-stats.json"
        if curl -s --max-time 10 "http://meilisearch:7700/stats" > "$stats_file" 2>/dev/null; then
            log "INFO" "Meilisearch statistics saved"
        else
            echo '{"error": "Stats not available"}' > "$stats_file"
        fi
        
        local archive_size=$(stat -f%z "$backup_path/data/meilisearch.tar.gz" 2>/dev/null || stat -c%s "$backup_path/data/meilisearch.tar.gz" 2>/dev/null || echo "0")
        log "INFO" "Meilisearch backup completed (Size: $((archive_size / 1024 / 1024))MB)"
    else
        log "WARN" "Meilisearch data directory not found"
    fi
    
    return 0
}

# Backup Redis data
backup_redis() {
    local backup_path="$1"
    log "INFO" "Backing up Redis data..."
    
    # Force Redis to save current state
    if docker exec grahmos-redis redis-cli BGSAVE >/dev/null 2>&1; then
        log "INFO" "Redis background save triggered"
        
        # Wait for background save to complete
        local save_complete=false
        for i in {1..30}; do
            if docker exec grahmos-redis redis-cli INFO persistence | grep -q "rdb_bgsave_in_progress:0"; then
                save_complete=true
                break
            fi
            sleep 1
        done
        
        if [[ "$save_complete" == "true" ]]; then
            log "INFO" "Redis save completed"
        else
            log "WARN" "Redis save may not have completed"
        fi
    else
        log "WARN" "Could not trigger Redis save"
    fi
    
    # Backup Redis data files
    if [[ -d "/redis" ]]; then
        tar czf "$backup_path/data/redis.tar.gz" -C /redis . 2>/dev/null || {
            log "WARN" "Failed to backup Redis data files"
            return 1
        }
        
        # Get Redis info
        local info_file="$backup_path/metadata/redis-info.txt"
        docker exec grahmos-redis redis-cli INFO ALL > "$info_file" 2>/dev/null || {
            echo "Redis info not available" > "$info_file"
        }
        
        local archive_size=$(stat -f%z "$backup_path/data/redis.tar.gz" 2>/dev/null || stat -c%s "$backup_path/data/redis.tar.gz" 2>/dev/null || echo "0")
        log "INFO" "Redis backup completed (Size: $((archive_size / 1024))KB)"
    else
        log "WARN" "Redis data directory not found"
    fi
    
    return 0
}

# Backup configuration files
backup_configuration() {
    local backup_path="$1"
    log "INFO" "Backing up configuration files..."
    
    # Backup environment files
    for env_file in /app/.env.* /app/docker-compose*.yml; do
        if [[ -f "$env_file" ]]; then
            cp "$env_file" "$backup_path/config/" 2>/dev/null || true
        fi
    done
    
    # Backup infrastructure configuration
    if [[ -d "/app/infra" ]]; then
        tar czf "$backup_path/config/infra.tar.gz" -C /app/infra . 2>/dev/null || {
            log "WARN" "Failed to backup infrastructure configuration"
        }
    fi
    
    # Backup certificates (without private keys for security)
    if [[ -d "/certs" ]]; then
        mkdir -p "$backup_path/config/certs"
        find /certs -name "*.crt" -o -name "*.pem" -type f | while read -r cert_file; do
            cp "$cert_file" "$backup_path/config/certs/" 2>/dev/null || true
        done
        
        # Create certificate inventory
        find "$backup_path/config/certs" -name "*.crt" -o -name "*.pem" | while read -r cert_file; do
            local cert_info
            cert_info=$(openssl x509 -in "$cert_file" -noout -subject -dates 2>/dev/null || echo "Certificate info not available")
            echo "$(basename "$cert_file"): $cert_info"
        done > "$backup_path/metadata/certificates.txt"
    fi
    
    log "INFO" "Configuration backup completed"
    return 0
}

# Backup monitoring data
backup_monitoring() {
    local backup_path="$1"
    log "INFO" "Backing up monitoring data..."
    
    # Backup Prometheus data (sample recent data only)
    if [[ -d "/prometheus" ]]; then
        local prometheus_backup="$backup_path/data/prometheus"
        mkdir -p "$prometheus_backup"
        
        # Backup only recent data (last 7 days) to save space
        find /prometheus -name "*.db" -mtime -7 -exec cp {} "$prometheus_backup/" \; 2>/dev/null || true
        
        # Export current metrics
        if curl -s --max-time 30 "http://prometheus:9090/api/v1/label/__name__/values" > "$backup_path/metadata/prometheus-metrics.json" 2>/dev/null; then
            log "INFO" "Prometheus metrics list exported"
        fi
    fi
    
    # Backup Grafana configuration
    if [[ -d "/grafana" ]]; then
        tar czf "$backup_path/data/grafana.tar.gz" -C /grafana . 2>/dev/null || {
            log "WARN" "Failed to backup Grafana data"
        }
    fi
    
    log "INFO" "Monitoring backup completed"
    return 0
}

# Backup application logs
backup_logs() {
    local backup_path="$1"
    log "INFO" "Backing up application logs..."
    
    # Backup recent logs (last 7 days)
    local log_backup="$backup_path/logs"
    mkdir -p "$log_backup"
    
    # Grahmos application logs
    if [[ -d "/var/log/grahmos" ]]; then
        find /var/log/grahmos -name "*.log" -mtime -7 -exec cp {} "$log_backup/" \; 2>/dev/null || true
    fi
    
    # System logs (if accessible)
    if [[ -d "/var/log" ]]; then
        for log_pattern in "nginx/*.log" "docker/*.log"; do
            find /var/log -path "*/$log_pattern" -mtime -7 -exec cp {} "$log_backup/" \; 2>/dev/null || true
        done
    fi
    
    # Compress log files
    if [[ -n "$(ls -A "$log_backup" 2>/dev/null)" ]]; then
        tar czf "$backup_path/logs/application-logs.tar.gz" -C "$log_backup" . 2>/dev/null
        rm -rf "$log_backup"/*.log 2>/dev/null || true
        log "INFO" "Application logs backup completed"
    else
        log "WARN" "No recent logs found to backup"
    fi
    
    return 0
}

# Create backup manifest
create_backup_manifest() {
    local backup_path="$1"
    log "INFO" "Creating backup manifest..."
    
    local end_time=$(date +%s)
    local duration=$((end_time - BACKUP_START_TIME))
    
    # Calculate total backup size
    local total_size
    total_size=$(du -sb "$backup_path" | cut -f1)
    
    # Generate file inventory
    local file_list="$backup_path/metadata/file-inventory.txt"
    find "$backup_path" -type f -exec ls -lh {} \; > "$file_list"
    
    # Create main manifest
    cat > "$BACKUP_MANIFEST" << EOF
{
    "backup_id": "$BACKUP_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "type": "$BACKUP_TYPE",
    "version": "v1+v2-unified",
    "duration_seconds": $duration,
    "total_size_bytes": $total_size,
    "total_size_human": "$(numfmt --to=iec-i --suffix=B $total_size)",
    "retention_days": $RETENTION_DAYS,
    "encryption_enabled": $ENCRYPT_BACKUPS,
    "compression_level": $COMPRESSION_LEVEL,
    "components": {
        "sqlite": $([ -f "$backup_path/data/grahmos.db" ] && echo "true" || echo "false"),
        "meilisearch": $([ -f "$backup_path/data/meilisearch.tar.gz" ] && echo "true" || echo "false"),
        "redis": $([ -f "$backup_path/data/redis.tar.gz" ] && echo "true" || echo "false"),
        "configuration": $([ -d "$backup_path/config" ] && echo "true" || echo "false"),
        "monitoring": $([ -f "$backup_path/data/grafana.tar.gz" ] && echo "true" || echo "false"),
        "logs": $([ -f "$backup_path/logs/application-logs.tar.gz" ] && echo "true" || echo "false")
    },
    "status": "$([ "$BACKUP_SUCCESS" = true ] && echo "success" || echo "failed")"
}
EOF
    
    cp "$BACKUP_MANIFEST" "$backup_path/manifest.json"
    log "INFO" "Backup manifest created"
}

# Encrypt backup
encrypt_backup() {
    local backup_path="$1"
    
    if [[ "$ENCRYPT_BACKUPS" != "true" ]]; then
        log "INFO" "Backup encryption disabled"
        return 0
    fi
    
    if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
        log "WARN" "No encryption key provided, skipping encryption"
        return 0
    fi
    
    log "INFO" "Encrypting backup..."
    
    local encrypted_archive="$backup_path.tar.gz.enc"
    
    # Create encrypted archive
    tar czf - -C "$backup_path" . | \
    openssl enc -aes-256-cbc -salt -k "$BACKUP_ENCRYPTION_KEY" > "$encrypted_archive"
    
    if [[ -f "$encrypted_archive" ]]; then
        # Remove unencrypted backup
        rm -rf "$backup_path"
        
        # Update manifest for encrypted backup
        local encrypted_manifest="$BACKUP_DIR/manifest-$BACKUP_ID.json"
        jq '.encrypted = true | .encrypted_file = "'"$(basename "$encrypted_archive")"'"' "$BACKUP_MANIFEST" > "$encrypted_manifest"
        
        log "INFO" "Backup encrypted successfully"
        echo "$encrypted_archive"
    else
        log "ERROR" "Backup encryption failed"
        return 1
    fi
}

# Upload to cloud storage
upload_to_cloud() {
    local backup_file="$1"
    
    if [[ -z "$S3_BUCKET" ]]; then
        log "INFO" "No S3 bucket configured, skipping cloud upload"
        return 0
    fi
    
    log "INFO" "Uploading backup to S3: s3://$S3_BUCKET"
    
    local s3_key="grahmos/backups/$(date +%Y/%m/%d)/$(basename "$backup_file")"
    
    # Upload with metadata
    aws s3 cp "$backup_file" "s3://$S3_BUCKET/$s3_key" \
        --region "$AWS_REGION" \
        --metadata "backup-id=$BACKUP_ID,backup-type=$BACKUP_TYPE,retention-days=$RETENTION_DAYS" \
        --storage-class STANDARD_IA
    
    if [[ $? -eq 0 ]]; then
        log "INFO" "Backup uploaded successfully to s3://$S3_BUCKET/$s3_key"
        
        # Upload manifest separately
        local manifest_key="grahmos/manifests/$(date +%Y/%m/%d)/manifest-$BACKUP_ID.json"
        aws s3 cp "$BACKUP_MANIFEST" "s3://$S3_BUCKET/$manifest_key" --region "$AWS_REGION"
    else
        log "ERROR" "Failed to upload backup to S3"
        return 1
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "INFO" "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    # Clean local backups
    find "$BACKUP_DIR" -name "backup-*" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.tar.gz*" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "manifest-*.json" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    # Clean S3 backups if configured
    if [[ -n "$S3_BUCKET" ]]; then
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
        
        # List and delete old backups (this is a simplified approach)
        aws s3 ls "s3://$S3_BUCKET/grahmos/backups/" --recursive --region "$AWS_REGION" | \
        awk '{print $1" "$2" "$4}' | \
        while read -r date time key; do
            if [[ "$date" < "$cutoff_date" ]]; then
                aws s3 rm "s3://$S3_BUCKET/$key" --region "$AWS_REGION" >/dev/null 2>&1 || true
            fi
        done
    fi
    
    local remaining_backups
    remaining_backups=$(find "$BACKUP_DIR" -name "backup-*" -type d | wc -l)
    log "INFO" "Cleanup completed. $remaining_backups local backups remaining."
}

# Send backup notification
send_notification() {
    local status="$1"
    local backup_file="${2:-}"
    
    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        local icon=":floppy_disk:"
        local title="Backup Completed"
        
        if [[ "$status" == "failed" ]]; then
            color="danger"
            icon=":rotating_light:"
            title="Backup Failed"
        fi
        
        local duration=$(($(date +%s) - BACKUP_START_TIME))
        local size_info=""
        
        if [[ -n "$backup_file" ]] && [[ -f "$backup_file" ]]; then
            local file_size
            file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0")
            size_info="Size: $(numfmt --to=iec-i --suffix=B $file_size)"
        fi
        
        local payload=$(cat << EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "$title - $BACKUP_TYPE",
            "fields": [
                {"title": "Backup ID", "value": "$BACKUP_ID", "short": true},
                {"title": "Duration", "value": "${duration}s", "short": true},
                {"title": "Type", "value": "$BACKUP_TYPE", "short": true},
                {"title": "Status", "value": "$status", "short": true}
            ],
            "footer": "Grahmos V1+V2 Backup Service",
            "ts": $(date +%s)
        }
    ]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$payload" \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
}

# Cleanup function
cleanup() {
    rm -f "$BACKUP_MANIFEST" 2>/dev/null || true
}

trap cleanup EXIT

# Main backup function
main() {
    setup_logging
    
    log "INFO" "Starting $BACKUP_TYPE backup process..."
    
    # Create backup structure
    local backup_path
    backup_path=$(setup_backup_structure)
    log "INFO" "Backup directory: $backup_path"
    
    # Perform backup components based on type
    case "$BACKUP_TYPE" in
        "full")
            backup_sqlite "$backup_path"
            backup_meilisearch "$backup_path"
            backup_redis "$backup_path"
            backup_configuration "$backup_path"
            backup_monitoring "$backup_path"
            backup_logs "$backup_path"
            ;;
        "data")
            backup_sqlite "$backup_path"
            backup_meilisearch "$backup_path"
            backup_redis "$backup_path"
            ;;
        "config")
            backup_configuration "$backup_path"
            ;;
        "logs")
            backup_logs "$backup_path"
            ;;
        *)
            log "ERROR" "Unknown backup type: $BACKUP_TYPE"
            exit 1
            ;;
    esac
    
    # Create manifest
    create_backup_manifest "$backup_path"
    
    # Encrypt if enabled
    local final_backup_file="$backup_path"
    if [[ "$ENCRYPT_BACKUPS" == "true" ]]; then
        final_backup_file=$(encrypt_backup "$backup_path")
    fi
    
    # Upload to cloud storage
    upload_to_cloud "$final_backup_file"
    
    # Clean old backups
    cleanup_old_backups
    
    # Calculate final statistics
    local end_time=$(date +%s)
    local total_duration=$((end_time - BACKUP_START_TIME))
    local backup_size=0
    
    if [[ -f "$final_backup_file" ]]; then
        backup_size=$(stat -f%z "$final_backup_file" 2>/dev/null || stat -c%s "$final_backup_file" 2>/dev/null || echo "0")
    elif [[ -d "$final_backup_file" ]]; then
        backup_size=$(du -sb "$final_backup_file" | cut -f1)
    fi
    
    log "INFO" "Backup completed successfully!"
    log "INFO" "Backup ID: $BACKUP_ID"
    log "INFO" "Duration: ${total_duration}s"
    log "INFO" "Size: $(numfmt --to=iec-i --suffix=B $backup_size)"
    log "INFO" "Location: $final_backup_file"
    
    # Send success notification
    send_notification "success" "$final_backup_file"
    
    echo "Backup completed: $BACKUP_ID"
}

# Handle different backup types based on arguments
case "${BACKUP_TYPE:-full}" in
    full|data|config|logs)
        main
        ;;
    *)
        echo "Usage: $0 [full|data|config|logs]"
        echo ""
        echo "Backup types:"
        echo "  full   - Complete backup (default)"
        echo "  data   - Database and search data only"
        echo "  config - Configuration files only"
        echo "  logs   - Application logs only"
        exit 1
        ;;
esac
