# M6A - Secure Peer Sync

## Overview
Secure peer-to-peer document synchronization using libp2p WebRTC with encrypted messaging and Ed25519 signature verification.

## Features
- WebRTC-based P2P networking with libp2p and gossipsub
- Passphrase-based encryption using TweetNaCl secretbox
- Ed25519 signature verification for message authenticity
- Real-time cross-tab synchronization
- Diagnostics widget showing peer count and last message time

## Testing
1. Open two browser tabs to localhost:3000
2. Go to /settings in both tabs and set the same sync passphrase
3. In tab A console: `await window.__sync.publish({id:'sync_demo'+Date.now(), title:'Sync Demo', url:'/A/Sync_Demo.html', summary:'hello from A'})`
4. Verify tab B receives the document and it appears in search results
5. Check diagnostics widget shows peer count and message timing

## Security
- Messages are encrypted with passphrase-derived keys
- Different passphrases prevent decryption
- Invalid signatures are rejected
- All crypto operations use TweetNaCl library

## Implementation
- `packages/p2p-delta/src/peerSync.ts` - Core P2P sync logic
- `apps/pwa-shell/src/lib/settings.ts` - Passphrase management
- `apps/pwa-shell/src/app/settings/page.tsx` - Settings UI
- `apps/pwa-shell/src/app/(components)/Diagnostics.tsx` - Status widget
