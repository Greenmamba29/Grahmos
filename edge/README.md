# Edge Security & Speed — Deployment Pack v1

This pack applies hardening + performance tweaks for production edge deployment:

* API is the **only** public surface (mTLS at NGINX, PoP/"cnf" JWT at API)
* Search engine runs **behind** the API over **Unix domain socket**
* Containers run **rootless**, **read‑only**, and with caps dropped
* **Delta updates** are signed, verified, and swapped atomically
* NVMe + memory‑mapped indices + warmup hooks for speed

## Quick Start

1. **Setup certificates**: Place TLS material in `/etc/edge/tls/`
2. **Start services**: `docker compose -f docker-compose.edge.yml up -d`
3. **Test mTLS auth**: `curl -k --cert client.crt --key client.key https://edge.grahmos.local/auth/mtls`
4. **Search with JWT**: Use returned token in Authorization header

## Security Features

- ✅ mTLS client authentication
- ✅ JWT with Proof-of-Possession (PoP) binding
- ✅ Rootless containers with read-only filesystems
- ✅ Unix domain sockets (no TCP exposure between services)
- ✅ Signed delta updates with atomic swaps
- ✅ nftables firewall (default-deny)
- ✅ Security headers and rate limiting

## Performance Features

- ⚡ Memory-mapped SQLite FTS indexes
- ⚡ Unix domain socket communication
- ⚡ NVMe optimizations
- ⚡ Query result caching
- ⚡ Warmup procedures

## Directory Structure

```
edge/
├─ docker-compose.edge.yml    # Main orchestration
├─ ops/                       # Operations config
│  ├─ nginx.conf             # Reverse proxy + mTLS
│  ├─ nftables.conf          # Firewall rules
│  └─ systemd/               # Service management
├─ edge-api/                 # API service
│  ├─ package.json
│  └─ src/
├─ data/                     # Data storage
│  ├─ content/               # Document content
│  ├─ manifests/             # Update manifests
│  └─ indexes/               # Search indexes
└─ updates/                  # Update scripts
```

Status: **In Development**
