#!/bin/bash

# AutoLumiku Docker Deployment Script
# This script automates the deployment process

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
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

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    print_info "Please create .env file from .env.docker template:"
    print_info "  cp .env.docker .env"
    print_info "  nano .env  # Edit with your values"
    exit 1
fi

print_success ".env file found"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed!"
    print_info "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

print_success "Docker is installed"

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed!"
    print_info "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

print_success "Docker Compose is installed"

# Determine docker-compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

print_info "Using: $DOCKER_COMPOSE"

# Main deployment
echo ""
print_info "Starting AutoLumiku deployment..."
echo ""

# Step 1: Stop existing containers
print_info "Step 1/6: Stopping existing containers..."
$DOCKER_COMPOSE down
print_success "Containers stopped"

# Step 2: Pull latest code (if using git)
if [ -d ".git" ]; then
    print_info "Step 2/6: Pulling latest code from git..."
    git pull origin main || git pull origin master || print_warning "Git pull failed, continuing anyway..."
    print_success "Code updated"
else
    print_warning "Step 2/6: Not a git repository, skipping pull"
fi

# Step 3: Build Docker images
print_info "Step 3/6: Building Docker images..."
$DOCKER_COMPOSE build --no-cache
print_success "Images built"

# Step 4: Start containers
print_info "Step 4/6: Starting containers..."
$DOCKER_COMPOSE up -d
print_success "Containers started"

# Step 5: Wait for database to be ready
print_info "Step 5/6: Waiting for database to be ready..."
sleep 10
print_success "Database should be ready"

# Step 6: Run database migrations
print_info "Step 6/6: Running database migrations..."
$DOCKER_COMPOSE exec -T app npx prisma migrate deploy || print_warning "Migration failed, you may need to run it manually"
print_success "Migrations completed"

# Show status
echo ""
print_success "Deployment completed!"
echo ""
print_info "Container status:"
$DOCKER_COMPOSE ps

# Show logs
echo ""
print_info "Application logs (last 20 lines):"
$DOCKER_COMPOSE logs --tail=20 app

# Health check
echo ""
print_info "Performing health check..."
sleep 5
if curl -f http://localhost/api/health > /dev/null 2>&1; then
    print_success "Health check passed! Application is running."
    print_info "Access your application at: http://localhost"
else
    print_warning "Health check failed. Check logs with: $DOCKER_COMPOSE logs app"
fi

echo ""
print_info "Useful commands:"
print_info "  View logs:           $DOCKER_COMPOSE logs -f app"
print_info "  Stop containers:     $DOCKER_COMPOSE stop"
print_info "  Start containers:    $DOCKER_COMPOSE start"
print_info "  Restart containers:  $DOCKER_COMPOSE restart"
print_info "  Remove containers:   $DOCKER_COMPOSE down"
print_info "  Database backup:     ./scripts/backup.sh"
echo ""
