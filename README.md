# 🌍 GrahmOS - Decentralized Emergency Knowledge Search & Mapping Platform

[![Deploy Status](https://api.netlify.com/api/v1/badges/9670dc3d-83fd-48cf-9aa4-ad1b07c4a60a/deploy-status)](https://app.netlify.com/projects/grahmos-v1)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-brightgreen)](https://grahmos-v1.netlify.app)
[![Offline First](https://img.shields.io/badge/Offline-First-blue)](#offline-capabilities)

**🚀 Live Demo:** [https://grahmos-v1.netlify.app](https://grahmos-v1.netlify.app)

GrahmOS is a decentralized, offline-first emergency preparedness and knowledge platform that combines:
- 🔍 **Intelligent Search** - Offline-capable search through emergency documentation
- 🗺️ **Emergency Mapping** - Real-time 2D/3D mapping with evacuation routes and hazard zones
- 🤖 **AI Assistant** - Context-aware assistant for emergency preparedness and general help
- 📱 **Progressive Web App** - Install as a native app on any device
- 🌐 **P2P Network** - Decentralized content distribution and verification

---

## 🚀 Quick Start - Install GrahmOS

### 📱 Mobile Installation (iOS/Android)

#### Option 1: Direct PWA Installation
1. **Open** [https://grahmos-v1.netlify.app](https://grahmos-v1.netlify.app) in your mobile browser
2. **iOS (Safari)**:
   - Tap the Share button (📤)
   - Scroll down and tap "Add to Home Screen"
   - Tap "Add" to install
3. **Android (Chrome)**:
   - Tap the three-dot menu (⋮)
   - Select "Add to Home screen" or "Install app"
   - Tap "Install"

#### Option 2: QR Code Installation
Visit the live demo and use your camera to scan the install QR code for instant access.

### 💻 Desktop Installation

#### Option 1: Browser PWA (Recommended)
1. **Chrome/Edge**:
   - Visit [https://grahmos-v1.netlify.app](https://grahmos-v1.netlify.app)
   - Click the install icon (⊕) in the address bar
   - Click "Install" in the popup
2. **Safari**:
   - Visit the URL and use "Add to Dock" from the Share menu
3. **Firefox**:
   - Visit the URL and look for the PWA install prompt

#### Option 2: Desktop App (Coming Soon)
```bash
# macOS
brew install grahmos

# Windows
winget install grahmos

# Linux
sudo snap install grahmos
```

### 🌐 Web Access
No installation required - just visit [https://grahmos-v1.netlify.app](https://grahmos-v1.netlify.app)

---

## ✨ Features Overview

### 🔍 Search & Documentation
- **Offline-First Search**: Search through emergency documentation without internet connection
- **Intelligent Indexing**: Fast, local search with real-time results
- **Content Caching**: Articles cached for offline reading
- **Multi-format Support**: Text, images, and interactive content

### 🗺️ Emergency Mapping
- **2D/3D Mapping**: Toggle between MapLibre 2D maps and Cesium 3D globe
- **Emergency Overlays**: Evacuation routes, safe zones, hazard areas, and emergency points
- **Real-time Data**: Live updates on emergency situations and evacuation routes
- **Interactive Layers**: Click and explore different emergency information layers

### 🤖 AI Assistant
- **Context-Aware Help**: Emergency preparedness guidance and general assistance
- **Offline Capability**: Basic emergency responses work without internet
- **Natural Conversation**: Chat-based interface with memory of conversation context
- **Emergency Mode**: Priority responses for urgent situations

### 📱 Progressive Web App
- **Native App Experience**: Install and run like a native app on any device
- **Offline Functionality**: Core features work without internet connection
- **Background Sync**: Updates sync when connection is restored
- **Push Notifications**: Emergency alerts and updates (when enabled)

---

## 🛠️ For Developers

### Quick Development Setup

```bash
# Clone the repository
git clone https://github.com/Greenmamba29/Grahmos.git
cd Grahmos

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

### 📦 Project Structure

```
apps/
├── pwa-shell/          # Next.js PWA (main frontend)
├── edge-functions/     # Cloudflare Workers
└── kiwix-serve/        # Docker content server

packages/
├── p2p-delta/          # P2P networking layer
├── crypto-verify/      # Security & verification
├── search-core/        # Search functionality
├── local-db/           # IndexedDB wrapper
├── ai/                 # AI integration
└── ui/                 # Shared components
```

### 🧰 Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS v4
- **Monorepo**: pnpm workspaces, Turbo
- **Mapping**: Cesium, MapLibre GL, Deck.gl, PMTiles
- **P2P**: libp2p, IPFS/Helia, gossipsub
- **Edge**: Cloudflare Workers, KV Storage
- **Security**: TweetNaCl, PBKDF2, replay protection
- **PWA**: Workbox, Service Workers, IndexedDB

### 📋 Development Commands

```bash
# Development
pnpm dev                # Start all servers
pnpm dev:pwa           # PWA shell only
pnpm dev:edge          # Edge functions
pnpm dev:kiwix         # Content server

# Building
pnpm build             # Build all packages
pnpm build:apps        # Build apps only
pnpm build:packages    # Build packages only

# Testing
pnpm test:e2e          # E2E tests with Playwright
pnpm test:integration  # Integration tests
pnpm test:unit         # Unit tests

# Deployment
pnpm deploy:staging    # Deploy to staging
pnpm deploy:production # Deploy to production
```

---

## 🌟 Why GrahmOS?

### For Users
- **Always Available**: Works offline when you need it most
- **Comprehensive**: Search, maps, and AI assistance in one platform  
- **Fast & Reliable**: Instant responses with local processing
- **Privacy-First**: Your data stays on your device
- **Universal**: Works on any device with a modern browser

### For Organizations
- **Decentralized**: No single point of failure
- **Scalable**: P2P network grows with usage
- **Customizable**: White-label deployment options
- **Cost-Effective**: Reduced infrastructure requirements
- **Resilient**: Continues working during network disruptions

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution Steps
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📜 License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support & Emergency Use

**For Emergency Use**: GrahmOS is designed to work offline. If you're in an emergency situation:
1. Open the app (it should work without internet)
2. Use the Emergency Mapping tab for evacuation routes
3. Search for "emergency" or "first aid" in the Search tab
4. Ask the AI assistant for immediate guidance

**For Support**: 
- 📧 Email: support@grahmos.com
- 🐛 Bug Reports: [GitHub Issues](https://github.com/Greenmamba29/Grahmos/issues)
- 💬 Community: [Discord Server](https://discord.gg/grahmos)
- 📖 Docs: [Documentation](https://docs.grahmos.com)

---

**Built with ❤️ for emergency preparedness and resilient communities**
