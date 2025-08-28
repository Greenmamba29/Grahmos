# Grahmos V1+V2 Unified - Documentation

## 📚 Complete Documentation & Runbooks

Welcome to the comprehensive documentation for the Grahmos V1+V2 unified monorepo deployment system. This documentation provides everything needed to deploy, operate, and maintain the production-grade Grahmos application.

## 🏗️ System Overview

Grahmos V1+V2 Unified is a production-ready deployment system featuring:

- **Unified Architecture**: Single monorepo containing both V1 and V2 services
- **Container Orchestration**: Docker Compose with production hardening
- **Security First**: Comprehensive security controls and compliance
- **Observability**: Full monitoring, logging, and alerting stack
- **CI/CD Pipeline**: Automated testing, security scanning, and deployment
- **High Availability**: Health checks, service discovery, and automated recovery

## 📋 Compliance & Policy Overview
- **Control Mapping (SOC 2 / NIST):** See `docs/policy/compliance.md#control-mapping`.
- **Data Retention & PII:** See `docs/policy/compliance.md#data-retention--pii`.
- **License Policy & SBOM:** See `docs/policy/compliance.md#license-policy-gates`.

## 🧭 Quick Navigation
- **Quick Start:** `docs/quick-start.md`
- **Production Deployment:** `docs/deployment/production-deployment.md`
- **Operations Runbook:** `docs/operations/operations-runbook.md`
- **Troubleshooting:** `docs/operations/troubleshooting.md`
- **Scripts Reference:** `docs/reference/scripts-reference.md`
- **Architecture:** `docs/architecture/system-architecture.md`, `docs/architecture/enhanced-architecture.md`

## 📖 Documentation Structure

### 🚀 Getting Started
- [Quick Start Guide](./quick-start.md) - Get up and running in minutes
- [Installation Guide](./installation.md) - Detailed setup instructions
- [Configuration Guide](./configuration.md) - Environment and service configuration

### 🏭 Deployment
- [Production Deployment](./deployment/production-deployment.md) - Production deployment guide
- [Staging Deployment](./deployment/staging-deployment.md) - Staging environment setup
- [Local Development](./deployment/local-development.md) - Development environment
- [Environment Management](./deployment/environment-management.md) - Multi-environment strategy

### 🔧 Operations
- [Operations Runbook](./operations/operations-runbook.md) - Day-to-day operations
- [Troubleshooting Guide](./operations/troubleshooting.md) - Common issues and solutions
- [Monitoring & Alerting](./operations/monitoring.md) - Observability stack operations
- [Backup & Recovery](./operations/backup-recovery.md) - Data protection procedures
- [Security Operations](./operations/security-operations.md) - Security management

### 🛠️ Administration
- [System Administration](./admin/system-admin.md) - System-level administration
- [User Management](./admin/user-management.md) - User accounts and permissions
- [Performance Tuning](./admin/performance-tuning.md) - Optimization guidelines
- [Capacity Planning](./admin/capacity-planning.md) - Scaling and resource planning

### 🔒 Security
- [Security Overview](./security/security-overview.md) - Security architecture
- [Security Hardening](./security/hardening-guide.md) - Production hardening
- [Compliance Guide](./security/compliance.md) - Regulatory compliance
- [Incident Response](./security/incident-response.md) - Security incident procedures

### 📄 Policy & Compliance
- [Compliance Framework](./policy/compliance.md) - SOC2, GDPR, and regulatory compliance
- [Data Retention Policy](./policy/compliance.md#data-retention--pii-policy) - Data governance and PII handling
- [License Management](./policy/compliance.md#license-policy-gate) - SBOM and license compliance
- [Security Governance](./policy/compliance.md#security-governance) - Risk management and auditing

### 💳 Payments & Purchases
- [Purchase Operations](./operations/runbooks-purchases.md) - Payment processing and reconciliation
- [Offline Purchase Guardrails](./operations/runbooks-purchases.md#offline-purchase-guardrails) - Risk controls and limits
- [Refunds & Disputes](./operations/runbooks-purchases.md#refunds--disputes) - Financial operations procedures
- [Purchase Analytics](./operations/runbooks-purchases.md#purchase-analytics--reporting) - Financial reporting

### 📊 Architecture
- [System Architecture](./architecture/system-architecture.md) - Overall system design
- [Service Architecture](./architecture/service-architecture.md) - Microservices design
- [Data Architecture](./architecture/data-architecture.md) - Data flow and storage
- [Network Architecture](./architecture/network-architecture.md) - Network topology

### 🔄 Development
- [Development Setup](./development/dev-setup.md) - Developer environment
- [Contributing Guide](./development/contributing.md) - Contribution guidelines
- [API Documentation](./development/api-docs.md) - API reference
- [Testing Guide](./development/testing.md) - Testing procedures

### 📋 Reference
- [Configuration Reference](./reference/configuration-reference.md) - All configuration options
- [Script Reference](./reference/scripts-reference.md) - All automation scripts
- [API Reference](./reference/api-reference.md) - Complete API documentation
- [Glossary](./reference/glossary.md) - Terms and definitions

## 🚀 Quick Navigation

| Task | Documentation |
|------|---------------|
| **First Time Setup** | [Quick Start Guide](./quick-start.md) |
| **Deploy to Production** | [Production Deployment](./deployment/production-deployment.md) |
| **Monitor System** | [Operations Runbook](./operations/operations-runbook.md) |
| **Fix Issues** | [Troubleshooting Guide](./operations/troubleshooting.md) |
| **Security Setup** | [Security Hardening](./security/hardening-guide.md) |
| **Performance Issues** | [Performance Tuning](./admin/performance-tuning.md) |

## 🛠️ Key Scripts & Commands

### Essential Operations
```bash
# System status check
./scripts/test-status.sh

# Deploy to production
./scripts/deploy.sh production

# Run security audit
./scripts/security-audit.sh

# Backup system
./scripts/backup.sh full

# Health check
./scripts/health-check.sh
```

### Development
```bash
# Start development environment
docker-compose up -d

# Run all tests
./scripts/test-all.sh

# Security hardening
./scripts/security-hardening.sh
```

### Monitoring
```bash
# Service discovery
./scripts/service-discovery.sh discover

# Check logs
docker-compose logs -f edge-api

# Metrics dashboard
open http://localhost:3000  # Grafana
```

## 🆘 Emergency Procedures

### System Down
1. Check [System Status](./operations/troubleshooting.md#system-down)
2. Run `./scripts/health-check.sh`
3. Review logs: `docker-compose logs`
4. Escalate if needed

### Security Incident
1. Follow [Incident Response](./security/incident-response.md)
2. Run `./scripts/security-audit.sh`
3. Check security logs
4. Report to security team

### Data Recovery
1. Stop services: `docker-compose down`
2. Run `./scripts/disaster-recovery.sh list-backups`
3. Restore: `./scripts/disaster-recovery.sh restore <backup-id>`
4. Verify integrity

## 📞 Support & Contact

- **Documentation Issues**: Create issue in repository
- **Security Concerns**: Follow incident response procedures
- **General Support**: Check troubleshooting guide first
- **Emergency**: Follow emergency procedures above

## 🔄 Document Maintenance

This documentation is maintained alongside the codebase. When making changes:

1. Update relevant documentation
2. Test all procedures
3. Update version information
4. Review with team members

---

**Last Updated**: $(date)  
**Version**: Production Ready  
**Maintainer**: Grahmos Operations Team
