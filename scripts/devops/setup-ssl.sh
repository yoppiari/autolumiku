#!/bin/bash

# AutoLumiku SSL Setup Script
# Sets up SSL certificates using Let's Encrypt (Certbot)

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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Get domain name
read -p "Enter your domain name (e.g., autolumiku.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    print_error "Domain name is required!"
    exit 1
fi

print_info "Domain: $DOMAIN"

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    print_warning "Certbot is not installed. Installing..."

    # Detect OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        print_error "Cannot detect OS"
        exit 1
    fi

    # Install certbot
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get update
        apt-get install -y certbot
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        yum install -y certbot
    else
        print_error "Unsupported OS: $OS"
        exit 1
    fi

    print_success "Certbot installed"
else
    print_success "Certbot is already installed"
fi

# Create SSL directory
mkdir -p ./nginx/ssl

# Get certificate
print_info "Obtaining SSL certificate..."
print_warning "Make sure your domain points to this server's IP!"
print_warning "Port 80 must be accessible from the internet!"

read -p "Continue? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    print_info "SSL setup cancelled"
    exit 0
fi

# Determine docker-compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Stop nginx temporarily
print_info "Stopping nginx..."
$DOCKER_COMPOSE stop nginx

# Run certbot
certbot certonly --standalone \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --agree-tos \
    --register-unsafely-without-email \
    --non-interactive

if [ $? -eq 0 ]; then
    print_success "SSL certificate obtained!"

    # Copy certificates to nginx/ssl
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./nginx/ssl/
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ./nginx/ssl/

    print_success "Certificates copied to nginx/ssl/"

    # Update nginx config
    print_info "Please update nginx/conf.d/autolumiku.conf:"
    print_info "1. Uncomment the HTTPS server block"
    print_info "2. Comment out or remove the HTTP server block"
    print_info "3. Update server_name with your domain: $DOMAIN"

    # Restart nginx
    print_info "Restarting nginx..."
    $DOCKER_COMPOSE start nginx

    print_success "SSL setup completed!"

    # Setup auto-renewal
    print_info "Setting up auto-renewal..."

    # Create renewal script
    cat > /etc/cron.monthly/renew-ssl.sh <<EOF
#!/bin/bash
docker-compose -f $(pwd)/docker-compose.yml stop nginx
certbot renew --quiet
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $(pwd)/nginx/ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $(pwd)/nginx/ssl/
docker-compose -f $(pwd)/docker-compose.yml start nginx
EOF

    chmod +x /etc/cron.monthly/renew-ssl.sh

    print_success "Auto-renewal configured (runs monthly)"

else
    print_error "Failed to obtain SSL certificate"
    $DOCKER_COMPOSE start nginx
    exit 1
fi
