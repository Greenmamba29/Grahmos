# Troubleshooting Guide - Grahmos V1+V2 Unified

## 🔍 Comprehensive Troubleshooting Reference

This guide provides solutions for common issues encountered with the Grahmos V1+V2 unified system.

## 🚨 Emergency Quick Reference

### System Down - Immediate Actions
```bash
# 1. Quick health check
./scripts/health-check.sh

# 2. Check service status
docker-compose ps

# 3. Check Docker daemon
sudo systemctl status docker

# 4. Check system resources
df -h && free -h

# 5. Emergency restart
docker-compose down && docker-compose up -d
```

### Critical Service Recovery
```bash
# Edge API down
docker-compose restart edge-api
curl -k https://localhost/api/health

# Database connection issues
docker-compose restart redis meilisearch
./scripts/service-discovery.sh info redis

# Proxy/SSL issues  
docker-compose restart nginx-proxy
curl -I https://localhost
```

## 🔧 Service-Specific Troubleshooting

### Edge API Issues

#### Symptom: API Returns 500 Errors
```bash
# Diagnosis
docker-compose logs edge-api --tail 50
curl -v https://localhost/api/health

# Common causes & solutions
# 1. Database connection failure
docker-compose exec edge-api env | grep DATABASE
docker-compose restart redis meilisearch

# 2. Memory issues
docker stats edge-api --no-stream
# If memory > 90%, restart service
docker-compose restart edge-api

# 3. Environment variables missing
docker-compose exec edge-api env | grep -E "JWT|DATABASE|REDIS"
```

#### Symptom: Slow API Response Times
```bash
# Diagnosis
curl -w "@curl-format.txt" -s https://localhost/api/v1/search?q=test

# Create curl timing format file
cat > curl-format.txt << 'EOF'
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
EOF

# Solutions
# 1. Check database performance
docker-compose exec redis redis-cli info stats | grep hit_rate
docker-compose exec meilisearch curl -s http://localhost:7700/stats

# 2. Scale if needed
docker-compose up -d --scale edge-api=2

# 3. Check resource limits
docker inspect edge-api | grep -A 10 "Resources"
```

#### Symptom: Authentication Failures
```bash
# Diagnosis
docker-compose logs edge-api | grep -i auth
grep "Failed password" /var/log/auth.log

# Solutions
# 1. Check JWT secret
./scripts/secrets-manager.sh get jwt_secret.key

# 2. Verify environment
docker-compose exec edge-api env | grep JWT

# 3. Check session storage
docker-compose exec redis redis-cli ping
```

### NGINX Proxy Issues

#### Symptom: SSL Certificate Errors
```bash
# Diagnosis
openssl x509 -enddate -noout -in certs/server.crt
curl -vI https://localhost 2>&1 | grep -E "certificate|SSL"

# Solutions
# 1. Renew certificates
sudo certbot renew
docker-compose restart nginx-proxy

# 2. Check certificate permissions
ls -la certs/
# Should be owned by nginx user or readable

# 3. Regenerate self-signed (development only)
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key \
  -out certs/server.crt -sha256 -days 365 -nodes \
  -subj "/CN=localhost"
```

#### Symptom: 502 Bad Gateway
```bash
# Diagnosis
docker-compose logs nginx-proxy --tail 20
curl -I https://localhost

# Solutions
# 1. Check upstream services
docker-compose ps edge-api
curl http://localhost:8080/api/health  # Direct API access

# 2. Verify NGINX configuration
docker-compose exec nginx-proxy nginx -t

# 3. Check network connectivity
docker-compose exec nginx-proxy ping edge-api
```

#### Symptom: Rate Limiting Issues
```bash
# Diagnosis
docker-compose logs nginx-proxy | grep -i "limiting"
curl -I https://localhost/api/health

# Solutions
# 1. Check rate limit configuration
grep -A 5 "limit_req" infra/nginx/nginx.prod.conf

# 2. Adjust limits temporarily
vim infra/nginx/nginx.prod.conf
docker-compose restart nginx-proxy

# 3. Check client IP patterns
docker-compose logs nginx-proxy | grep -E "limit|rate" | tail -20
```

### Database Issues

#### Redis Connection Problems
```bash
# Diagnosis
docker-compose exec redis redis-cli ping
docker-compose logs redis --tail 20

# Solutions
# 1. Check Redis configuration
docker-compose exec redis redis-cli config get "*"

# 2. Memory issues
docker-compose exec redis redis-cli info memory

# 3. Restart Redis
docker-compose restart redis
```

#### Meilisearch Issues
```bash
# Diagnosis
curl -s http://localhost:7700/health
docker-compose logs meilisearch --tail 20

# Solutions
# 1. Check disk space
df -h

# 2. Check Meilisearch stats
curl -s http://localhost:7700/stats | jq

# 3. Rebuild index if corrupted
docker-compose exec meilisearch curl -X DELETE http://localhost:7700/indexes/documents
```

## 📊 Monitoring & Logging Issues

### Prometheus/Grafana Issues

#### Symptom: Grafana Not Accessible
```bash
# Diagnosis
curl -I http://localhost:3000
docker-compose logs grafana --tail 20

# Solutions
# 1. Check Grafana service
docker-compose ps grafana
docker-compose restart grafana

# 2. Check configuration
ls -la infra/grafana/
docker-compose exec grafana grafana-cli admin reset-admin-password admin

# 3. Check data directory permissions
docker-compose exec grafana ls -la /var/lib/grafana
```

#### Symptom: Metrics Not Collecting
```bash
# Diagnosis
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health != "up")'

# Solutions
# 1. Check Prometheus configuration
docker-compose exec prometheus cat /etc/prometheus/prometheus.yml

# 2. Restart Prometheus
docker-compose restart prometheus

# 3. Check service endpoints
curl http://localhost:8080/metrics  # Edge API metrics
```

### Log Aggregation Issues

#### Symptom: Fluent Bit Not Working
```bash
# Diagnosis
docker-compose logs fluent-bit --tail 50
curl -s http://localhost:24224/api/v1/metrics.json

# Solutions
# 1. Check Fluent Bit configuration
docker-compose exec fluent-bit cat /fluent-bit/etc/fluent-bit.conf

# 2. Restart logging service
docker-compose restart fluent-bit

# 3. Check log file permissions
ls -la logs/
```

## 🔒 Security Issues

### Authentication Problems

#### Symptom: Users Cannot Login
```bash
# Diagnosis
./scripts/security-audit.sh | grep -E "auth|session"
docker-compose logs edge-api | grep -i auth

# Solutions
# 1. Check JWT configuration
./scripts/secrets-manager.sh get jwt_secret.key
docker-compose exec edge-api env | grep JWT

# 2. Check session storage
docker-compose exec redis redis-cli keys "session:*" | head -5

# 3. Reset authentication
./scripts/secrets-manager.sh rotate jwt_secret.key
docker-compose restart edge-api
```

#### Symptom: SSL/TLS Errors
```bash
# Diagnosis
openssl s_client -connect localhost:443 -servername localhost
./scripts/security-audit.sh | grep -i tls

# Solutions
# 1. Check certificate validity
openssl x509 -text -noout -in certs/server.crt

# 2. Update cipher suites
grep ssl_ciphers infra/nginx/nginx.prod.conf

# 3. Force TLS version
grep ssl_protocols infra/nginx/nginx.prod.conf
```

### Security Breaches

#### Symptom: Suspicious Activity Detected
```bash
# Immediate actions
# 1. Security audit
./scripts/security-audit.sh

# 2. Check access logs
sudo grep -E "Failed password|Invalid user" /var/log/auth.log | tail -20

# 3. Check application logs for anomalies
docker-compose logs --since 1h | grep -iE "error|fail|attack|breach"

# 4. Block suspicious IPs (if identified)
sudo ufw deny from <suspicious-ip>
```

## 🚀 Performance Issues

### High Resource Usage

#### Symptom: High CPU Usage
```bash
# Diagnosis
docker stats --no-stream
top -bn1 | head -20

# Solutions
# 1. Identify resource-hungry containers
docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"

# 2. Scale services
docker-compose up -d --scale edge-api=2

# 3. Optimize application settings
# Edit resource limits in docker-compose.prod.yml
```

#### Symptom: High Memory Usage
```bash
# Diagnosis
free -h
docker stats --no-stream | sort -k4 -hr

# Solutions
# 1. Clear cache
docker-compose exec redis redis-cli FLUSHALL

# 2. Restart memory-intensive services
docker-compose restart edge-api meilisearch

# 3. Increase swap (if needed)
sudo swapon --show
```

#### Symptom: Disk Space Issues
```bash
# Diagnosis
df -h
du -sh /var/lib/docker
docker system df

# Solutions
# 1. Clean up Docker
docker system prune -af
docker volume prune -f

# 2. Clean up logs
sudo journalctl --vacuum-time=7d
sudo find /var/log -type f -name "*.log" -exec truncate -s 0 {} \;

# 3. Clean up backups (keep recent)
find backups/ -name "*.tar.gz" -mtime +30 -delete
```

## 🌐 Network Issues

### Connectivity Problems

#### Symptom: Services Cannot Communicate
```bash
# Diagnosis
docker network ls
docker-compose exec edge-api ping redis
docker-compose exec nginx-proxy ping edge-api

# Solutions
# 1. Check Docker networks
docker network inspect grahmos_default

# 2. Restart networking
docker-compose down
docker-compose up -d

# 3. Check firewall rules
sudo ufw status verbose
```

#### Symptom: External Access Issues
```bash
# Diagnosis
curl -I http://external-ip
telnet external-ip 80
telnet external-ip 443

# Solutions
# 1. Check firewall
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 2. Check port binding
netstat -tlnp | grep -E ":80|:443"

# 3. Check DNS resolution
nslookup yourdomain.com
```

## 💾 Data Issues

### Backup Problems

#### Symptom: Backup Failures
```bash
# Diagnosis
./scripts/disaster-recovery.sh list-backups
ls -la backups/

# Solutions
# 1. Check disk space
df -h

# 2. Check backup service
docker-compose ps backup
docker-compose logs backup

# 3. Manual backup test
./scripts/backup.sh test --dry-run
```

#### Symptom: Restore Failures
```bash
# Diagnosis
./scripts/disaster-recovery.sh validate-backup <backup-id>

# Solutions
# 1. Check backup integrity
tar -tzf backups/<backup-file> > /dev/null

# 2. Check permissions
ls -la backups/

# 3. Free disk space
df -h
```

## 🔄 Container Issues

### Docker Problems

#### Symptom: Containers Won't Start
```bash
# Diagnosis
docker-compose ps
docker-compose logs
systemctl status docker

# Solutions
# 1. Check Docker daemon
sudo systemctl restart docker

# 2. Check resource limits
cat /proc/meminfo | grep MemAvailable
df -h

# 3. Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

#### Symptom: Image Pull Failures
```bash
# Diagnosis
docker pull <image-name>
docker images

# Solutions
# 1. Check internet connectivity
ping 8.8.8.8
curl -I https://registry-1.docker.io

# 2. Check Docker Hub authentication
docker login

# 3. Use different registry
# Edit docker-compose.yml to use alternative registry
```

## 🛠️ Development Issues

### Local Development Problems

#### Symptom: Hot Reload Not Working
```bash
# Diagnosis
docker-compose logs edge-api | grep -i reload
ls -la src/

# Solutions
# 1. Check volume mounts
docker-compose exec edge-api ls -la /app

# 2. Restart development services
docker-compose restart edge-api

# 3. Check file permissions
chmod -R 755 src/
```

## 🐦 Canary Queries & Quick Rollback

### Canary Query Testing

**Objective:** Quick validation that search & AI are working after deploy/swap.

**Canary Queries:**
```bash
# Health canary (should always return 200)
curl -f "https://localhost/search?q=test" \
  -H "Authorization: Bearer $JWT" \
  --max-time 5

# Search accuracy canary
curl -f "https://localhost/search?q=canary+query+validation" \
  -H "Authorization: Bearer $JWT" \
  -d '{"limit": 5}' \
  --max-time 10

# AI assistant canary
curl -f "https://localhost/ai/ask" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the status?", "canary": true}' \
  --max-time 15

# Edge sync canary (if applicable)
curl -f "https://edge-node-1/sync/status" \
  -H "Authorization: Bearer $JWT" \
  --max-time 5
```

**Exit Criteria:**
* All canary queries return 2xx status
* Response time < SLA thresholds
* Search results include expected content
* AI responses are coherent and relevant

### Emergency Rollback Procedures

#### Index Rollback (Blue/Green Swap)
```bash
# List available versions
ls -la /data/indexes/releases/

# Quick rollback to previous version
PREV_VER=$(ls /data/indexes/releases/ | sort -V | tail -n2 | head -n1)
echo "Rolling back to version: $PREV_VER"

# Atomic symlink rollback
ln -sfn /data/indexes/releases/$PREV_VER /data/indexes/current

# Verify rollback
curl -f "https://localhost/search?q=canary" --max-time 5

# Monitor for 5 minutes
for i in {1..10}; do
  echo "Health check $i/10..."
  ./scripts/health-check.sh --quick || break
  sleep 30
done
```

#### Application Rollback (Container)
```bash
# Get previous image tag
PREV_TAG=$(docker images grahmos/edge-api --format "table {{.Tag}}" | sed -n '2p')
echo "Rolling back to tag: $PREV_TAG"

# Update docker-compose with previous tag
sed -i.bak "s/edge-api:latest/edge-api:$PREV_TAG/g" docker-compose.prod.yml

# Rolling restart
docker-compose up -d --no-deps edge-api

# Wait for health
sleep 15
./scripts/health-check.sh edge-api

# Verify canary queries
./scripts/test-canary.sh --quick
```

#### Git-based Configuration Rollback
```bash
# Find last working commit
git log --oneline -n 10

# Rollback to previous commit
WORKING_COMMIT="abc1234"  # Replace with actual commit
git reset --hard $WORKING_COMMIT

# Redeploy configuration
docker-compose down
docker-compose up -d --force-recreate

# Verify system health
./scripts/health-check.sh
```

#### Database Rollback (Emergency)
```bash
# ⚠️ USE WITH EXTREME CAUTION ⚠️
# Only for critical data corruption issues

# Stop application services
docker-compose stop edge-api

# Find latest known good backup
./scripts/disaster-recovery.sh list-backups | head -5

# Restore database only (not full system)
./scripts/disaster-recovery.sh restore <backup-id> --database-only --confirm

# Restart services
docker-compose start edge-api

# Verify data integrity
./scripts/test-data-integrity.sh
```

### Rollback Decision Matrix

| Issue Type | Rollback Method | Time to Complete | Risk Level |
|------------|----------------|------------------|------------|
| **Search results incorrect** | Index rollback | ~2 minutes | Low |
| **API errors/crashes** | Application rollback | ~5 minutes | Medium |
| **Configuration errors** | Git configuration rollback | ~3 minutes | Low |
| **Performance degradation** | Application + index rollback | ~7 minutes | Medium |
| **Data corruption** | Database rollback | ~15-30 minutes | High |
| **Security breach** | Full system restore | ~30-60 minutes | Critical |

### Automated Rollback Triggers
```bash
# Automated monitoring and rollback
#!/bin/bash
# /scripts/auto-rollback-monitor.sh

CHECK_INTERVAL=30  # seconds
FAILURE_THRESHOLD=3
failure_count=0

while true; do
  if ! ./scripts/test-canary.sh --silent; then
    failure_count=$((failure_count + 1))
    echo "Canary failure $failure_count/$FAILURE_THRESHOLD"
    
    if [ $failure_count -ge $FAILURE_THRESHOLD ]; then
      echo "ALERT: Triggering automatic rollback"
      ./scripts/emergency-rollback.sh --auto
      break
    fi
  else
    failure_count=0
  fi
  
  sleep $CHECK_INTERVAL
done
```

### Post-Rollback Actions
```bash
# After successful rollback
# 1. Verify system stability
./scripts/health-check.sh --comprehensive

# 2. Document incident
cat >> logs/rollback-$(date +%Y%m).log << EOF
$(date): Emergency rollback executed
- Trigger: [DESCRIBE ISSUE]
- Rollback method: [index/application/config/database]
- Duration: [TIME TO COMPLETE]
- Status: SUCCESS
- Next actions: [ROOT CAUSE ANALYSIS]
EOF

# 3. Alert stakeholders
echo "System rolled back successfully. Investigating root cause." | \
  mail -s "ALERT: Production Rollback Completed" ops@company.com

# 4. Start root cause analysis
./scripts/incident-analysis.sh --rollback-event
```

## 📞 When All Else Fails

### Escalation Checklist
```bash
# 1. Gather system information
./scripts/health-check.sh > /tmp/health-report.txt
docker-compose ps > /tmp/services-status.txt
docker-compose logs > /tmp/all-logs.txt 2>&1

# 2. Create incident report
cat > /tmp/incident-report.txt << EOF
Incident Time: $(date)
Issue Description: [DESCRIBE ISSUE]
Steps Taken: [LIST TROUBLESHOOTING STEPS]
System Status: $(./scripts/health-check.sh | tail -1)
Error Messages: [INCLUDE KEY ERRORS]
EOF

# 3. Emergency contacts
# Team Lead: lead@company.com
# On-call: +1-XXX-XXX-XXXX
# Security: security@company.com
```

### Nuclear Option (Last Resort)
```bash
# Complete system reset (⚠️ DATA LOSS WARNING ⚠️)
# Only use if system is completely broken and backups are available

# 1. Create emergency backup
./scripts/backup.sh emergency

# 2. Stop all services
docker-compose down -v

# 3. Clean Docker system
docker system prune -af --volumes

# 4. Restore from backup
./scripts/disaster-recovery.sh restore <backup-id>

# 5. Verify system
./scripts/health-check.sh
```

---

## 📝 Troubleshooting Best Practices

### Before Starting
1. **Document the issue**: What exactly is broken?
2. **Check recent changes**: What was deployed recently?
3. **Verify scope**: Is it affecting all users or just some?

### During Troubleshooting
1. **Work systematically**: Follow this guide step by step
2. **Keep notes**: Document what you try
3. **Test thoroughly**: Verify fixes work completely

### After Resolution
1. **Document the solution**: Update this guide if needed
2. **Prevent recurrence**: What can prevent this?
3. **Monitor closely**: Watch for return of the issue

---

**Emergency Contact**: On-call: +1-XXX-XXX-XXXX  
**Last Updated**: $(date)  
**Version**: 1.0.0
