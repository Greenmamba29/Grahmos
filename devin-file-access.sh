#!/bin/bash

# Devin File Access Script for Grahmos Project
# This script provides Devin with all necessary file access information

echo "=== DEVIN FILE ACCESS INFORMATION ==="
echo ""

# File location
echo "📁 TAR.GZ FILE LOCATION:"
echo "File: grahmos-source-code.tar.gz"
echo "Full Path: /Users/paco/Downloads/grahmos-source-code.tar.gz"
echo "Size: $(ls -lh /Users/paco/Downloads/grahmos-source-code.tar.gz | awk '{print $5}')"
echo ""

# Current project location
echo "📂 CURRENT PROJECT LOCATION:"
echo "Working Directory: $(pwd)"
echo "Git Repository: https://github.com/Greenmamba29/Grahmos"
echo ""

# File verification
echo "🔍 FILE VERIFICATION:"
if [ -f "/Users/paco/Downloads/grahmos-source-code.tar.gz" ]; then
    echo "✅ TAR.GZ file exists and is accessible"
    echo "MD5: $(md5 -q /Users/paco/Downloads/grahmos-source-code.tar.gz)"
else
    echo "❌ TAR.GZ file not found"
fi
echo ""

# Extraction instructions
echo "📋 EXTRACTION INSTRUCTIONS FOR DEVIN:"
echo "To extract the tar.gz file:"
echo "tar -xzf /Users/paco/Downloads/grahmos-source-code.tar.gz -C /tmp/grahmos-extracted"
echo ""

# Project structure
echo "🏗️  PROJECT STRUCTURE:"
echo "This is a monorepo with the following structure:"
echo "├── apps/"
echo "│   ├── pwa-shell/          # Next.js PWA with Tailwind CSS"
echo "│   ├── edge-functions/     # Cloudflare Workers"
echo "│   └── kiwix-serve/        # Docker-based content server"
echo "├── packages/"
echo "│   ├── p2p-delta/          # P2P networking (libp2p/IPFS)"
echo "│   ├── crypto-verify/      # Cryptographic verification"
echo "│   ├── search-core/        # Core search functionality"
echo "│   ├── local-db/           # IndexedDB wrapper"
echo "│   └── ui/                 # Shared UI components"
echo "└── Configuration files for pnpm, Turbo, Docker, etc."
echo ""

# Dependencies
echo "⚙️  DEPENDENCIES:"
echo "Package Manager: pnpm"
echo "Build System: Turbo (monorepo)"
echo "Main Framework: Next.js 15+ with React 19"
echo "Styling: Tailwind CSS"
echo "P2P: libp2p, IPFS/Helia"
echo "Database: Dexie (IndexedDB)"
echo "Crypto: TweetNaCl"
echo "Edge: Cloudflare Workers"
echo ""

# Access methods
echo "🔗 ACCESS METHODS FOR DEVIN:"
echo "Method 1: Direct file access at /Users/paco/Downloads/grahmos-source-code.tar.gz"
echo "Method 2: Git repository at https://github.com/Greenmamba29/Grahmos"
echo "Method 3: Current extracted project at $(pwd)"
echo ""

# System info
echo "💻 SYSTEM INFORMATION:"
echo "OS: $(uname -s) $(uname -r)"
echo "Architecture: $(uname -m)"
echo "Shell: $SHELL"
echo "Node: $(node --version 2>/dev/null || echo 'Not installed')"
echo "npm: $(npm --version 2>/dev/null || echo 'Not installed')"
echo "pnpm: $(pnpm --version 2>/dev/null || echo 'Not installed')"
echo ""

echo "=== END DEVIN ACCESS INFO ==="
