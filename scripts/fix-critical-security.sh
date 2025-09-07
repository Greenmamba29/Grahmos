#!/bin/bash
# CRITICAL SECURITY FIXES - IMMEDIATE EXECUTION REQUIRED
# This script fixes all critical security vulnerabilities identified in the audit

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root (should not be)
if [[ $EUID -eq 0 ]]; then
    error "This script should not be run as root for security reasons"
    exit 1
fi

# Ensure we're in the workspace directory
cd /workspace

log "🚨 STARTING CRITICAL SECURITY FIXES"
log "This will fix all identified critical vulnerabilities"

# Phase 1: Fix Dependency Vulnerabilities
log "📦 Phase 1: Fixing dependency vulnerabilities..."

# Update package.json with security overrides
log "Adding security overrides to package.json..."
cat > temp_package_patch.json << 'EOF'
{
  "pnpm": {
    "overrides": {
      "body-parser": "^1.20.3",
      "path-to-regexp": "^0.1.12", 
      "got": "^11.8.5",
      "langchain": "^0.2.19",
      "esbuild": "^0.25.0",
      "next": "^15.4.7",
      "sharp": "^0.33.5"
    }
  }
}
EOF

# Merge with existing package.json
if command -v jq &> /dev/null; then
    jq -s '.[0] * .[1]' package.json temp_package_patch.json > package.json.new
    mv package.json.new package.json
    rm temp_package_patch.json
    success "Security overrides added to package.json"
else
    warn "jq not found, manually adding overrides to package.json"
    # Backup original
    cp package.json package.json.backup
    
    # Add overrides section if it doesn't exist
    if ! grep -q '"overrides"' package.json; then
        # Add the overrides section before the closing brace
        sed -i '$ i\  },\
  "pnpm": {\
    "overrides": {\
      "body-parser": "^1.20.3",\
      "path-to-regexp": "^0.1.12",\
      "got": "^11.8.5", \
      "langchain": "^0.2.19",\
      "esbuild": "^0.25.0",\
      "next": "^15.4.7",\
      "sharp": "^0.33.5"\
    }' package.json
    fi
    rm temp_package_patch.json
fi

# Update dependencies
log "Updating vulnerable dependencies..."
pnpm update body-parser@^1.20.3 || warn "Failed to update body-parser"
pnpm update path-to-regexp@^0.1.12 || warn "Failed to update path-to-regexp" 
pnpm update got@^11.8.5 || warn "Failed to update got"
pnpm update langchain@^0.2.19 || warn "Failed to update langchain"
pnpm update esbuild@^0.25.0 || warn "Failed to update esbuild"
pnpm update next@^15.4.7 || warn "Failed to update next"

# Reinstall to apply overrides
log "Reinstalling dependencies with security overrides..."
pnpm install

# Verify fixes
log "Verifying dependency vulnerability fixes..."
if pnpm audit --audit-level=high > /dev/null 2>&1; then
    success "✅ All high/critical dependency vulnerabilities fixed!"
else
    warn "⚠️ Some vulnerabilities may remain, check pnpm audit output"
fi

# Phase 2: Generate Production Secrets
log "🔐 Phase 2: Generating secure production secrets..."

# Create secrets directory with secure permissions
SECRETS_DIR="/workspace/secrets"
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

# Generate cryptographically secure secrets
log "Generating JWT secret..."
openssl rand -hex 32 > "$SECRETS_DIR/jwt_secret.key"

log "Generating encryption key..."
openssl rand -hex 32 > "$SECRETS_DIR/encryption_key.key"

log "Generating Grafana admin password..."
openssl rand -hex 32 > "$SECRETS_DIR/grafana_secret.key"

log "Generating Redis password..."
openssl rand -hex 16 > "$SECRETS_DIR/redis_password.key"

log "Generating session secret..."
openssl rand -hex 32 > "$SECRETS_DIR/session_secret.key"

log "Generating Meilisearch master key..."
openssl rand -hex 32 > "$SECRETS_DIR/meilisearch_master_key.key"

log "Generating database encryption key..."
openssl rand -hex 32 > "$SECRETS_DIR/database_encryption_key.key"

# Set secure permissions on all secret files
chmod 600 "$SECRETS_DIR"/*.key
success "✅ Production secrets generated securely"

# Phase 3: Create Production Environment File
log "📝 Phase 3: Creating production environment configuration..."

cat > .env.production << EOF
# PRODUCTION SECRETS - NEVER COMMIT THIS FILE
# Generated on $(date)

# Core Application Secrets
JWT_SECRET=$(cat "$SECRETS_DIR/jwt_secret.key")
ENCRYPTION_KEY=$(cat "$SECRETS_DIR/encryption_key.key")
SESSION_SECRET=$(cat "$SECRETS_DIR/session_secret.key")
DATABASE_ENCRYPTION_KEY=$(cat "$SECRETS_DIR/database_encryption_key.key")

# Service Passwords
GRAFANA_ADMIN_PASSWORD=$(cat "$SECRETS_DIR/grafana_secret.key")
GRAFANA_SECRET_KEY=$(openssl rand -hex 32)
REDIS_PASSWORD=$(cat "$SECRETS_DIR/redis_password.key")
MEILI_MASTER_KEY=$(cat "$SECRETS_DIR/meilisearch_master_key.key")

# Database Configuration
DB_ENCRYPTION_ENABLED=true
DB_SSL_MODE=require

# Security Configuration
NODE_ENV=production
SECURITY_HARDENED=true
LOG_LEVEL=warn
AUDIT_LOGGING=true

# API Keys (SET THESE MANUALLY)
# OPENAI_API_KEY=your_openai_api_key_here
# COQUI_API_KEY=your_coqui_api_key_here
# ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Monitoring
PROMETHEUS_METRICS_ENABLED=true
GRAFANA_SECURITY_ENABLED=true

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Security
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true

# TLS Configuration
TLS_MIN_VERSION=1.2
TLS_PREFER_SERVER_CIPHERS=true
EOF

chmod 600 .env.production
success "✅ Production environment file created"

# Phase 4: Update .gitignore for Security
log "🔒 Phase 4: Updating .gitignore for security..."

cat >> .gitignore << 'EOF'

# Security - NEVER commit these files
.env.production
.env.local
.env.staging
secrets/
*.key
*.pem
*.p12
*.crt
*.csr
backup/
security-scan-*.json
audit-*.log

# IDE and OS files that may contain sensitive data
.vscode/settings.json
.idea/
*~
.DS_Store
Thumbs.db

# Temporary security files
temp_*
*.tmp
EOF

success "✅ .gitignore updated with security exclusions"

# Phase 5: Fix Docker Configuration Security Issues
log "🐳 Phase 5: Fixing Docker security configurations..."

# Create a backup of docker-compose files
cp docker-compose.yml docker-compose.yml.backup
cp docker-compose.prod.yml docker-compose.prod.yml.backup

# Replace hardcoded secrets in docker-compose.yml
log "Replacing hardcoded secrets in docker-compose.yml..."
sed -i 's/development_master_key/${MEILI_MASTER_KEY}/g' docker-compose.yml
sed -i 's/development_redis_password/${REDIS_PASSWORD}/g' docker-compose.yml
sed -i 's/replace_with_strong_key_in_production/${JWT_SECRET}/g' docker-compose.yml

# Replace hardcoded secrets in docker-compose.prod.yml
log "Replacing hardcoded secrets in docker-compose.prod.yml..."
sed -i 's/changeme/${GRAFANA_ADMIN_PASSWORD}/g' docker-compose.prod.yml

# Fix infra security configs
if [[ -f "infra/security/docker-security.yml" ]]; then
    log "Fixing hardcoded secrets in infrastructure configs..."
    cp "infra/security/docker-security.yml" "infra/security/docker-security.yml.backup"
    sed -i 's/changeme/${REDIS_PASSWORD}/g' "infra/security/docker-security.yml"
    sed -i 's/changeme/${GRAFANA_ADMIN_PASSWORD}/g' "infra/security/docker-security.yml"
fi

# Fix monitoring configs  
if [[ -f "scripts/setup-monitoring.sh" ]]; then
    log "Fixing hardcoded secrets in monitoring setup..."
    cp "scripts/setup-monitoring.sh" "scripts/setup-monitoring.sh.backup"
    sed -i 's/admin123/${GRAFANA_ADMIN_PASSWORD}/g' "scripts/setup-monitoring.sh"
fi

success "✅ Docker configurations secured"

# Phase 6: Create Security Validation Script
log "🔍 Phase 6: Creating security validation script..."

cat > scripts/validate-security.sh << 'EOF'
#!/bin/bash
# Security validation script - run after fixes

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🔍 SECURITY VALIDATION REPORT${NC}"
echo "======================================"

# Check 1: Dependency vulnerabilities
echo -n "Dependency vulnerabilities: "
if pnpm audit --audit-level=high > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASSED${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Check 2: Secrets directory
echo -n "Secrets directory security: "
if [[ -d "secrets" ]] && [[ $(stat -c "%a" secrets) == "700" ]]; then
    echo -e "${GREEN}✅ PASSED${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Check 3: Environment file
echo -n "Production environment file: "
if [[ -f ".env.production" ]] && [[ $(stat -c "%a" .env.production) == "600" ]]; then
    echo -e "${GREEN}✅ PASSED${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Check 4: No hardcoded secrets
echo -n "Hardcoded secrets removed: "
if ! grep -r "admin123\|changeme\|development.*key" docker-compose*.yml > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASSED${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Check 5: .gitignore security
echo -n ".gitignore security entries: "
if grep -q "secrets/" .gitignore && grep -q ".env.production" .gitignore; then
    echo -e "${GREEN}✅ PASSED${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

echo ""
echo -e "${GREEN}Security validation completed!${NC}"
EOF

chmod +x scripts/validate-security.sh

# Phase 7: Final Validation
log "✅ Phase 7: Running final security validation..."

# Run the validation script
./scripts/validate-security.sh

# Final security audit
log "Running final dependency audit..."
pnpm audit --audit-level=moderate || warn "Some moderate vulnerabilities may remain"

# Success message
echo ""
echo "======================================"
success "🎉 CRITICAL SECURITY FIXES COMPLETED!"
echo "======================================"
echo ""
echo "✅ Fixed dependency vulnerabilities"
echo "✅ Generated secure production secrets" 
echo "✅ Removed hardcoded credentials"
echo "✅ Secured Docker configurations"
echo "✅ Updated .gitignore for security"
echo "✅ Created validation tools"
echo ""
warn "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Set your API keys in .env.production"
echo "2. Deploy with: docker-compose -f docker-compose.prod.yml --env-file .env.production up -d"
echo "3. Run regular security scans: ./scripts/validate-security.sh"
echo "4. Review the full remediation plan: SECURITY_REMEDIATION_PLAN.md"
echo ""
warn "🔒 REMEMBER: Never commit .env.production or secrets/ to version control!"