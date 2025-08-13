# Grahmos - Decentralized Search Platform

A modern monorepo built with Next.js, P2P networking, and edge computing.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev
```

## 📦 Project Structure

- `apps/pwa-shell/` - Next.js PWA with Tailwind CSS
- `apps/edge-functions/` - Cloudflare Workers
- `apps/kiwix-serve/` - Docker-based content server
- `packages/p2p-delta/` - P2P networking (libp2p/IPFS)
- `packages/crypto-verify/` - Cryptographic verification
- `packages/search-core/` - Core search functionality
- `packages/local-db/` - IndexedDB wrapper
- `packages/ui/` - Shared UI components

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Monorepo**: pnpm workspaces, Turbo
- **P2P**: libp2p, IPFS/Helia
- **Edge**: Cloudflare Workers
- **Database**: Dexie (IndexedDB)
- **Crypto**: TweetNaCl

## 📋 Development Commands

- `pnpm dev` - Start all development servers
- `pnpm dev:pwa` - Start PWA shell only  
- `pnpm dev:edge` - Start edge functions
- `pnpm dev:kiwix` - Start Kiwix server

## 🌟 Features

- Decentralized search architecture
- PWA with offline capabilities
- P2P content distribution
- Real-time cryptographic verification
- Modern dark mode UI with Tailwind
