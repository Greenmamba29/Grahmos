# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### In Progress
- GitHub Pages deployment workflow
- Cloudflare Workers preview deployment
- Release promotion automation

## [0.1.0-rc1] - 2025-08-13

### Added
- Complete PWA shell with offline search and article viewing
- Content pack management with signature verification
- Purchase system with receipt validation and key rotation
- Peer-to-peer sync with libp2p and battery-aware cadence profiles
- End-to-end Playwright testing for pack management and P2P sync
- Service worker caching with size limits and cleanup
- Diagnostic dashboard for P2P network and battery status

### Features Implemented
- **M6C**: Pack removal with cache eviction, OPFS cleanup, and document reindexing
- **M7A**: Enhanced diagnostics with peer sync cadence display
- **M7C**: Battery profiles (normal, red, lowPower, auto) with adaptive sync
- **M7D**: Playwright P2P smoke test for sync verification
- **M8A**: Purchase productionization with key rotation and Orders UI

### Security
- Minisign signature verification for content packs
- PBKDF2 key derivation with 100k iterations
- Replay protection with LRU cache and 60-minute TTL
- Message encryption with random 24-byte nonces
- Receipt validation with key ID-based verification

### Performance
- Workbox cache size caps (HTML: 50MB, Assets: 100MB, PMTiles: 200MB)
- OPFS storage for large datasets with cleanup on pack removal
- Battery-aware sync cadence with automatic profile switching
- Service worker precaching with 79 URLs (6.73MB total)

### Testing
- Playwright E2E tests for pack management workflows
- P2P sync smoke test with mock peer communication
- Receipt verification and download functionality tests
- Storage usage estimation and cache cleanup verification

## [0.0.1] - 2025-01-01

### Added
- Initial project setup
- Basic PWA shell structure
- Core dependencies and build system
