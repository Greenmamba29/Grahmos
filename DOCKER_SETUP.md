# Docker Setup Guide for Grahmos

## 🐳 Quick Docker Installation

### Option 1: Docker Desktop (Recommended)

1. **Download Docker Desktop**
   ```bash
   # Visit https://www.docker.com/products/docker-desktop/
   # OR use direct link:
   open "https://desktop.docker.com/mac/main/amd64/Docker.dmg"
   ```

2. **Install Docker Desktop**
   - Open the downloaded `.dmg` file
   - Drag Docker to Applications folder
   - Launch Docker from Applications
   - Follow setup wizard (accept license, etc.)

3. **Wait for Docker to Start**
   - Look for Docker icon in menu bar
   - Wait until it shows "Docker Desktop is running" (green icon)

### Option 2: Homebrew Installation

1. **Install Homebrew** (if not installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Docker**:
   ```bash
   brew install --cask docker
   ```

3. **Start Docker Desktop**:
   ```bash
   open /Applications/Docker.app
   ```

## 🚀 Start Grahmos

Once Docker is installed and running:

```bash
# Navigate to Grahmos directory
cd /Users/paco/Downloads/Grahmos

# Run the startup script
./start-grahmos.sh
```

## 🔧 Manual Docker Commands

If you prefer manual control:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Restart services
docker compose restart

# View service status
docker compose ps
```

## 🌐 Service Access

Once running, access these services:

- **Meilisearch**: http://localhost:7700
- **Edge API**: http://localhost:8080
- **NGINX Proxy**: https://localhost:8443

## 🔍 Health Checks

```bash
# Check Meilisearch
curl http://localhost:7700/health

# Check Edge API
curl http://localhost:8080/health
```

## 🛠️ Troubleshooting

### Docker Not Found
- Ensure Docker Desktop is installed and running
- Check Docker icon in menu bar is green
- Try restarting Docker Desktop

### Port Conflicts
If ports are already in use, edit `.env` file:
```bash
# Change ports in .env
MEILI_PORT=7701
NGINX_HTTP_PORT=8081
NGINX_HTTPS_PORT=8444
```

### Permission Issues
```bash
# Fix Docker socket permissions (if needed)
sudo chown $(whoami):staff /var/run/docker.sock
```

### Container Build Failures
```bash
# Clean up and rebuild
docker compose down -v
docker system prune -f
docker compose build --no-cache
docker compose up -d
```

## 📋 Next Steps

1. **Install Docker** using one of the options above
2. **Run the startup script**: `./start-grahmos.sh`
3. **Access the services** at the URLs listed above
4. **Check the logs** if anything fails: `docker compose logs -f`

The startup script will automatically:
- Check for Docker installation
- Validate all requirements
- Generate SSL certificates
- Start all services
- Run health checks
- Display service URLs

Happy coding! 🎉
