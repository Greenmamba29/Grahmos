# Production Deployment Guide

## 🏭 Grahmos V1+V2 Unified Production Deployment

This guide provides step-by-step instructions for deploying Grahmos V1+V2 unified system to production environments with enterprise-grade security, monitoring, and reliability.

## 📋 Pre-Deployment Checklist

### Infrastructure Requirements
- [ ] **Server Resources**: 16GB+ RAM, 8+ CPU cores, 200GB+ storage
- [ ] **Operating System**: Ubuntu 20.04+ / RHEL 8+ / CentOS 8+
- [ ] **Network**: Static IP, domain name configured
- [ ] **SSL Certificates**: Valid certificates for your domain
- [ ] **Backup Storage**: S3-compatible storage or external backup location

### Software Prerequisites
- [ ] **Docker**: Version 20.10+ installed and configured
- [ ] **Docker Compose**: V2 installed
- [ ] **System Updates**: All security patches applied
- [ ] **Firewall**: Configured to allow only necessary ports
- [ ] **Monitoring**: Log aggregation and monitoring solutions ready

### Security Prerequisites
- [ ] **Non-root user**: Created for running applications
- [ ] **SSH hardening**: Key-based authentication, disabled password auth
- [ ] **System hardening**: SELinux/AppArmor enabled
- [ ] **Network security**: Proper firewall rules configured

## 🚀 Production Deployment Steps

### 1. System Preparation

#### Create Application User
```bash
# Create non-root user for applications
sudo useradd -m -s /bin/bash grahmos
sudo usermod -aG docker grahmos

# Setup SSH key for grahmos user
sudo -u grahmos ssh-keygen -t ed25519 -C "grahmos-production"
```

#### System Hardening
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git openssl ufw fail2ban

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### 2. Application Deployment

#### Clone and Setup
```bash
# Switch to application user
sudo -i -u grahmos

# Clone repository
git clone <repository-url> /home/grahmos/grahmos
cd /home/grahmos/grahmos

# Make scripts executable
chmod +x scripts/*.sh

# Run system prerequisites check
./scripts/test-status.sh
```

#### Security Hardening
```bash
# Generate production secrets
./scripts/security-hardening.sh

# Verify security configuration
./scripts/security-audit.sh
```

#### SSL Certificate Setup
```bash
# Create certificates directory
mkdir -p certs/

# Option 1: Use Let's Encrypt (recommended)
sudo certbot certonly --standalone -d yourdomain.com
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem certs/server.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem certs/server.key
sudo chown grahmos:grahmos certs/*

# Option 2: Use existing certificates
# Copy your certificates to certs/server.crt and certs/server.key
```

### 3. Production Configuration

#### Environment Configuration
```bash
# Copy production environment template
cp .env.production.hardened .env.production

# Edit production environment
vim .env.production
```

**Key production settings:**
```bash
# Domain and SSL
DOMAIN=yourdomain.com
SSL_ENABLED=true

# Security
NODE_ENV=production
DEBUG=false
LOG_LEVEL=warn

# Database
DATABASE_URL=your-production-db-url
DATABASE_SSL=true

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true

# Backup
BACKUP_ENABLED=true
BACKUP_S3_BUCKET=your-backup-bucket
```

#### Production Compose Configuration
```bash
# Deploy with production configuration
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f infra/security/docker-security.yml \
  up -d
```

### 4. Initial Deployment

#### Deploy Services
```bash
# Run production deployment
./scripts/deploy.sh production

# Wait for services to start
sleep 30

# Verify deployment
./scripts/health-check.sh
```

#### Post-Deployment Verification
```bash
# Check all services are running
docker-compose ps

# Test API endpoints
curl -f https://yourdomain.com/api/health
curl -f https://yourdomain.com/api/v1/status
curl -f https://yourdomain.com/api/v2/status

# Check monitoring endpoints
curl -f http://localhost:9090/metrics  # Prometheus
curl -f http://localhost:3000/api/health  # Grafana
```

### 5. Monitoring Setup

#### Configure Dashboards
```bash
# Access Grafana
# URL: https://yourdomain.com:3000
# Default: admin/admin (change immediately)

# Import default dashboards
# Dashboards are pre-configured in infra/grafana/dashboards/
```

#### Setup Alerting
```bash
# Configure Prometheus alerts
# Edit infra/prometheus/prometheus.yml

# Test alert routing
curl -f http://localhost:9093/api/v1/alerts  # Alertmanager
```

### 6. Backup Configuration

#### Configure Automated Backups
```bash
# Setup backup service
docker-compose -f infra/backup/docker-compose.backup.yml up -d

# Test backup
./scripts/backup.sh full

# Verify backup
./scripts/disaster-recovery.sh list-backups
```

#### Schedule Regular Backups
```bash
# Add to crontab
crontab -e

# Add these lines:
# Daily backup at 2 AM
0 2 * * * /home/grahmos/grahmos/scripts/backup.sh incremental >> /var/log/grahmos-backup.log 2>&1

# Weekly full backup at 2 AM Sunday
0 2 * * 0 /home/grahmos/grahmos/scripts/backup.sh full >> /var/log/grahmos-backup.log 2>&1

# Monthly security audit
0 3 1 * * /home/grahmos/grahmos/scripts/security-audit.sh >> /var/log/grahmos-security.log 2>&1
```

## 🔧 Production Operations

### Service Management

#### Start/Stop Services
```bash
# Start all services
./scripts/deploy.sh production

# Stop services for maintenance
docker-compose down

# Restart specific service
docker-compose restart edge-api

# Rolling update with zero downtime
./scripts/deploy.sh production --rolling-update
```

#### Health Monitoring
```bash
# System health check
./scripts/health-check.sh

# Service discovery and status
./scripts/service-discovery.sh monitor

# Performance metrics
docker stats
```

### Log Management

#### Access Logs
```bash
# Application logs
docker-compose logs -f edge-api

# System logs
sudo journalctl -u docker -f

# Security logs
sudo tail -f /var/log/auth.log
```

#### Log Rotation
```bash
# Configure Docker log rotation
sudo tee /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  }
}
EOF

sudo systemctl restart docker
```

## 🔒 Security Operations

### Security Monitoring
```bash
# Run security audit
./scripts/security-audit.sh

# Check for security updates
sudo unattended-upgrades --dry-run

# Monitor failed login attempts
sudo grep "Failed password" /var/log/auth.log
```

### Certificate Management
```bash
# Check certificate expiry
openssl x509 -enddate -noout -in certs/server.crt

# Renew Let's Encrypt certificates
sudo certbot renew --dry-run
```

### Secret Rotation
```bash
# Rotate application secrets
./scripts/secrets-manager.sh rotate jwt_secret.key
./scripts/secrets-manager.sh rotate encryption_key.key

# Restart services after rotation
docker-compose restart edge-api
```

## 📊 Performance Optimization

### Database Optimization
```bash
# Monitor database performance
docker-compose exec database-service pg_stat_statements

# Optimize queries based on metrics
```

### Caching Strategy
```bash
# Monitor Redis cache hit rate
docker-compose exec redis redis-cli info stats

# Tune cache settings based on usage
```

### Resource Tuning
```bash
# Monitor resource usage
docker stats

# Adjust resource limits in docker-compose.prod.yml
# Scale services based on load
```

## 🚨 Disaster Recovery

### Backup Procedures
```bash
# Create emergency backup
./scripts/backup.sh emergency

# Test backup integrity
./scripts/disaster-recovery.sh validate-backup <backup-id>
```

### Recovery Procedures
```bash
# Full system restore
./scripts/disaster-recovery.sh restore <backup-id>

# Partial restore (data only)
./scripts/disaster-recovery.sh restore <backup-id> --data-only
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Load balancer configuration
- Database read replicas
- Redis clustering
- CDN integration

### Vertical Scaling
- Resource limit adjustments
- Container resource allocation
- System resource upgrades

## 🛡️ Compliance & Auditing

### Regular Audits
```bash
# Monthly security audit
./scripts/security-audit.sh

# Compliance check
./scripts/compliance-check.sh

# Performance audit
./scripts/performance-audit.sh
```

### Compliance Reports
- SOC2 compliance documentation
- GDPR compliance verification
- Security assessment reports

## 📱 Mobile & Distribution

### MDM Provisioning (mTLS + eSIM)

**Objective:** One‑tap enrollment for native apps.

**Action:** MobileConfig/MDM installs client cert + CA, sets APN/eSIM profile for private RAN. App reads key from keychain/keystore automatically.

**MDM Configuration:**
```xml
<!-- iOS Configuration Profile -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <!-- Client Certificate -->
        <dict>
            <key>PayloadType</key>
            <string>com.apple.security.pkcs12</string>
            <key>PayloadData</key>
            <data>[BASE64_ENCODED_P12]</data>
            <key>Password</key>
            <string>[P12_PASSWORD]</string>
        </dict>
        
        <!-- APN Configuration -->
        <dict>
            <key>PayloadType</key>
            <string>com.apple.cellular</string>
            <key>APNs</key>
            <array>
                <dict>
                    <key>APN</key>
                    <string>grahmos.private</string>
                    <key>Name</key>
                    <string>Grahmos Private Network</string>
                </dict>
            </array>
        </dict>
        
        <!-- eSIM Profile -->
        <dict>
            <key>PayloadType</key>
            <string>com.apple.cellular.plan</string>
            <key>ICCID</key>
            <string>[ESIM_ICCID]</string>
        </dict>
    </array>
</dict>
</plist>
```

**Android Enterprise Setup:**
```json
{
  "applications": [
    {
      "packageName": "com.grahmos.app",
      "installType": "FORCE_INSTALLED",
      "managedConfiguration": {
        "client_cert_alias": "grahmos_client_cert",
        "private_apn": "grahmos.private",
        "auto_connect": true
      }
    }
  ],
  "networkPolicies": [
    {
      "networkId": "grahmos_private_5g",
      "allowedNetworkTypes": ["CELLULAR", "WIFI"]
    }
  ]
}
```

**Deployment Commands:**
```bash
# Generate MDM profiles
./scripts/mdm-generator.sh --platform=ios --cert-profile=production
./scripts/mdm-generator.sh --platform=android --enterprise-config

# Deploy via MDM
./scripts/mdm-deploy.sh --profile=grahmos-ios.mobileconfig --target-groups=pilot
./scripts/mdm-deploy.sh --profile=grahmos-android.json --target-groups=pilot

# Verify enrollment
./scripts/mdm-status.sh --check-enrollment --platform=all
```

### PWA Storage Strategy

**Action:** Target ≤150 MB mini‑index for iOS; chunk shards; zstd compress; eviction policy documented; rehydrate on next RAN attach.

**Storage Implementation:**
```typescript
// PWA Storage Management
interface StorageStrategy {
  maxSize: 150 * 1024 * 1024; // 150 MB for iOS compatibility
  compressionAlgorithm: 'zstd';
  shardSize: 5 * 1024 * 1024;  // 5 MB chunks
  evictionPolicy: 'lru-with-frequency';
  rehydrationTrigger: 'network-attach';
}

// Storage quota management
class PWAStorageManager {
  async checkQuota(): Promise<StorageQuota> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return await navigator.storage.estimate();
    }
    return { usage: 0, quota: this.maxSize };
  }
  
  async evictOldShards(requiredSpace: number): Promise<void> {
    const shards = await this.getShardsByAccessTime();
    let freedSpace = 0;
    
    for (const shard of shards) {
      if (freedSpace >= requiredSpace) break;
      await this.deleteShard(shard.id);
      freedSpace += shard.size;
    }
  }
  
  async rehydrateOnNetworkAttach(): Promise<void> {
    if (navigator.onLine && this.shouldRehydrate()) {
      await this.syncWithEdgeNode();
    }
  }
}
```

**Storage Configuration:**
```bash
# PWA build with storage optimization
cd pwa
npm run build:storage-optimized

# Compression and chunking
./scripts/pwa-optimize.sh --compress=zstd --chunk-size=5MB --target-size=150MB

# iOS Safari quota testing
./scripts/test-pwa-storage.sh --platform=ios --quota-test
```

### Accessibility Checklist

**Action:** Enforce WCAG 2.1 AA: focus order, contrast, captions for TTS outputs; automated axe checks in CI.

**WCAG 2.1 AA Requirements:**

| Criterion | Requirement | Implementation | Testing |
|-----------|-------------|----------------|----------|
| **1.1.1 Non-text Content** | Alt text for images | `alt` attributes, ARIA labels | Automated scan |
| **1.3.1 Info and Relationships** | Semantic markup | Proper heading structure, lists | Screen reader test |
| **1.4.3 Contrast** | 4.5:1 normal, 3:1 large text | Color palette validation | Contrast analyzer |
| **1.4.11 Non-text Contrast** | 3:1 for UI components | Button/form field colors | Automated check |
| **2.1.1 Keyboard** | All functionality via keyboard | Tab navigation, shortcuts | Manual testing |
| **2.4.3 Focus Order** | Logical focus sequence | CSS and DOM order | Tab order review |
| **3.1.1 Language** | Page language specified | `lang` attribute | HTML validation |
| **4.1.2 Name, Role, Value** | Accessible names/roles | ARIA attributes | Accessibility tree |

**Accessibility Implementation:**
```typescript
// Voice Assistant Accessibility
interface AccessibilityFeatures {
  voiceOutput: {
    captions: boolean;
    transcription: boolean;
    pauseControl: boolean;
  };
  navigation: {
    skipLinks: boolean;
    landmarkRoles: boolean;
    headingStructure: boolean;
  };
  interaction: {
    keyboardOnly: boolean;
    focusManagement: boolean;
    reducedMotion: boolean;
  };
}

// TTS Accessibility Enhancement
class AccessibleTTS {
  async speakWithCaptions(text: string, options: TTSOptions): Promise<void> {
    // Display captions for deaf/hard-of-hearing users
    this.displayCaptions(text);
    
    // Respect user's reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (!prefersReducedMotion) {
      await this.speakText(text, options);
    }
  }
  
  displayCaptions(text: string): void {
    const captionElement = document.getElementById('tts-captions');
    if (captionElement) {
      captionElement.textContent = text;
      captionElement.setAttribute('aria-live', 'polite');
    }
  }
}
```

**CI/CD Accessibility Testing:**
```yaml
# .github/workflows/accessibility.yml
name: Accessibility Testing

on:
  pull_request:
    paths: ['pwa/**', 'apps/**']

jobs:
  accessibility_test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build application
        run: npm run build
        
      - name: Run axe accessibility tests
        run: |
          npx @axe-core/cli http://localhost:3000 \
            --rules wcag2a,wcag2aa,wcag21aa \
            --tags wcag2a,wcag2aa,wcag21aa \
            --fail-on-violations
            
      - name: Run Lighthouse accessibility audit
        uses: treosh/lighthouse-ci-action@v9
        with:
          configPath: './lighthouse-accessibility.json'
          
      - name: Color contrast validation
        run: |
          npx pa11y http://localhost:3000 \
            --standard WCAG2AA \
            --threshold 10
```

**Accessibility Testing Commands:**
```bash
# Automated accessibility scanning
./scripts/accessibility-test.sh --standard=wcag2aa --platform=all

# Screen reader testing simulation
./scripts/screen-reader-test.sh --voice-over --nvda --jaws

# Keyboard navigation testing
./scripts/keyboard-nav-test.sh --tab-order --shortcuts

# Color contrast validation
./scripts/contrast-check.sh --minimum-ratio=4.5 --report

# Focus management testing
./scripts/focus-test.sh --modal-dialogs --dynamic-content
```

## 🔄 CI/CD Integration

### Automated Deployment Pipeline
- GitHub Actions configured
- Security scanning integrated
- Automated testing pipeline
- Blue-green deployment strategy
- Mobile app distribution
- Accessibility validation

### Deployment Verification
```bash
# Post-deployment tests
./scripts/test-all.sh production

# Performance benchmarks
./scripts/test-performance.sh production

# Mobile app verification
./scripts/test-mobile-apps.sh --platform=all --mdm-check

# Accessibility compliance check
./scripts/test-accessibility.sh --wcag2aa --report
```

---

## 📞 Production Support

### Monitoring URLs
- **Grafana**: https://yourdomain.com:3000
- **Prometheus**: Internal access only
- **Application Health**: https://yourdomain.com/api/health

### Emergency Contacts
- **Operations Team**: ops@company.com
- **Security Team**: security@company.com
- **On-Call**: +1-XXX-XXX-XXXX

### Escalation Procedures
1. Check monitoring dashboards
2. Review application logs
3. Run health diagnostics
4. Follow incident response playbook
5. Escalate to on-call engineer

---

**Last Updated**: $(date)  
**Environment**: Production  
**Version**: 1.0.0
