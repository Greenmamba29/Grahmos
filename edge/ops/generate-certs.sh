#!/bin/bash

# Certificate Generation Script for Edge Security & Speed Deployment
# Creates a private CA and generates server + client certificates for mTLS

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="/etc/edge/tls"
TEMP_DIR="$(mktemp -d)"

echo "🔐 Edge Security Certificate Generation"
echo "======================================"

# Use local directory if specified
if [[ -n "${CERTS_DIR_OVERRIDE:-}" ]]; then
    CERTS_DIR="$CERTS_DIR_OVERRIDE"
fi

# Ensure we can write to the certificate directory
if [[ ! -w "$(dirname "$CERTS_DIR" 2>/dev/null || echo .)" ]] && [[ $EUID -ne 0 ]]; then
   echo "⚠️  This script needs to write to $CERTS_DIR"
   echo "   Either run as root or create a local certs directory for development:"
   echo "   mkdir -p ./certs && CERTS_DIR_OVERRIDE=./certs $0"
   exit 1
fi

echo "📁 Certificate directory: $CERTS_DIR"
mkdir -p "$CERTS_DIR"

cd "$TEMP_DIR"

# Certificate Configuration
CA_SUBJECT="/C=US/ST=CA/L=EdgeCity/O=Grahmos/OU=EdgeSecurity/CN=EdgeClientCA"
SERVER_SUBJECT="/C=US/ST=CA/L=EdgeCity/O=Grahmos/OU=EdgeSecurity/CN=edge.grahmos.local"

echo "🏗️  Generating Certificate Authority..."

# Generate CA private key
openssl genrsa -out ca.key 4096

# Generate CA certificate (self-signed, valid for 10 years)
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "$CA_SUBJECT"

echo "🖥️  Generating Server Certificate..."

# Generate server private key
openssl genrsa -out server.key 4096

# Generate server certificate signing request
openssl req -new -key server.key -out server.csr -subj "$SERVER_SUBJECT"

# Create server certificate extensions
cat > server.ext << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = edge.grahmos.local
DNS.2 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Sign server certificate with CA (valid for 2 years + 1 month for renewal overlap)
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
    -out server.crt -days 825 -extfile server.ext

echo "📱 Generating Client Certificates..."

# Function to generate client certificate
generate_client_cert() {
    local client_name="$1"
    local client_subject="/C=US/ST=CA/L=EdgeCity/O=Grahmos/OU=EdgeDevice/CN=$client_name"
    
    echo "  - Generating certificate for: $client_name"
    
    # Generate client private key (smaller for mobile devices)
    openssl genrsa -out "${client_name}.key" 2048
    
    # Generate client certificate signing request
    openssl req -new -key "${client_name}.key" -out "${client_name}.csr" -subj "$client_subject"
    
    # Create client certificate extensions
    cat > "${client_name}.ext" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment
extendedKeyUsage = clientAuth
EOF
    
    # Sign client certificate with CA (valid for 2 years)
    openssl x509 -req -in "${client_name}.csr" -CA ca.crt -CAkey ca.key -CAcreateserial \
        -out "${client_name}.crt" -days 730 -extfile "${client_name}.ext"
}

# Generate sample client certificates for different device types
generate_client_cert "ue1"          # User Equipment 1
generate_client_cert "tablet-001"   # Emergency Services Tablet
generate_client_cert "mobile-002"   # First Responder Mobile
generate_client_cert "admin-dev"    # Development/Admin client

echo "🔒 Setting up secure permissions..."

# Copy certificates to destination with secure permissions
cp ca.crt ca.key server.crt server.key ue1.crt ue1.key tablet-001.crt tablet-001.key \
   mobile-002.crt mobile-002.key admin-dev.crt admin-dev.key "$CERTS_DIR/"

# Set restrictive permissions
chmod 600 "$CERTS_DIR"/*.key
chmod 644 "$CERTS_DIR"/*.crt
chown -R root:root "$CERTS_DIR" 2>/dev/null || echo "⚠️  Could not set root ownership (development mode)"

echo "📋 Creating deployment package..."

# Create a deployment package for clients
mkdir -p "$CERTS_DIR/clients"
for client in ue1 tablet-001 mobile-002 admin-dev; do
    mkdir -p "$CERTS_DIR/clients/$client"
    cp "$client.crt" "$client.key" ca.crt "$CERTS_DIR/clients/$client/"
    
    # Create PKCS#12 bundle for easy import
    openssl pkcs12 -export -out "$CERTS_DIR/clients/$client/$client.p12" \
        -inkey "$client.key" -in "$client.crt" -certfile ca.crt \
        -passout pass:grahmos-edge-2025
done

echo "📝 Creating certificate information file..."

cat > "$CERTS_DIR/README.md" << 'EOF'
# Edge Security TLS Certificates

This directory contains the TLS certificates for the Edge Security & Speed deployment.

## Files

- `ca.crt` - Certificate Authority public certificate
- `ca.key` - Certificate Authority private key (keep secure!)
- `server.crt` - NGINX server certificate
- `server.key` - NGINX server private key
- `clients/` - Client certificates organized by device

## Client Certificate Usage

Each client directory contains:
- `{client}.crt` - Client public certificate
- `{client}.key` - Client private key
- `{client}.p12` - PKCS#12 bundle (password: grahmos-edge-2025)
- `ca.crt` - CA certificate (for trust store)

## Testing with curl

```bash
curl -k --cert clients/admin-dev/admin-dev.crt --key clients/admin-dev/admin-dev.key \
  https://edge.grahmos.local/auth/mtls
```

## Certificate Validation

- CA certificate valid for: 10 years
- Server certificate valid for: 27 months (825 days)
- Client certificates valid for: 2 years (730 days)

## Production Notes

- Change default PKCS#12 password in production
- Consider using hardware security modules (HSM) for CA key
- Implement certificate revocation list (CRL) for compromised certificates
- Set up automated certificate renewal before expiration
EOF

# Create verification script
cat > "$CERTS_DIR/verify-certs.sh" << 'EOF'
#!/bin/bash

echo "🔍 Verifying Edge TLS Certificates"
echo "================================="

CERTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Verify CA certificate
echo "📋 CA Certificate:"
openssl x509 -in "$CERTS_DIR/ca.crt" -text -noout | grep -E "(Subject|Not Before|Not After)"

echo ""
echo "🖥️  Server Certificate:"
openssl x509 -in "$CERTS_DIR/server.crt" -text -noout | grep -E "(Subject|Not Before|Not After|DNS:|IP Address:)"

# Verify server certificate against CA
echo ""
echo "🔗 Server Certificate Chain Verification:"
if openssl verify -CAfile "$CERTS_DIR/ca.crt" "$CERTS_DIR/server.crt"; then
    echo "✅ Server certificate chain is valid"
else
    echo "❌ Server certificate chain verification failed"
fi

# Verify client certificates
echo ""
echo "📱 Client Certificates:"
for client_dir in "$CERTS_DIR/clients"/*/; do
    if [[ -d "$client_dir" ]]; then
        client_name=$(basename "$client_dir")
        echo "  - $client_name:"
        if openssl verify -CAfile "$CERTS_DIR/ca.crt" "$client_dir/$client_name.crt" >/dev/null 2>&1; then
            echo "    ✅ Valid"
        else
            echo "    ❌ Invalid"
        fi
    fi
done

echo ""
echo "🎯 Certificate fingerprints (for PoP validation):"
for client_dir in "$CERTS_DIR/clients"/*/; do
    if [[ -d "$client_dir" ]]; then
        client_name=$(basename "$client_dir")
        fp=$(openssl x509 -in "$client_dir/$client_name.crt" -fingerprint -sha256 -noout | cut -d'=' -f2 | tr -d ':')
        echo "  - $client_name: $fp"
    fi
done
EOF

chmod +x "$CERTS_DIR/verify-certs.sh"

# Clean up temporary directory
cd "$SCRIPT_DIR"
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Certificate generation completed!"
echo ""
echo "📍 Certificates stored in: $CERTS_DIR"
echo "🔍 Verify certificates: $CERTS_DIR/verify-certs.sh"
echo ""
echo "🚀 Next steps:"
echo "   1. Review certificate details: $CERTS_DIR/README.md"
echo "   2. Distribute client certificates to devices"
echo "   3. Start edge services: docker compose -f docker-compose.edge.yml up -d"
echo "   4. Test mTLS authentication with sample client certificate"
