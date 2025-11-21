# AutoLumiKu Deployment Guide

## Overview

This guide covers deploying the AutoLumiKu Team Management System to production environments, with specific optimizations for Indonesian automotive dealerships.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Application Deployment](#application-deployment)
6. [CDN and Static Assets](#cdn-and-static-assets)
7. [Monitoring and Logging](#monitoring-and-logging)
8. [Security Hardening](#security-hardening)
9. [Indonesian Market Optimizations](#indonesian-market-optimizations)
10. [Backup and Disaster Recovery](#backup-and-disaster-recovery)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

#### Minimum Requirements
- **CPU**: 2 cores
- **Memory**: 4GB RAM
- **Storage**: 50GB SSD
- **Network**: 10 Mbps connection
- **OS**: Ubuntu 20.04 LTS or CentOS 8

#### Recommended Requirements
- **CPU**: 4+ cores
- **Memory**: 8GB+ RAM
- **Storage**: 100GB+ SSD
- **Network**: 100 Mbps connection
- **Load Balancer**: Nginx or AWS ALB

### Software Requirements

- **Node.js**: 18.x LTS
- **PostgreSQL**: 14.x
- **Redis**: 6.x
- **Nginx**: 1.20+
- **SSL Certificate**: Let's Encrypt or commercial certificate

### Domain and SSL

- **Domain**: Custom domain (e.g., `showroom.yourdealer.com`)
- **SSL**: Valid SSL certificate (required for production)
- **Subdomains**:
  - `api.yourdealer.com` (API endpoints)
  - `cdn.yourdealer.com` (static assets)

## Infrastructure Setup

### Option 1: Single Server Deployment

#### Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git nginx postgresql redis-server certbot python3-certbot-nginx

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Create application user
sudo adduser autolumiku
sudo usermod -aG sudo autolumiku
```

#### Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Option 2: Cloud Deployment (AWS)

#### EC2 Instance Setup

```bash
# Launch EC2 instance (Ubuntu 20.04 LTS)
# Instance type: t3.medium or larger
# Security Group: SSH (22), HTTP (80), HTTPS (443)
# Storage: 50GB gp3 SSD

# Connect via SSH
ssh -i your-key.pem ubuntu@your-ec2-ip

# Follow single server setup steps
```

#### RDS Database Setup

```bash
# Create RDS PostgreSQL instance
# Engine: PostgreSQL 14.x
# Instance class: db.t3.micro (development) or db.t3.small (production)
# Multi-AZ: Yes for production
# Backup retention: 7 days minimum
# Maintenance window: Indonesian off-peak hours (02:00-04:00 WIB)
```

#### ElastiCache Redis Setup

```bash
# Create ElastiCache Redis cluster
# Node type: cache.t3.micro (development) or cache.t3.small (production)
# Engine: Redis 6.x
# Cluster mode: Disabled (single node for simplicity)
# Automatic backup: Enabled
```

### Option 3: Docker Deployment

#### Docker Compose Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/autolumiku
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=autolumiku
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## Environment Configuration

### Production Environment Variables

Create `.env.production`:

```env
# Application
NODE_ENV=production
PORT=3000
APP_NAME=AutoLumiKu
APP_URL=https://showroom.yourdealer.com
API_URL=https://api.yourdealer.com

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/autolumiku_prod
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password
CACHE_TTL=300

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourdealer.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdealer.com
EMAIL_FROM_NAME=AutoLumiKu

# File Storage
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf,doc,docx

# Indonesian Market Config
DEFAULT_LANGUAGE=id
DEFAULT_TIMEZONE=Asia/Jakarta
CURRENCY=IDR
DATE_FORMAT=DD/MM/YYYY

# Security
CORS_ORIGIN=https://showroom.yourdealer.com
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
LOG_DIR=/app/logs
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_ENDPOINT=/health

# Mobile Optimization
LOW_BANDWIDTH_MODE=true
IMAGE_QUALITY=75
COMPRESSION_LEVEL=8
CACHE_STRATEGY=aggressive
```

### Security Configuration

Create `config/security.js`:

```javascript
module.exports = {
  // Session configuration
  session: {
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    optionsSuccessStatus: 200
  },

  // Helmet security headers
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.yourdealer.com"]
      }
    }
  }
};
```

## Database Setup

### PostgreSQL Configuration

Edit `/etc/postgresql/14/main/postgresql.conf`:

```ini
# Connection settings
listen_addresses = 'localhost'
port = 5432
max_connections = 100

# Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# WAL settings
wal_level = replica
max_wal_size = 1GB
min_wal_size = 80MB

# Checkpoint settings
checkpoint_completion_target = 0.9
checkpoint_timeout = 10min

# Logging
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'all'
log_min_duration_statement = 1000
```

### Database Creation

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE autolumiku_prod;

# Create application user
CREATE USER autolumiku_app WITH PASSWORD 'secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE autolumiku_prod TO autolumiku_app;

# Exit psql
\q
```

### Database Migration

```bash
# Clone repository
git clone https://github.com/your-org/autolumiku.git
cd autolumiku

# Install dependencies
npm install

# Copy environment file
cp .env.production .env.local

# Run migrations
npm run migrate:prod

# Seed data
npm run seed:prod
```

### Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX idx_team_members_tenant_id ON team_members(tenant_id);
CREATE INDEX idx_team_members_active ON team_members(is_active) WHERE is_active = true;
CREATE INDEX idx_team_member_roles_role_id ON team_member_roles(role_id);
CREATE INDEX idx_team_activity_logs_timestamp ON team_activity_logs(created_at);

-- Create partition for activity logs (if high volume)
CREATE TABLE team_activity_logs_2024 PARTITION OF team_activity_logs
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Configure autovacuum for high-traffic tables
ALTER TABLE team_members SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE team_activity_logs SET (autovacuum_vacuum_scale_factor = 0.05);
```

## Application Deployment

### Build Process

```bash
# Build for production
npm run build

# Verify build
ls -la .next/
```

### PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'autolumiku',
    script: 'npm',
    args: 'start',
    cwd: '/home/autolumiku/autolumiku',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/home/autolumiku/logs/autolumiku-error.log',
    out_file: '/home/autolumiku/logs/autolumiku-out.log',
    log_file: '/home/autolumiku/logs/autolumiku-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### Deploy Application

```bash
# Switch to application user
sudo su - autolumiku

# Clone and setup application
git clone https://github.com/your-org/autolumiku.git
cd autolumiku

# Install dependencies
npm ci --production

# Build application
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### Health Checks

Create health check endpoint:

```javascript
// pages/api/health.js
export default function handler(req, res) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  };

  res.status(200).json(health);
}
```

## CDN and Static Assets

### Nginx Configuration

Create `/etc/nginx/sites-available/autolumiku`:

```nginx
# API Server
server {
    listen 80;
    server_name api.yourdealer.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdealer.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdealer.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdealer.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location / {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://localhost:3000/health;
    }
}

# Static assets CDN
server {
    listen 80;
    server_name cdn.yourdealer.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cdn.yourdealer.com;

    ssl_certificate /etc/letsencrypt/live/cdn.yourdealer.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cdn.yourdealer.com/privkey.pem;

    root /var/www/autolumiku/static;
    index index.html;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Cache-Status "STATIC";
    }

    # HTML files
    location ~* \.(html)$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
}
```

### SSL Certificate Setup

```bash
# Obtain SSL certificate
sudo certbot --nginx -d api.yourdealer.com -d cdn.yourdealer.com

# Setup auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring and Logging

### Application Monitoring

Install monitoring tools:

```bash
# Install Node.js monitoring
npm install -g @pm2/io

# Create monitoring configuration
pm2 install pm2-server-monit
```

### Log Management

Create log rotation:

```bash
sudo nano /etc/logrotate.d/autolumiku
```

```
/home/autolumiku/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 autolumiku autolumiku
    postrotate
        pm2 reload autolumiku
    endscript
}
```

### Monitoring Dashboard

Create monitoring script:

```bash
#!/bin/bash
# /home/autolumiku/scripts/monitor.sh

echo "=== AutoLumiKu System Monitor ==="
echo "Time: $(date)"
echo ""

# Application status
echo "Application Status:"
pm2 status
echo ""

# System resources
echo "System Resources:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')"
echo "Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"
echo ""

# Database status
echo "Database Status:"
sudo -u postgres pg_isready -h localhost
echo ""

# Redis status
echo "Redis Status:"
redis-cli ping
echo ""

# Recent errors
echo "Recent Errors:"
tail -n 10 /home/autolumiku/logs/autolumiku-error.log 2>/dev/null || echo "No recent errors"
echo ""

# Health check
echo "Health Check:"
curl -s http://localhost:3000/health | jq . 2>/dev/null || echo "Health check failed"
```

## Security Hardening

### System Security

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install security tools
sudo apt install -y fail2ban ufw

# Configure fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# Enable fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Application Security

```javascript
// config/security.js
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

// Security middleware
module.exports = {
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"]
      }
    }
  }),

  rateLimit: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests'
  }),

  cors: cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
  })
};
```

### Database Security

```sql
-- Create read-only user for reporting
CREATE USER autolumiku_readonly WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE autolumiku_prod TO autolumiku_readonly;
GRANT USAGE ON SCHEMA public TO autolumiku_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO autolumiku_readonly;

-- Revoke dangerous permissions
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE autolumiku_prod FROM PUBLIC;
```

## Indonesian Market Optimizations

### Geographic Distribution

```bash
# Deploy to Indonesian regions
# - Singapore (ap-southeast-1)
# - Jakarta (ap-southeast-3)
# - Mumbai (ap-south-1)

# AWS CLI example for multi-region deployment
aws ec2 run-instances --region ap-southeast-1 --image-id ami-xxx --instance-type t3.medium
aws ec2 run-instances --region ap-southeast-3 --image-id ami-xxx --instance-type t3.medium
```

### CDN Configuration

```javascript
// CDN configuration for Indonesian users
const cdnConfig = {
  provider: 'cloudflare', // or AWS CloudFront
  locations: ['sin', 'cgk', 'bkk'], // Singapore, Jakarta, Bangkok
  cacheRules: {
    // Static assets - 1 year cache
    '*.js': { ttl: 31536000 },
    '*.css': { ttl: 31536000 },
    '*.png': { ttl: 31536000 },

    // API responses - 5 minutes cache
    '/api/team/*': { ttl: 300 },

    // Dynamic content - no cache
    '/api/auth/*': { ttl: 0 }
  },

  // Indonesian bandwidth optimization
  optimization: {
    compression: true,
    minification: true,
    webp: true,
    quality: 75
  }
};
```

### Mobile Optimization

```javascript
// Mobile optimization configuration
const mobileConfig = {
  // Indonesian network conditions
  networkProfiles: {
    'slow-2g': {
      timeout: 30000,
      retryAttempts: 3,
      batchSize: 5,
      imageQuality: 50
    },
    '2g': {
      timeout: 20000,
      retryAttempts: 2,
      batchSize: 10,
      imageQuality: 60
    },
    '3g': {
      timeout: 15000,
      retryAttempts: 2,
      batchSize: 15,
      imageQuality: 70
    },
    '4g': {
      timeout: 10000,
      retryAttempts: 1,
      batchSize: 25,
      imageQuality: 80
    }
  },

  // Progressive Web App
  pwa: {
    enableServiceWorker: true,
    offlineSupport: true,
    cacheFirst: ['/', '/manifest.json'],
    networkFirst: ['/api/team/*']
  }
};
```

## Backup and Disaster Recovery

### Database Backup Script

```bash
#!/bin/bash
# /home/autolumiku/scripts/backup.sh

BACKUP_DIR="/home/autolumiku/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="autolumiku_prod"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Redis backup
redis-cli --rdb $BACKUP_DIR/redis_backup_$DATE.rdb

# File backup
tar -czf $BACKUP_DIR/files_backup_$DATE.tar.gz /home/autolumiku/uploads

# Upload to cloud storage (AWS S3 example)
aws s3 cp $BACKUP_DIR/db_backup_$DATE.sql.gz s3://autolumiku-backups/database/
aws s3 cp $BACKUP_DIR/redis_backup_$DATE.rdb s3://autolumiku-backups/redis/
aws s3 cp $BACKUP_DIR/files_backup_$DATE.tar.gz s3://autolumiku-backups/files/

# Clean up old backups (keep last 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

### Automated Backup

```bash
# Add to crontab
sudo crontab -e

# Daily backup at 2 AM WIB (UTC 19:00)
0 19 * * * /home/autolumiku/scripts/backup.sh >> /home/autolumiku/logs/backup.log 2>&1
```

### Recovery Procedures

```bash
# Database recovery
gunzip -c /home/autolumiku/backups/db_backup_20231220_020000.sql.gz | psql autolumiku_prod

# Redis recovery
redis-cli --rdb /home/autolumiku/backups/redis_backup_20231220_020000.rdb

# File recovery
tar -xzf /home/autolumiku/backups/files_backup_20231220_020000.tar.gz -C /
```

## Troubleshooting

### Common Issues and Solutions

#### Application Won't Start

```bash
# Check logs
pm2 logs autolumiku

# Check environment
pm2 env 0

# Restart application
pm2 restart autolumiku
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U autolumiku_app -d autolumiku_prod

# Check connection limits
SELECT * FROM pg_stat_activity;
```

#### High Memory Usage

```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Restart application
pm2 restart autolumiku

# Optimize Node.js memory
pm2 delete autolumiku
pm2 start ecosystem.config.js --node-args="--max-old-space-size=2048"
```

#### Slow Performance

```bash
# Check system resources
htop
iotop

# Check database queries
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;

# Restart services
sudo systemctl restart postgresql
sudo systemctl restart redis
pm2 restart autolumiku
```

### Health Check Script

```bash
#!/bin/bash
# /home/autolumiku/scripts/health-check.sh

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Check application
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Application is healthy${NC}"
else
    echo -e "${RED}✗ Application is down${NC}"
    pm2 restart autolumiku
fi

# Check database
if sudo -u postgres pg_isready -h localhost > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database is healthy${NC}"
else
    echo -e "${RED}✗ Database is down${NC}"
    sudo systemctl restart postgresql
fi

# Check Redis
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is healthy${NC}"
else
    echo -e "${RED}✗ Redis is down${NC}"
    sudo systemctl restart redis
fi

echo "Health check completed at $(date)"
```

### Log Analysis

```bash
# Application errors
tail -f /home/autolumiku/logs/autolumiku-error.log

# Database queries
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Nginx access
sudo tail -f /var/log/nginx/access.log

# System logs
sudo journalctl -u autolumiku -f
```

## Support and Maintenance

### Monitoring Dashboard

Access monitoring at:
- Application: `https://api.yourdealer.com/metrics`
- PM2 Monitoring: `http://your-server-ip:8080`
- System Metrics: Custom dashboard setup

### Emergency Procedures

1. **Application Down**: Restart with PM2
2. **Database Issues**: Check PostgreSQL status and logs
3. **High Load**: Scale up instances or add workers
4. **Security Issues**: Review logs and update passwords

### Maintenance Schedule

- **Daily**: Health checks, log rotation
- **Weekly**: Security updates, performance monitoring
- **Monthly**: Database optimization, backup verification
- **Quarterly**: Security audit, performance tuning

---

*Last updated: December 2023*
*Version: 1.0.0*
*Target: Indonesian Production Deployment*