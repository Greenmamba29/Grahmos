# M8A - Purchases Productionization and Key Rotation

## Overview

M8A implements production-ready purchase handling with key rotation support, rate limiting, and comprehensive receipt management.

## Key Features

### 1. Key Rotation Support

**Key ID System**: Every receipt now includes a `keyId` field that identifies which key was used to sign it.

**Current Key Endpoint**: `GET /pubkey` returns:
```json
{
  "keyId": "key_2025_01",
  "pubkey": "R2x0r734631W9spz9AII2DQuJLByESkMRfbJRiIV30g="
}
```

**Verification**: Receipts can be verified using the appropriate public key for their `keyId`.

### 2. Rate Limiting & Security

**Rate Limits**: 30 requests per 5 minutes per IP address
**Payload Size**: Maximum 32KB per request
**Idempotency**: Duplicate `intentId` requests return the same response
**Structured Errors**: 4xx responses include error codes and descriptions

### 3. Receipt Verification

**Key-Based Verification**: Uses `verifyReceiptByKey()` function that resolves keys by ID
**Backward Compatibility**: Handles old receipts without `keyId`
**Status Tracking**: Receipts track verification status (verified, invalid, pending)

### 4. Orders Management UI

**Orders Page**: `/orders` displays all receipts with filtering and verification
**Status Filters**: All, Verified, Invalid, Pending
**Actions**: Verify signatures, download JSON receipts
**Real-time Status**: Visual status chips with icons

## How to Rotate Keys

### Step 1: Generate New Keypair

```bash
# Generate new Ed25519 keypair (example using Node.js)
node -e "
const nacl = require('tweetnacl');
const util = require('tweetnacl-util');
const keypair = nacl.sign.keyPair();
console.log('Private Key:', util.encodeBase64(keypair.secretKey));
console.log('Public Key:', util.encodeBase64(keypair.publicKey));
"
```

### Step 2: Update Worker Configuration

Update `wrangler.toml`:
```toml
[vars]
RECEIPT_KEY_ID = "key_2025_02"  # New key ID
RECEIPT_PUBLIC_KEY = "NEW_PUBLIC_KEY_BASE64"
RECEIPT_PRIVATE_KEY = "NEW_PRIVATE_KEY_BASE64"
```

### Step 3: Deploy Changes

```bash
wrangler publish
```

### Step 4: Verify Key Rotation

```bash
# Check new key is active
curl https://your-worker.example.com/pubkey

# Old receipts still verify with stored keys
# New purchases use the new key
```

## Environment Configuration

### Required Variables

```toml
[vars]
STRIPE_MODE = "test"                    # or "live" for production
RECEIPT_KEY_ID = "key_2025_01"         # Unique key identifier
RECEIPT_PUBLIC_KEY = "base64_pubkey"    # Ed25519 public key
RECEIPT_PRIVATE_KEY = "base64_privkey"  # Ed25519 private key

[[kv_namespaces]]
binding = "ORDERS"
id = "orders_kv"
preview_id = "orders_kv_preview"
```

### Development vs Production

**Test Mode**: Use test Stripe keys and test key IDs
**Production Mode**: Use live Stripe keys and production key IDs

## Receipt Structure

### Current Receipt Format

```json
{
  "intentId": "intent_1234567890",
  "orderId": "ord_abcdefghij",
  "keyId": "key_2025_01",
  "amount": 2999,
  "currency": "usd",
  "itemId": "kit_first_aid",
  "ts": 1704067200000,
  "status": "paid"
}
```

### Signature Format

Ed25519 signature of the canonical JSON (sorted keys):
```json
{
  "sig": "base64_signature_string"
}
```

## Verification Process

### Client-Side Verification

1. **Fetch Public Keys**: Get current and historical public keys
2. **Extract Key ID**: Read `keyId` from receipt
3. **Resolve Key**: Look up public key for that `keyId`
4. **Verify Signature**: Use `verifyReceiptByKey()` function
5. **Update Status**: Mark as verified/invalid in local database

### Key Storage Strategy

**Client-Side**: Store key history in local cache/database
**Server-Side**: Maintain key registry with historical keys
**Fallback**: Support verification of legacy receipts

## Error Handling

### Rate Limiting

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT"
}
```

### Payload Validation

```json
{
  "error": "Invalid amount",
  "code": "INVALID_PAYLOAD"
}
```

### Server Errors

```json
{
  "error": "Internal server error",
  "code": "SERVER_ERROR"
}
```

## Security Considerations

### Key Rotation Timeline

**Overlap Period**: Keep old keys active for verification during transition
**Key Retirement**: Remove old keys after sufficient time (e.g., 1 year)
**Emergency Rotation**: Process for compromised key scenarios

### Rate Limiting Strategy

**Per-IP Limits**: Prevent abuse from single sources
**Intent-Based Idempotency**: Prevent duplicate charges
**Graceful Degradation**: Fail-open on KV store issues

### Validation Layers

**Input Validation**: Amount, currency, itemId format checks
**Size Limits**: Prevent DoS via large payloads
**Authentication**: Future: Add API key requirements

## Monitoring & Logging

### Key Metrics

- Purchase success/failure rates
- Rate limit hits
- Signature verification failures
- Key rotation events

### Logging

- All purchase attempts with outcomes
- Rate limit violations
- Key usage patterns
- Verification failures

## Troubleshooting

### Common Issues

**Verification Failures**: Check key ID matches and public key is correct
**Rate Limits**: Reduce request frequency or implement client-side caching
**Legacy Receipts**: Ensure backward compatibility for old keyless receipts

### Debug Steps

1. Check `/pubkey` endpoint returns current key
2. Verify receipt contains expected `keyId`
3. Confirm public key matches the key ID
4. Test signature verification manually
5. Check KV store for rate limiting issues

## Migration Guide

### From Legacy System

1. **Preserve Old Keys**: Keep existing keys for legacy receipt verification
2. **Add Key IDs**: Update all new receipts to include `keyId`
3. **Client Updates**: Update apps to handle key-based verification
4. **Gradual Rollout**: Phase in new verification system

### Testing Strategy

1. **Unit Tests**: Verify signature creation and verification
2. **Integration Tests**: Test full purchase flow with key rotation
3. **Load Tests**: Verify rate limiting works under high traffic
4. **Security Tests**: Test replay protection and validation
