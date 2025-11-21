# Tenant Branding Service Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Tenant Branding Service in production, staging, and development environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Redis Configuration](#redis-configuration)
5. [AWS S3 Setup](#aws-s3-setup)
6. [Application Deployment](#application-deployment)
7. [Monitoring and Logging](#monitoring-and-logging)
8. [Security Configuration](#security-configuration)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: 18.x or higher
- **PostgreSQL**: 15.x or higher
- **Redis**: 7.x or higher
- **AWS Account**: For S3 file storage
- **Docker**: Optional, for containerized deployment

### Required Software

```bash
# Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Redis
sudo apt-get install redis-server

# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

## Environment Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/autolumiku
DB_HOST=localhost
DB_PORT=5432
DB_NAME=autolumiku
DB_USER=autolumiku_user
DB_PASSWORD=secure_password_here
DB_SSL=true
DB_POOL_SIZE=20
DB_CONNECTION_TIMEOUT=30000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password_here
REDIS_DB=0
REDIS_TTL=3600

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
S3_BUCKET_NAME=autolumiku-branding
S3_BUCKET_REGION=us-east-1

# JWT
JWT_SECRET=your_super_secure_jwt_secret_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Security
CORS_ORIGIN=https://app.autolumiku.com
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
LOG_LEVEL=info
LOG_FORMAT=json
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/svg+xml
VIRUS_SCAN_ENABLED=true
IMAGE_PROCESSING_ENABLED=true
```

### Configuration Validation

Validate environment configuration:

```bash
# Use provided validation script
npm run config:validate

# Manual validation
node -e "
const required = ['DATABASE_URL', 'REDIS_HOST', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('Missing required environment variables:', missing);
  process.exit(1);
}
console.log('Environment configuration valid');
"
```

## Database Setup

### PostgreSQL Installation and Configuration

1. **Install PostgreSQL**:
   ```bash
   sudo apt-get update
   sudo apt-get install postgresql postgresql-contrib
   ```

2. **Create Database and User**:
   ```sql
   -- Connect to PostgreSQL
   sudo -u postgres psql

   -- Create database
   CREATE DATABASE autolumiku;

   -- Create user
   CREATE USER autolumiku_user WITH PASSWORD 'secure_password_here';

   -- Grant privileges
   GRANT ALL PRIVILEGES ON DATABASE autolumiku TO autolumiku_user;

   -- Exit
   \q
   ```

3. **Run Database Migrations**:
   ```bash
   # Run all migrations
   npm run db:migrate

   # Seed initial data (optional)
   npm run db:seed
   ```

4. **Configure PostgreSQL for Production**:
   ```bash
   # Edit postgresql.conf
   sudo nano /etc/postgresql/15/main/postgresql.conf
   ```

   Key settings:
   ```ini
   # Performance
   shared_buffers = 256MB
   effective_cache_size = 1GB
   work_mem = 4MB
   maintenance_work_mem = 64MB

   # Connections
   max_connections = 200
   max_prepared_transactions = 200

   # Logging
   log_statement = 'all'
   log_min_duration_statement = 1000
   ```

5. **Set Up Connection Pooling** (Optional):
   ```bash
   # Install PgBouncer
   sudo apt-get install pgbouncer

   # Configure pgbouncer
   sudo nano /etc/pgbouncer/pgbouncer.ini
   ```

## Redis Configuration

### Redis Setup

1. **Install and Configure Redis**:
   ```bash
   # Install Redis
   sudo apt-get install redis-server

   # Configure Redis
   sudo nano /etc/redis/redis.conf
   ```

   Key configuration:
   ```ini
   # Security
   requirepass redis_password_here
   bind 127.0.0.1

   # Performance
   maxmemory 512mb
   maxmemory-policy allkeys-lru

   # Persistence
   save 900 1
   save 300 10
   save 60 10000
   ```

2. **Start Redis Service**:
   ```bash
   sudo systemctl start redis-server
   sudo systemctl enable redis-server
   ```

3. **Test Redis Connection**:
   ```bash
   redis-cli -a redis_password_here ping
   # Should return: PONG
   ```

## AWS S3 Setup

### S3 Bucket Configuration

1. **Create S3 Bucket**:
   ```bash
   aws s3 mb s3://autolumiku-branding --region us-east-1
   ```

2. **Configure Bucket Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "DenyInsecureConnections",
         "Effect": "Deny",
         "Principal": "*",
         "Action": "s3:*",
         "Resource": "arn:aws:s3:::autolumiku-branding/*",
         "Condition": {
           "Bool": {
             "aws:SecureTransport": "false"
           }
         }
       }
     ]
   }
   ```

3. **Set Up CORS Configuration**:
   ```xml
   <CORSConfiguration>
     <CORSRule>
       <AllowedOrigin>https://app.autolumiku.com</AllowedOrigin>
       <AllowedMethod>GET</AllowedMethod>
       <AllowedMethod>PUT</AllowedMethod>
       <AllowedMethod>POST</AllowedMethod>
       <AllowedMethod>DELETE</AllowedMethod>
       <AllowedHeader>*</AllowedHeader>
       <MaxAgeSeconds>3000</MaxAgeSeconds>
     </CORSRule>
   </CORSConfiguration>
   ```

4. **Create IAM User with S3 Access**:
   ```bash
   # Create IAM user
   aws iam create-user --user-name autolumiku-branding-service

   # Attach policy
   aws iam attach-user-policy \
     --user-name autolumiku-branding-service \
     --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

   # Create access keys
   aws iam create-access-key --user-name autolumiku-branding-service
   ```

## Application Deployment

### Option 1: Traditional Deployment

1. **Clone and Build Application**:
   ```bash
   # Clone repository
   git clone https://github.com/your-org/autolumiku.git
   cd autolumiku

   # Install dependencies
   npm ci --production

   # Build application
   npm run build

   # Run tests
   npm test
   npm run test:integration
   ```

2. **Configure Process Manager**:
   ```bash
   # Install PM2
   npm install -g pm2

   # Create PM2 configuration
   cat > ecosystem.config.js << EOF
   module.exports = {
     apps: [{
       name: 'autolumiku-branding',
       script: 'dist/index.js',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       },
       error_file: 'logs/branding-error.log',
       out_file: 'logs/branding-out.log',
       log_file: 'logs/branding-combined.log',
       time: true,
       max_memory_restart: '1G',
       node_args: '--max-old-space-size=1024'
     }]
   };
   EOF

   # Start application
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

3. **Configure Nginx Reverse Proxy**:
   ```nginx
   server {
       listen 80;
       server_name api.autolumiku.com;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name api.autolumiku.com;

       ssl_certificate /path/to/ssl/cert.pem;
       ssl_certificate_key /path/to/ssl/private.key;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
           proxy_read_timeout 86400;
       }

       # File upload limit
       client_max_body_size 10M;

       # Security headers
       add_header X-Frame-Options DENY;
       add_header X-Content-Type-Options nosniff;
       add_header X-XSS-Protection "1; mode=block";
       add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
   }
   ```

### Option 2: Docker Deployment

1. **Create Dockerfile**:
   ```dockerfile
   FROM node:18-alpine

   WORKDIR /app

   # Copy package files
   COPY package*.json ./

   # Install dependencies
   RUN npm ci --production && npm cache clean --force

   # Copy source code
   COPY . .

   # Build application
   RUN npm run build

   # Create non-root user
   RUN addgroup -g 1001 -S nodejs
   RUN adduser -S nodejs -u 1001

   # Change ownership
   RUN chown -R nodejs:nodejs /app
   USER nodejs

   # Expose port
   EXPOSE 3000

   # Health check
   HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
     CMD curl -f http://localhost:3000/health || exit 1

   # Start application
   CMD ["npm", "start"]
   ```

2. **Create docker-compose.yml**:
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
         - REDIS_HOST=redis
       depends_on:
         - db
         - redis
       restart: unless-stopped

     db:
       image: postgres:15-alpine
       environment:
         POSTGRES_DB: autolumiku
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: password
       volumes:
         - postgres_data:/var/lib/postgresql/data
       restart: unless-stopped

     redis:
       image: redis:7-alpine
       command: redis-server --requirepass password
       volumes:
         - redis_data:/data
       restart: unless-stopped

   volumes:
     postgres_data:
     redis_data:
   ```

3. **Deploy with Docker**:
   ```bash
   # Build and start services
   docker-compose up -d

   # Run migrations
   docker-compose exec app npm run db:migrate

   # View logs
   docker-compose logs -f app
   ```

## Monitoring and Logging

### Application Monitoring

1. **Set Up Health Checks**:
   ```bash
   # Health endpoint
   curl https://api.autolumiku.com/health

   # Expected response
   {
     "status": "healthy",
     "timestamp": "2025-11-20T15:30:00Z",
     "uptime": 86400,
     "version": "1.0.0",
     "checks": {
       "database": "healthy",
       "redis": "healthy",
       "s3": "healthy"
     }
   }
   ```

2. **Configure Logging**:
   ```javascript
   // Winston configuration for production
   const winston = require('winston');

   const logger = winston.createLogger({
     level: 'info',
     format: winston.format.combine(
       winston.format.timestamp(),
       winston.format.errors({ stack: true }),
       winston.format.json()
     ),
     defaultMeta: { service: 'branding-service' },
     transports: [
       new winston.transports.File({
         filename: 'logs/error.log',
         level: 'error'
       }),
       new winston.transports.File({
         filename: 'logs/combined.log'
       })
     ]
   });

   if (process.env.NODE_ENV !== 'production') {
     logger.add(new winston.transports.Console({
       format: winston.format.simple()
     }));
   }
   ```

3. **Set Up Monitoring with Prometheus** (Optional):
   ```javascript
   // Add metrics collection
   const prometheus = require('prom-client');

   const httpRequestDuration = new prometheus.Histogram({
     name: 'http_request_duration_seconds',
     help: 'Duration of HTTP requests in seconds',
     labelNames: ['method', 'route', 'status_code']
   });

   const activeConnections = new prometheus.Gauge({
     name: 'active_connections',
     help: 'Number of active database connections'
   });
   ```

## Security Configuration

### SSL/TLS Setup

1. **Install SSL Certificates**:
   ```bash
   # Use Let's Encrypt
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d api.autolumiku.com
   ```

2. **Configure Security Headers**:
   ```nginx
   # Add to Nginx configuration
   add_header X-Frame-Options DENY;
   add_header X-Content-Type-Options nosniff;
   add_header X-XSS-Protection "1; mode=block";
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
   add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";
   ```

### API Security

1. **Rate Limiting**:
   ```javascript
   const rateLimit = require('express-rate-limit');

   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100, // limit each IP to 100 requests per windowMs
     message: 'Too many requests from this IP'
   });
   ```

2. **Input Validation**:
   ```javascript
   const Joi = require('joi');

   const brandingSchema = Joi.object({
     primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).required(),
     companyName: Joi.string().min(1).max(255).required(),
     email: Joi.string().email(),
     website: Joi.string().uri(),
     phone: Joi.string().pattern(/^\+628[0-9]{8,12}$/)
   });
   ```

## Performance Optimization

### Database Optimization

1. **Add Database Indexes**:
   ```sql
   -- Performance indexes
   CREATE INDEX CONCURRENTLY idx_tenant_branding_tenant_id
   ON tenant_branding(tenant_id);

   CREATE INDEX CONCURRENTLY idx_tenant_branding_updated_at
   ON tenant_branding(updated_at DESC);

   CREATE INDEX CONCURRENTLY idx_tenant_branding_company_name
   ON tenant_branding(company_name);
   ```

2. **Configure Connection Pooling**:
   ```javascript
   const { Pool } = require('pg');

   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 20, // Maximum number of connections
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

### Caching Strategy

1. **Redis Caching Configuration**:
   ```javascript
   const caching = {
     branding: { ttl: 3600 }, // 1 hour
     theme: { ttl: 1800 },    // 30 minutes
     preview: { ttl: 300 }    // 5 minutes
   };
   ```

2. **CDN Configuration**:
   ```javascript
   // Configure CloudFront or similar CDN
   const cdnConfig = {
     domain: 'cdn.autolumiku.com',
     cacheTTL: 86400, // 24 hours
     secureHeaders: true
   };
   ```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql

   # Test connection
   psql -h localhost -U autolumiku_user -d autolumiku

   # Check connection pool
   SELECT * FROM pg_stat_activity WHERE datname = 'autolumiku';
   ```

2. **Redis Connection Issues**:
   ```bash
   # Check Redis status
   sudo systemctl status redis

   # Test connection
   redis-cli -a password ping

   # Monitor Redis
   redis-cli -a password info stats
   ```

3. **File Upload Issues**:
   ```bash
   # Check S3 connectivity
   aws s3 ls s3://autolumiku-branding

   # Check AWS credentials
   aws sts get-caller-identity

   # Test file upload
   aws s3 cp test.txt s3://autolumiku-branding/test.txt
   ```

### Log Analysis

1. **Application Logs**:
   ```bash
   # View real-time logs
   tail -f logs/combined.log

   # Filter error logs
   grep "ERROR" logs/combined.log

   # Monitor performance
   grep "slow query" logs/combined.log
   ```

2. **Nginx Logs**:
   ```bash
   # Access logs
   tail -f /var/log/nginx/access.log

   # Error logs
   tail -f /var/log/nginx/error.log

   # Analyze traffic patterns
   awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr
   ```

### Performance Debugging

1. **Database Performance**:
   ```sql
   -- Slow queries
   SELECT query, mean_time, calls
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;

   -- Index usage
   SELECT schemaname, tablename, indexname, idx_scan
   FROM pg_stat_user_indexes
   ORDER BY idx_scan DESC;
   ```

2. **Application Performance**:
   ```bash
   # Memory usage
   pm2 monit

   # CPU usage
   top -p $(pgrep -f "node.*branding")

   # Response time monitoring
   curl -w "@curl-format.txt" -o /dev/null -s https://api.autolumiku.com/health
   ```

## Deployment Checklist

### Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Redis connectivity tested
- [ ] AWS S3 permissions verified
- [ ] SSL certificates installed
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Monitoring and logging set up
- [ ] Health checks configured
- [ ] Backup procedures tested
- [ ] Rollback plan prepared

### Post-deployment Verification

- [ ] Application starts successfully
- [ ] Health endpoint responds correctly
- [ ] Database connectivity working
- [ ] Redis cache functioning
- [ ] File uploads working
- [ ] API endpoints responding
- [ ] SSL certificate valid
- [ ] Monitoring data flowing
- [ ] Error logs reviewed
- [ ] Performance benchmarks met

## Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Review error logs
   - Check performance metrics
   - Update security patches
   - Backup database

2. **Monthly**:
   - Analyze slow queries
   - Review resource usage
   - Update dependencies
   - Security audit

3. **Quarterly**:
   - Performance optimization review
   - Capacity planning
   - Disaster recovery testing
   - Architecture review

This deployment guide provides everything needed to successfully deploy and maintain the Tenant Branding Service in production.