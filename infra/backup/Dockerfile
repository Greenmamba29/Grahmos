# Grahmos V1+V2 Unified - Backup Service
# Phase 3: Improve/Deploy - Automated Backup & Disaster Recovery

FROM alpine:3.19

# Install required tools
RUN apk add --no-cache \
    bash \
    curl \
    aws-cli \
    postgresql-client \
    sqlite \
    tar \
    gzip \
    cron \
    jq \
    rsync \
    rclone \
    && rm -rf /var/cache/apk/*

# Create backup user
RUN addgroup -g 1002 backup && \
    adduser -D -u 1002 -G backup backup

# Create directories
RUN mkdir -p /backup/scripts /backup/data /backup/logs /var/log/backup && \
    chown -R backup:backup /backup /var/log/backup

# Copy backup scripts
COPY scripts/ /backup/scripts/
COPY config/ /backup/config/

# Make scripts executable
RUN chmod +x /backup/scripts/*.sh && \
    chown -R backup:backup /backup/scripts /backup/config

# Install crontab for automated backups
COPY crontab /etc/crontab

# Switch to backup user
USER backup
WORKDIR /backup

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /backup/scripts/health-check.sh

# Default command
CMD ["/backup/scripts/start.sh"]
