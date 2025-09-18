#!/bin/bash
# Script to generate secure production secrets

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔐 Generating Production Secrets"
echo "================================="

# Check if .env.production already exists
if [[ -f ".env.production" ]]; then
    echo -e "${YELLOW}⚠️  .env.production already exists!${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborting..."
        exit 1
    fi
fi

# Generate secure JWT secret (64 characters)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')

# Generate secure update signing keypair
UPDATE_KEY_DIR="./keys"
mkdir -p "$UPDATE_KEY_DIR"

echo "Generating RSA keypair for update signing..."
openssl genrsa -out "$UPDATE_KEY_DIR/update-signing.key" 4096 2>/dev/null
openssl rsa -in "$UPDATE_KEY_DIR/update-signing.key" -pubout -out "$UPDATE_KEY_DIR/update-public.key" 2>/dev/null
chmod 600 "$UPDATE_KEY_DIR/update-signing.key"
chmod 644 "$UPDATE_KEY_DIR/update-public.key"

# Copy template and replace values
cp .env.production.example .env.production

# Replace JWT secret
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env.production

# Update timestamp
echo "" >> .env.production
echo "# Generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> .env.production

# Set proper permissions
chmod 600 .env.production

echo -e "${GREEN}✅ Production secrets generated successfully!${NC}"
echo ""
echo "Files created:"
echo "  - .env.production (mode 600)"
echo "  - $UPDATE_KEY_DIR/update-signing.key (mode 600)"
echo "  - $UPDATE_KEY_DIR/update-public.key (mode 644)"
echo ""
echo -e "${YELLOW}⚠️  Important Security Notes:${NC}"
echo "1. Keep .env.production and private keys secure"
echo "2. Never commit these files to version control"
echo "3. Use a secure key management system in production"
echo "4. Rotate secrets regularly"
echo "5. Monitor for unauthorized access attempts"
echo ""
echo "JWT Secret (first 16 chars): ${JWT_SECRET:0:16}..."