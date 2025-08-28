#!/usr/bin/env bash

# Manifest Signing Script for Edge Security Updates
# Signs update manifests with RSA private key

set -euo pipefail

MANIFEST="${1:?Usage: $0 <manifest.json> [private_key.pem]}"
PRIVATE_KEY="${2:-./signing_key.pem}"

echo "🔐 Edge Security Manifest Signer"
echo "================================="
echo "📄 Manifest: $MANIFEST"
echo "🔑 Private Key: $PRIVATE_KEY"
echo ""

# Validate inputs
if [[ ! -f "$MANIFEST" ]]; then
    echo "❌ Manifest file not found: $MANIFEST"
    exit 1
fi

if [[ ! -f "$PRIVATE_KEY" ]]; then
    echo "❌ Private key file not found: $PRIVATE_KEY"
    echo ""
    echo "💡 To generate a signing key pair:"
    echo "   # Generate private key"
    echo "   openssl genrsa -out signing_key.pem 4096"
    echo "   # Extract public key"
    echo "   openssl rsa -in signing_key.pem -pubout -out signing_key_public.pem"
    exit 1
fi

# Validate manifest JSON
if ! jq empty "$MANIFEST" >/dev/null 2>&1; then
    echo "❌ Invalid JSON in manifest file"
    exit 1
fi

# Extract manifest info
VERSION=$(jq -r '.version' "$MANIFEST")
FILE_COUNT=$(jq '.files | length' "$MANIFEST")
TOTAL_BYTES=$(jq '.files | map(.bytes) | add' "$MANIFEST")

echo "📦 Manifest Details:"
echo "   Version: $VERSION"
echo "   Files: $FILE_COUNT"
echo "   Total Size: $TOTAL_BYTES bytes"
echo ""

# Generate signature
SIGNATURE_FILE="${MANIFEST}.sig"

echo "🔒 Generating Signature..."
if openssl dgst -sha256 -sign "$PRIVATE_KEY" -out "$SIGNATURE_FILE" "$MANIFEST"; then
    echo "✅ Signature created: $SIGNATURE_FILE"
else
    echo "❌ Failed to create signature"
    exit 1
fi

# Verify signature (self-test)
PUBLIC_KEY="${PRIVATE_KEY%.*}_public.pem"
if [[ -f "$PUBLIC_KEY" ]]; then
    echo ""
    echo "🔍 Verifying Signature..."
    if openssl dgst -sha256 -verify "$PUBLIC_KEY" -signature "$SIGNATURE_FILE" "$MANIFEST" >/dev/null 2>&1; then
        echo "✅ Signature verification successful"
    else
        echo "❌ Signature verification failed"
        exit 1
    fi
else
    echo "⚠️  Public key not found at $PUBLIC_KEY - skipping verification"
fi

# Display signature information
echo ""
echo "📋 Signature Information:"
echo "   Algorithm: RSA-SHA256"
echo "   Signature File: $SIGNATURE_FILE"
echo "   Size: $(wc -c < "$SIGNATURE_FILE") bytes"

# Generate signature fingerprint for verification
SIG_FINGERPRINT=$(openssl dgst -sha256 -r "$SIGNATURE_FILE" | awk '{print $1}')
echo "   Fingerprint: $SIG_FINGERPRINT"

echo ""
echo "✅ Manifest Signed Successfully!"
echo ""
echo "🚀 Next Steps:"
echo "   1. Distribute $MANIFEST and $SIGNATURE_FILE together"
echo "   2. Ensure public key is available on target systems"
echo "   3. Run update: ./update.sh $MANIFEST $SIGNATURE_FILE $PUBLIC_KEY"
