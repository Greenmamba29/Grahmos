# Grahmos Edge Gateway - NixOS Configuration
# Reproducible edge node deployment with P2P networking and monitoring

{ config, pkgs, lib, ... }:

let
  # Grahmos edge gateway configuration
  grahmos-edge = pkgs.stdenv.mkDerivation rec {
    pname = "grahmos-edge";
    version = "2.0.0";
    
    src = ../../../apps/edge-api;
    
    nativeBuildInputs = with pkgs; [
      nodejs_20
      pnpm
    ];
    
    buildPhase = ''
      export HOME=$TMPDIR
      export PNPM_HOME=$TMPDIR/.pnpm
      
      pnpm config set store-dir $TMPDIR/.pnpm-store
      pnpm install --frozen-lockfile
      pnpm build
    '';
    
    installPhase = ''
      mkdir -p $out/bin $out/lib/grahmos-edge
      cp -r dist/* $out/lib/grahmos-edge/
      cp -r node_modules $out/lib/grahmos-edge/
      cp package.json $out/lib/grahmos-edge/
      
      # Create startup script
      cat > $out/bin/grahmos-edge << 'EOF'
      #!${pkgs.bash}/bin/bash
      cd $out/lib/grahmos-edge
      exec ${pkgs.nodejs_20}/bin/node dist/index.js "$@"
      EOF
      chmod +x $out/bin/grahmos-edge
    '';
    
    meta = with lib; {
      description = "Grahmos Edge Gateway Service";
      homepage = "https://github.com/grahmos/grahmos";
      license = licenses.agpl3Plus;
      maintainers = [ "grahmos-team" ];
      platforms = platforms.linux;
    };
  };
  
  # P2P network configuration
  p2pConfig = {
    bootstrap_nodes = [
      "/ip4/bootstrap1.grahmos.io/tcp/4001/p2p/12D3KooWGRMGDJH8Q7Wz8QJX9X2P4Y5Z6A7B8C9D0E1F2G3H4I5J6"
      "/ip4/bootstrap2.grahmos.io/tcp/4001/p2p/12D3KooWABCDEFGH8I7J6K5L4M3N2O1P0Q9R8S7T6U5V4W3X2Y1Z0"
    ];
    listen_addresses = [
      "/ip4/0.0.0.0/tcp/4001"
      "/ip6/::/tcp/4001"
      "/ip4/0.0.0.0/tcp/4002/ws"
    ];
    enable_mdns = true;
    enable_upnp = true;
    connection_limits = {
      max_peers = 100;
      min_peers = 5;
      max_pending_incoming = 10;
      max_pending_outgoing = 25;
    };
  };
  
  # Monitoring configuration
  monitoring = {
    enable = true;
    prometheus_port = 9090;
    metrics_interval = 30;
    log_level = "info";
  };

in {
  # System configuration
  system.stateVersion = "23.11";
  
  # Networking
  networking = {
    hostName = "grahmos-edge-gateway";
    
    # Enable NetworkManager for dynamic network configuration
    networkmanager.enable = true;
    
    # Firewall configuration for P2P networking
    firewall = {
      enable = true;
      allowedTCPPorts = [ 
        22    # SSH
        80    # HTTP
        443   # HTTPS  
        4001  # P2P libp2p
        8080  # Edge API
        9090  # Prometheus metrics
      ];
      allowedUDPPorts = [
        4001  # P2P libp2p UDP
        1900  # UPnP discovery
      ];
      
      # Allow mDNS for local discovery
      allowedTCPPortRanges = [
        { from = 32768; to = 65535; }  # Dynamic ports for WebRTC
      ];
    };
    
    # Enable IPv6
    enableIPv6 = true;
  };
  
  # Users and security
  users.users.grahmos = {
    isSystemUser = true;
    group = "grahmos";
    home = "/var/lib/grahmos";
    createHome = true;
    shell = pkgs.bash;
  };
  
  users.groups.grahmos = {};
  
  # System packages
  environment.systemPackages = with pkgs; [
    # Core utilities
    curl
    wget
    jq
    htop
    iotop
    netstat-nat
    tcpdump
    
    # Network tools
    dig
    nmap
    iperf3
    
    # Monitoring
    prometheus-node-exporter
    
    # Container runtime
    docker
    docker-compose
    
    # Development tools (for debugging)
    nodejs_20
    git
  ];
  
  # Docker configuration
  virtualisation.docker = {
    enable = true;
    enableOnBoot = true;
    autoPrune.enable = true;
  };
  
  # Add grahmos user to docker group
  users.users.grahmos.extraGroups = [ "docker" "networkmanager" ];
  
  # Grahmos Edge Gateway Service
  systemd.services.grahmos-edge = {
    description = "Grahmos Edge Gateway";
    after = [ "network.target" "docker.service" ];
    wants = [ "network.target" ];
    wantedBy = [ "multi-user.target" ];
    
    environment = {
      NODE_ENV = "production";
      PORT = "8080";
      
      # P2P Configuration
      P2P_BOOTSTRAP_NODES = builtins.concatStringsSep "," p2pConfig.bootstrap_nodes;
      P2P_LISTEN_ADDRESSES = builtins.concatStringsSep "," p2pConfig.listen_addresses;
      P2P_ENABLE_MDNS = if p2pConfig.enable_mdns then "true" else "false";
      P2P_ENABLE_UPNP = if p2pConfig.enable_upnp then "true" else "false";
      P2P_MAX_PEERS = toString p2pConfig.connection_limits.max_peers;
      P2P_MIN_PEERS = toString p2pConfig.connection_limits.min_peers;
      
      # Monitoring
      METRICS_ENABLED = "true";
      METRICS_PORT = toString monitoring.prometheus_port;
      LOG_LEVEL = monitoring.log_level;
      
      # Storage
      DATA_DIR = "/var/lib/grahmos/data";
      LOG_DIR = "/var/log/grahmos";
      
      # Security
      AUTO_UPDATE_ENABLED = "true";
      SIGNATURE_VERIFICATION = "true";
    };
    
    serviceConfig = {
      Type = "simple";
      User = "grahmos";
      Group = "grahmos";
      ExecStart = "${grahmos-edge}/bin/grahmos-edge";
      Restart = "always";
      RestartSec = "10s";
      
      # Security hardening
      NoNewPrivileges = true;
      PrivateTmp = true;
      ProtectSystem = "strict";
      ProtectHome = true;
      ReadWritePaths = [ "/var/lib/grahmos" "/var/log/grahmos" ];
      
      # Resource limits
      LimitNOFILE = 65536;
      LimitNPROC = 4096;
    };
    
    preStart = ''
      # Create necessary directories
      mkdir -p /var/lib/grahmos/{data,config}
      mkdir -p /var/log/grahmos
      chown -R grahmos:grahmos /var/lib/grahmos /var/log/grahmos
      
      # Generate node identity if it doesn't exist
      if [ ! -f /var/lib/grahmos/config/node-id ]; then
        ${pkgs.openssl}/bin/openssl rand -hex 32 > /var/lib/grahmos/config/node-id
        chown grahmos:grahmos /var/lib/grahmos/config/node-id
        chmod 600 /var/lib/grahmos/config/node-id
      fi
    '';
  };
  
  # Prometheus Node Exporter for system metrics
  services.prometheus.exporters.node = {
    enable = true;
    port = 9100;
    enabledCollectors = [
      "systemd"
      "processes"
      "network"
      "diskstats"
      "filesystem"
      "loadavg"
      "meminfo"
      "netstat"
    ];
  };
  
  # Log rotation for Grahmos logs
  services.logrotate = {
    enable = true;
    settings = {
      "/var/log/grahmos/*.log" = {
        frequency = "daily";
        rotate = 30;
        compress = true;
        delaycompress = true;
        missingok = true;
        notifempty = true;
        postrotate = "systemctl reload grahmos-edge || true";
      };
    };
  };
  
  # Automatic updates for security
  system.autoUpgrade = {
    enable = true;
    dates = "daily";
    flags = [
      "--max-jobs" "4"
      "--cores" "0"
    ];
  };
  
  # SSH configuration
  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = false;
      PermitRootLogin = "no";
      Protocol = 2;
    };
  };
  
  # Time synchronization
  services.chrony.enable = true;
  
  # Hardware optimization
  hardware.enableRedistributableFirmware = true;
  
  # Bootloader configuration (for physical deployment)
  boot = {
    loader = {
      systemd-boot.enable = true;
      efi.canTouchEfiVariables = true;
    };
    
    # Kernel parameters for network performance
    kernelParams = [
      "net.core.rmem_max=134217728"
      "net.core.wmem_max=134217728"
      "net.ipv4.tcp_rmem=4096 65536 134217728"
      "net.ipv4.tcp_wmem=4096 65536 134217728"
      "net.ipv4.tcp_congestion_control=bbr"
    ];
  };
  
  # Periodic maintenance tasks
  systemd.services.grahmos-maintenance = {
    description = "Grahmos Edge Gateway Maintenance";
    serviceConfig = {
      Type = "oneshot";
      User = "grahmos";
      Group = "grahmos";
    };
    
    script = ''
      # Clean up old logs (beyond logrotate)
      find /var/log/grahmos -name "*.log.*" -mtime +60 -delete
      
      # Clean up temporary files
      find /var/lib/grahmos/data/temp -type f -mtime +7 -delete
      
      # Prune Docker images and containers
      ${pkgs.docker}/bin/docker system prune -f --volumes
      
      # Log maintenance completion
      echo "$(date): Maintenance completed" >> /var/log/grahmos/maintenance.log
    '';
  };
  
  # Run maintenance weekly
  systemd.timers.grahmos-maintenance = {
    description = "Grahmos Edge Gateway Maintenance Timer";
    wantedBy = [ "timers.target" ];
    timerConfig = {
      OnCalendar = "weekly";
      Persistent = true;
    };
  };
}
