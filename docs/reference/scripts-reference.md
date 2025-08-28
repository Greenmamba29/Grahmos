# Scripts Reference - Grahmos V1+V2 Unified

## 📜 Complete Scripts Documentation

This reference provides comprehensive documentation for all automation scripts in the Grahmos V1+V2 unified system.

## 📁 Scripts Directory Structure

```
scripts/
├── backup.sh                 # Backup operations
├── deploy.sh                 # Production deployment
├── disaster-recovery.sh      # Disaster recovery and restore
├── health-check.sh          # System health monitoring
├── secrets-manager.sh       # Secrets management
├── security-audit.sh        # Security auditing
├── security-hardening.sh    # Security hardening
├── service-discovery.sh     # Service discovery and registry
├── test-all.sh             # Comprehensive testing suite
├── test-functional.sh      # Functional testing
├── test-performance.sh     # Performance testing
├── test-security.sh        # Security testing
└── test-status.sh          # System status check
```

## 🔧 Core System Scripts

### `health-check.sh` - System Health Monitoring

**Purpose**: Comprehensive health check for all system components

**Usage**:
```bash
./scripts/health-check.sh [options]
```

**Options**:
- `--service <name>`: Check specific service only
- `--json`: Output results in JSON format
- `--quiet`: Suppress verbose output
- `--continuous`: Run continuously every 30s

**Examples**:
```bash
# Full system health check
./scripts/health-check.sh

# Check specific service
./scripts/health-check.sh --service edge-api

# JSON output for automation
./scripts/health-check.sh --json

# Continuous monitoring
./scripts/health-check.sh --continuous
```

**What it checks**:
- Core services (edge-api, nginx-proxy, redis, meilisearch)
- Monitoring services (prometheus, grafana)
- Infrastructure (network, certificates, system resources)
- Docker container health
- Service endpoints and APIs

### `service-discovery.sh` - Service Discovery and Registry

**Purpose**: Discover, register, and monitor Grahmos services

**Usage**:
```bash
./scripts/service-discovery.sh <command> [options]
```

**Commands**:
- `discover`: Discover and register all services
- `list`: List all registered services
- `info <service>`: Get detailed service information
- `health <service>`: Check service health
- `monitor`: Continuous monitoring mode
- `export <format>`: Export service registry
- `init`: Initialize service registry

**Examples**:
```bash
# Discover all services
./scripts/service-discovery.sh discover

# List services
./scripts/service-discovery.sh list

# Get service details
./scripts/service-discovery.sh info edge-api

# Monitor continuously
./scripts/service-discovery.sh monitor

# Export as JSON
./scripts/service-discovery.sh export json
```

### `test-status.sh` - System Status Check

**Purpose**: Quick system readiness and prerequisites check

**Usage**:
```bash
./scripts/test-status.sh [options]
```

**Options**:
- `--verbose`: Detailed output
- `--check-certs`: Include certificate validation
- `--check-performance`: Include basic performance check

**What it checks**:
- Docker and Docker Compose availability
- Required system resources
- Network connectivity
- File permissions
- Essential directories and files

## 🚀 Deployment Scripts

### `deploy.sh` - Production Deployment

**Purpose**: Automated deployment with zero-downtime rolling updates

**Usage**:
```bash
./scripts/deploy.sh <environment> [options]
```

**Environments**:
- `staging`: Deploy to staging environment
- `production`: Deploy to production environment

**Options**:
- `--rolling-update`: Perform rolling update (zero downtime)
- `--force`: Force deployment even if health checks fail
- `--backup`: Create backup before deployment
- `--dry-run`: Show what would be deployed without executing
- `--notify <channel>`: Send notifications (slack/discord)

**Examples**:
```bash
# Production deployment
./scripts/deploy.sh production

# Rolling update with backup
./scripts/deploy.sh production --rolling-update --backup

# Staging deployment
./scripts/deploy.sh staging

# Dry run
./scripts/deploy.sh production --dry-run
```

**Deployment Process**:
1. Pre-deployment checks
2. Backup creation (if requested)
3. Service health validation
4. Rolling updates (if specified)
5. Post-deployment verification
6. Notifications

## 🧪 Testing Scripts

### `test-all.sh` - Comprehensive Testing Suite

**Purpose**: Run all test suites and generate comprehensive report

**Usage**:
```bash
./scripts/test-all.sh [environment] [options]
```

**Options**:
- `--parallel`: Run tests in parallel
- `--report-format <format>`: Output format (markdown/json/html)
- `--coverage`: Include test coverage analysis
- `--benchmark`: Include performance benchmarks

**Test Suites Included**:
- Functional testing
- Security testing
- Performance testing
- Integration testing

### `test-functional.sh` - Functional Testing

**Purpose**: Test API endpoints and functional requirements

**Usage**:
```bash
./scripts/test-functional.sh [options]
```

**Test Categories**:
- API endpoint functionality
- Authentication flows
- Backend integration
- Error handling
- CORS validation
- API versioning
- Rate limiting
- Data validation

### `test-security.sh` - Security Testing

**Purpose**: Comprehensive security validation

**Usage**:
```bash
./scripts/test-security.sh [options]
```

**Security Tests**:
- mTLS authentication
- DPoP token validation
- JWT PoP verification
- Container security
- Network security
- Input validation
- Environment security
- Certificate validation

### `test-performance.sh` - Performance Testing

**Purpose**: Performance benchmarking and load testing

**Usage**:
```bash
./scripts/test-performance.sh [options]
```

**Performance Tests**:
- API response times
- Authentication performance
- Search backend performance
- Concurrent load handling
- Resource usage analysis
- TLS handshake performance

## 🔒 Security Scripts

### `security-hardening.sh` - Security Hardening

**Purpose**: Apply production security hardening configurations

**Usage**:
```bash
./scripts/security-hardening.sh [options]
```

**Options**:
- `--audit-only`: Audit current security without changes
- `--force`: Apply hardening without prompts

**Hardening Steps**:
1. Generate cryptographically secure secrets
2. Apply container security configurations
3. Set up secrets management
4. Configure security policies
5. Validate security settings

### `security-audit.sh` - Security Auditing

**Purpose**: Comprehensive security assessment and compliance checking

**Usage**:
```bash
./scripts/security-audit.sh [options]
```

**Options**:
- `--report-format <format>`: Output format (markdown/json)
- `--compliance <standard>`: Check specific compliance (soc2/gdpr)
- `--remediation`: Include remediation suggestions

**Audit Areas**:
- Docker security configuration
- Secrets management
- TLS/SSL configuration
- Network security
- Logging and monitoring
- Backup security
- Compliance requirements

### `secrets-manager.sh` - Secrets Management

**Purpose**: Secure secrets management operations

**Usage**:
```bash
./scripts/secrets-manager.sh <command> <secret-name>
```

**Commands**:
- `get <secret>`: Retrieve secret value
- `rotate <secret>`: Rotate secret and generate new value
- `list`: List all managed secrets
- `validate`: Validate all secrets

**Examples**:
```bash
# Get secret value
./scripts/secrets-manager.sh get jwt_secret.key

# Rotate secret
./scripts/secrets-manager.sh rotate encryption_key.key

# List all secrets
./scripts/secrets-manager.sh list
```

## 💾 Backup & Recovery Scripts

### `backup.sh` - Backup Operations

**Purpose**: Create encrypted backups of system data and configuration

**Usage**:
```bash
./scripts/backup.sh <type> [options]
```

**Backup Types**:
- `full`: Complete system backup
- `incremental`: Incremental backup
- `data-only`: Data files only
- `config-only`: Configuration files only
- `logs-only`: Log files only
- `emergency`: Emergency backup with timestamp

**Options**:
- `--encrypt`: Encrypt backup with GPG
- `--compress`: Compress backup (default: gzip)
- `--upload`: Upload to S3 storage
- `--comment <text>`: Add comment to backup
- `--retention <days>`: Set retention period

**Examples**:
```bash
# Full encrypted backup
./scripts/backup.sh full --encrypt

# Emergency backup
./scripts/backup.sh emergency --comment "Pre-maintenance"

# Data-only backup with upload
./scripts/backup.sh data-only --encrypt --upload
```

**Backup Contents**:
- SQLite databases
- Meilisearch indices
- Redis data
- Configuration files
- SSL certificates
- Application logs
- Monitoring data

### `disaster-recovery.sh` - Disaster Recovery

**Purpose**: Disaster recovery and system restoration

**Usage**:
```bash
./scripts/disaster-recovery.sh <command> [options]
```

**Commands**:
- `list-backups`: List available backups
- `validate-backup <id>`: Validate backup integrity
- `restore <id>`: Restore from backup
- `test-restore <id>`: Test restore in dry-run mode

**Options**:
- `--data-only`: Restore data files only
- `--config-only`: Restore configuration only
- `--dry-run`: Show what would be restored
- `--force`: Force restore without confirmation
- `--backup-location <path>`: Specify backup location

**Examples**:
```bash
# List available backups
./scripts/disaster-recovery.sh list-backups

# Validate backup
./scripts/disaster-recovery.sh validate-backup backup-20231201-143022

# Restore system
./scripts/disaster-recovery.sh restore backup-20231201-143022

# Dry run restore
./scripts/disaster-recovery.sh restore backup-20231201-143022 --dry-run
```

## 🔧 Script Configuration

### Environment Variables

All scripts respect these environment variables:

```bash
# Logging
LOG_LEVEL=info          # debug, info, warn, error
SCRIPT_LOG_DIR=logs/    # Script log directory

# Notifications
SLACK_WEBHOOK_URL=      # Slack notifications
DISCORD_WEBHOOK_URL=    # Discord notifications

# Backup
BACKUP_ENCRYPTION=true  # Enable backup encryption
BACKUP_S3_BUCKET=       # S3 bucket for backups
BACKUP_RETENTION_DAYS=30 # Backup retention period

# Testing
TEST_TIMEOUT=300        # Test timeout in seconds
TEST_PARALLEL=true      # Enable parallel testing

# Security
SECURITY_STRICT_MODE=true # Enable strict security mode
```

### Script Logging

All scripts log to standardized locations:

```bash
logs/
├── health-check-YYYYMMDD.log
├── deploy-YYYYMMDD-HHMMSS.log
├── backup-YYYYMMDD-HHMMSS.log
├── security-audit-YYYYMMDD-HHMMSS.log
└── test-results-YYYYMMDD-HHMMSS.log
```

### Exit Codes

Standard exit codes used by all scripts:

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Permission denied |
| 4 | Service unavailable |
| 5 | Network error |
| 10 | Health check failed |
| 20 | Security issue |
| 30 | Backup/restore failed |

## 🔄 Script Integration

### Cron Job Examples

```bash
# Daily backup at 2 AM
0 2 * * * /opt/grahmos/scripts/backup.sh incremental --encrypt >> /var/log/grahmos-backup.log 2>&1

# Weekly full backup at 2 AM Sunday  
0 2 * * 0 /opt/grahmos/scripts/backup.sh full --encrypt --upload >> /var/log/grahmos-backup.log 2>&1

# Daily health check at 9 AM
0 9 * * * /opt/grahmos/scripts/health-check.sh --json > /tmp/health-status.json

# Monthly security audit
0 3 1 * * /opt/grahmos/scripts/security-audit.sh >> /var/log/grahmos-security.log 2>&1
```

### CI/CD Integration

**GitHub Actions Workflow**:
```yaml
- name: Run Security Tests
  run: ./scripts/test-security.sh --report-format json

- name: Deploy to Staging  
  run: ./scripts/deploy.sh staging --backup

- name: Health Check
  run: ./scripts/health-check.sh --service edge-api
```

### Monitoring Integration

**Prometheus Integration**:
```bash
# Export health metrics
./scripts/health-check.sh --json | jq -r '.services[] | select(.status=="healthy") | .name' | wc -l
```

**Grafana Dashboard**:
Scripts provide metrics that can be visualized in Grafana dashboards.

## 🛠️ Script Development

### Adding New Scripts

1. **Location**: Add to `scripts/` directory
2. **Permissions**: Make executable (`chmod +x`)
3. **Template**: Use existing scripts as template
4. **Logging**: Use standardized logging functions
5. **Error Handling**: Include proper error handling
6. **Documentation**: Update this reference

### Script Template

```bash
#!/usr/bin/env bash
# Script name and description

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Import common functions
source scripts/common.sh

# Script-specific functions
main() {
    log "Starting script..."
    # Implementation
    log "Script completed successfully"
}

# Execute with error handling
if ! main "$@"; then
    error "Script failed"
    exit 1
fi
```

## 📞 Support

For script-related issues:

1. **Check logs**: All scripts log to `logs/` directory
2. **Verbose mode**: Most scripts support `--verbose` flag
3. **Dry run**: Many scripts support `--dry-run` for testing
4. **Documentation**: This reference and inline help (`--help`)

---

**Last Updated**: $(date)  
**Version**: 1.0.0  
**Maintainer**: Grahmos Operations Team
