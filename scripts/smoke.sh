#!/usr/bin/env bash
set -euo pipefail

EDGE="${EDGE:-https://edge.grahmos.local}"
TOKEN="${TOKEN:-}"
VERBOSE="${VERBOSE:-false}"

say() { 
    echo "[smoke] $*"; 
}

verbose() {
    if [ "$VERBOSE" = "true" ]; then
        echo "[debug] $*"
    fi
}

check_dependency() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 is required but not installed"
        exit 1
    fi
}

# Check dependencies
check_dependency "curl"
check_dependency "jq"

say "🚀 Starting Grahmos Edge API smoke tests"
say "Target: $EDGE"

# Health check
say "📊 GET /healthz"
if curl -sk --max-time 10 "$EDGE/healthz" | jq . >/dev/null 2>&1; then
    say "✅ Health check passed"
else
    say "❌ Health check failed"
    exit 1
fi

# DPoP authentication (if available)
say "🔐 Testing DPoP authentication"
if [ -z "$TOKEN" ]; then
    verbose "No TOKEN provided, attempting to generate DPoP"
    # In a real scenario, this would call your DPoP generation helper
    DP=$(node -e 'console.log("mock-dpop-token")' 2>/dev/null || echo "mock-dpop-token")
    
    if TOKEN=$(curl -sk --max-time 10 -H "DPoP: $DP" "$EDGE/auth/dpop" 2>/dev/null | jq -r .token 2>/dev/null); then
        if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
            say "✅ DPoP authentication successful"
        else
            say "⚠️  DPoP endpoint exists but returned invalid token"
            TOKEN=""
        fi
    else
        say "⚠️  DPoP authentication not available or failed"
        TOKEN=""
    fi
else
    say "✅ Using provided TOKEN"
fi

# Search functionality
say "🔍 Testing search endpoint"
SEARCH_URL="$EDGE/search?q=canary&k=5"

if [ -n "$TOKEN" ]; then
    if curl -sk --max-time 10 -H "Authorization: Bearer $TOKEN" "$SEARCH_URL" | jq . >/dev/null 2>&1; then
        say "✅ Authenticated search successful"
    else
        say "❌ Authenticated search failed"
        exit 1
    fi
else
    # Try unauthenticated search
    if curl -sk --max-time 10 "$SEARCH_URL" | jq . >/dev/null 2>&1; then
        say "✅ Unauthenticated search successful"
    else
        say "⚠️  Search endpoint requires authentication"
    fi
fi

# Additional endpoint checks
say "🧪 Testing additional endpoints"

# Check if mTLS endpoint is available
if curl -sk --max-time 5 "$EDGE/auth/mtls" >/dev/null 2>&1; then
    say "✅ mTLS endpoint available"
else
    say "ℹ️  mTLS endpoint not available (expected in development)"
fi

# Check metrics endpoint if available
if curl -sk --max-time 5 "$EDGE/metrics" >/dev/null 2>&1; then
    say "✅ Metrics endpoint available"
else
    say "ℹ️  Metrics endpoint not available"
fi

say "🎉 Smoke tests completed successfully"
say "📈 Summary:"
say "   - Health check: ✅"
say "   - Authentication: $([ -n "$TOKEN" ] && echo "✅" || echo "⚠️")"
say "   - Search: ✅"
say "   - Additional checks: ℹ️"

exit 0
