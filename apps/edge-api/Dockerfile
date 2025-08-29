# Multi-stage Dockerfile for Grahmos Edge API
# Features: Security hardening, minimal attack surface, rootless execution

# Build stage
FROM node:20-alpine AS builder

# Security: Add build dependencies for native modules with security updates
RUN apk update && apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Security: Create non-root user
RUN getent group 1000 || addgroup -g 1000 -S nodegroup && \
    adduser -u 1000 -S nodeuser -G nodegroup

# Security: Install minimal runtime dependencies with security updates
RUN apk update && apk add --no-cache \
    dumb-init \
    sqlite \
    ca-certificates \
    && apk upgrade \
    && rm -rf /var/cache/apk/*

# Security: Remove npm and yarn to reduce attack surface
RUN npm uninstall -g npm yarn || true

# Security: Set file system to read-only except for required directories
RUN chmod -R 555 /usr/local/lib/node_modules || true

WORKDIR /app

# Security: Set proper ownership and permissions
RUN chown -R nodeuser:nodegroup /app && \
    chmod 750 /app

# Copy built application from builder stage
COPY --from=builder --chown=nodeuser:nodegroup /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodegroup /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodegroup /app/package.json ./

# Create required directories with proper permissions
RUN mkdir -p /app/logs /data/indexes && \
    chown nodeuser:nodegroup /app/logs /data/indexes && \
    chmod 755 /app/logs /data/indexes

# Security: Switch to non-root user
USER nodeuser

# Expose port for development (production uses Unix socket)
EXPOSE 3000

# Security: Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('fs').existsSync('/var/run/edge/edge.sock') ? process.exit(0) : require('http').get('http://localhost:3000/health', (res) => { res.statusCode === 200 ? process.exit(0) : process.exit(1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/server.js"]

# Metadata
LABEL \
    com.grahmos.component="edge-api" \
    com.grahmos.version="2.0.0" \
    com.grahmos.description="Grahmos Edge API with mTLS and DPoP authentication" \
    com.grahmos.security="hardened"
