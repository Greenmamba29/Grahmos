# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile for Grahmos Edge API (CI/CD Optimized)
# Features: PNPM support, caching optimization, security hardening

FROM node:20-alpine AS base

# Add build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev

WORKDIR /app

# Copy package files and enable PNPM
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate && pnpm fetch

# Copy source and install dependencies
COPY . .
RUN pnpm install --offline && pnpm build

# Production stage
FROM node:20-alpine

# Security: Create non-root user
RUN addgroup -g 1000 -S nodegroup && \
    adduser -u 1000 -S nodeuser -G nodegroup

# Security: Install minimal runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    sqlite \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy built application from base stage
COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./package.json

# Install production dependencies with PNPM
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate && pnpm install --prod --ignore-scripts --no-optional

# Create required directories with proper permissions
RUN mkdir -p /app/logs /data/indexes /var/run/edge && \
    chown -R nodeuser:nodegroup /app /var/run/edge && \
    chmod 755 /app/logs /data/indexes /var/run/edge

# Security: Switch to non-root user
USER nodeuser

# Expose port for development (production uses Unix socket)
EXPOSE 3000

# Security: Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('fs').existsSync('/var/run/edge/edge.sock') ? process.exit(0) : require('http').get('http://localhost:3000/health', (res) => { res.statusCode === 200 ? process.exit(0) : process.exit(1) }).on('error', () => process.exit(1))"

# Runtime expects to bind to UDS at /var/run/edge/edge.sock
CMD ["node","dist/server.js"]

# Metadata
LABEL \
    com.grahmos.component="edge-api" \
    com.grahmos.version="2.0.0" \
    com.grahmos.description="Grahmos Edge API with mTLS and DPoP authentication" \
    com.grahmos.security="hardened"
