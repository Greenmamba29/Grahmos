# System Architecture - Grahmos V1+V2 Unified

## 🏗️ Architecture Overview

The Grahmos V1+V2 Unified system is a production-ready, containerized application architecture designed for enterprise deployment with comprehensive security, monitoring, and operational capabilities.

> **📄 For Enhanced NTN/RAN + Edge Architecture**: See [Enhanced Architecture Document](./enhanced-architecture.md) for details on the evolved system supporting Non-Terrestrial Networks (NTN), Radio Access Networks (RAN), and distributed edge computing capabilities.

### Architecture Evolution

This document describes the current Grahmos V1+V2 unified system architecture. The system is designed to evolve towards:

- **NTN/RAN Integration**: Support for private 4G/5G networks and satellite backhaul
- **Edge Computing**: Distributed processing nodes for low-latency operations
- **Mobile-First Design**: PWA, iOS, and Android applications
- **Advanced Security**: DPoP tokens, TPM/HSM integration, document-level ACLs
- **Enhanced Monitoring**: Distributed observability with Thanos and OpenTelemetry

### Reference Architecture Documents

- **Current System**: This document (system-architecture.md)
- **Enhanced System**: [Enhanced Architecture](./enhanced-architecture.md)
- **Deployment Diagrams**: Referenced in [Enhanced Architecture Mermaid Diagrams](./enhanced-architecture.md#system-architecture-diagram)
- **Network Integration**: [Enhanced Architecture - Network Layer](./enhanced-architecture.md#network-layer-integration)
- **Mobile Architecture**: [Enhanced Architecture - Client Layer](./enhanced-architecture.md#client-layer-architecture)

## 📐 High-Level Architecture

```mermaid
graph TB
    subgraph "Load Balancer / CDN"
        LB[Load Balancer]
    end
    
    subgraph "Application Tier"
        subgraph "NGINX Proxy"
            NGX[NGINX Proxy<br/>SSL Termination<br/>Rate Limiting]
        end
        
        subgraph "Edge API Services"
            API1[Edge API V1]
            API2[Edge API V2]
            API_UNIFIED[Unified Edge API]
        end
    end
    
    subgraph "Data Tier"
        subgraph "Search & Cache"
            MEILI[Meilisearch<br/>Search Engine]
            REDIS[Redis<br/>Cache & Sessions]
        end
        
        subgraph "Storage"
            DATA[Data Volumes<br/>Persistent Storage]
        end
    end
    
    subgraph "Monitoring & Observability"
        PROM[Prometheus<br/>Metrics Collection]
        GRAF[Grafana<br/>Visualization]
        FLUENT[Fluent Bit<br/>Log Aggregation]
    end
    
    subgraph "Security & Backup"
        BACKUP[Backup Service<br/>Automated Backups]
        SECRETS[Secrets Management<br/>Encrypted Storage]
    end
    
    LB --> NGX
    NGX --> API1
    NGX --> API2
    NGX --> API_UNIFIED
    
    API1 --> MEILI
    API2 --> MEILI
    API_UNIFIED --> MEILI
    
    API1 --> REDIS
    API2 --> REDIS
    API_UNIFIED --> REDIS
    
    MEILI --> DATA
    REDIS --> DATA
    
    API1 --> PROM
    API2 --> PROM
    API_UNIFIED --> PROM
    NGX --> PROM
    
    PROM --> GRAF
    
    API1 --> FLUENT
    API2 --> FLUENT
    API_UNIFIED --> FLUENT
    NGX --> FLUENT
    
    BACKUP --> DATA
    SECRETS --> API_UNIFIED
```

## 🏛️ System Components

### Application Layer

#### NGINX Proxy
- **Purpose**: SSL termination, load balancing, reverse proxy
- **Key Features**:
  - TLS 1.2/1.3 support with strong cipher suites
  - Rate limiting and DDoS protection
  - Security headers injection
  - Request/response compression
  - Health check endpoints

#### Edge API Services
- **Edge API V1**: Legacy API compatibility layer
- **Edge API V2**: Enhanced API with new features
- **Unified Edge API**: Single endpoint supporting both V1 and V2 protocols
- **Key Features**:
  - RESTful API design
  - JWT authentication with PoP tokens
  - mTLS support for service-to-service communication
  - Comprehensive input validation
  - Rate limiting and throttling

### Data Layer

#### Meilisearch
- **Purpose**: High-performance search engine
- **Features**:
  - Full-text search capabilities
  - Real-time indexing
  - Typo tolerance and fuzzy matching
  - Faceted search and filtering
  - Multi-language support

#### Redis
- **Purpose**: Caching and session management
- **Features**:
  - In-memory data structure store
  - Session persistence
  - Cache with TTL support
  - Pub/Sub messaging
  - Data replication

### Monitoring Stack

#### Prometheus
- **Purpose**: Metrics collection and alerting
- **Metrics Collected**:
  - Application performance metrics
  - System resource utilization
  - Custom business metrics
  - Security event metrics
  - Service health indicators

#### Grafana
- **Purpose**: Visualization and dashboards
- **Dashboards**:
  - System overview dashboard
  - Application performance monitoring
  - Infrastructure monitoring
  - Security monitoring
  - Business metrics

#### Fluent Bit
- **Purpose**: Log collection and forwarding
- **Features**:
  - Lightweight log processor
  - Multiple input sources
  - Log parsing and enrichment
  - Multiple output destinations
  - Buffer management

### Security Layer

#### Secrets Management
- **Features**:
  - Encrypted secret storage
  - Automatic secret rotation
  - Access control and auditing
  - Integration with external vaults

#### Backup Service
- **Features**:
  - Automated backup scheduling
  - Incremental and full backups
  - Encryption at rest
  - Cloud storage integration
  - Backup verification

## 🔄 Data Flow

### Request Processing Flow

```mermaid
sequenceDiagram
    participant Client
    participant LB as Load Balancer
    participant NGX as NGINX Proxy
    participant API as Edge API
    participant REDIS as Redis Cache
    participant MEILI as Meilisearch
    
    Client->>LB: HTTPS Request
    LB->>NGX: Forward Request
    NGX->>NGX: SSL Termination
    NGX->>NGX: Rate Limiting Check
    NGX->>API: Proxy to Backend
    
    API->>API: Authentication
    API->>REDIS: Check Cache
    alt Cache Hit
        REDIS-->>API: Cached Response
    else Cache Miss
        API->>MEILI: Query Search Engine
        MEILI-->>API: Search Results
        API->>REDIS: Update Cache
    end
    
    API-->>NGX: Response
    NGX-->>LB: Response with Headers
    LB-->>Client: HTTPS Response
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant API as Edge API
    participant REDIS as Redis
    participant AUTH as Auth Service
    
    Client->>API: Login Request
    API->>AUTH: Validate Credentials
    AUTH-->>API: Validation Result
    
    alt Valid Credentials
        API->>API: Generate JWT + PoP
        API->>REDIS: Store Session
        API-->>Client: Auth Tokens
    else Invalid Credentials
        API-->>Client: 401 Unauthorized
    end
    
    Note over Client,REDIS: Subsequent Requests
    Client->>API: API Request + JWT
    API->>API: Validate JWT + PoP
    API->>REDIS: Check Session
    REDIS-->>API: Session Data
    API-->>Client: API Response
```

## 🌐 Network Architecture

### Container Network Topology

```mermaid
graph TB
    subgraph "External Network"
        INTERNET[Internet]
    end
    
    subgraph "Host Network"
        HOST[Host OS<br/>Ubuntu/RHEL]
    end
    
    subgraph "Docker Networks"
        subgraph "Frontend Network"
            NGX_NET[nginx-proxy:443]
        end
        
        subgraph "Application Network"
            API_NET[edge-api:8080]
        end
        
        subgraph "Backend Network"
            REDIS_NET[redis:6379]
            MEILI_NET[meilisearch:7700]
        end
        
        subgraph "Monitoring Network"
            PROM_NET[prometheus:9090]
            GRAF_NET[grafana:3000]
            FLUENT_NET[fluent-bit:24224]
        end
    end
    
    INTERNET --> HOST
    HOST --> NGX_NET
    NGX_NET --> API_NET
    API_NET --> REDIS_NET
    API_NET --> MEILI_NET
    API_NET --> PROM_NET
    PROM_NET --> GRAF_NET
    API_NET --> FLUENT_NET
```

### Port Mapping

| Service | Internal Port | External Port | Protocol |
|---------|---------------|---------------|----------|
| NGINX Proxy | 80, 443 | 80, 443 | HTTP/HTTPS |
| Edge API | 8080 | - | HTTP |
| Redis | 6379 | - | TCP |
| Meilisearch | 7700 | - | HTTP |
| Prometheus | 9090 | 9090* | HTTP |
| Grafana | 3000 | 3000* | HTTP |
| Fluent Bit | 24224 | - | TCP |

*Monitoring ports accessible only from localhost in production

## 🔒 Security Architecture

### Security Layers

1. **Network Security**
   - TLS encryption for all external communications
   - Network segmentation with Docker networks
   - Firewall rules limiting access
   - VPN access for administrative functions

2. **Application Security**
   - JWT authentication with Proof-of-Possession
   - mTLS for service-to-service communication
   - Input validation and sanitization
   - Rate limiting and throttling
   - Security headers (HSTS, CSP, etc.)

3. **Container Security**
   - Non-root user execution
   - Read-only file systems
   - Capability dropping
   - Resource limits and constraints
   - Security scanning and vulnerability management

4. **Data Security**
   - Encryption at rest for sensitive data
   - Encrypted backups
   - Secrets management with rotation
   - Data anonymization and pseudonymization

### Authentication & Authorization

```mermaid
graph LR
    subgraph "Authentication Flow"
        USER[User] --> AUTH[Authentication]
        AUTH --> JWT[JWT Token]
        AUTH --> POP[PoP Token]
        AUTH --> SESSION[Session Storage]
    end
    
    subgraph "Authorization Flow"
        REQUEST[API Request] --> VALIDATE[Validate JWT + PoP]
        VALIDATE --> AUTHZ[Authorization Check]
        AUTHZ --> RESOURCE[Resource Access]
    end
    
    JWT --> VALIDATE
    POP --> VALIDATE
    SESSION --> AUTHZ
```

## 📊 Scalability Design

### Horizontal Scaling

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Load Balancer<br/>HAProxy/NGINX]
    end
    
    subgraph "Application Tier (Scalable)"
        API1[Edge API Instance 1]
        API2[Edge API Instance 2]
        API3[Edge API Instance N...]
    end
    
    subgraph "Data Tier (Scalable)"
        REDIS_M[Redis Master]
        REDIS_S1[Redis Slave 1]
        REDIS_S2[Redis Slave 2]
        
        MEILI_M[Meilisearch Master]
        MEILI_R1[Meilisearch Replica 1]
        MEILI_R2[Meilisearch Replica 2]
    end
    
    LB --> API1
    LB --> API2
    LB --> API3
    
    API1 --> REDIS_M
    API2 --> REDIS_M
    API3 --> REDIS_M
    
    REDIS_M --> REDIS_S1
    REDIS_M --> REDIS_S2
    
    API1 --> MEILI_M
    API2 --> MEILI_M
    API3 --> MEILI_M
    
    MEILI_M --> MEILI_R1
    MEILI_M --> MEILI_R2
```

### Performance Characteristics

| Component | Target Latency | Throughput | Scalability |
|-----------|----------------|------------|-------------|
| NGINX Proxy | < 10ms | 10k+ req/sec | Horizontal |
| Edge API | < 100ms | 1k+ req/sec | Horizontal |
| Redis Cache | < 1ms | 100k+ ops/sec | Master-Slave |
| Meilisearch | < 50ms | 1k+ searches/sec | Master-Replica |

## 🔄 Deployment Architecture

### Environments

```mermaid
graph LR
    subgraph "Development"
        DEV[Local Development<br/>Docker Compose]
    end
    
    subgraph "Staging"
        STAGING[Staging Environment<br/>Production-like Setup]
    end
    
    subgraph "Production"
        PROD[Production Environment<br/>High Availability Setup]
    end
    
    DEV -->|CI/CD Pipeline| STAGING
    STAGING -->|Automated Deployment| PROD
```

### Deployment Strategy

1. **Blue-Green Deployment**
   - Zero-downtime deployments
   - Instant rollback capability
   - Traffic switching at load balancer

2. **Rolling Updates**
   - Gradual service updates
   - Health check validation
   - Automatic rollback on failure

3. **Canary Releases**
   - Limited exposure testing
   - Gradual traffic shifting
   - Performance monitoring

## 📈 Monitoring Architecture

### Metrics Collection

```mermaid
graph TB
    subgraph "Application Services"
        API[Edge API<br/>Custom Metrics]
        NGX[NGINX<br/>Access Metrics]
    end
    
    subgraph "System Metrics"
        SYS[System Resources<br/>CPU, Memory, Disk]
    end
    
    subgraph "Data Services"
        REDIS_M[Redis Metrics]
        MEILI_M[Meilisearch Metrics]
    end
    
    subgraph "Collection & Storage"
        PROM[Prometheus<br/>Time Series DB]
    end
    
    subgraph "Visualization & Alerting"
        GRAF[Grafana Dashboards]
        ALERT[Alertmanager]
    end
    
    API --> PROM
    NGX --> PROM
    SYS --> PROM
    REDIS_M --> PROM
    MEILI_M --> PROM
    
    PROM --> GRAF
    PROM --> ALERT
```

### Log Architecture

```mermaid
graph TB
    subgraph "Log Sources"
        APP_LOGS[Application Logs]
        SYS_LOGS[System Logs]
        NGINX_LOGS[NGINX Access Logs]
        SECURITY_LOGS[Security Logs]
    end
    
    subgraph "Log Processing"
        FLUENT[Fluent Bit<br/>Collection & Processing]
    end
    
    subgraph "Log Storage & Analysis"
        STORAGE[Log Storage<br/>Elasticsearch/Loki]
        ANALYSIS[Log Analysis<br/>Kibana/Grafana]
    end
    
    APP_LOGS --> FLUENT
    SYS_LOGS --> FLUENT
    NGINX_LOGS --> FLUENT
    SECURITY_LOGS --> FLUENT
    
    FLUENT --> STORAGE
    STORAGE --> ANALYSIS
```

## 🔄 Disaster Recovery

### Backup Strategy

```mermaid
graph TB
    subgraph "Data Sources"
        APP_DATA[Application Data]
        CONFIG[Configuration Files]
        SECRETS[Secrets & Keys]
        LOGS[Application Logs]
    end
    
    subgraph "Backup Processing"
        BACKUP_SVC[Backup Service<br/>Automated Backups]
        ENCRYPT[Encryption Service]
        COMPRESS[Compression]
    end
    
    subgraph "Storage Destinations"
        LOCAL[Local Storage]
        S3[S3 Compatible Storage]
        OFFSITE[Offsite Storage]
    end
    
    APP_DATA --> BACKUP_SVC
    CONFIG --> BACKUP_SVC
    SECRETS --> BACKUP_SVC
    LOGS --> BACKUP_SVC
    
    BACKUP_SVC --> ENCRYPT
    ENCRYPT --> COMPRESS
    
    COMPRESS --> LOCAL
    COMPRESS --> S3
    COMPRESS --> OFFSITE
```

### Recovery Objectives

| Component | RTO | RPO | Recovery Method |
|-----------|-----|-----|-----------------|
| Edge API | 15 minutes | 1 hour | Service restart |
| Redis Cache | 5 minutes | 15 minutes | Backup restore |
| Meilisearch | 30 minutes | 4 hours | Index rebuild |
| Configuration | 5 minutes | 24 hours | Config restore |

## 🔧 Operational Considerations

### Resource Requirements

| Environment | CPU | Memory | Storage | Network |
|-------------|-----|--------|---------|---------|
| Development | 4 cores | 8GB | 50GB | 1Gbps |
| Staging | 8 cores | 16GB | 200GB | 1Gbps |
| Production | 16+ cores | 32GB+ | 500GB+ | 10Gbps |

### Capacity Planning

1. **Application Tier**
   - Plan for 2x peak load capacity
   - Monitor response times and queue depths
   - Auto-scaling based on CPU and memory

2. **Data Tier**
   - Monitor cache hit ratios
   - Plan for 80% memory utilization
   - Monitor disk I/O and storage growth

3. **Network Tier**
   - Monitor bandwidth utilization
   - Plan for DDoS mitigation
   - CDN integration for static content

---

**Version**: 1.0.0  
**Last Updated**: $(date)  
**Maintainer**: Grahmos Architecture Team
