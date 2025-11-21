#!/bin/bash

# AutoLumiku Database Backup Script
# Creates a backup of the PostgreSQL database

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${NC}ℹ $1${NC}"
}

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="autolumiku_backup_${TIMESTAMP}.sql"
RETENTION_DAYS=30

# Determine docker-compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

print_info "Starting database backup..."

# Run backup
if $DOCKER_COMPOSE exec -T postgres pg_dump -U autolumiku autolumiku_prod > "$BACKUP_DIR/$BACKUP_FILE"; then
    print_success "Backup created: $BACKUP_DIR/$BACKUP_FILE"

    # Compress backup
    gzip "$BACKUP_DIR/$BACKUP_FILE"
    print_success "Backup compressed: $BACKUP_DIR/${BACKUP_FILE}.gz"

    # Get file size
    SIZE=$(du -h "$BACKUP_DIR/${BACKUP_FILE}.gz" | cut -f1)
    print_info "Backup size: $SIZE"

    # Delete old backups
    print_info "Cleaning up old backups (older than $RETENTION_DAYS days)..."
    find "$BACKUP_DIR" -name "autolumiku_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    print_success "Cleanup completed"

    # List recent backups
    echo ""
    print_info "Recent backups:"
    ls -lh "$BACKUP_DIR" | tail -5

else
    print_error "Backup failed!"
    exit 1
fi

print_success "Backup completed successfully!"
