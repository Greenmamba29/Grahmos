# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Grahmos is a decentralized search platform built as a modern monorepo with Next.js PWA, P2P networking, edge computing, and 3D mapping capabilities. It combines offline-first architecture with cryptographic verification and real-time content distribution.

## Common Development Commands

### Quick Start
```bash
# Install all dependencies
pnpm install

# Start all development servers (parallel)
pnpm dev
```

### Individual Service Development
```bash
# PWA shell only (Next.js app on port 3000)
pnpm dev:pwa

# Edge functions (Cloudflare Workers)
pnpm dev:edge

# Kiwix content server (Docker)
pnpm dev:kiwix
```

### Build & Release
```bash
# Build all packages
pnpm build

# Create release candidate tag
pnpm release:rc

# Promote release (with specific version)
pnpm release:promote --from v0.1.0-rc1 --to v0.1.0
```

### Testing
```bash
# E2E tests with Playwright
cd apps/pwa-shell
pnpm test:e2e

# Interactive E2E testing
pnpm test:e2e:ui

# Debug E2E tests
pnpm test:e2e:debug
```

### Verification & Testing Scripts
```bash
# Milestone verification
node verify-m6a-fixes.js
node verify-m8a-crypto.js

# Integration testing
node test-emergency-integration.js
node test-m8a.js
node test-milestones.js
```

## Architecture Overview

### Monorepo Structure
- **pnpm workspaces** with Turbo for efficient builds
- **TypeScript throughout** with Next.js 15 and React 19
- **Microservices approach** with independent apps and shared packages

### Core Apps
1. **`apps/pwa-shell/`** - Next.js 15 PWA with static export
   - Tailwind CSS v4 for styling
   - Workbox for service worker and offline caching
   - Cesium for 3D mapping and geospatial visualization
   - Deck.gl for overlay layers and data visualization
   - MapLibre GL for 2D mapping

2. **`apps/edge-functions/`** - Cloudflare Workers
   - Stripe integration for payments
   - Receipt generation with TweetNaCl cryptography
   - KV storage for orders

3. **`apps/kiwix-serve/`** - Docker-based content server
   - Offline Wikipedia/content serving
   - Volume mounts for ZIM files and library data

### Core Packages
1. **`packages/p2p-delta/`** - P2P networking layer
   - libp2p with WebSockets and WebRTC transports
   - IPFS/Helia for distributed content
   - Gossipsub for real-time message broadcasting
   - Cryptographic verification for content integrity

2. **`packages/crypto-verify/`** - Security layer
   - TweetNaCl for signing and verification
   - PBKDF2 key derivation with 100k iterations
   - Replay protection with 60min TTL
   - Message canonicalization for signature binding

3. **`packages/search-core/`** - Search functionality
   - In-memory indexing with field-based search
   - Document management and filtering

4. **`packages/local-db/`** - Client storage
   - Dexie wrapper for IndexedDB
   - Offline data persistence and sync

5. **`packages/ui/`** - Shared components
   - Reusable React components across apps

### Key Architectural Patterns

#### P2P Content Distribution
- Real-time document updates via gossipsub topics
- Cryptographic signatures on all content deltas
- TOFU (Trust On First Use) key management
- Automatic replication and verification pipeline

#### Hybrid Mapping System
- **2D Mode**: MapLibre with PMTiles for vector data
- **3D Mode**: Cesium with 3D tilesets and terrain
- **Overlay System**: Deck.gl layers for evacuation routes/points
- **Performance Monitoring**: Render timing and GPU optimization

#### Offline-First PWA
- Workbox caching strategies (CacheFirst, StaleWhileRevalidate)
- OPFS (Origin Private File System) for large files
- Service worker with cache eviction and cleanup
- Static site generation with Next.js export

#### Security Architecture
- **Nonce-based replay protection** with 24-byte randomness
- **Enhanced signature binding** covering all message fields
- **PBKDF2 key derivation** with salt and high iteration count
- **Dev assertions** for debugging security flows

## Development Patterns

### Workbox Caching Strategy
- **Pack content**: CacheFirst for `/api/kiwix?path=*`
- **Overlay data**: CacheFirst for `/overlays/*` paths
- **Static assets**: Precaching with revision-based invalidation
- **Cache cleanup**: Automatic eviction on pack removal

### TypeScript Configuration
- **Strict mode enabled** across all packages
- **ESM modules** with proper import/export patterns
- **Workspace references** for cross-package dependencies
- **Next.js transpilation** of workspace packages

### Testing Strategy
- **Playwright E2E tests** for critical user flows
- **Integration tests** for P2P and cryptography
- **Milestone verification** scripts for feature validation
- **Cross-browser testing** (Chrome, Firefox, Safari)

## Important Notes

### Development Server Behavior
- Next.js dev server may use alternate ports (3001, 3002) if 3000 is busy
- Development logs include WebRTC connection attempts and P2P handshakes
- Hot reloading works across workspace package changes

### Production Build Requirements
- **Static export mode** configured for PWA deployment
- **Workbox service worker generation** with 70+ cached URLs
- **Image optimization disabled** for static hosting compatibility
- **Package transpilation required** for workspace dependencies

### P2P Network Considerations
- libp2p bootstrap nodes may be needed for initial peer discovery
- WebRTC requires STUN/TURN servers for NAT traversal
- Message verification adds ~50ms latency per update
- Replay protection requires persistent storage across sessions

### 3D Mapping Performance
- Cesium requires ~50MB initial download for full features
- 3D tilesets should be optimized with glTF compression
- Performance monitoring available via render timers
- GPU memory usage scales with overlay complexity

### Security Model
- All content updates require valid cryptographic signatures
- Public keys distributed via DHT with TOFU validation
- Nonce uniqueness prevents replay attacks
- Emergency mode allows bypassing some verification for critical updates

This architecture enables truly decentralized, offline-capable search and mapping while maintaining security and performance standards suitable for emergency response scenarios.
