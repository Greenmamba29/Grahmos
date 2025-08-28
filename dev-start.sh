#!/bin/bash

echo "🚀 Starting Grahmos Development Environment"
echo "==========================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Docker
if command_exists docker; then
    echo "✅ Docker found - Kiwix service will be available"
    DOCKER_AVAILABLE=true
else
    echo "⚠️  Docker not found - Kiwix service will be skipped"
    echo "   Install Docker Desktop to enable offline content serving"
    DOCKER_AVAILABLE=false
fi

# Check Wrangler
if command_exists wrangler; then
    echo "✅ Wrangler found - Edge functions will be available"
    WRANGLER_AVAILABLE=true
else
    echo "⚠️  Wrangler not found - Edge functions may not work"
    echo "   Run: npm install -g wrangler"
    WRANGLER_AVAILABLE=false
fi

echo ""
echo "Starting services..."

# Start PWA Shell (always available)
echo "🌐 Starting PWA Shell on http://localhost:3000"
pnpm dev:pwa &
PWA_PID=$!

# Start Edge Functions if Wrangler is available
if [ "$WRANGLER_AVAILABLE" = true ]; then
    echo "⚡ Starting Edge Functions on http://localhost:8787"
    pnpm dev:edge &
    EDGE_PID=$!
fi

# Start Kiwix if Docker is available
if [ "$DOCKER_AVAILABLE" = true ]; then
    echo "📚 Starting Kiwix Content Server"
    pnpm dev:kiwix &
    KIWIX_PID=$!
fi

echo ""
echo "🎉 Development environment started!"
echo ""
echo "Available services:"
echo "- PWA Shell: http://localhost:3000"
if [ "$WRANGLER_AVAILABLE" = true ]; then
    echo "- Edge Functions: http://localhost:8787"
fi
if [ "$DOCKER_AVAILABLE" = true ]; then
    echo "- Kiwix Server: http://localhost:8080 (when Docker containers are ready)"
fi

echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    
    if [ ! -z "$PWA_PID" ]; then
        kill $PWA_PID 2>/dev/null
    fi
    
    if [ ! -z "$EDGE_PID" ]; then
        kill $EDGE_PID 2>/dev/null
    fi
    
    if [ ! -z "$KIWIX_PID" ]; then
        kill $KIWIX_PID 2>/dev/null
        # Also stop Docker containers
        cd apps/kiwix-serve && docker compose down 2>/dev/null
    fi
    
    exit 0
}

# Set trap to cleanup on Ctrl+C
trap cleanup INT TERM

# Wait for user to stop
wait
