# Compliance & Policy - Grahmos V1+V2 Unified

## 🏛️ Regulatory Compliance Framework

This document outlines compliance mappings, data governance, and policy enforcement for the Grahmos V1+V2 unified system.

## 📊 Control Mapping Snapshot

### Objective: Trace features to controls (SOC2/NIST)

**Action:** Maintain a table mapping features to security controls across multiple compliance frameworks.

| Control Domain | SOC2 Control | NIST Control | Grahmos Implementation | Validation Method |
|----------------|--------------|--------------|----------------------|-------------------|
| **Access Control** | CC6.1, CC6.2, CC6.3 | AC-2, AC-3, AC-6 | mTLS/DPoP/JWT authentication | Authentication tests, audit logs |
| **Change Management** | CC8.1, CC8.2 | CM-2, CM-3, CM-5 | CI/CD gated deployments | Pipeline logs, approval records |
| **Logging & Monitoring** | CC7.1, CC7.2, CC7.3 | AU-2, AU-3, AU-6 | Loki/OpenTelemetry/Prometheus | Log retention, monitoring alerts |
| **Incident Response** | CC7.4, CC7.5 | IR-1, IR-2, IR-4 | Automated runbooks, escalation | Response time metrics, postmortems |
| **Data Protection** | CC6.7, CC6.8 | SC-8, SC-13, SC-28 | Encryption at rest/transit | Encryption validation, key rotation |
| **Backup & Recovery** | A1.2, A1.3 | CP-1, CP-2, CP-4 | Automated backups, index swaps | Recovery testing, RTO/RPO metrics |
| **Network Security** | CC6.1, CC6.6 | SC-7, SC-8, SC-23 | Private 4G/5G, NTN/HAPS | Network segmentation, TLS validation |
| **System Integrity** | CC8.1, PI1.1 | SI-2, SI-3, SI-7 | Container hardening, SLSA attestations | Vulnerability scans, integrity checks |

### Compliance Validation Schedule

```bash
# Daily compliance checks
./scripts/security-audit.sh --compliance-check

# Monthly compliance report
./scripts/compliance-report.sh --framework=soc2 --month=$(date +%Y-%m)

# Quarterly compliance review
./scripts/compliance-report.sh --comprehensive --quarter=Q$(date +%q)
```

## 🔐 Data Retention & PII Policy

### Data Classification

| Data Type | Classification | Retention Period | Storage Location | Access Control |
|-----------|----------------|-----------------|------------------|----------------|
| **Application Logs** | Internal | 30 days hot, 180 days cold | Loki/S3 Archive | Admin, SRE |
| **Security Logs** | Confidential | 1 year hot, 3 years cold | Secure logging service | Security team only |
| **Audit Logs** | Confidential | 2 years hot, 7 years archive | Compliance archive | Audit, Compliance |
| **Trace Data** | Internal | 7 days Jaeger, sampled 5% | Jaeger/Archive | Dev, SRE |
| **User PII** | Restricted | 2 years or deletion request | Encrypted database | Application, Privacy team |
| **Search Indexes** | Mixed | Based on source data policy | Edge nodes, encrypted | Users per ACL |

### Data Retention Implementation

```bash
# Log retention configuration
# Loki configuration
retention_period: 30d
compactor:
  retention_enabled: true
  retention_delete_delay: 2h

# Jaeger retention
trace_retention: 168h  # 7 days
sampling_rate: 0.05    # 5%

# PII retention job
0 2 * * 0 /scripts/pii-cleanup.sh --dry-run >> /var/log/pii-cleanup.log
0 3 * * 0 /scripts/pii-cleanup.sh --execute >> /var/log/pii-cleanup.log
```

### PII Handling Procedures

**Action:** PII redaction at ingest; ban secrets in logs via CI check.

```bash
# PII redaction patterns
PII_PATTERNS=(
  "email:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
  "ssn:[0-9]{3}-[0-9]{2}-[0-9]{4}"
  "phone:[0-9]{3}-[0-9]{3}-[0-9]{4}"
  "credit_card:[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}"
)

# Automated PII scanning
./scripts/pii-scanner.sh --scan-logs --redact --report

# CI/CD secret detection
pre-commit-hook:
  - detect-secrets
  - truffleHog
  - git-leaks
```

**PII Processing Requirements:**
- **Consent Management**: Explicit consent for PII collection
- **Right to Deletion**: 30-day SLA for deletion requests
- **Data Portability**: Export capability for user data
- **Breach Notification**: 72-hour notification requirement
- **Cross-Border Transfer**: GDPR Article 46 safeguards

## 🔒 License Policy Gate

### Objective: SBOM scan must block disallowed licenses

**Action:** License policy enforcement in CI/CD pipeline with exception approval process.

```yaml
# License policy configuration
license_policy:
  allowed_licenses:
    - MIT
    - Apache-2.0
    - BSD-3-Clause
    - ISC
    - CC0-1.0
  
  restricted_licenses:
    - GPL-3.0    # Requires legal review
    - AGPL-3.0   # Requires legal review
    - SSPL-1.0   # Commercial conflict
  
  prohibited_licenses:
    - WTFPL      # Unprofessional
    - Unlicense  # Legal uncertainty

# CI/CD integration
jobs:
  license_scan:
    runs-on: ubuntu-latest
    steps:
      - name: SBOM Generation
        run: |
          syft packages . -o spdx-json > sbom.json
          
      - name: License Policy Check
        run: |
          grype sbom.json --fail-on medium
          ./scripts/license-check.sh sbom.json
          
      - name: License Exception Check
        if: failure()
        run: |
          # Check for approved exceptions
          if ! ./scripts/check-license-exceptions.sh; then
            echo "❌ Disallowed licenses found without exception approval"
            exit 1
          fi
```

**License Exception Process:**
1. **Detection**: CI/CD pipeline identifies restricted license
2. **Ticket Creation**: Automatic JIRA ticket for legal review
3. **Review Process**: Legal team evaluates risk and compatibility
4. **Approval/Denial**: Decision documented with rationale
5. **Exception Tracking**: Approved exceptions added to allowlist

### SBOM Publication

```bash
# Generate and publish SBOM
./scripts/generate-sbom.sh --format=spdx-json --sign
./scripts/publish-sbom.sh --registry=ghcr.io --tag=latest

# SBOM verification
cosign verify-attestation ghcr.io/grahmos/edge-api:latest \
  --type spdxjson --certificate-identity-regexp=".*" \
  --certificate-oidc-issuer-regexp=".*"
```

## 🏢 Organizational Controls

### Privacy Impact Assessment (PIA)

| Data Element | Purpose | Legal Basis | Retention | Third Parties |
|--------------|---------|-------------|-----------|---------------|
| User Authentication | Access control | Legitimate interest | Account lifetime | None |
| Search Queries | Service delivery | Contract performance | 30 days | None |
| Usage Analytics | Service improvement | Legitimate interest | 1 year aggregated | None |
| Error Logs | System maintenance | Legitimate interest | 30 days | Cloud provider |
| Payment Data | Transaction processing | Contract performance | Per regulation | Payment processor |

### Data Processing Register

```bash
# Data processing activities tracking
./scripts/privacy-audit.sh --generate-register

# Privacy compliance check
./scripts/privacy-audit.sh --check-consent --check-retention

# Data subject request handling
./scripts/privacy-audit.sh --subject-request --type=export --user-id=$USER_ID
./scripts/privacy-audit.sh --subject-request --type=delete --user-id=$USER_ID
```

## 🛡️ Security Governance

### Security Control Testing

```bash
# Monthly security control validation
./scripts/security-controls-test.sh --framework=soc2

# Penetration testing integration
./scripts/pentest-runner.sh --scope=external --automated

# Vulnerability management
./scripts/vulnerability-scan.sh --severity=medium --notify
```

### Risk Management

| Risk Category | Impact | Likelihood | Mitigation | Owner |
|---------------|--------|------------|------------|-------|
| Data Breach | High | Low | Encryption, Access Controls, Monitoring | CISO |
| Service Outage | Medium | Medium | HA Architecture, Backups, Monitoring | Engineering |
| Supply Chain Attack | High | Low | SLSA, Attestations, SBOM | Security |
| Regulatory Non-compliance | High | Low | Automated Controls, Audits | Compliance |
| Key Compromise | Medium | Low | HSM, Key Rotation, Detection | Security |

### Audit & Assessment Schedule

```bash
# Internal security assessment (quarterly)
Q1: ./scripts/security-assessment.sh --type=internal --quarter=1
Q2: ./scripts/security-assessment.sh --type=internal --quarter=2
Q3: ./scripts/security-assessment.sh --type=internal --quarter=3
Q4: ./scripts/security-assessment.sh --type=internal --quarter=4

# External audit preparation (annual)
./scripts/audit-prep.sh --auditor=big4 --framework=soc2 --year=$(date +%Y)

# Compliance reporting
./scripts/compliance-report.sh --stakeholders --format=executive-summary
```

## 📋 Policy Enforcement

### Automated Policy Checks

```bash
# Policy as code validation
./scripts/policy-check.sh --opa --policies=security,privacy,compliance

# Configuration drift detection
./scripts/config-drift.sh --baseline=production --alert-threshold=medium

# Compliance monitoring
./scripts/compliance-monitor.sh --continuous --frameworks=soc2,gdpr,ccpa
```

### Policy Violations Response

1. **Detection**: Automated monitoring identifies policy violation
2. **Classification**: Severity assessment (Low/Medium/High/Critical)
3. **Notification**: Immediate alert to responsible team
4. **Investigation**: Root cause analysis and impact assessment
5. **Remediation**: Corrective action implementation
6. **Documentation**: Incident documentation and lessons learned
7. **Prevention**: Policy updates and control improvements

### Training & Awareness

```bash
# Security training compliance tracking
./scripts/training-compliance.sh --report --overdue-alert

# Policy acknowledgment tracking
./scripts/policy-ack.sh --policy=security-policy --check-compliance

# Incident response training
./scripts/tabletop-exercise.sh --scenario=data-breach --participants=all
```

## 🔄 Continuous Compliance

### Compliance Dashboard

```bash
# Compliance metrics collection
compliance_score=$(./scripts/compliance-score.sh --framework=soc2)
policy_violations=$(./scripts/policy-violations.sh --count --last-30-days)
training_completion=$(./scripts/training-status.sh --percentage)

# Grafana dashboard updates
curl -X POST http://grafana:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @compliance-dashboard.json
```

### Regulatory Change Management

```bash
# Regulatory update monitoring
./scripts/reg-monitor.sh --jurisdictions=us,eu,uk --notify-changes

# Impact assessment workflow
./scripts/reg-impact.sh --change-id=$REG_CHANGE --assess --assign-owner

# Compliance gap analysis
./scripts/gap-analysis.sh --current-controls --required-controls --report
```

---

## 📞 Compliance Contacts

- **Chief Compliance Officer**: compliance@company.com
- **Data Protection Officer**: dpo@company.com  
- **Legal Counsel**: legal@company.com
- **Chief Information Security Officer**: ciso@company.com
- **Internal Audit**: audit@company.com

## 📚 Reference Documents

- [SOC 2 Control Implementation Guide](./soc2-implementation.md)
- [GDPR Compliance Procedures](./gdpr-procedures.md)
- [Data Classification Guide](./data-classification.md)
- [Incident Response Plan](./incident-response.md)
- [Privacy Policy](./privacy-policy.md)

---

**Last Updated**: $(date)  
**Version**: 2.0.0  
**Owner**: Compliance Team
