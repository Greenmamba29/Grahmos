#!/usr/bin/env bash

# Grahmos V1+V2 Unified - Security Audit & Validation
# Comprehensive security assessment and compliance checking

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logs
AUDIT_LOG="logs/security-audit-$(date +%Y%m%d-%H%M%S).log"
mkdir -p logs/

log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo -e "${CYAN}${message}${NC}"
    echo "$message" >> "$AUDIT_LOG"
}

pass() {
    local message="✅ $*"
    echo -e "${GREEN}${message}${NC}"
    echo "$message" >> "$AUDIT_LOG"
}

warn() {
    local message="⚠️  $*"
    echo -e "${YELLOW}${message}${NC}"
    echo "$message" >> "$AUDIT_LOG"
}

fail() {
    local message="❌ $*"
    echo -e "${RED}${message}${NC}"
    echo "$message" >> "$AUDIT_LOG"
}

# Check Docker security configuration
check_docker_security() {
    log "🐳 Auditing Docker security configuration..."
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        fail "Docker daemon is not running"
        return 1
    fi
    
    # Check for hardened compose file
    if [[ -f "infra/security/docker-security.yml" ]]; then
        pass "Security hardened Docker configuration found"
    else
        fail "Security hardened Docker configuration missing"
    fi
    
    # Check for non-root users
    local root_containers=0
    while read -r container; do
        if [[ -n "$container" ]]; then
            local user=$(docker inspect "$container" --format '{{.Config.User}}' 2>/dev/null || echo "root")
            if [[ "$user" == "root" || "$user" == "" ]]; then
                warn "Container $container running as root"
                ((root_containers++))
            fi
        fi
    done < <(docker ps -q 2>/dev/null || true)
    
    if [[ $root_containers -eq 0 ]]; then
        pass "No containers running as root"
    else
        warn "$root_containers containers running as root"
    fi
    
    # Check for readonly filesystems
    local writable_containers=0
    while read -r container; do
        if [[ -n "$container" ]]; then
            local readonly=$(docker inspect "$container" --format '{{.HostConfig.ReadonlyRootfs}}' 2>/dev/null || echo "false")
            if [[ "$readonly" != "true" ]]; then
                warn "Container $container has writable filesystem"
                ((writable_containers++))
            fi
        fi
    done < <(docker ps -q 2>/dev/null || true)
    
    if [[ $writable_containers -eq 0 ]]; then
        pass "All containers have readonly filesystems"
    else
        warn "$writable_containers containers have writable filesystems"
    fi
}

# Check secrets management
check_secrets() {
    log "🔐 Auditing secrets management..."
    
    # Check for secrets directory
    if [[ -d "secrets" ]]; then
        pass "Secrets directory exists"
        
        # Check permissions
        local perms=$(stat -f "%A" secrets/ 2>/dev/null || stat -c "%a" secrets/ 2>/dev/null || echo "000")
        if [[ "$perms" -le 700 ]]; then
            pass "Secrets directory has secure permissions ($perms)"
        else
            fail "Secrets directory permissions too open ($perms)"
        fi
        
        # Check for required secrets
        local required_secrets=("jwt_secret.key" "encryption_key.key" "db_key.key" "session_secret.key")
        for secret in "${required_secrets[@]}"; do
            if [[ -f "secrets/$secret" ]]; then
                local file_perms=$(stat -f "%A" "secrets/$secret" 2>/dev/null || stat -c "%a" "secrets/$secret" 2>/dev/null || echo "000")
                if [[ "$file_perms" -le 600 ]]; then
                    pass "Secret $secret exists with secure permissions ($file_perms)"
                else
                    fail "Secret $secret has insecure permissions ($file_perms)"
                fi
            else
                fail "Required secret $secret missing"
            fi
        done
    else
        fail "Secrets directory missing"
    fi
    
    # Check for secrets in environment files
    log "Checking for exposed secrets in environment files..."
    local exposed_secrets=0
    for env_file in .env* docker-compose*.yml; do
        if [[ -f "$env_file" ]]; then
            if grep -q "password\|secret\|key.*=" "$env_file" 2>/dev/null; then
                if ! grep -q "changeme\|example\|placeholder" "$env_file" 2>/dev/null; then
                    warn "Potential secrets found in $env_file"
                    ((exposed_secrets++))
                fi
            fi
        fi
    done
    
    if [[ $exposed_secrets -eq 0 ]]; then
        pass "No exposed secrets found in configuration files"
    else
        warn "$exposed_secrets files may contain exposed secrets"
    fi
}

# Check TLS/SSL configuration
check_tls() {
    log "🔒 Auditing TLS/SSL configuration..."
    
    # Check for certificates
    if [[ -d "certs" ]]; then
        pass "Certificates directory exists"
        
        # Check certificate files
        for cert in certs/*.crt certs/*.pem; do
            if [[ -f "$cert" ]]; then
                local expiry=$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2 || echo "")
                if [[ -n "$expiry" ]]; then
                    local expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry" +%s 2>/dev/null || echo "0")
                    local current_epoch=$(date +%s)
                    local days_remaining=$(( (expiry_epoch - current_epoch) / 86400 ))
                    
                    if [[ $days_remaining -gt 30 ]]; then
                        pass "Certificate $cert valid for $days_remaining days"
                    elif [[ $days_remaining -gt 0 ]]; then
                        warn "Certificate $cert expires in $days_remaining days"
                    else
                        fail "Certificate $cert has expired"
                    fi
                else
                    warn "Could not check expiry for certificate $cert"
                fi
            fi
        done
    else
        warn "No certificates directory found"
    fi
    
    # Check NGINX TLS configuration
    if [[ -f "infra/nginx/nginx.prod.conf" ]]; then
        if grep -q "ssl_protocols.*TLSv1.[23]" "infra/nginx/nginx.prod.conf"; then
            pass "NGINX configured with secure TLS versions"
        else
            warn "NGINX TLS configuration may be insecure"
        fi
        
        if grep -q "ssl_ciphers" "infra/nginx/nginx.prod.conf"; then
            pass "NGINX cipher suite configured"
        else
            warn "NGINX cipher suite not explicitly configured"
        fi
    fi
}

# Check network security
check_network() {
    log "🌐 Auditing network security..."
    
    # Check for open ports
    if command -v netstat >/dev/null 2>&1; then
        local open_ports=$(netstat -tlnp 2>/dev/null | grep LISTEN | wc -l || echo "0")
        if [[ $open_ports -lt 10 ]]; then
            pass "Reasonable number of open ports ($open_ports)"
        else
            warn "Many open ports detected ($open_ports)"
        fi
    fi
    
    # Check Docker network configuration
    if docker network ls >/dev/null 2>&1; then
        if docker network ls | grep -q "grahmos"; then
            pass "Custom Docker network configured"
        else
            warn "No custom Docker network found"
        fi
    fi
    
    # Check for rate limiting configuration
    if [[ -f "infra/nginx/nginx.prod.conf" ]]; then
        if grep -q "limit_req" "infra/nginx/nginx.prod.conf"; then
            pass "NGINX rate limiting configured"
        else
            warn "NGINX rate limiting not configured"
        fi
    fi
}

# Check logging and monitoring
check_monitoring() {
    log "📊 Auditing logging and monitoring..."
    
    # Check for log directories
    if [[ -d "logs" ]]; then
        pass "Logs directory exists"
    else
        warn "Logs directory missing"
    fi
    
    # Check Prometheus configuration
    if [[ -f "infra/prometheus/prometheus.yml" ]]; then
        pass "Prometheus configuration found"
    else
        warn "Prometheus configuration missing"
    fi
    
    # Check Grafana configuration
    if [[ -f "infra/grafana/datasources.yml" ]]; then
        pass "Grafana datasources configured"
    else
        warn "Grafana configuration missing"
    fi
    
    # Check logging configuration
    if [[ -f "infra/fluent-bit/fluent-bit.conf" ]]; then
        pass "Fluent Bit logging configuration found"
    else
        warn "Centralized logging configuration missing"
    fi
}

# Check backup security
check_backup() {
    log "💾 Auditing backup security..."
    
    # Check backup scripts
    if [[ -f "infra/backup/scripts/backup.sh" ]]; then
        pass "Backup script exists"
        
        # Check for encryption in backup script
        if grep -q "encrypt\|gpg" "infra/backup/scripts/backup.sh"; then
            pass "Backup encryption configured"
        else
            warn "Backup encryption not configured"
        fi
    else
        warn "Backup script missing"
    fi
    
    # Check disaster recovery
    if [[ -f "scripts/disaster-recovery.sh" ]]; then
        pass "Disaster recovery script exists"
    else
        warn "Disaster recovery script missing"
    fi
}

# Check compliance
check_compliance() {
    log "📋 Auditing compliance requirements..."
    
    # Check for security policies
    if [[ -f "infra/security/security-policies.yml" ]]; then
        pass "Security policies documented"
    else
        warn "Security policies missing"
    fi
    
    # Check for security checklist
    if [[ -f "infra/security/security-checklist.md" ]]; then
        pass "Security checklist available"
    else
        warn "Security checklist missing"
    fi
    
    # Check CI/CD security scanning
    if [[ -f ".github/workflows/security-scan.yml" ]]; then
        pass "Security scanning in CI/CD configured"
    else
        warn "CI/CD security scanning not configured"
    fi
}

# Generate audit report
generate_report() {
    log "📄 Generating security audit report..."
    
    local report_file="logs/security-audit-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# Grahmos V1+V2 Unified - Security Audit Report

**Date**: $(date)
**Auditor**: Automated Security Audit Script
**Version**: Production Security Assessment

## Executive Summary

This report provides a comprehensive security audit of the Grahmos V1+V2 unified production deployment.

## Audit Results

$(grep "✅\|⚠️\|❌" "$AUDIT_LOG" || echo "No results found")

## Recommendations

### High Priority
$(grep "❌" "$AUDIT_LOG" | head -10 || echo "- No critical issues found")

### Medium Priority  
$(grep "⚠️" "$AUDIT_LOG" | head -10 || echo "- No warnings found")

## Compliance Status

- **Docker Security**: $(if grep -q "Docker.*✅" "$AUDIT_LOG"; then echo "✅ Compliant"; else echo "⚠️ Needs Attention"; fi)
- **Secrets Management**: $(if grep -q "secrets.*✅" "$AUDIT_LOG"; then echo "✅ Compliant"; else echo "⚠️ Needs Attention"; fi)
- **TLS/SSL**: $(if grep -q "TLS.*✅" "$AUDIT_LOG"; then echo "✅ Compliant"; else echo "⚠️ Needs Attention"; fi)
- **Network Security**: $(if grep -q "network.*✅" "$AUDIT_LOG"; then echo "✅ Compliant"; else echo "⚠️ Needs Attention"; fi)
- **Monitoring**: $(if grep -q "monitoring.*✅" "$AUDIT_LOG"; then echo "✅ Compliant"; else echo "⚠️ Needs Attention"; fi)

## Next Steps

1. Address any critical security issues (❌)
2. Review and remediate warnings (⚠️)
3. Schedule regular security audits
4. Update security documentation
5. Conduct security training for team members

---

*This report was generated automatically. Manual verification is recommended for critical findings.*
EOF
    
    pass "Security audit report generated: $report_file"
}

# Main audit function
main() {
    echo -e "${CYAN}🛡️  Grahmos V1+V2 Security Audit${NC}"
    echo "=================================="
    echo ""
    
    log "Starting comprehensive security audit..."
    
    check_docker_security
    echo ""
    
    check_secrets
    echo ""
    
    check_tls
    echo ""
    
    check_network
    echo ""
    
    check_monitoring
    echo ""
    
    check_backup
    echo ""
    
    check_compliance
    echo ""
    
    generate_report
    
    echo ""
    log "Security audit completed. Check $AUDIT_LOG for detailed results."
    echo -e "${GREEN}✅ Security audit finished successfully!${NC}"
}

# Run audit with error handling
if ! main "$@"; then
    echo -e "${RED}❌ Security audit failed with errors${NC}"
    exit 1
fi
