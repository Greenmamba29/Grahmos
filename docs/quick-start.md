# Quick Start Guide - Grahmos V1+V2 Unified

## 🚀 Get Started in 5 Minutes

This guide helps you get the Grahmos V1+V2 unified system running quickly for development or testing.

## Prerequisites

Before starting, ensure you have:

- **Docker & Docker Compose**: Version 20.10+ and Compose V2
- **Git**: For cloning the repository
- **OpenSSL**: For certificate generation
- **Bash**: For running automation scripts
- **8GB+ RAM**: Recommended for all services

### Quick Prerequisites Check
```bash
# Check Docker
docker --version && docker-compose --version

# Check available memory
free -h  # Linux
system_profiler SPHardwareDataType | grep Memory  # macOS

# Check OpenSSL
openssl version
```

## 🏃‍♂️ Quick Start Steps

### 1. Clone Repository
```bash
git clone <repository-url>
cd Grahmos
```

### 2. Initial Setup
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run initial setup and status check
./scripts/test-status.sh
```

### 3. Start Development Environment
```bash
# Start all services
docker-compose up -d

# Check service health
./scripts/health-check.sh
```

### 4. Verify Installation
```bash
# Check all services are running
docker-compose ps

# Test API endpoints
curl -k https://localhost/api/health
curl -k https://localhost/api/v1/status
curl -k https://localhost/api/v2/status
```

### 5. Access Web Interfaces

| Service | URL | Default Credentials |
|---------|-----|-------------------|
| **Grahmos API** | https://localhost | - |
| **Grafana** | http://localhost:3000 | admin/admin |
| **Prometheus** | http://localhost:9090 | - |

## 🎯 What You Get

After quick start, you'll have:

- ✅ **Edge API**: Main application API (V1 + V2)
- ✅ **NGINX Proxy**: SSL termination and routing
- ✅ **Meilisearch**: Search backend service
- ✅ **Redis**: Caching and session storage
- ✅ **Prometheus**: Metrics collection
- ✅ **Grafana**: Monitoring dashboards
- ✅ **Fluent Bit**: Log aggregation

## 🔧 Essential Commands

### Service Management
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart a service
docker-compose restart edge-api

# View logs
docker-compose logs -f edge-api
```

### Health & Status
```bash
# Full system health check
./scripts/health-check.sh

# Service discovery
./scripts/service-discovery.sh discover

# System status
./scripts/test-status.sh
```

### Development
```bash
# Run all tests
./scripts/test-all.sh

# Run specific tests
./scripts/test-functional.sh
./scripts/test-security.sh
./scripts/test-performance.sh
```

## 🚨 Common Issues & Quick Fixes

### Port Conflicts
```bash
# Check what's using ports
lsof -i :80 -i :443 -i :3000 -i :9090

# Stop conflicting services
sudo systemctl stop nginx  # If system NGINX running
```

### Permission Issues
```bash
# Fix script permissions
find scripts/ -name "*.sh" -exec chmod +x {} \;

# Fix Docker socket permissions (Linux)
sudo usermod -aG docker $USER
newgrp docker
```

### Memory Issues
```bash
# Check Docker resource usage
docker stats

# Increase Docker memory limit (Docker Desktop)
# Go to Docker Desktop > Settings > Resources > Memory
```

### SSL Certificate Issues
```bash
# Regenerate self-signed certificates
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key \
    -out certs/server.crt -sha256 -days 365 -nodes \
    -subj "/CN=localhost"
```

## 🔍 Verification Checklist

After setup, verify:

- [ ] All containers are running: `docker-compose ps`
- [ ] API responds: `curl -k https://localhost/api/health`
- [ ] Grafana accessible: http://localhost:3000
- [ ] Prometheus accessible: http://localhost:9090
- [ ] No errors in logs: `docker-compose logs`
- [ ] Health check passes: `./scripts/health-check.sh`

## 📚 Next Steps

Once you have the basic system running:

1. **Production Setup**: Follow [Production Deployment Guide](./deployment/production-deployment.md)
2. **Security Hardening**: Run `./scripts/security-hardening.sh`
3. **Monitoring Setup**: Configure [Monitoring & Alerting](./operations/monitoring.md)
4. **Backup Configuration**: Set up [Backup & Recovery](./operations/backup-recovery.md)

## 🆘 Need Help?

### Quick Troubleshooting
1. Check [Troubleshooting Guide](./operations/troubleshooting.md)
2. Run diagnostic: `./scripts/health-check.sh`
3. Check logs: `docker-compose logs`

### Advanced Setup
- [Installation Guide](./installation.md) - Detailed setup instructions
- [Configuration Guide](./configuration.md) - Environment configuration
- [Operations Runbook](./operations/operations-runbook.md) - Day-to-day operations

### Emergency Issues
- System down: Follow [System Recovery](./operations/troubleshooting.md#system-down)
- Security incident: Follow [Incident Response](./security/incident-response.md)
- Data loss: Use [Disaster Recovery](./scripts/disaster-recovery.sh)

---

**Pro Tip**: Save this command for quick system overview:
```bash
alias grahmos-status='./scripts/health-check.sh && ./scripts/service-discovery.sh list'
```
