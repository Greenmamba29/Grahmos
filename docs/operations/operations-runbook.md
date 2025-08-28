# Operations Runbook - Grahmos V1+V2 Unified

## 📋 Daily Operations Guide

This runbook provides standard operating procedures for managing the Grahmos V1+V2 unified system in production.

## 🌅 Daily Operations Checklist

### Morning Health Check (9:00 AM)
```bash
# 1. System health overview
./scripts/health-check.sh

# 2. Service discovery and status
./scripts/service-discovery.sh list

# 3. Check overnight logs for errors
docker-compose logs --since 12h | grep -i error

# 4. Monitor resource usage
docker stats --no-stream

# 5. Backup status verification
ls -la backups/ | tail -5
```

### System Metrics Review
```bash
# Check Grafana dashboards
open http://localhost:3000

# Key metrics to review:
# - API response times < 500ms
# - Memory usage < 80%
# - CPU usage < 70%
# - Disk usage < 85%
# - Error rate < 1%
```

### Security Status Check
```bash
# Check security logs
sudo grep -i "failed\|error\|denied" /var/log/auth.log | tail -20

# SSL certificate status
openssl x509 -enddate -noout -in certs/server.crt

# Failed login attempts
./scripts/security-audit.sh | grep -E "❌|⚠️"
```

## 🔧 Service Management Operations

### Service Status Operations
```bash
# Check all service status
docker-compose ps

# Get detailed service info
./scripts/service-discovery.sh info edge-api

# Monitor specific service logs
docker-compose logs -f --tail 100 edge-api

# Check service health endpoints
curl -k https://localhost/api/health
curl -k https://localhost/api/v1/status
curl -k https://localhost/api/v2/status
```

### Service Restart Procedures

#### Restart Individual Service
```bash
# Graceful restart with health check
docker-compose restart edge-api
sleep 10
./scripts/health-check.sh edge-api
```

#### Rolling Restart (Zero Downtime)
```bash
# Use deployment script for rolling updates
./scripts/deploy.sh production --rolling-update
```

#### Emergency Restart All Services
```bash
# Full system restart
docker-compose down
sleep 5
docker-compose up -d
./scripts/health-check.sh
```

### Configuration Updates

#### Update Environment Variables
```bash
# 1. Edit environment file
vim .env.production

# 2. Restart affected services
docker-compose up -d --force-recreate edge-api

# 3. Verify changes applied
docker-compose exec edge-api env | grep UPDATED_VAR
```

#### Update Service Configuration
```bash
# 1. Update configuration files
vim infra/nginx/nginx.prod.conf

# 2. Recreate service with new config
docker-compose up -d --force-recreate nginx-proxy

# 3. Test configuration
curl -I https://localhost/api/health
```

## 📊 Monitoring & Alerting Operations

### Grafana Dashboard Management

#### Access Dashboards
```bash
# Primary monitoring dashboard
open http://localhost:3000/d/grahmos-overview

# Key dashboards:
# - System Overview: Overall health metrics
# - API Performance: Response times, throughput
# - Infrastructure: CPU, memory, disk usage
# - Security: Authentication, failed requests
```

#### Dashboard Alerts
```bash
# Check active alerts
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[]'

# Acknowledge alerts in Grafana UI
# Navigate to Alerting > Alert Rules > Acknowledge
```

### Log Analysis Operations

#### Centralized Log Access
```bash
# Application logs
docker-compose logs edge-api --since 1h

# Error analysis
docker-compose logs --since 1h | grep -i error | head -20

# Performance analysis
docker-compose logs nginx-proxy --since 1h | grep -E "slow|timeout"
```

#### Log Aggregation Status
```bash
# Check Fluent Bit status
docker-compose logs fluent-bit --tail 50

# Verify log forwarding
curl -s http://localhost:24224/api/v1/metrics.json
```

## 🔒 Security Operations

### Daily Security Tasks

#### Security Monitoring
```bash
# Run security audit
./scripts/security-audit.sh

# Check for suspicious activities
sudo grep -E "Failed password|Invalid user" /var/log/auth.log | tail -10

# Monitor container security
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy system --security-checks vuln
```

#### Access Control Review
```bash
# Check active sessions
who -u

# Review sudo activities
sudo grep sudo /var/log/auth.log | tail -10

# Verify service accounts
grep -E "grahmos|docker" /etc/passwd
```

### Secret Management Operations

#### Secret Rotation (Monthly)
```bash
# Rotate JWT secrets
./scripts/secrets-manager.sh rotate jwt_secret.key

# Rotate encryption keys
./scripts/secrets-manager.sh rotate encryption_key.key

# Restart services after rotation
docker-compose restart edge-api
```

#### Certificate Management
```bash
# Check certificate expiry (weekly)
openssl x509 -enddate -noout -in certs/server.crt

# Renew certificates (as needed)
sudo certbot renew
docker-compose restart nginx-proxy
```

## 💾 Backup & Recovery Operations

### Daily Backup Tasks

#### Verify Backup Status
```bash
# Check latest backups
./scripts/disaster-recovery.sh list-backups | head -10

# Verify backup integrity
./scripts/disaster-recovery.sh validate-backup $(ls backups/ | tail -1)
```

#### Manual Backup Creation
```bash
# Create emergency backup
./scripts/backup.sh emergency --comment "Pre-maintenance backup"

# Create full backup
./scripts/backup.sh full --encrypt
```

### Recovery Operations

#### Partial Recovery (Data Only)
```bash
# List available backups
./scripts/disaster-recovery.sh list-backups

# Restore specific data
./scripts/disaster-recovery.sh restore <backup-id> --data-only --dry-run
./scripts/disaster-recovery.sh restore <backup-id> --data-only
```

#### Full System Recovery
```bash
# Emergency recovery procedure
docker-compose down
./scripts/disaster-recovery.sh restore <backup-id>
./scripts/health-check.sh
```

## 📈 Performance Optimization Operations

### Resource Monitoring

#### CPU and Memory Analysis
```bash
# Real-time resource monitoring
docker stats

# Historical resource usage
docker-compose exec prometheus curl -s 'http://localhost:9090/api/v1/query?query=rate(container_cpu_usage_seconds_total[5m])'

# Memory usage trends
docker-compose exec prometheus curl -s 'http://localhost:9090/api/v1/query?query=container_memory_usage_bytes'
```

#### Database Performance
```bash
# Redis performance metrics
docker-compose exec redis redis-cli info stats

# Meilisearch performance
curl -s http://localhost:7700/stats | jq '.databases'
```

### Performance Tuning

#### Optimize Container Resources
```bash
# Update resource limits in docker-compose.prod.yml
# Example: Increase memory limit for high-usage service
docker-compose up -d --force-recreate edge-api
```

#### Cache Optimization
```bash
# Redis cache hit rate analysis
docker-compose exec redis redis-cli info stats | grep hit_rate

# Clear cache if needed (use with caution)
docker-compose exec redis redis-cli FLUSHALL
```

## 🚨 Incident Response Operations

### Incident Detection

#### Automated Alerts
```bash
# Check alert status
curl -s http://localhost:9093/api/v1/alerts

# Review recent incidents
grep -i "alert\|critical" logs/*.log | tail -20
```

#### Manual Issue Detection
```bash
# High-level health check
./scripts/health-check.sh

# Detailed system analysis
./scripts/service-discovery.sh monitor --verbose

# Error pattern analysis
docker-compose logs --since 1h | grep -i error | sort | uniq -c | sort -nr
```

### Incident Response Procedures

#### Service Unavailable
```bash
# 1. Immediate assessment
./scripts/health-check.sh
docker-compose ps

# 2. Check logs
docker-compose logs --tail 100

# 3. Restart affected services
docker-compose restart <service-name>

# 4. Verify recovery
curl -f https://localhost/api/health
```

#### Performance Degradation
```bash
# 1. Resource analysis
docker stats --no-stream

# 2. Log analysis
docker-compose logs --since 30m | grep -E "slow|timeout|error"

# 3. Scale if needed
docker-compose up -d --scale edge-api=2

# 4. Monitor improvement
watch './scripts/health-check.sh'
```

#### Security Incident
```bash
# 1. Immediate security audit
./scripts/security-audit.sh

# 2. Check for breaches
sudo grep -E "Failed password|Invalid user|sudo" /var/log/auth.log

# 3. Isolate if needed
# Block suspicious IPs in firewall

# 4. Follow incident response plan
# Refer to security/incident-response.md
```

## 🔄 Maintenance Operations

### Scheduled Maintenance

#### Weekly Maintenance (Sunday 2:00 AM)
```bash
#!/bin/bash
# Weekly maintenance script

# 1. System updates
sudo apt update && sudo apt upgrade -y

# 2. Docker cleanup
docker system prune -f

# 3. Log rotation
sudo logrotate -f /etc/logrotate.conf

# 4. Security audit
./scripts/security-audit.sh > logs/weekly-security-audit.log

# 5. Performance baseline
./scripts/test-performance.sh > logs/weekly-performance.log
```

#### Monthly Maintenance
```bash
#!/bin/bash
# Monthly maintenance script

# 1. Full backup
./scripts/backup.sh full --encrypt

# 2. Certificate check and renewal
sudo certbot renew --force-renewal

# 3. Security hardening review
./scripts/security-hardening.sh --audit-only

# 4. Capacity planning review
df -h > logs/monthly-disk-usage.log
free -h > logs/monthly-memory-usage.log
```

### Emergency Maintenance

#### Unplanned Downtime Procedure
```bash
# 1. Notify stakeholders
echo "System maintenance in progress" > /var/www/html/maintenance.html

# 2. Graceful service shutdown
docker-compose down

# 3. Perform maintenance
# (specific maintenance tasks)

# 4. Restart services
docker-compose up -d

# 5. Verify functionality
./scripts/health-check.sh

# 6. Remove maintenance notice
rm /var/www/html/maintenance.html
```

## 🔐 Advanced Security Operations

### DPoP Nonce + Replay Protection

**Objective:** Enforce per‑request nonces for DPoP to block replays.

**Action:** Enable nonce challenge on the Edge API. Clients must fetch a `nonce` from `/auth/dpop/nonce`, include it in the DPoP payload (`nonce` claim), and refresh on 401/nonce_expired.

**Implementation:**
```bash
# Enable DPoP nonce enforcement
curl -k https://localhost/auth/dpop/nonce
# Returns: {"nonce": "abc123", "expires": 120}

# Client includes nonce in DPoP token
# Nonce TTL ≤ 120s, single‑use
```

**Acceptance Criteria:**
* Requests without valid `nonce` are 401
* `nonce` TTL ≤ 120s, single‑use
* PWA auto‑retries once to refresh nonce; native app mirrors

### TPM/HSM Key Management

**Objective:** Protect JWT signing keys using TPM/HSM and rotate automatically.

**Action:** Move `JWT_HS512_KEY` to HSM/TPM‑backed KMS. Implement key IDs (`kid`) and rotation every 90 days with dual‑sign period of 7 days. Document rollback using previous `kid`.

**Key Rotation Procedure:**
```bash
# Generate new key with rotation
./scripts/secrets-manager.sh rotate jwt_signing_key --hsm

# Verify key ID assignment
curl -s https://localhost/.well-known/jwks.json | jq '.keys[] | .kid'

# Test dual-sign period
./scripts/test-security.sh --key-rotation-test
```

**Acceptance Criteria:**
* Keys never appear in env files or logs
* All tokens include `kid` and verify against active keys set
* Rotation runbook tested in staging

### Doc‑Level ACLs

**Objective:** Enforce document authorization at index & query time.

**Action:** Tag documents with `labels:[public|restricted|secret]` and `tenants:[...]`. API must add a mandatory filter based on user claims (`tier`, `tenant_ids`). For SQLite FTS, use a join table; for Meili, use filterable attributes.

**Implementation:**
```bash
# Configure document-level security
# Documents tagged with access controls
{
  "id": "doc123",
  "content": "sensitive data",
  "labels": ["restricted"],
  "tenants": ["tenant-a", "tenant-b"]
}

# Query with user context
curl -X POST https://localhost/api/search \
  -H "Authorization: Bearer $JWT" \
  -d '{"q": "query", "filter": "user_can_access"}'
```

**Acceptance Criteria:**
* Unauthorized docs never appear in results
* Negative tests included in CI

### SLSA + Attestations

**Objective:** Achieve SLSA‑L3 provenance for containers and packages.

**Action:** Emit in‑toto attestations in CI; verify on deploy. Block unsigned/unknown provenance.

**Implementation:**
```bash
# Verify SLSA attestations
./scripts/security-audit.sh --slsa-verify

# Check container provenance
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image --security-checks vuln,config,secret \
  grahmos/edge-api:latest
```

**Acceptance Criteria:**
* Deploy job fails if attestation verify fails

### Secrets Management

**Objective:** Standardize secrets with Vault/1Password and rotation SLAs.

**Action:** All app secrets pulled at boot via machine identity. Rotation every 90 days; emergency rotation runbook.

**Secrets Rotation Schedule:**
```bash
# Automated rotation (every 90 days)
0 2 1 */3 * /scripts/secrets-manager.sh rotate-all --vault

# Emergency rotation
./scripts/secrets-manager.sh emergency-rotate jwt_secret.key
./scripts/deploy.sh production --rolling-restart
```

## 🚀 Platform Operations

### Blue/Green Edge Swap

**Goal:** Zero‑downtime index & release swaps on edge.

**Procedure:**
```bash
# 1. Stage new version
mkdir -p /data/indexes/releases/$VER
cp -r new_index/* /data/indexes/releases/$VER/

# 2. Health probe new version
curl -f http://localhost:7700/_healthz
curl -f "http://localhost:7700/search?q=canary" --data '{"index": "'$VER'"}'

# 3. Atomic symlink swap
ln -sfn /data/indexes/releases/$VER /data/indexes/current

# 4. Monitor for 10 minutes
watch -n 30 './scripts/health-check.sh --monitor-swap'

# 5. Rollback if needed
if [ $health_check_failed ]; then
  ln -sfn /data/indexes/releases/$PREV_VER /data/indexes/current
  echo "Rollback completed"
fi
```

**Exit Criteria:**
* p95 latency within SLA
* 5xx rate < 0.1%
* Search results accuracy validated

### Chaos Drill Menu

**Scenarios:**
1. **Backhaul Loss Simulation**
   ```bash
   # Simulate network partition
   sudo iptables -A OUTPUT -d upstream-server -j DROP
   # Verify edge continues serving from cache
   # Restore: sudo iptables -D OUTPUT -d upstream-server -j DROP
   ```

2. **RAN Outage Drill**
   ```bash
   # Simulate radio access network failure
   docker-compose stop srsran-enb
   # Verify fallback to Wi-Fi/cellular
   # Restore: docker-compose start srsran-enb
   ```

3. **Index Corruption Recovery**
   ```bash
   # Simulate index corruption
   rm -rf /data/indexes/current/*
   # Trigger automatic rebuild
   ./scripts/disaster-recovery.sh rebuild-index
   ```

4. **Certificate Expiry Test**
   ```bash
   # Test cert renewal under pressure
   ./scripts/test-security.sh --cert-expiry-drill
   ```

**Exit Criteria:** Runbook steps executed and service restored within target RTO

### Capacity & Cost Dashboard

**Action:** Add Grafana board: CPU, RAM, NVMe I/O, p50/p95 latency, QPS, egress, $/venue/day. Alert on trend breaks.

**Dashboard Queries:**
```promql
# CPU utilization by edge node
rate(container_cpu_usage_seconds_total[5m]) * 100

# Memory usage percentage
(container_memory_usage_bytes / container_spec_memory_limit_bytes) * 100

# NVMe I/O operations
rate(container_fs_io_current[5m])

# API latency percentiles
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Cost per venue per day
sum by (venue) (cost_per_hour * 24)
```

### Synthetic Probes

**Action:** Blackbox HTTP probes for `/auth/mtls`, `/auth/dpop`, `/search` and a canary query. Alert on SLO breach.

**Probe Configuration:**
```yaml
# blackbox.yml
modules:
  http_2xx:
    prober: http
    timeout: 10s
    http:
      valid_http_versions: ["HTTP/1.1", "HTTP/2.0"]
      valid_status_codes: [200]
      method: GET
      
  mTLS_probe:
    prober: http
    http:
      tls_config:
        cert_file: "/certs/client.crt"
        key_file: "/certs/client.key"
        ca_file: "/certs/ca.crt"
```

**Monitoring Commands:**
```bash
# Test mTLS endpoint
curl -f --cert client.crt --key client.key --cacert ca.crt \
  https://localhost/auth/mtls

# Test DPoP endpoint
curl -f -H "Authorization: DPoP $TOKEN" \
  -H "DPoP: $DPOP_PROOF" \
  https://localhost/auth/dpop

# Canary search query
curl -f "https://localhost/search?q=canary+test" \
  -H "Authorization: Bearer $JWT"
```

## 📞 Escalation Procedures

### Escalation Matrix

| Severity | Initial Response | Escalation Time | Contact |
|----------|------------------|----------------|---------|
| **Critical** | Immediate | 15 minutes | On-call engineer |
| **High** | Within 1 hour | 2 hours | Team lead |
| **Medium** | Within 4 hours | Next business day | Team member |
| **Low** | Next business day | 3 days | Backlog |

### Contact Information
```bash
# On-call rotation
curl -s http://oncall-api.company.com/current

# Team contacts
# Team Lead: lead@company.com
# Operations: ops@company.com
# Security: security@company.com
# DevOps: devops@company.com
```

## 📝 Documentation Updates

### Daily Log Entries
```bash
# Create daily operation log entry
cat >> logs/operations-$(date +%Y%m).log << EOF
$(date): Daily operations completed
- Health check: PASS
- Backup status: OK
- Security audit: No issues
- Performance: Within normal range
EOF
```

### Incident Documentation
```bash
# Document incidents in operations log
cat >> logs/incidents-$(date +%Y%m).log << EOF
$(date): [INCIDENT] Brief description
- Impact: Service availability
- Duration: 15 minutes
- Root cause: Configuration error
- Resolution: Service restart
- Prevention: Updated runbook
EOF
```

---

**Remember**: Always test in staging before applying changes to production!

**Emergency Contact**: On-call: +1-XXX-XXX-XXXX  
**Last Updated**: $(date)  
**Version**: 1.0.0
