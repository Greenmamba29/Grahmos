#!/bin/bash
# Automated Security Scanning Script
# Integrates with CI/CD pipeline for continuous security monitoring

set -euo pipefail

# Configuration
SCAN_RESULTS_DIR="/tmp/security-scans"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SCAN_RESULTS_FILE="$SCAN_RESULTS_DIR/security-scan-$TIMESTAMP.json"
REPORT_FILE="$SCAN_RESULTS_DIR/security-report-$TIMESTAMP.html"

# Thresholds (fail build if exceeded)
CRITICAL_THRESHOLD=0
HIGH_THRESHOLD=0
MEDIUM_THRESHOLD=10

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
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

# Create results directory
mkdir -p "$SCAN_RESULTS_DIR"

log "🔍 Starting automated security scan..."
log "Results will be saved to: $SCAN_RESULTS_FILE"

# Initialize results
cat > "$SCAN_RESULTS_FILE" << EOF
{
  "scan_timestamp": "$(date -Iseconds)",
  "scan_id": "$TIMESTAMP",
  "repository": "grahmos-unified",
  "branch": "${GITHUB_REF:-$(git branch --show-current 2>/dev/null || echo 'unknown')}",
  "commit": "${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}",
  "results": {}
}
EOF

# 1. Dependency Vulnerability Scan
log "📦 Scanning dependencies for vulnerabilities..."
DEPENDENCY_SCAN_PASSED=true

if command -v pnpm &> /dev/null; then
    if pnpm audit --json > /tmp/pnpm-audit.json 2>/dev/null || true; then
        # Parse pnpm audit results
        if command -v jq &> /dev/null; then
            CRITICAL=$(jq -r '.vulnerabilities | to_entries | map(select(.value.severity == "critical")) | length' /tmp/pnpm-audit.json 2>/dev/null || echo "0")
            HIGH=$(jq -r '.vulnerabilities | to_entries | map(select(.value.severity == "high")) | length' /tmp/pnpm-audit.json 2>/dev/null || echo "0")
            MEDIUM=$(jq -r '.vulnerabilities | to_entries | map(select(.value.severity == "moderate")) | length' /tmp/pnpm-audit.json 2>/dev/null || echo "0")
            LOW=$(jq -r '.vulnerabilities | to_entries | map(select(.value.severity == "low")) | length' /tmp/pnpm-audit.json 2>/dev/null || echo "0")
            
            # Add to results
            jq --argjson critical "$CRITICAL" \
               --argjson high "$HIGH" \
               --argjson medium "$MEDIUM" \
               --argjson low "$LOW" \
               '.results.dependencies = {
                 "critical": $critical,
                 "high": $high, 
                 "medium": $medium,
                 "low": $low,
                 "total": ($critical + $high + $medium + $low)
               }' "$SCAN_RESULTS_FILE" > /tmp/scan_temp.json && mv /tmp/scan_temp.json "$SCAN_RESULTS_FILE"
        else
            warn "jq not available, cannot parse audit results"
            CRITICAL=0; HIGH=0; MEDIUM=0; LOW=0
        fi
    else
        error "Failed to run pnpm audit"
        DEPENDENCY_SCAN_PASSED=false
        CRITICAL=999; HIGH=999; MEDIUM=999; LOW=999
    fi
else
    error "pnpm not found"
    DEPENDENCY_SCAN_PASSED=false
    CRITICAL=999; HIGH=999; MEDIUM=999; LOW=999
fi

log "Dependencies: Critical=$CRITICAL, High=$HIGH, Medium=$MEDIUM, Low=$LOW"

# 2. Secret Detection Scan
log "🔐 Scanning for exposed secrets..."
SECRET_ISSUES=0

# Common secret patterns
SECRET_PATTERNS=(
    "password.*=.*['\"][^'\"]{8,}['\"]"
    "api[_-]?key.*=.*['\"][^'\"]{16,}['\"]"
    "secret.*=.*['\"][^'\"]{16,}['\"]"
    "token.*=.*['\"][^'\"]{16,}['\"]"
    "private[_-]?key.*=.*['\"][^'\"]{32,}['\"]"
    "aws[_-]?access.*=.*['\"][^'\"]{16,}['\"]"
    "-----BEGIN.*PRIVATE KEY-----"
)

for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -r -E "$pattern" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=secrets --exclude="*.log" --exclude="*.backup" 2>/dev/null | grep -v ".env.example" | grep -v "SECURITY_REMEDIATION_PLAN.md" | grep -v "fix-critical-security.sh"; then
        ((SECRET_ISSUES++))
    fi
done

# Add secret scan results
jq --argjson issues "$SECRET_ISSUES" \
   '.results.secrets = {
     "exposed_secrets": $issues,
     "status": (if $issues == 0 then "PASS" else "FAIL" end)
   }' "$SCAN_RESULTS_FILE" > /tmp/scan_temp.json && mv /tmp/scan_temp.json "$SCAN_RESULTS_FILE"

log "Secret scan: $SECRET_ISSUES potential issues found"

# 3. Docker Security Scan
log "🐳 Scanning Docker configurations..."
DOCKER_ISSUES=0

# Check for security anti-patterns in Dockerfiles
if find . -name "Dockerfile*" -type f | head -10 | while read -r dockerfile; do
    # Check for running as root
    if ! grep -q "USER.*[^r][^o][^o][^t]" "$dockerfile" 2>/dev/null; then
        warn "Docker security: $dockerfile may run as root"
        ((DOCKER_ISSUES++))
    fi
    
    # Check for --privileged or --cap-add=ALL
    if grep -q "privileged.*true\|cap_add.*ALL" "$dockerfile" 2>/dev/null; then
        warn "Docker security: $dockerfile uses privileged mode"
        ((DOCKER_ISSUES++))
    fi
done; then
    log "Docker scan completed"
fi

# Check docker-compose files
if find . -name "docker-compose*.yml" -type f | head -10 | while read -r composefile; do
    # Check for hardcoded secrets
    if grep -E "(password|secret|key).*:.*['\"][^'\"]{8,}['\"]" "$composefile" 2>/dev/null; then
        warn "Docker security: $composefile may contain hardcoded secrets"
        ((DOCKER_ISSUES++))
    fi
    
    # Check for privileged containers
    if grep -q "privileged.*true" "$composefile" 2>/dev/null; then
        warn "Docker security: $composefile uses privileged containers"
        ((DOCKER_ISSUES++))
    fi
done; then
    log "Docker Compose scan completed"
fi

# Add Docker scan results
jq --argjson issues "$DOCKER_ISSUES" \
   '.results.docker = {
     "security_issues": $issues,
     "status": (if $issues == 0 then "PASS" else "FAIL" end)
   }' "$SCAN_RESULTS_FILE" > /tmp/scan_temp.json && mv /tmp/scan_temp.json "$SCAN_RESULTS_FILE"

log "Docker scan: $DOCKER_ISSUES issues found"

# 4. Configuration Security Scan
log "⚙️ Scanning configuration files..."
CONFIG_ISSUES=0

# Check for insecure configurations
INSECURE_PATTERNS=(
    "ssl.*false"
    "tls.*false"
    "verify.*false"
    "debug.*true"
    "development.*true"
)

for pattern in "${INSECURE_PATTERNS[@]}"; do
    if grep -r -E "$pattern" . --include="*.yml" --include="*.yaml" --include="*.json" --include="*.conf" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | grep -v ".example" | grep -v "test" | grep -v "spec"; then
        ((CONFIG_ISSUES++))
    fi
done

# Add config scan results
jq --argjson issues "$CONFIG_ISSUES" \
   '.results.configuration = {
     "insecure_configs": $issues,
     "status": (if $issues == 0 then "PASS" else "FAIL" end)
   }' "$SCAN_RESULTS_FILE" > /tmp/scan_temp.json && mv /tmp/scan_temp.json "$SCAN_RESULTS_FILE"

log "Configuration scan: $CONFIG_ISSUES issues found"

# 5. Generate Security Report
log "📊 Generating security report..."

# Calculate overall status
OVERALL_STATUS="PASS"
if [[ $CRITICAL -gt $CRITICAL_THRESHOLD ]] || [[ $HIGH -gt $HIGH_THRESHOLD ]] || [[ $MEDIUM -gt $MEDIUM_THRESHOLD ]] || [[ $SECRET_ISSUES -gt 0 ]]; then
    OVERALL_STATUS="FAIL"
fi

# Add overall results
jq --arg status "$OVERALL_STATUS" \
   --arg timestamp "$(date -Iseconds)" \
   '.overall_status = $status |
    .scan_completed = $timestamp |
    .thresholds = {
      "critical": 0,
      "high": 0, 
      "medium": 10
    }' "$SCAN_RESULTS_FILE" > /tmp/scan_temp.json && mv /tmp/scan_temp.json "$SCAN_RESULTS_FILE"

# Generate HTML Report
cat > "$REPORT_FILE" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .pass { color: #28a745; }
        .fail { color: #dc3545; }
        .warn { color: #ffc107; }
        .metric { display: inline-block; margin: 10px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; }
        .section { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Security Scan Report</h1>
        <p><strong>Scan ID:</strong> $TIMESTAMP</p>
        <p><strong>Timestamp:</strong> $(date)</p>
        <p><strong>Overall Status:</strong> <span class="$(echo $OVERALL_STATUS | tr '[:upper:]' '[:lower:]')">${OVERALL_STATUS}</span></p>
    </div>
    
    <div class="section">
        <h2>📊 Summary Metrics</h2>
        <div class="metric">
            <h3>Dependencies</h3>
            <p>Critical: <span class="$([ $CRITICAL -eq 0 ] && echo 'pass' || echo 'fail')">$CRITICAL</span></p>
            <p>High: <span class="$([ $HIGH -eq 0 ] && echo 'pass' || echo 'fail')">$HIGH</span></p>
            <p>Medium: <span class="$([ $MEDIUM -le $MEDIUM_THRESHOLD ] && echo 'pass' || echo 'warn')">$MEDIUM</span></p>
        </div>
        
        <div class="metric">
            <h3>Secrets</h3>
            <p>Exposed: <span class="$([ $SECRET_ISSUES -eq 0 ] && echo 'pass' || echo 'fail')">$SECRET_ISSUES</span></p>
        </div>
        
        <div class="metric">
            <h3>Docker</h3>
            <p>Issues: <span class="$([ $DOCKER_ISSUES -eq 0 ] && echo 'pass' || echo 'warn')">$DOCKER_ISSUES</span></p>
        </div>
        
        <div class="metric">
            <h3>Configuration</h3>
            <p>Issues: <span class="$([ $CONFIG_ISSUES -eq 0 ] && echo 'pass' || echo 'warn')">$CONFIG_ISSUES</span></p>
        </div>
    </div>
    
    <div class="section">
        <h2>🎯 Recommendations</h2>
        <ul>
EOF

if [[ $CRITICAL -gt 0 ]] || [[ $HIGH -gt 0 ]]; then
    echo "            <li>🚨 <strong>CRITICAL:</strong> Fix high/critical dependency vulnerabilities immediately</li>" >> "$REPORT_FILE"
fi

if [[ $SECRET_ISSUES -gt 0 ]]; then
    echo "            <li>🔐 <strong>URGENT:</strong> Remove exposed secrets from codebase</li>" >> "$REPORT_FILE"
fi

if [[ $DOCKER_ISSUES -gt 0 ]]; then
    echo "            <li>🐳 <strong>MEDIUM:</strong> Address Docker security configurations</li>" >> "$REPORT_FILE"
fi

if [[ $CONFIG_ISSUES -gt 0 ]]; then
    echo "            <li>⚙️ <strong>LOW:</strong> Review insecure configuration settings</li>" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF
        </ul>
    </div>
    
    <div class="section">
        <h2>📋 Next Steps</h2>
        <ol>
            <li>Review detailed results in: <code>$SCAN_RESULTS_FILE</code></li>
            <li>Run: <code>./scripts/fix-critical-security.sh</code> for automated fixes</li>
            <li>Address remaining issues manually</li>
            <li>Re-run scan to verify fixes</li>
        </ol>
    </div>
    
    <div class="section">
        <p><small>Generated by Grahmos Security Scanner v1.0</small></p>
    </div>
</body>
</html>
EOF

# 6. Output Results
echo ""
echo "======================================"
log "🔍 SECURITY SCAN COMPLETED"
echo "======================================"
echo ""

if [[ $OVERALL_STATUS == "PASS" ]]; then
    success "✅ Security scan PASSED"
else
    error "❌ Security scan FAILED"
fi

echo ""
echo "📊 SUMMARY:"
echo "  Dependencies: Critical=$CRITICAL, High=$HIGH, Medium=$MEDIUM"
echo "  Secrets: $SECRET_ISSUES exposed"
echo "  Docker: $DOCKER_ISSUES issues"
echo "  Config: $CONFIG_ISSUES issues"
echo ""
echo "📁 FILES GENERATED:"
echo "  Results: $SCAN_RESULTS_FILE"
echo "  Report:  $REPORT_FILE"
echo ""

# 7. Exit with appropriate code
if [[ $OVERALL_STATUS == "FAIL" ]]; then
    error "🚫 SECURITY SCAN FAILED - Build should be blocked"
    echo ""
    echo "FAILURE REASONS:"
    [[ $CRITICAL -gt $CRITICAL_THRESHOLD ]] && echo "  - Critical vulnerabilities: $CRITICAL (threshold: $CRITICAL_THRESHOLD)"
    [[ $HIGH -gt $HIGH_THRESHOLD ]] && echo "  - High vulnerabilities: $HIGH (threshold: $HIGH_THRESHOLD)"
    [[ $MEDIUM -gt $MEDIUM_THRESHOLD ]] && echo "  - Medium vulnerabilities: $MEDIUM (threshold: $MEDIUM_THRESHOLD)"
    [[ $SECRET_ISSUES -gt 0 ]] && echo "  - Exposed secrets: $SECRET_ISSUES"
    echo ""
    echo "🔧 RUN: ./scripts/fix-critical-security.sh"
    exit 1
else
    success "🎉 Security scan passed - Build can proceed"
    exit 0
fi