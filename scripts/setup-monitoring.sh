#!/usr/bin/env bash

# Grahmos Monitoring Stack Setup Script
# Phase 10: Advanced Monitoring, Observability & Analytics

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
MONITORING_COMPOSE_FILE="$PROJECT_ROOT/infra/monitoring/enhanced-monitoring.yml"
PROMETHEUS_CONFIG="$PROJECT_ROOT/infra/prometheus/prometheus.yml"
GRAFANA_CONFIG_DIR="$PROJECT_ROOT/infra/grafana"
ALERTMANAGER_CONFIG="$PROJECT_ROOT/infra/alertmanager/alertmanager.yml"

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "INFO")
            echo -e "${CYAN}[${timestamp}] [INFO] ${message}${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[${timestamp}] [SUCCESS] ${message}${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}[${timestamp}] [WARNING] ${message}${NC}"
            ;;
        "ERROR")
            echo -e "${RED}[${timestamp}] [ERROR] ${message}${NC}"
            ;;
        "DEBUG")
            if [[ "${DEBUG:-}" == "true" ]]; then
                echo -e "${PURPLE}[${timestamp}] [DEBUG] ${message}${NC}"
            fi
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check for required tools
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
        missing_tools+=("docker-compose")
    fi
    
    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log "ERROR" "Missing required tools: ${missing_tools[*]}"
        log "ERROR" "Please install the missing tools and try again"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log "ERROR" "Docker daemon is not running"
        exit 1
    fi
    
    log "SUCCESS" "All prerequisites met"
}

# Create necessary directories
create_directories() {
    log "INFO" "Creating monitoring directories..."
    
    local dirs=(
        "$PROJECT_ROOT/infra/grafana/dashboards/grahmos"
        "$PROJECT_ROOT/infra/grafana/dashboards/infrastructure"
        "$PROJECT_ROOT/infra/grafana/dashboards/security"
        "$PROJECT_ROOT/infra/grafana/dashboards/business"
        "$PROJECT_ROOT/infra/prometheus/rules"
        "$PROJECT_ROOT/infra/alertmanager/templates"
        "$PROJECT_ROOT/infra/loki"
        "$PROJECT_ROOT/infra/jaeger"
        "$PROJECT_ROOT/infra/thanos"
        "$PROJECT_ROOT/infra/otel"
        "$PROJECT_ROOT/logs/monitoring"
        "$PROJECT_ROOT/data/prometheus"
        "$PROJECT_ROOT/data/grafana"
        "$PROJECT_ROOT/data/loki"
        "$PROJECT_ROOT/data/jaeger"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log "DEBUG" "Created directory: $dir"
        fi
    done
    
    log "SUCCESS" "Monitoring directories created"
}

# Setup environment variables
setup_environment() {
    log "INFO" "Setting up environment variables..."
    
    local env_file="$PROJECT_ROOT/.env.monitoring"
    
    # Create environment file if it doesn't exist
    if [[ ! -f "$env_file" ]]; then
        cat > "$env_file" << EOF
# Grahmos Monitoring Configuration
# Generated on $(date)

# Grafana Configuration
GRAFANA_PASSWORD=admin123
GRAFANA_SECRET_KEY=$(openssl rand -base64 32)

# AlertManager Configuration
SMTP_PASSWORD=your-smtp-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/your/webhook/url
WEBHOOK_TOKEN=$(openssl rand -hex 32)
PAGERDUTY_WEBHOOK_URL=https://your-pagerduty-webhook
PAGERDUTY_TOKEN=your-pagerduty-token

# OpenTelemetry Configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_RESOURCE_ATTRIBUTES=service.name=grahmos,service.version=2.0.0

# Prometheus Remote Write (optional)
# PROMETHEUS_REMOTE_WRITE_URL=https://your-remote-prometheus/api/v1/write
# PROMETHEUS_REMOTE_WRITE_USERNAME=prometheus
# PROMETHEUS_REMOTE_WRITE_PASSWORD=your-password

# Telemetry Configuration
TELEMETRY_ENABLED=true
TELEMETRY_SAMPLE_RATE=0.1
PROMETHEUS_METRICS_PORT=9464
EOF
        log "WARNING" "Created environment file at $env_file"
        log "WARNING" "Please review and update the configuration values"
    fi
    
    # Source environment file
    if [[ -f "$env_file" ]]; then
        # shellcheck source=/dev/null
        source "$env_file"
        export $(grep -v '^#' "$env_file" | xargs)
    fi
    
    log "SUCCESS" "Environment variables configured"
}

# Setup OpenTelemetry Collector configuration
setup_otel_collector() {
    log "INFO" "Setting up OpenTelemetry Collector configuration..."
    
    local otel_config="$PROJECT_ROOT/infra/otel/otel-collector-config.yaml"
    
    cat > "$otel_config" << 'EOF'
# OpenTelemetry Collector Configuration for Grahmos
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
        cors:
          allowed_origins:
            - "http://localhost:3000"
            - "https://*.grahmos.dev"
          allowed_headers:
            - "*"

  prometheus:
    config:
      scrape_configs:
        - job_name: 'otel-collector'
          scrape_interval: 30s
          static_configs:
            - targets: ['localhost:8888']

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024
    send_batch_max_size: 2048

  memory_limiter:
    limit_mib: 512

  resource:
    attributes:
      - key: service.namespace
        value: grahmos
        action: insert
      - key: deployment.environment
        value: ${ENVIRONMENT:-production}
        action: insert

  attributes:
    actions:
      - key: grahmos.version
        value: "2.0.0"
        action: insert

exporters:
  prometheus:
    endpoint: "0.0.0.0:8889"
    namespace: grahmos
    const_labels:
      cluster: grahmos-unified
    
  jaeger:
    endpoint: jaeger-all-in-one:14250
    tls:
      insecure: true

  loki:
    endpoint: http://loki:3100/loki/api/v1/push
    tenant_id: grahmos

extensions:
  health_check:
    endpoint: 0.0.0.0:13133
  pprof:
    endpoint: 0.0.0.0:1777
  zpages:
    endpoint: 0.0.0.0:55679

service:
  extensions: [health_check, pprof, zpages]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource, attributes]
      exporters: [jaeger]
    
    metrics:
      receivers: [otlp, prometheus]
      processors: [memory_limiter, batch, resource, attributes]
      exporters: [prometheus]
    
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource, attributes]
      exporters: [loki]
EOF

    log "SUCCESS" "OpenTelemetry Collector configuration created"
}

# Setup Loki configuration
setup_loki_config() {
    log "INFO" "Setting up Loki configuration..."
    
    local loki_config="$PROJECT_ROOT/infra/loki/loki-config.yaml"
    
    cat > "$loki_config" << 'EOF'
# Loki Configuration for Grahmos
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://alertmanager:9093

analytics:
  reporting_enabled: false

limits_config:
  retention_period: 30d
  ingestion_rate_mb: 16
  ingestion_burst_size_mb: 32
  max_cache_freshness_per_query: 10m
  max_global_streams_per_user: 10000
  max_query_parallelism: 32
  max_streams_per_user: 0
  max_line_size: 0
EOF

    log "SUCCESS" "Loki configuration created"
}

# Setup Promtail configuration
setup_promtail_config() {
    log "INFO" "Setting up Promtail configuration..."
    
    local promtail_config="$PROJECT_ROOT/infra/promtail/promtail-config.yaml"
    mkdir -p "$(dirname "$promtail_config")"
    
    cat > "$promtail_config" << 'EOF'
# Promtail Configuration for Grahmos
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Docker container logs
  - job_name: containers
    static_configs:
      - targets:
          - localhost
        labels:
          job: containerlogs
          __path__: /var/lib/docker/containers/*/*.log

    pipeline_stages:
      - json:
          expressions:
            output: log
            stream: stream
            attrs:
      - json:
          expressions:
            tag:
          source: attrs
      - regex:
          expression: (?P<container_name>(?:[^|]*))\|
          source: tag
      - timestamp:
          format: RFC3339Nano
          source: time
      - labels:
          stream:
          container_name:
      - output:
          source: output

  # System logs
  - job_name: syslog
    static_configs:
      - targets:
          - localhost
        labels:
          job: syslog
          __path__: /var/log/syslog

  # Grahmos application logs
  - job_name: grahmos
    static_configs:
      - targets:
          - localhost
        labels:
          job: grahmos-app
          __path__: /var/log/grahmos/*.log

    pipeline_stages:
      - multiline:
          firstline: '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}'
          max_wait_time: 3s
      - regex:
          expression: '^(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(?P<level>\w+)\] \[(?P<component>\w+)\] (?P<message>.*)'
      - timestamp:
          format: '2006-01-02 15:04:05'
          source: timestamp
      - labels:
          level:
          component:
EOF

    log "SUCCESS" "Promtail configuration created"
}

# Validate configurations
validate_configurations() {
    log "INFO" "Validating monitoring configurations..."
    
    local issues=()
    
    # Check if configuration files exist
    local required_files=(
        "$PROMETHEUS_CONFIG"
        "$GRAFANA_CONFIG_DIR/datasources.yml"
        "$ALERTMANAGER_CONFIG"
        "$PROJECT_ROOT/infra/otel/otel-collector-config.yaml"
        "$PROJECT_ROOT/infra/loki/loki-config.yaml"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            issues+=("Missing configuration file: $file")
        fi
    done
    
    # Validate Prometheus configuration
    if command -v promtool &> /dev/null && [[ -f "$PROMETHEUS_CONFIG" ]]; then
        if ! promtool check config "$PROMETHEUS_CONFIG" &> /dev/null; then
            issues+=("Invalid Prometheus configuration")
        fi
    fi
    
    # Check dashboard files
    if [[ ! -f "$PROJECT_ROOT/infra/grafana/dashboards/grahmos/grahmos-overview.json" ]]; then
        issues+=("Missing main Grafana dashboard")
    fi
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        log "WARNING" "Configuration validation issues found:"
        for issue in "${issues[@]}"; do
            log "WARNING" "  - $issue"
        done
    else
        log "SUCCESS" "All configurations validated successfully"
    fi
}

# Start monitoring stack
start_monitoring_stack() {
    log "INFO" "Starting monitoring stack..."
    
    cd "$PROJECT_ROOT"
    
    # Stop any existing monitoring services
    if docker-compose -f "$MONITORING_COMPOSE_FILE" ps -q 2>/dev/null | grep -q .; then
        log "INFO" "Stopping existing monitoring services..."
        docker-compose -f "$MONITORING_COMPOSE_FILE" down --remove-orphans
    fi
    
    # Start monitoring stack
    log "INFO" "Starting enhanced monitoring stack..."
    docker-compose -f "$MONITORING_COMPOSE_FILE" up -d
    
    # Wait for services to be healthy
    log "INFO" "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    local services=(
        "prometheus:9090"
        "grafana:3000"
        "alertmanager:9093"
        "loki:3100"
        "jaeger-all-in-one:16686"
        "otel-collector:8888"
    )
    
    local unhealthy_services=()
    
    for service in "${services[@]}"; do
        local host_port="${service}"
        if ! curl -f -s "http://localhost:${host_port##*:}/health" &> /dev/null && \
           ! curl -f -s "http://localhost:${host_port##*:}/" &> /dev/null && \
           ! curl -f -s "http://localhost:${host_port##*:}/ready" &> /dev/null; then
            unhealthy_services+=("$service")
        fi
    done
    
    if [[ ${#unhealthy_services[@]} -gt 0 ]]; then
        log "WARNING" "Some services may not be fully ready: ${unhealthy_services[*]}"
        log "WARNING" "This is normal for initial startup. Services should be ready within a few minutes."
    else
        log "SUCCESS" "All monitoring services are healthy"
    fi
}

# Setup monitoring dashboard links
setup_dashboard_links() {
    log "INFO" "Setting up monitoring dashboard access..."
    
    cat << 'EOF'

🚀 Grahmos Monitoring Stack is now running!

Access your monitoring dashboards:

📊 Grafana (Main Dashboard)
   URL: http://localhost:3000
   User: admin
   Password: admin123 (or check .env.monitoring)

🔍 Prometheus (Metrics & Alerts)
   URL: http://localhost:9090
   Targets: http://localhost:9090/targets
   Alerts: http://localhost:9090/alerts

🚨 AlertManager (Alert Management)
   URL: http://localhost:9093
   Status: http://localhost:9093/#/status

📝 Loki (Log Aggregation)
   URL: http://localhost:3100
   Ready: http://localhost:3100/ready

🔗 Jaeger (Distributed Tracing)
   URL: http://localhost:16686
   Search: http://localhost:16686/search

🛠️ OpenTelemetry Collector
   Health: http://localhost:13133
   Metrics: http://localhost:8889/metrics
   ZPages: http://localhost:55679/debug/tracez

📈 Key Grafana Dashboards:
   - Grahmos Application Overview
   - Infrastructure Monitoring
   - Security Metrics
   - Business Analytics

🔔 Alerting Channels:
   - Email notifications configured
   - Slack integration ready
   - PagerDuty integration available

📚 Documentation:
   - Monitoring Guide: docs/AUTO_UPDATE.md
   - Runbooks: https://runbooks.grahmos.dev
   - API Reference: docs/reference/api-reference.md

EOF
}

# Health check
health_check() {
    log "INFO" "Running monitoring stack health check..."
    
    local checks=(
        "http://localhost:9090/-/healthy|Prometheus"
        "http://localhost:3000/api/health|Grafana"
        "http://localhost:9093/-/healthy|AlertManager"
        "http://localhost:3100/ready|Loki"
        "http://localhost:16686/|Jaeger"
        "http://localhost:13133|OTEL Collector"
    )
    
    local failed_checks=()
    
    for check in "${checks[@]}"; do
        local url="${check%|*}"
        local service="${check#*|}"
        
        if curl -f -s "$url" &> /dev/null; then
            log "SUCCESS" "$service is healthy"
        else
            log "ERROR" "$service is not responding"
            failed_checks+=("$service")
        fi
    done
    
    if [[ ${#failed_checks[@]} -eq 0 ]]; then
        log "SUCCESS" "All monitoring services are healthy!"
        return 0
    else
        log "ERROR" "Health check failed for: ${failed_checks[*]}"
        return 1
    fi
}

# Main function
main() {
    log "INFO" "Starting Grahmos Monitoring Stack Setup..."
    log "INFO" "Phase 10: Advanced Monitoring, Observability & Analytics"
    echo
    
    check_prerequisites
    create_directories
    setup_environment
    setup_otel_collector
    setup_loki_config
    setup_promtail_config
    validate_configurations
    start_monitoring_stack
    
    # Wait a bit for services to fully start
    log "INFO" "Waiting for services to fully initialize..."
    sleep 60
    
    if health_check; then
        setup_dashboard_links
        log "SUCCESS" "Monitoring stack setup completed successfully!"
    else
        log "WARNING" "Monitoring stack started but some services need more time to initialize."
        log "INFO" "Run './scripts/setup-monitoring.sh health' to check status later."
    fi
}

# Handle script arguments
case "${1:-}" in
    "health"|"check")
        health_check
        ;;
    "stop")
        log "INFO" "Stopping monitoring stack..."
        docker-compose -f "$MONITORING_COMPOSE_FILE" down
        log "SUCCESS" "Monitoring stack stopped"
        ;;
    "restart")
        log "INFO" "Restarting monitoring stack..."
        docker-compose -f "$MONITORING_COMPOSE_FILE" restart
        log "SUCCESS" "Monitoring stack restarted"
        ;;
    "logs")
        docker-compose -f "$MONITORING_COMPOSE_FILE" logs -f "${2:-}"
        ;;
    *)
        main
        ;;
esac
