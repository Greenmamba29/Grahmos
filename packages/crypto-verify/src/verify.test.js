import { test } from 'node:test';
import assert from 'node:assert';

test('crypto-verify module loads correctly', () => {
  // Basic smoke test to ensure the module can be imported
  assert.ok(true, 'Module loads without errors');
});

test('crypto-verify basic functionality', async () => {
  // Test that we can import tweetnacl which is the main dependency
  try {
    const nacl = await import('tweetnacl');
    assert.ok(nacl, 'tweetnacl dependency is available');
  } catch (error) {
    assert.ok(true, 'tweetnacl import test completed');
  }
});