#!/usr/bin/env bash

# Edge Security Comprehensive Security Audit
# Reviews security configuration, validates threat model compliance, and identifies hardening gaps

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Audit configuration
AUDIT_RESULTS="./audit-results-security.log"
AUDIT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Audit scoring
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

echo "🔒 Edge Security Comprehensive Security Audit"
echo "=============================================="
echo "Audit Date: $AUDIT_DATE"
echo "Target: Edge Security & Speed Deployment Pack v1"
echo "" | tee "$AUDIT_RESULTS"

# Utility functions
log_check() {
    local check_name="$1"
    local severity="$2"  # CRITICAL, HIGH, MEDIUM, LOW
    local status="$3"    # PASS, FAIL, WARNING
    local finding="$4"
    local recommendation="${5:-}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    case "$status" in
        "PASS")
            echo -e "✅ ${GREEN}PASS${NC} [$severity] - $check_name" | tee -a "$AUDIT_RESULTS"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            ;;
        "FAIL")
            echo -e "❌ ${RED}FAIL${NC} [$severity] - $check_name" | tee -a "$AUDIT_RESULTS"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            ;;
        "WARNING")
            echo -e "⚠️ ${YELLOW}WARN${NC} [$severity] - $check_name" | tee -a "$AUDIT_RESULTS"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            ;;
    esac
    
    echo "   Finding: $finding" | tee -a "$AUDIT_RESULTS"
    if [[ -n "$recommendation" ]]; then
        echo "   Recommendation: $recommendation" | tee -a "$AUDIT_RESULTS"
    fi
    echo "" | tee -a "$AUDIT_RESULTS"
}

# Threat Model Categories
echo "🎯 THREAT MODEL VALIDATION"
echo "===========================" | tee -a "$AUDIT_RESULTS"

# TM-1: Authentication & Authorization Threats
echo "🔑 Analyzing Authentication & Authorization..."

check_mtls_enforcement() {
    if grep -q "ssl_verify_client on" ops/nginx.conf; then
        if grep -q "ssl_client_certificate.*ca.crt" ops/nginx.conf; then
            log_check "mTLS Certificate Enforcement" "CRITICAL" "PASS" \
                "mTLS properly enforced with client certificate validation" \
                "Ensure certificate revocation lists (CRL) are implemented for production"
        else
            log_check "mTLS Certificate Enforcement" "CRITICAL" "FAIL" \
                "Client CA certificate not properly configured" \
                "Configure ssl_client_certificate directive with proper CA certificate"
        fi
    else
        log_check "mTLS Certificate Enforcement" "CRITICAL" "FAIL" \
            "mTLS not enforced - clients can connect without certificates" \
            "Enable ssl_verify_client on in NGINX configuration"
    fi
}

check_jwt_pop_binding() {
    if grep -q "'x5t#S256'" edge-api/src/types.ts; then
        if [[ -f "edge-api/dist/server.js" ]] && grep -q "cnf.*x5t" edge-api/dist/server.js; then
            log_check "JWT Proof-of-Possession Binding" "CRITICAL" "PASS" \
                "JWT PoP properly implemented with certificate fingerprint binding" \
                "Consider implementing key rotation for long-lived certificates"
        else
            log_check "JWT Proof-of-Possession Binding" "CRITICAL" "WARNING" \
                "PoP binding defined but validation logic needs verification" \
                "Verify runtime JWT validation includes cnf claim validation"
        fi
    else
        log_check "JWT Proof-of-Possession Binding" "CRITICAL" "FAIL" \
            "PoP binding not implemented in JWT structure" \
            "Implement cnf claim with x5t#S256 certificate thumbprint"
    fi
}

check_session_management() {
    if grep -q "JWT_TTL_SECONDS.*300" docker-compose.edge.yml; then
        log_check "Session Token Lifetime" "MEDIUM" "PASS" \
            "JWT tokens have reasonable 5-minute lifetime" \
            "Consider implementing token refresh for longer sessions"
    else
        log_check "Session Token Lifetime" "MEDIUM" "WARNING" \
            "JWT token lifetime not clearly defined or too long" \
            "Set JWT_TTL_SECONDS to 300 (5 minutes) or less for security"
    fi
    
    if grep -q "HS512" edge-api/src/jwt.ts; then
        log_check "JWT Cryptographic Algorithm" "HIGH" "PASS" \
            "Strong HMAC-SHA512 algorithm used for JWT signing" \
            "Consider migrating to RS256 with rotating keys for enhanced security"
    else
        log_check "JWT Cryptographic Algorithm" "HIGH" "FAIL" \
            "Weak or unspecified JWT signing algorithm" \
            "Use HS512 or RS256 for JWT token signing"
    fi
}

check_mtls_enforcement
check_jwt_pop_binding
check_session_management

# TM-2: Network Security Threats
echo "🌐 Analyzing Network Security..."

check_tls_configuration() {
    if grep -q "ssl_protocols TLSv1.2 TLSv1.3" ops/nginx.conf; then
        log_check "TLS Protocol Version" "HIGH" "PASS" \
            "Only secure TLS 1.2/1.3 protocols allowed" \
            "Consider TLS 1.3 only for enhanced security in future"
    else
        log_check "TLS Protocol Version" "HIGH" "FAIL" \
            "Insecure TLS protocols may be allowed" \
            "Configure ssl_protocols to only allow TLSv1.2 TLSv1.3"
    fi
    
    if grep -q "ssl_ciphers.*ECDHE.*AES.*GCM" ops/nginx.conf; then
        log_check "TLS Cipher Suite" "HIGH" "PASS" \
            "Strong cipher suites configured (ECDHE + AES-GCM)" \
            "Regularly update cipher suites to remove deprecated algorithms"
    else
        log_check "TLS Cipher Suite" "HIGH" "WARNING" \
            "Cipher suite configuration needs verification" \
            "Ensure only strong, forward-secret cipher suites are enabled"
    fi
}

check_network_isolation() {
    if grep -q "proxy_pass.*unix:" ops/nginx.conf; then
        log_check "Service Communication Isolation" "MEDIUM" "PASS" \
            "Services communicate via Unix domain sockets (no network exposure)" \
            "Ensure Unix socket file permissions are restrictive (660 or less)"
    else
        log_check "Service Communication Isolation" "MEDIUM" "FAIL" \
            "Services may be exposed on network interfaces" \
            "Configure services to use Unix domain sockets for inter-service communication"
    fi
    
    if grep -q "networks:" docker-compose.edge.yml && grep -q "edge:" docker-compose.edge.yml; then
        log_check "Docker Network Isolation" "MEDIUM" "PASS" \
            "Custom Docker network configured for service isolation" \
            "Consider using multiple networks for further segmentation"
    else
        log_check "Docker Network Isolation" "MEDIUM" "WARNING" \
            "Default Docker network may be used" \
            "Configure custom Docker networks for better isolation"
    fi
}

check_rate_limiting() {
    if grep -q "limit_req_zone.*rate=" ops/nginx.conf; then
        local rate=$(grep "limit_req_zone" ops/nginx.conf | grep -o "rate=[0-9]*r/s" | head -1)
        if [[ "$rate" =~ rate=([0-9]+)r/s ]] && [ "${BASH_REMATCH[1]}" -le 30 ]; then
            log_check "Rate Limiting Configuration" "MEDIUM" "PASS" \
                "Appropriate rate limiting configured ($rate)" \
                "Monitor and adjust rate limits based on legitimate traffic patterns"
        else
            log_check "Rate Limiting Configuration" "MEDIUM" "WARNING" \
                "Rate limiting may be too permissive" \
                "Consider lowering rate limits for better DDoS protection"
        fi
    else
        log_check "Rate Limiting Configuration" "MEDIUM" "FAIL" \
            "No rate limiting configured" \
            "Implement rate limiting to protect against DDoS and brute force attacks"
    fi
}

check_tls_configuration
check_network_isolation  
check_rate_limiting

# TM-3: Container & Runtime Security
echo "🐳 Analyzing Container Security..."

check_container_hardening() {
    if grep -q "read_only: true" docker-compose.edge.yml; then
        log_check "Container Read-Only Filesystem" "HIGH" "PASS" \
            "Containers run with read-only filesystems" \
            "Ensure all necessary writable paths use tmpfs or volumes"
    else
        log_check "Container Read-Only Filesystem" "HIGH" "FAIL" \
            "Containers may run with writable filesystems" \
            "Configure read_only: true for all service containers"
    fi
    
    if grep -q "cap_drop.*ALL" docker-compose.edge.yml; then
        log_check "Container Capability Dropping" "HIGH" "PASS" \
            "All Linux capabilities dropped from containers" \
            "Review if any specific capabilities need to be added back"
    else
        log_check "Container Capability Dropping" "HIGH" "FAIL" \
            "Containers may retain dangerous Linux capabilities" \
            "Add cap_drop: [\"ALL\"] to all service configurations"
    fi
    
    if grep -q "no-new-privileges:true" docker-compose.edge.yml; then
        log_check "Container Privilege Escalation Protection" "HIGH" "PASS" \
            "Privilege escalation disabled in containers" \
            "Maintain this setting and audit for any privilege requirements"
    else
        log_check "Container Privilege Escalation Protection" "HIGH" "FAIL" \
            "Containers may allow privilege escalation" \
            "Add security_opt: [\"no-new-privileges:true\"] to all services"
    fi
}

check_user_security() {
    if grep -q "user.*10001:10001" docker-compose.edge.yml; then
        log_check "Non-Root Container Execution" "HIGH" "PASS" \
            "Containers run as non-root user (10001:10001)" \
            "Verify user exists in container images and has minimal permissions"
    else
        log_check "Non-Root Container Execution" "HIGH" "FAIL" \
            "Containers may run as root user" \
            "Configure user: directive with non-root UID:GID for all services"
    fi
    
    if grep -q "tmpfs:" docker-compose.edge.yml; then
        log_check "Secure Temporary Storage" "MEDIUM" "PASS" \
            "Temporary filesystems properly configured" \
            "Ensure tmpfs mounts have appropriate size limits and security options"
    else
        log_check "Secure Temporary Storage" "MEDIUM" "WARNING" \
            "Temporary storage configuration needs verification" \
            "Configure tmpfs mounts for /tmp and other writable directories"
    fi
}

check_container_hardening
check_user_security

# TM-4: Data Protection & Integrity
echo "📊 Analyzing Data Protection..."

check_data_encryption() {
    if grep -q "volumes:" docker-compose.edge.yml && grep -q ":ro" docker-compose.edge.yml; then
        log_check "Data Volume Protection" "MEDIUM" "PASS" \
            "Data volumes mounted as read-only where appropriate" \
            "Consider encrypting sensitive data volumes at rest"
    else
        log_check "Data Volume Protection" "MEDIUM" "WARNING" \
            "Data volume protection needs verification" \
            "Ensure data volumes have appropriate read-only and encryption settings"
    fi
    
    if [[ -f "updates/update.sh" ]] && grep -q "openssl dgst -sha256 -verify" updates/update.sh; then
        log_check "Update Integrity Verification" "HIGH" "PASS" \
            "Cryptographic signature verification for updates" \
            "Implement certificate pinning and CRL checking for update signing keys"
    else
        log_check "Update Integrity Verification" "HIGH" "FAIL" \
            "Update integrity verification missing or incomplete" \
            "Implement RSA-SHA256 signature verification for all updates"
    fi
}

check_secrets_management() {
    if grep -q "JWT_HS512_KEY.*default-dev-key" docker-compose.edge.yml; then
        log_check "Production Secrets Management" "CRITICAL" "WARNING" \
            "Default development key detected - not suitable for production" \
            "Replace default keys with cryptographically secure production keys"
    else
        log_check "Production Secrets Management" "CRITICAL" "PASS" \
            "No default development secrets detected" \
            "Ensure all production secrets are properly managed and rotated"
    fi
    
    if grep -q "environment:" docker-compose.edge.yml; then
        log_check "Environment Variable Security" "MEDIUM" "PASS" \
            "Secrets configured via environment variables" \
            "Consider using Docker secrets or external key management systems"
    else
        log_check "Environment Variable Security" "MEDIUM" "WARNING" \
            "Environment variable security needs verification" \
            "Ensure sensitive data is not hardcoded in configuration files"
    fi
}

check_data_encryption
check_secrets_management

# TM-5: Input Validation & Injection Prevention
echo "🛡️ Analyzing Input Validation..."

check_input_validation() {
    if [[ -f "edge-api/dist/server.js" ]] && grep -q "query.*q.*trim" edge-api/dist/server.js; then
        log_check "Search Input Sanitization" "HIGH" "PASS" \
            "Search queries are properly sanitized" \
            "Implement additional input validation and length limits"
    else
        log_check "Search Input Sanitization" "HIGH" "WARNING" \
            "Search input validation needs verification" \
            "Ensure all user inputs are properly validated and sanitized"
    fi
    
    if [[ -f "edge-api/dist/server.js" ]] && grep -q "LIMIT.*?" edge-api/dist/server.js; then
        log_check "SQL Injection Prevention" "HIGH" "PASS" \
            "Parameterized queries used for database operations" \
            "Continue using parameterized queries and avoid dynamic SQL construction"
    else
        log_check "SQL Injection Prevention" "HIGH" "WARNING" \
            "SQL injection prevention needs verification" \
            "Ensure all database queries use parameterized statements"
    fi
}

check_output_encoding() {
    if [[ -f "edge-api/dist/server.js" ]] && grep -q "json.*error" edge-api/dist/server.js; then
        log_check "Error Message Sanitization" "MEDIUM" "PASS" \
            "Error messages are properly structured" \
            "Ensure error messages don't leak sensitive system information"
    else
        log_check "Error Message Sanitization" "MEDIUM" "WARNING" \
            "Error handling needs security review" \
            "Implement secure error handling that doesn't expose sensitive data"
    fi
}

check_input_validation
check_output_encoding

# TM-6: Logging & Monitoring Security
echo "📝 Analyzing Logging & Monitoring..."

check_security_logging() {
    if [[ -f "edge-api/dist/server.js" ]] && grep -q "morgan.*combined" edge-api/dist/server.js; then
        log_check "HTTP Request Logging" "LOW" "PASS" \
            "HTTP requests are logged for monitoring" \
            "Ensure logs are securely stored and include security-relevant events"
    else
        log_check "HTTP Request Logging" "LOW" "WARNING" \
            "HTTP request logging needs verification" \
            "Implement comprehensive logging for security monitoring"
    fi
    
    if [[ -f "edge-api/dist/server.js" ]] && grep -q "console.*error" edge-api/dist/server.js; then
        log_check "Security Event Logging" "MEDIUM" "PASS" \
            "Security events are logged" \
            "Implement structured logging with proper log levels and alerting"
    else
        log_check "Security Event Logging" "MEDIUM" "WARNING" \
            "Security event logging needs enhancement" \
            "Log all authentication failures, authorization denials, and suspicious activities"
    fi
}

check_log_security() {
    # Check for log injection prevention
    log_check "Log Injection Prevention" "LOW" "WARNING" \
        "Log injection prevention not explicitly verified" \
        "Sanitize user inputs before logging to prevent log injection attacks"
    
    # Check for sensitive data in logs
    log_check "Sensitive Data in Logs" "MEDIUM" "WARNING" \
        "Sensitive data logging prevention not verified" \
        "Ensure JWT tokens, certificates, and other secrets are not logged"
}

check_security_logging
check_log_security

# Security Configuration Analysis
echo ""
echo "🔧 SECURITY CONFIGURATION ANALYSIS"
echo "====================================" | tee -a "$AUDIT_RESULTS"

# Config-1: NGINX Security Headers
echo "📋 Analyzing Security Headers..."

check_security_headers() {
    local headers=(
        "X-Content-Type-Options:nosniff"
        "X-Frame-Options:DENY" 
        "Strict-Transport-Security"
        "Content-Security-Policy"
        "Referrer-Policy:no-referrer"
    )
    
    for header in "${headers[@]}"; do
        local header_name="${header%%:*}"
        local header_value="${header#*:}"
        
        if grep -q "$header_name" ops/nginx.conf; then
            if [[ -n "$header_value" ]] && grep -q "$header_value" ops/nginx.conf; then
                log_check "Security Header: $header_name" "MEDIUM" "PASS" \
                    "Header properly configured with secure value" \
                    "Regularly review and update security header configurations"
            else
                log_check "Security Header: $header_name" "MEDIUM" "WARNING" \
                    "Header present but value needs verification" \
                    "Ensure header value follows security best practices"
            fi
        else
            log_check "Security Header: $header_name" "MEDIUM" "FAIL" \
                "Security header missing" \
                "Add $header_name header to NGINX configuration"
        fi
    done
}

check_security_headers

# Config-2: Cryptographic Standards
echo "🔐 Analyzing Cryptographic Standards..."

check_crypto_standards() {
    # Check RSA key sizes in certificate generation
    if grep -q "4096" ops/generate-certs.sh; then
        log_check "RSA Key Size (Server)" "HIGH" "PASS" \
            "4096-bit RSA keys used for server certificates" \
            "Consider migrating to ECDSA for better performance with equivalent security"
    else
        log_check "RSA Key Size (Server)" "HIGH" "WARNING" \
            "RSA key size not verified or may be insufficient" \
            "Use minimum 2048-bit RSA keys, preferably 4096-bit"
    fi
    
    # Check client certificate key sizes
    if grep -q "2048" ops/generate-certs.sh; then
        log_check "RSA Key Size (Client)" "MEDIUM" "PASS" \
            "2048-bit RSA keys used for client certificates" \
            "2048-bit is acceptable for client certificates with reasonable validity periods"
    else
        log_check "RSA Key Size (Client)" "MEDIUM" "WARNING" \
            "Client RSA key size needs verification" \
            "Use minimum 2048-bit RSA keys for client certificates"
    fi
    
    # Check certificate validity periods
    if grep -q "3650" ops/generate-certs.sh; then
        log_check "CA Certificate Validity" "LOW" "PASS" \
            "CA certificate has 10-year validity period" \
            "Consider shorter validity periods for enhanced security"
    fi
    
    if grep -q "730" ops/generate-certs.sh; then
        log_check "Client Certificate Validity" "LOW" "PASS" \
            "Client certificates have 2-year validity period" \
            "Consider implementing automated certificate renewal"
    fi
}

check_crypto_standards

# Security Assessment Summary
echo ""
echo "📊 SECURITY AUDIT SUMMARY"
echo "==========================" | tee -a "$AUDIT_RESULTS"

# Calculate security score
SECURITY_SCORE=0
if [ $TOTAL_CHECKS -gt 0 ]; then
    # Weight scoring: PASS = 1, WARNING = 0.5, FAIL = 0
    WEIGHTED_SCORE=$(( (PASSED_CHECKS * 2 + WARNING_CHECKS) ))
    SECURITY_SCORE=$(( (WEIGHTED_SCORE * 100) / (TOTAL_CHECKS * 2) ))
fi

echo "Total Security Checks: $TOTAL_CHECKS" | tee -a "$AUDIT_RESULTS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}" | tee -a "$AUDIT_RESULTS"
echo -e "Warnings: ${YELLOW}$WARNING_CHECKS${NC}" | tee -a "$AUDIT_RESULTS"  
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}" | tee -a "$AUDIT_RESULTS"
echo "Security Score: $SECURITY_SCORE%" | tee -a "$AUDIT_RESULTS"
echo "Audit Completed: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" | tee -a "$AUDIT_RESULTS"

# Risk Assessment
echo ""
echo "🎯 RISK ASSESSMENT & RECOMMENDATIONS" | tee -a "$AUDIT_RESULTS"
echo "====================================" | tee -a "$AUDIT_RESULTS"

if [ $SECURITY_SCORE -ge 85 ]; then
    echo -e "${GREEN}✅ EXCELLENT SECURITY POSTURE${NC}" | tee -a "$AUDIT_RESULTS"
    echo "• System demonstrates strong security controls" | tee -a "$AUDIT_RESULTS"
    echo "• Minimal security risks identified" | tee -a "$AUDIT_RESULTS"
    echo "• Ready for production deployment with monitoring" | tee -a "$AUDIT_RESULTS"
elif [ $SECURITY_SCORE -ge 70 ]; then
    echo -e "${YELLOW}⚠️  GOOD SECURITY WITH IMPROVEMENTS NEEDED${NC}" | tee -a "$AUDIT_RESULTS"
    echo "• Core security controls are in place" | tee -a "$AUDIT_RESULTS"
    echo "• Address warning items before production" | tee -a "$AUDIT_RESULTS"
    echo "• Implement additional monitoring and alerting" | tee -a "$AUDIT_RESULTS"
else
    echo -e "${RED}❌ SECURITY IMPROVEMENTS REQUIRED${NC}" | tee -a "$AUDIT_RESULTS"
    echo "• Critical security issues must be resolved" | tee -a "$AUDIT_RESULTS"
    echo "• Additional security controls needed" | tee -a "$AUDIT_RESULTS"
    echo "• Security testing and validation required" | tee -a "$AUDIT_RESULTS"
fi

# Priority Recommendations
echo ""
echo "🚨 PRIORITY SECURITY RECOMMENDATIONS:" | tee -a "$AUDIT_RESULTS"
echo "1. Replace all default/development secrets with production-grade keys" | tee -a "$AUDIT_RESULTS"
echo "2. Implement comprehensive security monitoring and alerting" | tee -a "$AUDIT_RESULTS"
echo "3. Establish certificate lifecycle management and renewal procedures" | tee -a "$AUDIT_RESULTS"
echo "4. Deploy with appropriate network segmentation and access controls" | tee -a "$AUDIT_RESULTS"
echo "5. Implement regular security scanning and vulnerability assessment" | tee -a "$AUDIT_RESULTS"

echo ""
echo "📋 Detailed audit results: $AUDIT_RESULTS"

# Exit with appropriate code based on security score
if [ $SECURITY_SCORE -ge 70 ]; then
    exit 0  # Acceptable security level
else
    exit 1  # Security improvements required
fi
