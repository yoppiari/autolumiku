# AutoLumiku - Docker Deployment Guide

**Untuk Dedicated Server dengan Docker**

Panduan lengkap deployment AutoLumiku menggunakan Docker dan Docker Compose pada dedicated server Anda sendiri.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start](#2-quick-start)
3. [Detailed Setup](#3-detailed-setup)
4. [Configuration](#4-configuration)
5. [SSL/HTTPS Setup](#5-sslhttps-setup)
6. [Database Management](#6-database-management)
7. [Monitoring & Logs](#7-monitoring--logs)
8. [Troubleshooting](#8-troubleshooting)
9. [Production Optimization](#9-production-optimization)

---

## 1. Prerequisites

### Server Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- OS: Ubuntu 20.04+ / Debian 11+ / CentOS 8+

**Recommended:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 50GB SSD
- OS: Ubuntu 22.04 LTS

### Software Requirements

1. **Docker** (version 20.10+)
2. **Docker Compose** (version 2.0+)
3. **Git** (optional, untuk update)

---

## 2. Quick Start

### Step 1: Install Docker & Docker Compose

#### Ubuntu/Debian:
```bash
# Update package list
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

#### CentOS/RHEL:
```bash
# Install Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker compose version
```

**Logout and login again** untuk apply group changes.

---

### Step 2: Clone or Upload Project

**Option A: Clone from Git**
```bash
git clone https://github.com/your-org/autolumiku.git
cd autolumiku
```

**Option B: Upload via SCP**
```bash
# From your local machine
scp -r autolumiku/ user@your-server:/home/user/
```

---

### Step 3: Configure Environment

```bash
# Copy environment template
cp .env.docker .env

# Edit environment variables
nano .env
```

**IMPORTANT:** Generate secure secrets:
```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output and paste into JWT_SECRET

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output and paste into JWT_REFRESH_SECRET

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output and paste into SESSION_SECRET
```

**Minimum required changes in .env:**
```bash
# Change these passwords!
DB_PASSWORD=your-strong-password-here
REDIS_PASSWORD=your-redis-password-here

# Add your ZhipuAI API key
ZHIPUAI_API_KEY=your-api-key-here

# Change all secrets (use generated values from above)
JWT_SECRET=generated-secret-1
JWT_REFRESH_SECRET=generated-secret-2
SESSION_SECRET=generated-secret-3

# Update domain (if you have one)
NEXT_PUBLIC_APP_URL=http://your-domain.com
NEXT_PUBLIC_API_URL=http://your-domain.com/api
```

---

### Step 4: Deploy

```bash
# Run deployment script
./scripts/deploy.sh
```

**What this script does:**
1. ✅ Stops existing containers
2. ✅ Builds Docker images
3. ✅ Starts all services (PostgreSQL, Redis, App, Nginx)
4. ✅ Runs database migrations
5. ✅ Performs health check

---

### Step 5: Verify Deployment

```bash
# Check container status
docker compose ps

# Expected output:
# NAME                    STATUS              PORTS
# autolumiku-postgres     Up (healthy)        5432/tcp
# autolumiku-redis        Up (healthy)        6379/tcp
# autolumiku-app          Up (healthy)        3000/tcp
# autolumiku-nginx        Up (healthy)        80/tcp, 443/tcp

# Check application health
curl http://localhost/api/health

# Expected output:
# {"status":"healthy","timestamp":"...","environment":"production","database":"connected"}
```

**Access your application:**
- Local: http://localhost
- Remote: http://your-server-ip
- Domain: http://your-domain.com (if configured)

---

## 3. Detailed Setup

### Architecture Overview

```
┌─────────────────────────────────────────────┐
│                  Internet                    │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │    Nginx (Port 80)   │  ← Reverse Proxy
        │   Rate Limiting      │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   Next.js App        │  ← Application
        │   (Port 3000)        │
        └─────┬────────┬───────┘
              │        │
              ▼        ▼
   ┌──────────────┐  ┌──────────────┐
   │  PostgreSQL  │  │    Redis     │
   │  (Port 5432) │  │  (Port 6379) │
   └──────────────┘  └──────────────┘
```

### Services Explained

1. **autolumiku-postgres**
   - PostgreSQL 15 database
   - Persistent storage for all data
   - Automatic health checks
   - Data stored in Docker volume: `postgres_data`

2. **autolumiku-redis**
   - Redis 7 for caching & sessions
   - Optional but recommended
   - Data stored in Docker volume: `redis_data`

3. **autolumiku-app**
   - Next.js application
   - Multi-stage Docker build for optimization
   - Runs as non-root user for security
   - Logs stored in Docker volume: `app_logs`

4. **autolumiku-nginx**
   - Nginx reverse proxy
   - SSL/TLS termination
   - Rate limiting
   - Static file serving
   - Logs stored in Docker volume: `nginx_logs`

---

## 4. Configuration

### Environment Variables

See `.env.docker` for all available variables. Key configurations:

#### Database
```bash
DB_USER=autolumiku
DB_PASSWORD=your-secure-password
DB_NAME=autolumiku_prod
```

#### Security (MUST CHANGE!)
```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-generated-secret-here
JWT_REFRESH_SECRET=your-generated-secret-here
SESSION_SECRET=your-generated-secret-here
```

#### Application URLs
```bash
# For production
NEXT_PUBLIC_APP_URL=https://autolumiku.com
NEXT_PUBLIC_API_URL=https://autolumiku.com/api

# For development/testing
NEXT_PUBLIC_APP_URL=http://localhost
NEXT_PUBLIC_API_URL=http://localhost/api
```

#### Email (Optional)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@autolumiku.com
SMTP_PASSWORD=your-app-password
```

### Docker Compose Configuration

The `docker-compose.yml` file defines all services. Key sections:

#### Resource Limits (Add if needed)
```yaml
services:
  app:
    # ... existing config
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

#### Custom Ports
```yaml
services:
  nginx:
    ports:
      - "8080:80"  # Change 80 to 8080 if port 80 is taken
      - "8443:443"
```

---

## 5. SSL/HTTPS Setup

### Option A: Automated SSL with Let's Encrypt (Recommended)

**Prerequisites:**
- Domain pointing to your server IP
- Port 80 accessible from internet

**Steps:**

1. **Run SSL setup script:**
```bash
sudo ./scripts/setup-ssl.sh
```

2. **Follow prompts:**
   - Enter your domain (e.g., autolumiku.com)
   - Wait for certificate generation

3. **Update nginx config:**

Edit `nginx/conf.d/autolumiku.conf`:

```bash
# Comment out HTTP server (lines 18-120)
# Uncomment HTTPS server (lines 123-end)

# Update server_name
server_name autolumiku.com www.autolumiku.com;
```

4. **Restart nginx:**
```bash
docker compose restart nginx
```

5. **Verify HTTPS:**
```bash
curl https://autolumiku.com/api/health
```

---

### Option B: Manual SSL Certificate

If you have your own SSL certificate:

1. **Copy certificates to nginx/ssl:**
```bash
cp your-fullchain.pem nginx/ssl/fullchain.pem
cp your-privkey.pem nginx/ssl/privkey.pem
```

2. **Update nginx config** (same as Option A, step 3)

3. **Restart nginx** (same as Option A, step 4)

---

### Option C: Self-Signed Certificate (Testing Only)

**⚠️ NOT for production!**

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/C=ID/ST=Jakarta/L=Jakarta/O=AutoLumiku/CN=localhost"

# Update nginx config and restart
```

---

## 6. Database Management

### Database Migration

**Initial migration (first deployment):**
```bash
docker compose exec app npx prisma migrate deploy
```

**Generate Prisma Client:**
```bash
docker compose exec app npx prisma generate
```

**View database with Prisma Studio:**
```bash
docker compose exec app npx prisma studio
```
Visit: http://localhost:5555

---

### Database Backup

**Manual backup:**
```bash
./scripts/backup.sh
```

**What it does:**
- Creates SQL dump
- Compresses with gzip
- Stores in `./backups/` directory
- Removes backups older than 30 days

**Backup location:**
```bash
ls -lh backups/
# autolumiku_backup_20251121_120000.sql.gz
```

---

### Database Restore

**Restore from backup:**
```bash
./scripts/restore.sh backups/autolumiku_backup_20251121_120000.sql.gz
```

**⚠️ WARNING:** This will replace the current database!

---

### Automated Daily Backups

**Setup cron job:**
```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * cd /home/user/autolumiku && ./scripts/backup.sh >> /var/log/autolumiku-backup.log 2>&1
```

---

### Direct Database Access

**Connect to PostgreSQL:**
```bash
docker compose exec postgres psql -U autolumiku -d autolumiku_prod
```

**Run SQL commands:**
```sql
-- Check number of users
SELECT COUNT(*) FROM "User";

-- Check number of vehicles
SELECT COUNT(*) FROM "Vehicle";

-- Exit
\q
```

---

## 7. Monitoring & Logs

### View Logs

**All services:**
```bash
docker compose logs -f
```

**Specific service:**
```bash
docker compose logs -f app        # Application logs
docker compose logs -f postgres   # Database logs
docker compose logs -f nginx      # Nginx logs
docker compose logs -f redis      # Redis logs
```

**Last 50 lines:**
```bash
docker compose logs --tail=50 app
```

**Since specific time:**
```bash
docker compose logs --since 1h app
```

---

### Container Status

**Check status:**
```bash
docker compose ps
```

**Resource usage:**
```bash
docker stats
```

**Expected output:**
```
CONTAINER          CPU %    MEM USAGE / LIMIT    MEM %    NET I/O
autolumiku-app     5.23%    256MiB / 2GiB       12.5%    1.2MB / 800kB
autolumiku-postgres 2.15%   128MiB / 2GiB       6.25%    500kB / 300kB
autolumiku-redis   0.50%    32MiB / 256MiB      12.5%    100kB / 50kB
autolumiku-nginx   0.10%    16MiB / 128MiB      12.5%    2MB / 1MB
```

---

### Health Checks

**Application health:**
```bash
curl http://localhost/api/health
```

**Database health:**
```bash
docker compose exec postgres pg_isready -U autolumiku
```

**Redis health:**
```bash
docker compose exec redis redis-cli ping
# Expected: PONG
```

---

### Log Files

Logs are stored in Docker volumes and host directories:

**Nginx logs:**
```bash
docker compose exec nginx tail -f /var/log/nginx/autolumiku-access.log
docker compose exec nginx tail -f /var/log/nginx/autolumiku-error.log
```

**Application logs:**
```bash
docker compose exec app tail -f /app/logs/combined.log
docker compose exec app tail -f /app/logs/error.log
```

---

## 8. Troubleshooting

### Common Issues

#### 1. Container won't start

**Check logs:**
```bash
docker compose logs app
```

**Common causes:**
- Environment variable missing
- Port already in use
- Database connection failed

**Solutions:**
```bash
# Check all environment variables are set
docker compose config

# Check if ports are available
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :3000

# Restart with fresh build
docker compose down
docker compose up --build -d
```

---

#### 2. Database connection error

**Error:** `Error: P1001: Can't reach database server`

**Check database is running:**
```bash
docker compose ps postgres
```

**Check database logs:**
```bash
docker compose logs postgres
```

**Solution:**
```bash
# Restart database
docker compose restart postgres

# Wait for it to be healthy
docker compose ps postgres
# Should show (healthy)

# Retry application
docker compose restart app
```

---

#### 3. Migration failed

**Error:** `Migration failed to apply`

**Solution:**
```bash
# Reset database (⚠️ THIS WILL DELETE ALL DATA!)
docker compose exec postgres psql -U autolumiku -d postgres -c "DROP DATABASE autolumiku_prod;"
docker compose exec postgres psql -U autolumiku -d postgres -c "CREATE DATABASE autolumiku_prod;"

# Run migration again
docker compose exec app npx prisma migrate deploy
```

---

#### 4. Out of disk space

**Check disk usage:**
```bash
df -h
docker system df
```

**Clean up:**
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused containers
docker container prune

# Remove everything unused (⚠️ careful!)
docker system prune -a --volumes
```

---

#### 5. Nginx 502 Bad Gateway

**Cause:** Application not running or not ready

**Check application:**
```bash
docker compose ps app
docker compose logs app
```

**Solution:**
```bash
# Restart application
docker compose restart app

# Check health
curl http://localhost:3000/api/health
```

---

#### 6. Permission denied errors

**Cause:** Docker running as root, files owned by root

**Solution:**
```bash
# Fix ownership
sudo chown -R $USER:$USER .

# Or run docker with current user
docker compose --user $(id -u):$(id -g) up
```

---

### Debug Mode

**Enable debug logging:**

Edit `.env`:
```bash
LOG_LEVEL=debug
```

Restart:
```bash
docker compose restart app
```

View debug logs:
```bash
docker compose logs -f app
```

---

## 9. Production Optimization

### Performance Tuning

#### 1. Resource Limits

Add to `docker-compose.yml`:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 512M

  postgres:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

---

#### 2. PostgreSQL Optimization

Edit PostgreSQL settings (create `postgresql.conf`):
```bash
# Create custom PostgreSQL config
cat > postgres-custom.conf <<EOF
# Memory
shared_buffers = 512MB
effective_cache_size = 2GB
work_mem = 16MB
maintenance_work_mem = 128MB

# Checkpoints
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Connections
max_connections = 100

# Logging
log_min_duration_statement = 1000  # Log slow queries (>1s)
EOF
```

Mount in `docker-compose.yml`:
```yaml
services:
  postgres:
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres-custom.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
```

---

#### 3. Redis Optimization

Configure Redis for production:
```yaml
services:
  redis:
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru --requirepass ${REDIS_PASSWORD}
```

---

#### 4. Nginx Optimization

Already configured in `nginx/nginx.conf`:
- ✅ Gzip compression
- ✅ Static file caching
- ✅ Connection pooling
- ✅ Rate limiting

**Additional optimizations** (add to nginx.conf):
```nginx
# Worker processes = CPU cores
worker_processes 4;

# Increase worker connections
events {
    worker_connections 2048;
}

# Enable HTTP/2
server {
    listen 443 ssl http2;
    # ...
}
```

---

### Security Hardening

#### 1. Firewall Configuration

**Ubuntu (UFW):**
```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

**CentOS (firewalld):**
```bash
# Allow HTTP/HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Reload
sudo firewall-cmd --reload

# Check
sudo firewall-cmd --list-all
```

---

#### 2. Automatic Security Updates

**Ubuntu:**
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

#### 3. Fail2Ban (Optional)

Protect against brute-force attacks:
```bash
# Install
sudo apt install fail2ban

# Configure
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Enable nginx protection
sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
logpath = /var/log/nginx/autolumiku-error.log
```

---

### Monitoring Setup

#### 1. Uptime Monitoring

**Using UptimeRobot (Free):**
1. Sign up at https://uptimerobot.com
2. Add HTTP(s) monitor
3. URL: `https://your-domain.com/api/health`
4. Interval: 5 minutes
5. Alerts: Email/SMS

---

#### 2. Log Management

**Using Logrotate:**
```bash
# Create logrotate config
sudo nano /etc/logrotate.d/autolumiku
```

Add:
```
/var/lib/docker/volumes/autolumiku_nginx_logs/_data/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        docker compose -f /home/user/autolumiku/docker-compose.yml exec nginx nginx -s reload
    endscript
}
```

---

#### 3. Performance Monitoring

**Using Docker Stats:**
```bash
# Real-time monitoring
watch -n 1 docker stats

# Or use ctop (better UI)
docker run --rm -ti \
  --name=ctop \
  --volume /var/run/docker.sock:/var/run/docker.sock:ro \
  quay.io/vektorlab/ctop:latest
```

---

### Backup Strategy

**3-2-1 Backup Rule:**
- **3** copies of data
- **2** different storage media
- **1** off-site backup

**Implementation:**

1. **Local backups** (automatic via cron)
```bash
# Already configured in Section 6
./scripts/backup.sh
```

2. **Remote backups** (upload to cloud)
```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure remote (e.g., Google Drive, S3)
rclone config

# Create backup and upload script
cat > scripts/backup-remote.sh <<'EOF'
#!/bin/bash
./scripts/backup.sh
LATEST_BACKUP=$(ls -t backups/*.sql.gz | head -1)
rclone copy "$LATEST_BACKUP" remote:autolumiku-backups/
EOF

chmod +x scripts/backup-remote.sh
```

3. **Schedule remote backups**
```bash
crontab -e
# Add: Daily backup at 3 AM
0 3 * * * cd /home/user/autolumiku && ./scripts/backup-remote.sh
```

---

## 10. Common Commands Reference

### Docker Compose

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose stop

# Restart all services
docker compose restart

# Stop and remove containers
docker compose down

# Rebuild and restart
docker compose up --build -d

# View logs
docker compose logs -f [service-name]

# Execute command in container
docker compose exec [service-name] [command]

# Check status
docker compose ps

# View config
docker compose config
```

---

### Application Management

```bash
# Deploy/Update
./scripts/deploy.sh

# Backup database
./scripts/backup.sh

# Restore database
./scripts/restore.sh [backup-file]

# Setup SSL
sudo ./scripts/setup-ssl.sh

# Health check
curl http://localhost/api/health
```

---

### Database Commands

```bash
# Run migration
docker compose exec app npx prisma migrate deploy

# Generate Prisma client
docker compose exec app npx prisma generate

# Open Prisma Studio
docker compose exec app npx prisma studio

# Database shell
docker compose exec postgres psql -U autolumiku -d autolumiku_prod

# Create backup
docker compose exec postgres pg_dump -U autolumiku autolumiku_prod > backup.sql
```

---

### Logs & Debugging

```bash
# Application logs
docker compose logs -f app

# Nginx logs
docker compose exec nginx tail -f /var/log/nginx/autolumiku-access.log
docker compose exec nginx tail -f /var/log/nginx/autolumiku-error.log

# Database logs
docker compose logs -f postgres

# Redis logs
docker compose logs -f redis

# Container stats
docker stats

# Disk usage
docker system df
```

---

## 11. Scaling & High Availability

### Horizontal Scaling (Multiple App Instances)

**Update docker-compose.yml:**
```yaml
services:
  app:
    # Remove container_name for multiple instances
    # container_name: autolumiku-app
    deploy:
      replicas: 3  # Run 3 instances
```

**Update nginx upstream:**
```nginx
upstream nextjs_app {
    least_conn;
    server autolumiku-app-1:3000;
    server autolumiku-app-2:3000;
    server autolumiku-app-3:3000;
}
```

---

### Database Replication (Advanced)

For high availability, consider:
- PostgreSQL streaming replication
- Managed database services (AWS RDS, Google Cloud SQL)
- Database clustering (Patroni, Stolon)

---

## 12. Maintenance

### Regular Maintenance Tasks

**Weekly:**
- [ ] Review logs for errors
- [ ] Check disk space
- [ ] Review backup success

**Monthly:**
- [ ] Update Docker images
- [ ] Security updates
- [ ] Performance review
- [ ] Backup restore test

**Quarterly:**
- [ ] Full security audit
- [ ] Database optimization
- [ ] Capacity planning

---

### Update Procedure

**Application update:**
```bash
# Pull latest code
git pull origin main

# Deploy with new code
./scripts/deploy.sh
```

**Docker image update:**
```bash
# Pull latest base images
docker compose pull

# Rebuild
docker compose up --build -d
```

---

## 13. Disaster Recovery

### Recovery Scenarios

#### Scenario 1: Container Crash
```bash
# Restart affected container
docker compose restart app

# If persistent, rebuild
docker compose up --build -d app
```

#### Scenario 2: Data Corruption
```bash
# Restore from latest backup
./scripts/restore.sh backups/latest.sql.gz

# Restart application
docker compose restart app
```

#### Scenario 3: Complete Server Failure
1. Provision new server
2. Install Docker & Docker Compose
3. Clone/upload project
4. Copy `.env` file
5. Restore latest backup
6. Run `./scripts/deploy.sh`

---

## 14. Support & Resources

### Documentation
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Documentation](https://www.prisma.io/docs/)

### Getting Help

**Check logs first:**
```bash
docker compose logs -f
```

**Common issues:**
- See [Troubleshooting](#8-troubleshooting) section
- Check GitHub Issues
- Review error messages in logs

---

## 15. Checklist: Production Launch

### Pre-Launch
- [ ] All environment variables configured
- [ ] Secrets generated (JWT, session)
- [ ] Database passwords changed
- [ ] SSL certificate installed
- [ ] Domain configured
- [ ] Firewall rules set
- [ ] Backup automation enabled
- [ ] Monitoring configured
- [ ] Health checks passing

### Launch Day
- [ ] Final backup created
- [ ] Deploy to production
- [ ] Smoke tests completed
- [ ] SSL/HTTPS verified
- [ ] Performance tested
- [ ] Error monitoring active

### Post-Launch
- [ ] Monitor logs (first 24h)
- [ ] User feedback review
- [ ] Performance metrics review
- [ ] Backup verification
- [ ] Security scan

---

## Conclusion

Anda sekarang memiliki setup Docker lengkap untuk AutoLumiku dengan:

✅ **Containerized architecture** - Mudah deploy dan scale
✅ **Automated deployment** - One-command deployment
✅ **Database management** - Backup & restore scripts
✅ **SSL/HTTPS support** - Secure connections
✅ **Nginx reverse proxy** - Load balancing & rate limiting
✅ **Health monitoring** - Automatic health checks
✅ **Production-ready** - Optimized for performance & security

**Next Steps:**
1. Configure `.env` file
2. Run `./scripts/deploy.sh`
3. Setup SSL with `./scripts/setup-ssl.sh`
4. Configure automated backups
5. Monitor and enjoy! 🚀

---

**Document Version:** 1.0
**Last Updated:** 2025-11-21
**Maintained By:** AutoLumiku Team
