# Multi-stage Dockerfile for Grahmos Edge API
# Features: Security hardening, minimal attack surface, rootless execution

# Build stage
FROM node:20-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm@8.15.4

# Add build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev

# Set up workspace
WORKDIR /workspace

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./

# Copy packages that edge-api depends on
COPY packages/ ./packages/

# Copy the edge-api app
COPY apps/edge-api/ ./apps/edge-api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build the edge-api
WORKDIR /workspace/apps/edge-api
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production

# Security: Create non-root user
RUN addgroup -g 1000 -S nodegroup && \
    adduser -u 1000 -S nodeuser -G nodegroup

# Security: Install minimal runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    sqlite \
    && rm -rf /var/cache/apk/*

# Security: Remove package managers to reduce attack surface
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm \
    /usr/local/lib/node_modules/yarn /usr/local/bin/yarn \
    /usr/local/lib/node_modules/pnpm /usr/local/bin/pnpm || true

WORKDIR /app

# Security: Set proper ownership and permissions
RUN chown -R nodeuser:nodegroup /app && \
    chmod 750 /app

# Copy built application from builder stage
COPY --from=builder --chown=nodeuser:nodegroup /workspace/apps/edge-api/dist ./dist
COPY --from=builder --chown=nodeuser:nodegroup /workspace/apps/edge-api/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodegroup /workspace/apps/edge-api/package.json ./

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