#!/usr/bin/env bash

# Edge Security Production Deployment Script
# Creates systemd services, configures firewall rules, and sets up production environment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SERVICE_NAME="grahmos-edge"
EDGE_DIR="$(pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 Edge Security Production Deployment"
echo "======================================"
echo "Deployment Target: $(hostname)"
echo "Edge Directory: $EDGE_DIR"
echo "Service Name: $SERVICE_NAME"
echo ""

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to prompt for user input
confirm() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi
    
    read -p "$prompt" -r
    REPLY=${REPLY:-$default}
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Check prerequisites
echo "📋 Checking Prerequisites..."

if ! command_exists docker; then
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose first.${NC}"
    exit 1
fi

if ! command_exists systemctl; then
    echo -e "${RED}❌ systemctl not found. This script requires systemd.${NC}"
    exit 1
fi

# Check if running as root (we don't want that)
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}❌ Do not run this script as root. Run as your regular user.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Create systemd user directory if it doesn't exist
echo "📁 Setting up systemd user services..."
mkdir -p "$SYSTEMD_USER_DIR"

# Create the main service file
cat > "$SYSTEMD_USER_DIR/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Grahmos Edge Security & Speed Service
Documentation=file://${EDGE_DIR}/README-edge-security.md
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=exec
WorkingDirectory=${EDGE_DIR}
ExecStartPre=/usr/bin/docker-compose -f docker-compose.edge.yml pull --quiet
ExecStart=/usr/bin/docker-compose -f docker-compose.edge.yml up --remove-orphans
ExecStop=/usr/bin/docker-compose -f docker-compose.edge.yml down --timeout 30
ExecStopPost=/usr/bin/docker system prune -f --filter "label=grahmos.edge=true"

# Restart policy
Restart=on-failure
RestartSec=30
StartLimitInterval=300
StartLimitBurst=3

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${EDGE_DIR}
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096
MemoryMax=2G
TasksMax=1024

# Environment
Environment=COMPOSE_PROJECT_NAME=grahmos-edge
Environment=DOCKER_BUILDKIT=1

[Install]
WantedBy=default.target
EOF

# Create certificate renewal service
cat > "$SYSTEMD_USER_DIR/${SERVICE_NAME}-cert-renewal.service" << EOF
[Unit]
Description=Grahmos Edge Certificate Renewal
Documentation=file://${EDGE_DIR}/README-edge-security.md

[Service]
Type=oneshot
WorkingDirectory=${EDGE_DIR}
ExecStart=${EDGE_DIR}/ops/generate-certificates.sh --renew
User=$(whoami)

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=${EDGE_DIR}/ops/certs
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=grahmos-edge-cert
EOF

# Create certificate renewal timer
cat > "$SYSTEMD_USER_DIR/${SERVICE_NAME}-cert-renewal.timer" << EOF
[Unit]
Description=Grahmos Edge Certificate Renewal Timer
Documentation=file://${EDGE_DIR}/README-edge-security.md
Requires=${SERVICE_NAME}-cert-renewal.service

[Timer]
OnCalendar=daily
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Create update service
cat > "$SYSTEMD_USER_DIR/${SERVICE_NAME}-update.service" << EOF
[Unit]
Description=Grahmos Edge System Update
Documentation=file://${EDGE_DIR}/README-edge-security.md

[Service]
Type=oneshot
WorkingDirectory=${EDGE_DIR}
ExecStart=${EDGE_DIR}/ops/update.sh --check-and-apply
User=$(whoami)

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=${EDGE_DIR}
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes

# Timeout
TimeoutStartSec=600

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=grahmos-edge-update
EOF

# Create update timer (weekly)
cat > "$SYSTEMD_USER_DIR/${SERVICE_NAME}-update.timer" << EOF
[Unit]
Description=Grahmos Edge System Update Timer
Documentation=file://${EDGE_DIR}/README-edge-security.md
Requires=${SERVICE_NAME}-update.service

[Timer]
OnCalendar=weekly
RandomizedDelaySec=2h
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo -e "${GREEN}✅ Systemd service files created${NC}"

# Reload systemd and enable services
echo "🔄 Enabling systemd services..."

systemctl --user daemon-reload

if confirm "Enable and start the main edge security service?" "y"; then
    systemctl --user enable --now "${SERVICE_NAME}.service"
    echo -e "${GREEN}✅ Main service enabled and started${NC}"
else
    echo -e "${YELLOW}⚠️  Main service not started (you can start it later with: systemctl --user start ${SERVICE_NAME})${NC}"
fi

if confirm "Enable certificate renewal timer?" "y"; then
    systemctl --user enable --now "${SERVICE_NAME}-cert-renewal.timer"
    echo -e "${GREEN}✅ Certificate renewal timer enabled${NC}"
fi

if confirm "Enable system update timer?" "y"; then
    systemctl --user enable --now "${SERVICE_NAME}-update.timer"
    echo -e "${GREEN}✅ Update timer enabled${NC}"
fi

# Enable lingering for user services to start on boot
echo "🔐 Configuring user service persistence..."
if confirm "Enable user service persistence (services start on boot without login)?" "y"; then
    sudo loginctl enable-linger "$(whoami)"
    echo -e "${GREEN}✅ User service persistence enabled${NC}"
fi

# Firewall configuration (if available)
echo ""
echo "🔥 Firewall Configuration..."

configure_firewall_ufw() {
    echo "Configuring UFW firewall..."
    
    # Basic UFW setup
    sudo ufw --force reset
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH (adjust port as needed)
    sudo ufw allow ssh
    
    # Allow Edge Security HTTPS
    sudo ufw allow 8443/tcp comment 'Grahmos Edge HTTPS'
    
    # Allow Edge Security HTTP (for Let's Encrypt)
    sudo ufw allow 8080/tcp comment 'Grahmos Edge HTTP'
    
    # Rate limiting for Edge ports
    sudo ufw limit 8443/tcp
    sudo ufw limit 8080/tcp
    
    # Enable UFW
    sudo ufw --force enable
    
    echo -e "${GREEN}✅ UFW firewall configured${NC}"
}

configure_firewall_nftables() {
    echo "Configuring nftables firewall..."
    
    # Create nftables configuration
    sudo tee /etc/nftables-grahmos-edge.conf > /dev/null << 'EOF'
#!/usr/sbin/nft -f

# Grahmos Edge Security Firewall Rules
flush ruleset

table inet grahmos_edge {
    # Rate limiting sets
    set rate_limit_ssh {
        type ipv4_addr
        size 65536
        flags dynamic,timeout
        timeout 60s
    }
    
    set rate_limit_edge {
        type ipv4_addr
        size 65536  
        flags dynamic,timeout
        timeout 10s
    }
    
    chain input {
        type filter hook input priority filter; policy drop;
        
        # Allow loopback
        iif "lo" accept
        
        # Allow established and related connections
        ct state established,related accept
        
        # Allow ICMP ping
        ip protocol icmp icmp type echo-request limit rate 1/second accept
        ip6 nexthdr ipv6-icmp icmpv6 type echo-request limit rate 1/second accept
        
        # SSH with rate limiting
        tcp dport 22 add @rate_limit_ssh { ip saddr limit rate 3/minute } accept
        
        # Grahmos Edge services with rate limiting
        tcp dport 8443 add @rate_limit_edge { ip saddr limit rate 20/second } accept
        tcp dport 8080 add @rate_limit_edge { ip saddr limit rate 10/second } accept
        
        # Log dropped packets (optional)
        limit rate 1/minute log prefix "DROP: "
    }
    
    chain forward {
        type filter hook forward priority filter; policy drop;
    }
    
    chain output {
        type filter hook output priority filter; policy accept;
    }
}
EOF
    
    # Load nftables rules
    sudo nft -f /etc/nftables-grahmos-edge.conf
    
    # Make persistent (systemd method)
    if command_exists systemctl; then
        sudo systemctl enable nftables
        sudo cp /etc/nftables-grahmos-edge.conf /etc/nftables.conf
    fi
    
    echo -e "${GREEN}✅ nftables firewall configured${NC}"
}

if command_exists ufw; then
    if confirm "Configure UFW firewall for Edge Security?" "y"; then
        configure_firewall_ufw
    fi
elif command_exists nft; then
    if confirm "Configure nftables firewall for Edge Security?" "y"; then
        configure_firewall_nftables
    fi
else
    echo -e "${YELLOW}⚠️  No supported firewall found (ufw or nftables). Please configure firewall manually.${NC}"
    echo "Required ports:"
    echo "  - 8443/tcp (HTTPS)"
    echo "  - 8080/tcp (HTTP)"
    echo "  - 22/tcp (SSH - adjust as needed)"
fi

# Log rotation setup
echo ""
echo "📋 Setting up log rotation..."

sudo tee /etc/logrotate.d/grahmos-edge > /dev/null << EOF
# Grahmos Edge log rotation
${EDGE_DIR}/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 $(whoami) $(whoami)
    postrotate
        systemctl --user reload-or-restart ${SERVICE_NAME} >/dev/null 2>&1 || true
    endscript
}
EOF

echo -e "${GREEN}✅ Log rotation configured${NC}"

# Create production health check script
echo ""
echo "🏥 Creating health check script..."

cat > "${EDGE_DIR}/ops/health-check.sh" << 'EOF'
#!/usr/bin/env bash

# Grahmos Edge Health Check Script
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EDGE_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'  
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🏥 Grahmos Edge Health Check"
echo "==========================="

# Check if services are running
echo "📊 Service Status:"
if systemctl --user is-active --quiet grahmos-edge; then
    echo -e "  ${GREEN}✅ Main service: ACTIVE${NC}"
else
    echo -e "  ${RED}❌ Main service: INACTIVE${NC}"
fi

# Check container health
echo ""
echo "🐳 Container Status:"
cd "$EDGE_DIR"
if docker-compose -f docker-compose.edge.yml ps | grep -q "Up"; then
    echo -e "  ${GREEN}✅ Containers: RUNNING${NC}"
    docker-compose -f docker-compose.edge.yml ps --format table
else
    echo -e "  ${RED}❌ Containers: NOT RUNNING${NC}"
fi

# Check endpoints
echo ""
echo "🌐 Endpoint Health:"
if curl -k -s --max-time 5 https://localhost:8443/health >/dev/null 2>&1; then
    echo -e "  ${GREEN}✅ HTTPS endpoint: RESPONSIVE${NC}"
else
    echo -e "  ${RED}❌ HTTPS endpoint: NOT RESPONSIVE${NC}"
fi

# Check certificates
echo ""
echo "🔐 Certificate Status:"
if [ -f "$EDGE_DIR/ops/certs/server.crt" ]; then
    CERT_EXPIRY=$(openssl x509 -in "$EDGE_DIR/ops/certs/server.crt" -noout -dates | grep notAfter | cut -d= -f2)
    DAYS_UNTIL_EXPIRY=$(( ($(date -d "$CERT_EXPIRY" +%s) - $(date +%s)) / 86400 ))
    
    if [ $DAYS_UNTIL_EXPIRY -gt 30 ]; then
        echo -e "  ${GREEN}✅ Certificate: Valid for $DAYS_UNTIL_EXPIRY days${NC}"
    elif [ $DAYS_UNTIL_EXPIRY -gt 7 ]; then
        echo -e "  ${YELLOW}⚠️  Certificate: Expires in $DAYS_UNTIL_EXPIRY days${NC}"
    else
        echo -e "  ${RED}❌ Certificate: Expires in $DAYS_UNTIL_EXPIRY days - URGENT${NC}"
    fi
else
    echo -e "  ${RED}❌ Certificate: NOT FOUND${NC}"
fi

# Check disk space
echo ""
echo "💾 Resource Usage:"
DISK_USAGE=$(df "$EDGE_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 80 ]; then
    echo -e "  ${GREEN}✅ Disk usage: ${DISK_USAGE}%${NC}"
elif [ $DISK_USAGE -lt 90 ]; then
    echo -e "  ${YELLOW}⚠️  Disk usage: ${DISK_USAGE}%${NC}"
else
    echo -e "  ${RED}❌ Disk usage: ${DISK_USAGE}% - CRITICAL${NC}"
fi

echo ""
echo "Health check completed: $(date)"
EOF

chmod +x "${EDGE_DIR}/ops/health-check.sh"

# Create monitoring cron job
if confirm "Set up automated health checks (cron)?" "y"; then
    # Add to user's crontab
    (crontab -l 2>/dev/null; echo "*/5 * * * * ${EDGE_DIR}/ops/health-check.sh >> ${EDGE_DIR}/logs/health-check.log 2>&1") | crontab -
    echo -e "${GREEN}✅ Health check cron job added (every 5 minutes)${NC}"
fi

# Final status check
echo ""
echo "🎯 Final Status Check"
echo "===================="

# Run health check
"${EDGE_DIR}/ops/health-check.sh"

echo ""
echo -e "${GREEN}🚀 Production deployment completed!${NC}"
echo ""
echo "Service Management Commands:"
echo "  Start:   systemctl --user start ${SERVICE_NAME}"
echo "  Stop:    systemctl --user stop ${SERVICE_NAME}"  
echo "  Status:  systemctl --user status ${SERVICE_NAME}"
echo "  Logs:    journalctl --user -u ${SERVICE_NAME} -f"
echo ""
echo "Health Check: ${EDGE_DIR}/ops/health-check.sh"
echo "Certificate Renewal: systemctl --user start ${SERVICE_NAME}-cert-renewal"
echo "System Update: systemctl --user start ${SERVICE_NAME}-update"
echo ""
echo "Next Steps:"
echo "1. Test the deployment with real client certificates"
echo "2. Monitor logs for any issues"
echo "3. Set up external monitoring if desired"
echo "4. Review firewall rules and adjust as needed"

exit 0
