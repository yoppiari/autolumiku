#!/bin/bash

# AutoLumiku Database Restore Script
# Restores database from backup

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

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${NC}ℹ $1${NC}"
}

# Check if backup file is provided
if [ -z "$1" ]; then
    print_error "No backup file specified!"
    print_info "Usage: ./scripts/restore.sh <backup_file>"
    print_info "Example: ./scripts/restore.sh backups/autolumiku_backup_20251121_120000.sql.gz"
    echo ""
    print_info "Available backups:"
    ls -lh backups/ 2>/dev/null || print_error "No backups found!"
    exit 1
fi

BACKUP_FILE=$1

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    print_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Determine docker-compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Warning
print_warning "⚠️  WARNING: This will REPLACE the current database!"
print_warning "All current data will be lost!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    print_info "Restore cancelled"
    exit 0
fi

print_info "Starting database restore from: $BACKUP_FILE"

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
    print_info "Decompressing backup..."
    TEMP_FILE="${BACKUP_FILE%.gz}"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    RESTORE_FILE="$TEMP_FILE"
else
    RESTORE_FILE="$BACKUP_FILE"
fi

# Stop application
print_info "Stopping application..."
$DOCKER_COMPOSE stop app

# Drop and recreate database
print_info "Dropping existing database..."
$DOCKER_COMPOSE exec -T postgres psql -U autolumiku -d postgres -c "DROP DATABASE IF EXISTS autolumiku_prod;"
print_info "Creating new database..."
$DOCKER_COMPOSE exec -T postgres psql -U autolumiku -d postgres -c "CREATE DATABASE autolumiku_prod;"

# Restore database
print_info "Restoring database..."
if cat "$RESTORE_FILE" | $DOCKER_COMPOSE exec -T postgres psql -U autolumiku -d autolumiku_prod; then
    print_success "Database restored successfully!"

    # Clean up temp file if created
    if [[ $BACKUP_FILE == *.gz ]]; then
        rm -f "$TEMP_FILE"
    fi

    # Restart application
    print_info "Restarting application..."
    $DOCKER_COMPOSE start app

    print_success "Restore completed successfully!"
else
    print_error "Restore failed!"

    # Clean up temp file if created
    if [[ $BACKUP_FILE == *.gz ]]; then
        rm -f "$TEMP_FILE"
    fi

    exit 1
fi
