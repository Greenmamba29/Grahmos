#!/bin/bash

# Grahmos V1+V2 Unified Startup Script
# This script starts the Grahmos development environment

set -e

echo "🚀 Starting Grahmos V1+V2 Unified System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        echo ""
        print_header "📦 Docker Installation Required"
        echo ""
        echo "Please install Docker Desktop for macOS:"
        echo "1. Visit: https://www.docker.com/products/docker-desktop/"
        echo "2. Download and install Docker Desktop"
        echo "3. Start Docker Desktop application"
        echo "4. Run this script again"
        echo ""
        echo "Alternative installation via Homebrew:"
        echo "  brew install --cask docker"
        echo ""
        exit 1
    fi

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        echo ""
        print_header "🐳 Docker Setup Required"
        echo ""
        echo "Please start Docker Desktop:"
        echo "1. Open Docker Desktop application"
        echo "2. Wait for Docker to start (green icon in menu bar)"
        echo "3. Run this script again"
        echo ""
        exit 1
    fi

    print_status "Docker is installed and running ✅"
}

# Check if docker-compose is available
check_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    elif docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        print_error "Docker Compose is not available"
        echo ""
        print_header "📦 Docker Compose Required"
        echo ""
        echo "Docker Compose should be included with Docker Desktop."
        echo "Please reinstall Docker Desktop or install Docker Compose separately."
        exit 1
    fi
    
    print_status "Docker Compose is available: $DOCKER_COMPOSE ✅"
}

# Validate environment file
check_environment() {
    if [[ ! -f ".env" ]]; then
        print_warning ".env file not found, creating from defaults..."
        cp .env.example .env 2>/dev/null || {
            print_error ".env.example not found. Please create .env file manually."
            exit 1
        }
    fi
    print_status "Environment configuration found ✅"
}

# Check required directories and files
check_requirements() {
    # Check if Edge API exists
    if [[ ! -d "apps/edge-api" ]]; then
        print_error "apps/edge-api directory not found"
        echo "Please ensure the Edge API application is present."
        exit 1
    fi

    # Check if nginx.conf exists
    if [[ ! -f "nginx.conf" ]]; then
        print_warning "nginx.conf not found in root, copying from infra/docker/"
        cp infra/docker/nginx.conf nginx.conf || {
            print_error "Could not copy nginx.conf"
            exit 1
        }
    fi

    # Check SSL certificates
    if [[ ! -f "certs/server.crt" ]] || [[ ! -f "certs/server.key" ]]; then
        print_warning "SSL certificates not found, generating development certificates..."
        mkdir -p certs
        openssl req -x509 -newkey rsa:2048 -keyout certs/server.key -out certs/server.crt \
            -sha256 -days 365 -nodes -subj "/CN=localhost/O=Grahmos Development" &> /dev/null
        print_status "Development SSL certificates generated ✅"
    fi

    print_status "All requirements checked ✅"
}

# Clean up previous runs
cleanup_previous() {
    print_status "Cleaning up previous containers..."
    $DOCKER_COMPOSE down --remove-orphans &> /dev/null || true
}

# Start services
start_services() {
    print_header ""
    print_header "🏃 Starting Grahmos Services..."
    print_header ""
    
    # Start core services (without Redis by default)
    print_status "Starting Meilisearch and Edge API..."
    $DOCKER_COMPOSE up -d meilisearch edge-api
    
    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    sleep 10
    
    # Start nginx after backend is ready
    print_status "Starting NGINX reverse proxy..."
    $DOCKER_COMPOSE up -d nginx
    
    print_header ""
    print_header "✅ Grahmos V1+V2 Unified System Started!"
    print_header ""
}

# Show service status
show_status() {
    echo ""
    print_header "📊 Service Status:"
    echo ""
    $DOCKER_COMPOSE ps
    echo ""
    
    print_header "🌐 Available Services:"
    echo ""
    echo "• Meilisearch (Search):    http://localhost:7700"
    echo "• Edge API (Main):         http://localhost:8080"
    echo "• NGINX Proxy (HTTPS):     https://localhost:8443"
    echo ""
    
    print_header "🔧 Useful Commands:"
    echo ""
    echo "• View logs:               $DOCKER_COMPOSE logs -f"
    echo "• Stop services:           $DOCKER_COMPOSE down"
    echo "• Restart services:        $DOCKER_COMPOSE restart"
    echo "• View service status:     $DOCKER_COMPOSE ps"
    echo ""
    
    print_header "🛠️ Development URLs:"
    echo ""
    echo "• API Health Check:        http://localhost:8080/health"
    echo "• Meilisearch Admin:       http://localhost:7700"
    echo ""
}

# Health check
health_check() {
    print_status "Running health checks..."
    
    # Check if services are responding
    sleep 5
    
    if curl -s http://localhost:7700/health > /dev/null 2>&1; then
        print_status "Meilisearch is healthy ✅"
    else
        print_warning "Meilisearch health check failed ⚠️"
    fi
    
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        print_status "Edge API is healthy ✅"
    else
        print_warning "Edge API health check failed ⚠️ (may still be starting)"
    fi
}

# Main execution
main() {
    print_header "==============================================="
    print_header "🚀 Grahmos V1+V2 Unified Startup Script"
    print_header "==============================================="
    echo ""
    
    check_docker
    check_docker_compose
    check_environment
    check_requirements
    cleanup_previous
    start_services
    show_status
    health_check
    
    echo ""
    print_header "🎉 Grahmos is ready for development!"
    print_header "==============================================="
}

# Handle script arguments
case "${1:-start}" in
    start)
        main
        ;;
    stop)
        print_status "Stopping Grahmos services..."
        $DOCKER_COMPOSE down
        print_status "Services stopped ✅"
        ;;
    restart)
        print_status "Restarting Grahmos services..."
        $DOCKER_COMPOSE restart
        print_status "Services restarted ✅"
        ;;
    status)
        $DOCKER_COMPOSE ps
        ;;
    logs)
        $DOCKER_COMPOSE logs -f
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start    - Start all Grahmos services (default)"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart all services"
        echo "  status   - Show service status"
        echo "  logs     - Show and follow logs"
        exit 1
        ;;
esac
