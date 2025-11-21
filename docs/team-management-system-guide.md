# AutoLumiKu Team Management System Guide

## Overview

The AutoLumiKu Team Management System is a comprehensive solution designed specifically for Indonesian automotive dealerships. It provides role-based access control, team analytics, and performance optimization tailored for the Indonesian market.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Features](#core-features)
3. [Indonesian Market Adaptations](#indonesian-market-adaptations)
4. [Installation & Setup](#installation--setup)
5. [Configuration](#configuration)
6. [User Guide](#user-guide)
7. [API Documentation](#api-documentation)
8. [Security](#security)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting](#troubleshooting)
11. [Maintenance](#maintenance)

## System Architecture

### Multi-Tenant Architecture

The system uses a database-per-tenant pattern with complete data isolation:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Tenant A DB   │    │   Tenant B DB   │    │   Tenant C DB   │
│  (showroom-a)   │    │  (showroom-b)   │    │  (showroom-c)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Frontend (Next) │    │  API Gateway    │    │  Authentication │
│   - React UI    │◄──►│   - Routes      │◄──►│   - JWT Auth    │
│   - Mobile Opt. │    │   - Middleware  │    │   - Sessions    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│Team Management  │    │   RBAC Service  │    │ Analytics Service│
│   Service       │    │   - Roles       │    │   - Metrics     │
│   - Members     │    │   - Permissions │    │   - Reports     │
│   - Invitations │    │   - Hierarchies │    │   - Insights    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Features

### 1. Role Management System

#### Indonesian Dealership Roles

| Role (English) | Role (Indonesian) | Level | Description |
|----------------|-------------------|-------|-------------|
| Showroom Manager | Pemilik/Kepala Showroom | 1 | Full access to all operations |
| Sales Manager | Manager Penjualan | 10 | Team oversight, inventory, sales analytics |
| Sales Executive | Sales Executive | 20 | Customer interactions, inventory management |
| Finance Manager | Manager Keuangan | 15 | Billing, financial reports, subscriptions |
| Service Advisor | Konsultan Layanan | 25 | After-sales service coordination |
| Marketing Coordinator | Koordinator Pemasaran | 30 | Promotions, customer engagement |
| Inventory Manager | Manager Inventaris | 35 | Stock management, vehicle listings |
| Read-only Staff | Staf View-only | 90 | Limited access for reporting only |

#### Permission Categories

- **Team Management**: `team.view_members`, `team.manage_members`, `team.invite_users`
- **Inventory**: `inventory.view`, `inventory.manage`, `inventory.edit`
- **Sales**: `sales.view`, `sales.manage`, `sales.reports`
- **Billing**: `billing.view`, `billing.manage`, `billing.subscriptions`
- **Analytics**: `analytics.view`, `analytics.export`, `analytics.advanced`

### 2. Team Analytics Dashboard

#### Key Metrics

- **Team Overview**: Total members, active members, online now, new this month
- **Performance Metrics**: Activity scores, lead response times, customer interactions
- **Role Distribution**: Members by role and department
- **Comparative Analytics**: Period-over-period performance comparison
- **AI-Powered Insights**: Automated recommendations and alerts

#### Report Types

- **Daily**: Last 24 hours of activity
- **Weekly**: 7-day performance summary
- **Monthly**: 30-day comprehensive analysis
- **Quarterly**: 90-day trend analysis
- **Yearly**: Annual performance review

### 3. Invitation System

#### Workflow

1. **Create Invitation**: Admin selects role and enters email
2. **Send Invitation**: System sends secure email with Bahasa Indonesia template
3. **Accept Invitation**: User clicks link and creates account
4. **Role Assignment**: User automatically gets assigned role
5. **Audit Logging**: All actions tracked for compliance

#### Email Templates (Bahasa Indonesia)

```subject
Undangan Bergabung dengan Tim [Showroom Name] - AutoLumiKu
```

```body
Halo [Nama],

Anda telah diundang untuk bergabung dengan tim [Showroom Name] di platform AutoLumiKu.

Peran Anda: [Role Name]
Departemen: [Department]

Klik tautan di bawah ini untuk membuat akun Anda:
[Invitation Link]

Tautan ini akan kadaluarsa dalam 7 hari.

Hormat kami,
Tim [Showroom Name]
```

## Indonesian Market Adaptations

### Mobile Optimization

- **Low-Bandwidth Mode**: Optimized for 3G/4G networks common in Indonesia
- **Progressive Loading**: Content loads incrementally for better perceived performance
- **Offline Support**: Core functionality available without internet connection
- **Compressed Images**: WebP format with quality optimization

### Language & Cultural Support

- **Bahasa Indonesia**: Full UI and email template localization
- **Formal Business Language**: Professional communication style
- **Cultural Considerations**: Role names and responsibilities adapted for Indonesian dealerships

### Performance Optimizations

- **CDN Integration**: Content delivered from Indonesian edge servers
- **Caching Strategy**: Aggressive caching for slow networks
- **Connection Awareness**: Adaptive behavior based on network quality
- **Device Detection**: Optimized for low-end Android devices

## Installation & Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- SSL Certificate (for production)

### Environment Setup

```bash
# Clone repository
git clone https://github.com/your-org/autolumiku.git
cd autolumiku

# Install dependencies
npm install

# Copy environment files
cp .env.example .env.local

# Configure database
createdb autolumiku_prod
```

### Environment Configuration

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/autolumiku_prod"

# Redis
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="24h"

# Email (for invitations)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Indonesian Market Config
DEFAULT_LANGUAGE="id"
DEFAULT_TIMEZONE="Asia/Jakarta"
CURRENCY="IDR"

# Performance
CACHE_TTL=300
MAX_BATCH_SIZE=20
LOW_BANDWIDTH_MODE=true
```

### Database Setup

```bash
# Run migrations
npm run migrate

# Seed Indonesian dealership roles
npm run seed:roles

# Create admin user
npm run seed:admin
```

### Start Services

```bash
# Development
npm run dev

# Production
npm run build
npm start

# Background services
npm run queue:work
npm run cache:warmup
```

## Configuration

### Role Configuration

Edit `config/indonesian-roles.json` to customize dealership roles:

```json
{
  "showroom_manager": {
    "name": "showroom_manager",
    "displayName": "Showroom Manager",
    "indonesianTitle": "Pemilik/Kepala Showroom",
    "level": 1,
    "permissions": ["*"],
    "description": "Full access to all showroom operations"
  }
}
```

### Cache Configuration

```typescript
// config/cache.ts
export const cacheConfig = {
  defaultTTL: 300, // 5 minutes
  layers: ['memory', 'redis'],
  compression: true,
  maxMemorySize: 1000,
  indonesianOptimization: true
};
```

### Mobile Optimization

```typescript
// config/mobile.ts
export const mobileConfig = {
  lowBandwidthMode: true,
  imageQuality: 70,
  enableAnimations: true,
  batchSize: 15,
  lazyLoadThreshold: 100,
  compressionLevel: 8
};
```

## User Guide

### For Showroom Administrators

#### Adding Team Members

1. Go to **Team Management** → **Invite Members**
2. Enter team member's email address
3. Select appropriate role (e.g., "Sales Executive")
4. Add personal message (optional)
5. Click **Send Invitation**

#### Managing Roles

1. Go to **Team Management** → **Roles**
2. Click **Edit Role** or **Create Custom Role**
3. Configure permissions using the permission matrix
4. Save changes

#### Viewing Analytics

1. Go to **Team Management** → **Analytics**
2. Select report period (Daily, Weekly, Monthly, etc.)
3. View team performance metrics and insights
4. Export reports if needed

### For Team Members

#### Accepting Invitation

1. Check email for invitation from AutoLumiKu
2. Click invitation link
3. Create password and complete profile
4. Log in to access assigned features

#### Daily Tasks

- **Sales Executive**: Update inventory, respond to leads
- **Service Advisor**: Manage service appointments
- **Finance Manager**: Review billing and subscriptions

## API Documentation

### Authentication

All API requests require authentication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "X-Tenant-ID: your-tenant-id" \
     https://api.autolumiku.com/api/team/members
```

### Role Management Endpoints

#### List Roles

```http
GET /api/team/roles?includeMatrix=true
```

#### Create Custom Role

```http
POST /api/team/roles
Content-Type: application/json

{
  "name": "custom_sales_role",
  "displayName": "Custom Sales Role",
  "indonesianTitle": "Peran Penjualan Kustom",
  "description": "Custom role for sales team",
  "department": "Sales",
  "roleLevel": 25,
  "permissions": ["team.view_members", "inventory.view"]
}
```

#### Update Role Permissions

```http
PUT /api/team/roles/{roleId}
Content-Type: application/json

{
  "permissions": ["team.view_members", "inventory.manage", "sales.view"]
}
```

### Analytics Endpoints

#### Get Team Analytics

```http
GET /api/team/analytics?type=monthly&includeInsights=true
```

#### Export Analytics

```http
POST /api/team/analytics/export
Content-Type: application/json

{
  "format": "csv",
  "reportType": "monthly",
  "startDate": "2023-12-01",
  "endDate": "2023-12-31"
}
```

### Team Member Endpoints

#### List Team Members

```http
GET /api/team/members?role=sales_executive&status=active
```

#### Invite Team Member

```http
POST /api/team/invite
Content-Type: application/json

{
  "email": "newmember@example.com",
  "roleId": "role-123",
  "message": "Welcome to our team!"
}
```

## Security

### Authentication & Authorization

- **JWT-based Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Granular permission system
- **Multi-Tenant Isolation**: Complete data separation between tenants
- **Session Management**: Secure session handling with automatic refresh

### Data Protection

- **Encryption**: All sensitive data encrypted at rest and in transit
- **Audit Logging**: Complete audit trail of all team management actions
- **Data Privacy**: PDPA compliance for Indonesian data protection laws
- **Backup & Recovery**: Automated backups with point-in-time recovery

### Security Best Practices

- **Input Validation**: All inputs validated and sanitized
- **SQL Injection Prevention**: Parameterized queries and ORM usage
- **XSS Protection**: Content Security Policy and output encoding
- **Rate Limiting**: API rate limiting to prevent abuse

## Performance Optimization

### Caching Strategy

- **Multi-Layer Caching**: Memory cache + Redis + CDN
- **Cache Warming**: Preload critical data for Indonesian users
- **Intelligent Invalidation**: Smart cache invalidation based on data changes
- **Compression**: Response compression for bandwidth optimization

### Mobile Optimization

- **Progressive Web App**: PWA features for better mobile experience
- **Image Optimization**: WebP format with responsive images
- **Lazy Loading**: On-demand content loading
- **Connection Awareness**: Adaptive behavior based on network quality

### Indonesian Network Optimization

- **Edge Computing**: Content delivery from Indonesian edge servers
- **Low-Bandwidth Mode**: Optimized for 3G/4G networks
- **Offline Support**: Core functionality without internet
- **Batch Processing**: Efficient data processing for high-latency connections

## Troubleshooting

### Common Issues

#### Performance Issues

**Problem**: Slow page loading on mobile devices
**Solution**:
1. Enable low-bandwidth mode in configuration
2. Check CDN configuration
3. Verify image optimization settings
4. Monitor cache hit rates

#### Authentication Issues

**Problem**: Users unable to log in
**Solution**:
1. Check JWT secret configuration
2. Verify database connection
3. Check user account status
4. Review session timeout settings

#### Invitation Issues

**Problem**: Invitation emails not delivered
**Solution**:
1. Verify SMTP configuration
2. Check email spam folders
3. Validate invitation links
4. Review email template formatting

#### Database Issues

**Problem**: Database connection errors
**Solution**:
1. Check database credentials
2. Verify database is running
3. Review connection pool settings
4. Monitor database performance

### Debug Mode

Enable debug mode for detailed logging:

```bash
# Set debug environment
DEBUG=true npm run dev

# Check logs
tail -f logs/application.log

# Monitor cache stats
curl http://localhost:3000/api/cache/stats
```

### Performance Monitoring

Monitor key metrics:

```bash
# Get performance summary
curl http://localhost:3000/api/performance/summary

# Check cache performance
curl http://localhost:3000/api/cache/performance

# View mobile optimization stats
curl http://localhost:3000/api/mobile/stats
```

## Maintenance

### Regular Tasks

#### Daily

- Monitor application logs for errors
- Check cache performance metrics
- Review system resource usage
- Backup database

#### Weekly

- Update security patches
- Review team analytics
- Optimize database queries
- Clean up expired cache entries

#### Monthly

- Update role permissions
- Review and audit user access
- Performance optimization review
- Security audit

### Backup Strategy

#### Database Backups

```bash
# Daily backup
pg_dump autolumiku_prod > backup_$(date +%Y%m%d).sql

# Compress backup
gzip backup_$(date +%Y%m%d).sql

# Upload to cloud storage
aws s3 cp backup_$(date +%Y%m%d).sql.gz s3://backups/
```

#### Cache Backup

```bash
# Export Redis cache
redis-cli --rdb cache_backup_$(date +%Y%m%d).rdb

# Backup configuration
cp config/ cache_config_$(date +%Y%m%d).json
```

### Updates & Patches

#### Application Updates

```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Run migrations
npm run migrate

# Restart services
npm restart
```

#### Security Updates

```bash
# Check for vulnerabilities
npm audit

# Fix security issues
npm audit fix

# Update dependencies
npm update
```

### Monitoring & Alerts

Set up monitoring for:

- Application performance metrics
- Database performance
- Cache hit rates
- Error rates
- Resource utilization

#### Example Monitoring Script

```bash
#!/bin/bash
# monitoring.sh

# Check application health
curl -f http://localhost:3000/health || echo "Application down!"

# Check database connection
pg_isready -h localhost -p 5432 || echo "Database down!"

# Check Redis connection
redis-cli ping || echo "Redis down!"

# Send alerts if needed
if [ $? -ne 0 ]; then
    curl -X POST "https://hooks.slack.com/..." \
         -d '{"text":"AutoLumiKu service alert!"}'
fi
```

## Support

### Getting Help

- **Documentation**: This guide and API documentation
- **Community**: GitHub Discussions and Issues
- **Support**: support@autolumiku.com
- **Emergency**: emergency@autolumiku.com

### Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

*Last updated: December 2023*
*Version: 1.0.0*
*Target: Indonesian Automotive Dealerships*