// Test script to add a content pack for verification testing
// This creates both valid and invalid test packs for testing

import { db, ContentPack } from '../../../../../packages/local-db/src/db'
import nacl from 'tweetnacl'
import util from 'tweetnacl-util'

// Generate a test key pair for demonstration
const testKeyPair = nacl.sign.keyPair()
const TEST_PUBKEY = util.encodeBase64(testKeyPair.publicKey)
const TEST_PRIVATE_KEY = testKeyPair.secretKey

// Create test pack data
const testPackData = {
  id: 'test-pack-123',
  name: 'Test Content Pack',
  size: 1024 * 1024 * 50, // 50MB
  sha256: 'abcdef123456789abcdef123456789abcdef123456789abcdef123456789abc',
  keyId: 'test-key-01'
}

// Create signature for the test pack
function createTestPackSignature(packData: any): string {
  const payloadString = JSON.stringify(packData, Object.keys(packData).sort())
  const messageBytes = util.decodeUTF8(payloadString)
  const signature = nacl.sign.detached(messageBytes, TEST_PRIVATE_KEY)
  return util.encodeBase64(signature)
}

// Create test packs with different verification scenarios
const testPacks = [
  // Pack 1: Valid signature
  {
    ...testPackData,
    id: 'test-pack-valid',
    name: 'Valid Test Pack',
    pubkey: TEST_PUBKEY,
    sigB64: '', // Will be filled below
    installedAt: Date.now(),
    status: 'installed' as const
  },
  // Pack 2: Invalid signature
  {
    ...testPackData,
    id: 'test-pack-invalid',
    name: 'Invalid Test Pack',
    pubkey: TEST_PUBKEY,
    sigB64: 'aW52YWxpZCBzaWduYXR1cmUgZm9yIHRlc3Rpbmc=', // Invalid signature
    installedAt: Date.now(),
    status: 'installed' as const
  },
  // Pack 3: No signature (unsigned)
  {
    ...testPackData,
    id: 'test-pack-unsigned',
    name: 'Unsigned Test Pack',
    pubkey: TEST_PUBKEY,
    sigB64: '', // No signature
    installedAt: Date.now(),
    status: 'installed' as const
  }
]

// Generate valid signature for the first pack
const validPackPayload = {
  id: testPacks[0].id,
  name: testPacks[0].name,
  size: testPacks[0].size,
  sha256: testPacks[0].sha256,
  keyId: testPacks[0].keyId
}
testPacks[0].sigB64 = createTestPackSignature(validPackPayload)

async function addTestPacks() {
  try {
    console.log('Adding test packs to database...')
    
    for (const pack of testPacks) {
      // Check if pack already exists
      const existing = await db.contentPacks.get(pack.id)
      if (existing) {
        console.log(`Test pack ${pack.id} already exists, removing first...`)
        await db.contentPacks.delete(pack.id)
      }
      
      // Add the test pack
      await db.contentPacks.add(pack as ContentPack)
      
      console.log(`Added test pack: ${pack.name}`, {
        id: pack.id,
        hasSignature: !!pack.sigB64,
        hasPubkey: !!pack.pubkey,
        signaturePreview: pack.sigB64 ? pack.sigB64.substring(0, 20) + '...' : 'none'
      })
    }
    
    console.log('All test packs added successfully!')
    
  } catch (error) {
    console.error('Failed to add test packs:', error)
  }
}

async function removeTestPacks() {
  try {
    console.log('Removing test packs from database...')
    
    for (const pack of testPacks) {
      await db.contentPacks.delete(pack.id)
      console.log(`Removed test pack: ${pack.id}`)
    }
    
    console.log('All test packs removed successfully!')
    
  } catch (error) {
    console.error('Failed to remove test packs:', error)
  }
}

// Self-executing functions for browser console
if (typeof window !== 'undefined') {
  (window as any).addTestPacks = addTestPacks
  (window as any).removeTestPacks = removeTestPacks
  console.log('Test pack functions available:')
  console.log('- window.addTestPacks() - Add test packs with different verification scenarios')
  console.log('- window.removeTestPacks() - Remove all test packs')
}

export { addTestPacks, removeTestPacks }
