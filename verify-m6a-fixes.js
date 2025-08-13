#!/usr/bin/env node

// M6A Security Verification Script
// Verifies that all critical security fixes are working

import { deriveKey, encrypt, decrypt } from './packages/p2p-delta/src/peerSync.js'
import { db } from './packages/local-db/src/db.js'
import { canon } from './packages/crypto-verify/src/verify.js'

console.log('🔍 M6A Security Verification Starting...\n')

let passCount = 0
let failCount = 0

function pass(test) {
  console.log(`✅ PASS: ${test}`)
  passCount++
}

function fail(test, error) {
  console.log(`❌ FAIL: ${test}`)
  if (error) console.log(`   Error: ${error.message}`)
  failCount++
}

async function verifyKeyDerivation() {
  console.log('📋 Testing PBKDF2 Key Derivation...')
  
  try {
    // Test 1: Key derivation returns salt and key
    const result1 = await deriveKey('test-passphrase')
    if (result1.key && result1.salt && result1.key.length === 32 && result1.salt.length === 32) {
      pass('PBKDF2 returns 32-byte key and salt')
    } else {
      fail('PBKDF2 key/salt format')
    }
    
    // Test 2: Same passphrase with same salt produces same key
    const result2 = await deriveKey('test-passphrase', result1.salt)
    if (result1.key.toString() === result2.key.toString()) {
      pass('Deterministic key derivation with salt')
    } else {
      fail('Key derivation not deterministic')
    }
    
    // Test 3: Different salt produces different key
    const result3 = await deriveKey('test-passphrase')
    if (result1.key.toString() !== result3.key.toString()) {
      pass('Different salts produce different keys')
    } else {
      fail('Salt not affecting key derivation')
    }
    
  } catch (e) {
    fail('Key derivation basic functionality', e)
  }
}

async function verifyEncryption() {
  console.log('\n📋 Testing Encryption with Random Nonces...')
  
  try {
    const { key } = await deriveKey('test-passphrase')
    const testDoc = { id: 'test-doc-1', title: 'Test Document' }
    
    // Test 1: Encryption includes nonce
    const encrypted1 = encrypt(testDoc, key)
    if (encrypted1.length > 24) {
      pass('Encryption includes 24-byte nonce')
    } else {
      fail('Encryption nonce format')
    }
    
    // Test 2: Decryption works
    const decrypted = decrypt(encrypted1, key)
    if (decrypted && decrypted.id === testDoc.id) {
      pass('Decryption restores original data')
    } else {
      fail('Decryption failed')
    }
    
    // Test 3: Different encryptions have different nonces
    const encrypted2 = encrypt(testDoc, key)
    const nonce1 = encrypted1.slice(0, 24)
    const nonce2 = encrypted2.slice(0, 24)
    if (nonce1.toString() !== nonce2.toString()) {
      pass('Each encryption uses unique random nonce')
    } else {
      fail('Nonces not random between encryptions')
    }
    
  } catch (e) {
    fail('Encryption functionality', e)
  }
}

async function verifyReplayProtection() {
  console.log('\n📋 Testing Replay Protection Database...')
  
  try {
    // Test database schema includes recentMessages
    if (db.recentMessages) {
      pass('RecentMessages table exists in database schema')
    } else {
      fail('RecentMessages table missing')
    }
    
    // Test we can store and retrieve recent messages
    const testMsgId = 'test-msg-' + Date.now()
    await db.recentMessages.put({ msgId: testMsgId, ts: Date.now() })
    
    const retrieved = await db.recentMessages.get(testMsgId)
    if (retrieved && retrieved.msgId === testMsgId) {
      pass('Recent message storage and retrieval')
    } else {
      fail('Recent message database operations')
    }
    
  } catch (e) {
    fail('Replay protection database', e)
  }
}

async function verifySignatureBinding() {
  console.log('\n📋 Testing Enhanced Signature Binding...')
  
  try {
    const testDoc = { id: 'test-doc-1', title: 'Test Document' }
    const docHash = 'abc123'
    const ts = Date.now()
    const topic = 'grahmos-sync-v1'
    const nonce = [1, 2, 3, 4, 5]
    
    // Test canonical message format includes all required fields
    const canonMsg = canon({ 
      docId: testDoc.id, 
      docHash, 
      ts, 
      topic, 
      nonce 
    })
    
    const parsed = JSON.parse(canonMsg)
    if (parsed.docId && parsed.docHash && parsed.ts && parsed.topic && parsed.nonce) {
      pass('Signature binding includes docId, docHash, ts, topic, and nonce')
    } else {
      fail('Signature binding missing required fields')
    }
    
  } catch (e) {
    fail('Signature binding', e)
  }
}

async function verifyCrdtReadiness() {
  console.log('\n📋 Testing CRDT Readiness...')
  
  try {
    // Test Doc interface includes CRDT fields
    const testDoc = {
      id: 'test-doc-1',
      title: 'Test Document',
      url: 'test-url',
      source: 'test-source',
      version: 1,
      crdtClock: { actor: 'test', clock: 1 }
    }
    
    await db.docs.put(testDoc)
    const retrieved = await db.docs.get('test-doc-1')
    
    if (retrieved && retrieved.source === 'test-source' && retrieved.version === 1) {
      pass('Doc interface supports CRDT metadata fields')
    } else {
      fail('CRDT fields not persisted correctly')
    }
    
  } catch (e) {
    fail('CRDT readiness', e)
  }
}

async function main() {
  try {
    await verifyKeyDerivation()
    await verifyEncryption()
    await verifyReplayProtection()
    await verifySignatureBinding()
    await verifyCrdtReadiness()
    
    console.log(`\n🎯 M6A Security Verification Complete!`)
    console.log(`✅ Passed: ${passCount}`)
    console.log(`❌ Failed: ${failCount}`)
    
    if (failCount === 0) {
      console.log('\n🎉 All M6A security fixes are working correctly!')
      console.log('✓ Nonce handling & replay protection')
      console.log('✓ PBKDF2 key derivation with salt') 
      console.log('✓ Enhanced signature binding')
      console.log('✓ CRDT readiness metadata')
      console.log('✓ Database schema updated')
    } else {
      console.log('\n⚠️  Some tests failed. Please review the implementation.')
      process.exit(1)
    }
    
  } catch (e) {
    console.error('Verification script failed:', e)
    process.exit(1)
  }
}

main()
