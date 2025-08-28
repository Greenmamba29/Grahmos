#!/usr/bin/env bash

# Grahmos V1+V2 Unified - Production Security Hardening
# Phase 3: Improve/Deploy - Security Hardening

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"
}

# Generate strong secrets
generate_secrets() {
    log "🔐 Generating production secrets..."
    
    mkdir -p secrets/
    
    # JWT Secret
    openssl rand -hex 32 > secrets/jwt_secret.key
    
    # Encryption keys
    openssl rand -hex 32 > secrets/encryption_key.key
    
    # Database keys
    openssl rand -hex 16 > secrets/db_key.key
    
    # Session secret
    openssl rand -hex 32 > secrets/session_secret.key
    
    # Set secure permissions
    chmod 600 secrets/*.key
    
    log "✅ Production secrets generated"
}

# Harden container configurations
harden_containers() {
    log "🛡️  Hardening container configurations..."
    
    # Create hardened environment file
    cat > .env.production.hardened << 'EOF'
# Production Security Hardened Configuration

# Security Settings
NODE_ENV=production
LOG_LEVEL=warn
DEBUG=false

# Rate Limiting (Strict)
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_MAX_REQUESTS=50

# Session Security
SESSION_SECURE=true
SESSION_SAME_SITE=strict
SESSION_HTTP_ONLY=true

# CORS Security
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true

# TLS Configuration
TLS_MIN_VERSION=1.2
TLS_CIPHER_SUITE=ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS

# Database Security
DB_SSL_MODE=require
DB_CONNECTION_TIMEOUT=30000

# Container Security
DOCKER_CONTENT_TRUST=1
DOCKER_BUILDKIT=1

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
EOF

    log "✅ Container hardening complete"
}

# Setup secrets management
setup_secrets_management() {
    log "🔑 Setting up secrets management..."
    
    # Create secrets manager script
    cat > scripts/secrets-manager.sh << 'EOF'
#!/usr/bin/env bash
# Secrets management for production

case "$1" in
    get)
        docker run --rm -v "$PWD/secrets:/secrets:ro" \
            alpine:latest cat "/secrets/$2" 2>/dev/null || echo "Secret not found"
        ;;
    rotate)
        openssl rand -hex 32 > "secrets/$2"
        chmod 600 "secrets/$2"
        echo "Secret $2 rotated"
        ;;
    *)
        echo "Usage: $0 {get|rotate} <secret-name>"
        ;;
esac
EOF
    
    chmod +x scripts/secrets-manager.sh
    
    log "✅ Secrets management configured"
}

# Main hardening
main() {
    echo -e "${CYAN}🛡️  Grahmos V1+V2 Production Security Hardening${NC}"
    echo "================================================="
    echo ""
    
    generate_secrets
    harden_containers  
    setup_secrets_management
    
    echo ""
    echo -e "${GREEN}🎉 Security hardening completed!${NC}"
}

main "$@"
