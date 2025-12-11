# AutoLumiku - Production Deployment Guide

**Target:** Production-ready deployment untuk AutoLumiku Multi-Tenant Platform
**Timeline:** 1-2 hari untuk complete deployment
**Status:** Ready untuk production dengan minor enhancements

---

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Security Hardening](#2-security-hardening)
3. [Infrastructure Setup](#3-infrastructure-setup)
4. [Environment Configuration](#4-environment-configuration)
5. [Database Migration](#5-database-migration)
6. [Deployment Steps](#6-deployment-steps)
7. [Post-Deployment Verification](#7-post-deployment-verification)
8. [Monitoring & Maintenance](#8-monitoring--maintenance)
9. [Rollback Procedures](#9-rollback-procedures)

---

## 1. Pre-Deployment Checklist

### ✅ Critical Tasks (MUST DO)

#### A. Implement Rate Limiting (2-4 hours)
**Priority:** CRITICAL
**Why:** Protect API dari abuse & DoS attacks

**Step 1: Install Dependencies**
```bash
npm install express-rate-limit
```

**Step 2: Create Rate Limit Middleware**
Create file: `/src/middleware/rate-limit.ts`

```typescript
import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per 15 minutes per IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

// Auth endpoints rate limiter (stricter)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Max 5 login attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful logins
  message: {
    error: 'Too many login attempts, please try again later.',
    retryAfter: '15 minutes',
  },
});

// Public API rate limiter (more lenient)
export const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Max 60 requests per minute
  message: {
    error: 'Too many requests, please slow down.',
  },
});

// Per-tenant rate limiter
export const tenantLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30, // Max 30 requests per minute per tenant
  keyGenerator: (req: any) => {
    // Use tenant ID from authenticated user
    return req.user?.tenantId || req.ip;
  },
  message: {
    error: 'Tenant rate limit exceeded.',
  },
});
```

**Step 3: Apply to Next.js API Routes**

Create middleware wrapper: `/src/lib/with-rate-limit.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiters = {
  api: new RateLimiterMemory({
    points: 100, // Number of requests
    duration: 15 * 60, // Per 15 minutes
  }),
  auth: new RateLimiterMemory({
    points: 5,
    duration: 15 * 60,
  }),
  public: new RateLimiterMemory({
    points: 60,
    duration: 60, // Per 1 minute
  }),
};

export function withRateLimit(
  handler: Function,
  limiterType: 'api' | 'auth' | 'public' = 'api'
) {
  return async (request: NextRequest, context?: any) => {
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    try {
      await rateLimiters[limiterType].consume(ip);
      return handler(request, context);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: Math.ceil((error as any).msBeforeNext / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((error as any).msBeforeNext / 1000)),
          },
        }
      );
    }
  };
}
```

**Step 4: Install rate-limiter-flexible**
```bash
npm install rate-limiter-flexible
```

**Step 5: Apply to Critical Routes**

Example: `/src/app/api/auth/login/route.ts`
```typescript
import { withRateLimit } from '@/lib/with-rate-limit';

async function loginHandler(request: NextRequest) {
  // Your login logic
}

export const POST = withRateLimit(loginHandler, 'auth');
```

---

#### B. Environment Variables Configuration

**Step 1: Create Production `.env.production`**
```bash
# Database
DATABASE_URL="postgresql://user:password@production-host:5432/autolumiku_prod"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-min-32-characters"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-min-32-characters"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# ZhipuAI (AI Services)
ZHIPUAI_API_KEY="your-zhipuai-api-key"
ZHIPUAI_MODEL_VISION="glm-4v-flash"
ZHIPUAI_MODEL_TEXT="glm-4-flash"

# Application
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://app.autolumiku.com"
NEXT_PUBLIC_API_URL="https://api.autolumiku.com"

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET="your-session-secret-min-32-characters"
CORS_ORIGIN="https://autolumiku.com,https://app.autolumiku.com"

# Email (for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="noreply@autolumiku.com"
SMTP_PASSWORD="your-smtp-password"
EMAIL_FROM="AutoLumiku <noreply@autolumiku.com>"

# File Upload
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_IMAGE_TYPES="image/jpeg,image/png,image/webp"

# Redis (for caching & sessions)
REDIS_URL="redis://production-redis:6379"

# Monitoring
SENTRY_DSN="your-sentry-dsn"  # Optional but recommended
LOG_LEVEL="error"  # production: error, staging: info, dev: debug

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes

# Feature Flags
ENABLE_2FA=true
ENABLE_ANALYTICS=true
ENABLE_WHATSAPP=true
```

**Step 2: Secure Environment Variables**
```bash
# NEVER commit .env files to git
echo ".env*" >> .gitignore

# Use environment variable management service
# Options: AWS Secrets Manager, Vercel Environment Variables,
#          Railway Secrets, Docker secrets
```

---

#### C. Database Migration Preparation

**Step 1: Backup Current Development Database**
```bash
# Create backup
npx prisma db pull
npx prisma generate

# Export schema
pg_dump -h localhost -U postgres autolumiku > backup_before_production.sql
```

**Step 2: Review Migration Plan**
```bash
# Generate migration
npx prisma migrate dev --name production_ready

# Review migration files
ls prisma/migrations/
```

**Step 3: Test Migration on Staging**
```bash
# Apply to staging database first
DATABASE_URL="postgresql://staging..." npx prisma migrate deploy
```

---

#### D. Security Audit

**Step 1: Review Authentication**
- [x] JWT secrets are strong (min 32 characters)
- [x] Password hashing uses bcrypt with rounds >= 12
- [x] Session expiration configured
- [x] Refresh token rotation implemented
- [x] 2FA available for sensitive accounts

**Step 2: Review Authorization**
- [x] RBAC implemented for all endpoints
- [x] Tenant isolation enforced
- [x] Permission checks on all protected routes
- [x] Audit logging for sensitive operations

**Step 3: Review Input Validation**
- [x] All inputs validated with Zod schemas
- [x] SQL injection prevention (Prisma ORM)
- [x] XSS prevention (React auto-escaping)
- [x] File upload validation (type & size)

**Step 4: Review API Security**
- [ ] Rate limiting implemented (DO THIS NOW)
- [x] CORS configured properly
- [x] HTTPS enforced
- [x] Security headers configured

---

### ⚠️ Recommended Tasks (SHOULD DO)

#### E. API Key Management (4-8 hours)

**Step 1: Add Database Model**

Add to `prisma/schema.prisma`:
```prisma
model ApiKey {
  id          String   @id @default(uuid())
  tenantId    String
  name        String   // "Integration API", "Mobile App", etc.
  key         String   @unique // Hashed API key
  keyPrefix   String   // First 8 chars for identification (e.g., "ak_12345678")
  scopes      String[] // ["read:vehicles", "write:leads", etc.]
  expiresAt   DateTime?
  lastUsedAt  DateTime?
  usageCount  Int      @default(0)
  isActive    Boolean  @default(true)
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([keyPrefix])
  @@index([expiresAt])
}
```

**Step 2: Create API Key Service**

Create `/src/services/api-key-service.ts`:
```typescript
import { randomBytes, createHash } from 'crypto';
import prisma from '@/lib/prisma';

export class ApiKeyService {
  // Generate new API key
  static async generateApiKey(
    tenantId: string,
    name: string,
    scopes: string[],
    userId: string,
    expiresInDays?: number
  ): Promise<{ apiKey: ApiKey; plainKey: string }> {
    // Generate random key
    const plainKey = `ak_${randomBytes(32).toString('hex')}`;

    // Hash the key for storage
    const hashedKey = this.hashApiKey(plainKey);

    // Get prefix for identification
    const keyPrefix = plainKey.substring(0, 11); // "ak_12345678"

    // Calculate expiration
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Store in database
    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId,
        name,
        key: hashedKey,
        keyPrefix,
        scopes,
        expiresAt,
        createdBy: userId,
      },
    });

    // Return both (plainKey only shown once!)
    return { apiKey, plainKey };
  }

  // Verify API key
  static async verifyApiKey(plainKey: string): Promise<ApiKey | null> {
    const hashedKey = this.hashApiKey(plainKey);

    const apiKey = await prisma.apiKey.findUnique({
      where: { key: hashedKey },
      include: { tenant: true },
    });

    if (!apiKey) return null;

    // Check if active
    if (!apiKey.isActive) return null;

    // Check if expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    // Update usage stats
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });

    return apiKey;
  }

  // Hash API key for storage
  private static hashApiKey(plainKey: string): string {
    return createHash('sha256').update(plainKey).digest('hex');
  }

  // Revoke API key
  static async revokeApiKey(apiKeyId: string, tenantId: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id: apiKeyId, tenantId },
      data: { isActive: false },
    });
  }

  // List API keys for tenant
  static async listApiKeys(tenantId: string) {
    return prisma.apiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        usageCount: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

**Step 3: Create API Key Middleware**

Create `/src/middleware/api-key-auth.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/api-key-service';

export function withApiKeyAuth(handler: Function, requiredScopes?: string[]) {
  return async (request: NextRequest, context?: any) => {
    // Get API key from header
    const apiKeyHeader = request.headers.get('X-API-Key') ||
                        request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!apiKeyHeader) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    // Verify API key
    const apiKey = await ApiKeyService.verifyApiKey(apiKeyHeader);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Invalid or expired API key' },
        { status: 401 }
      );
    }

    // Check scopes if required
    if (requiredScopes && requiredScopes.length > 0) {
      const hasRequiredScopes = requiredScopes.every(scope =>
        apiKey.scopes.includes(scope)
      );

      if (!hasRequiredScopes) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Add API key info to request
    const enhancedContext = {
      ...context,
      apiKey,
      tenantId: apiKey.tenantId,
    };

    return handler(request, enhancedContext);
  };
}
```

**Step 4: Create API Key Management Endpoints**

Create `/src/app/api/v1/api-keys/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { ApiKeyService } from '@/services/api-key-service';

// GET /api/v1/api-keys - List API keys
export const GET = withAuth(async (request, { user }) => {
  const apiKeys = await ApiKeyService.listApiKeys(user.tenantId);
  return NextResponse.json(apiKeys);
});

// POST /api/v1/api-keys - Create new API key
export const POST = withAuth(async (request, { user }) => {
  const body = await request.json();

  const { apiKey, plainKey } = await ApiKeyService.generateApiKey(
    user.tenantId,
    body.name,
    body.scopes || [],
    user.id,
    body.expiresInDays
  );

  return NextResponse.json({
    ...apiKey,
    plainKey, // Only shown once!
    warning: 'Save this key now. You will not be able to see it again.',
  }, { status: 201 });
});
```

Create `/src/app/api/v1/api-keys/[keyId]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { ApiKeyService } from '@/services/api-key-service';

// DELETE /api/v1/api-keys/[keyId] - Revoke API key
export const DELETE = withAuth(
  async (request, { user, params }: { user: any; params: { keyId: string } }) => {
    await ApiKeyService.revokeApiKey(params.keyId, user.tenantId);
    return NextResponse.json({ message: 'API key revoked successfully' });
  }
);
```

**Step 5: Run Migration**
```bash
npx prisma db push
```

---

#### F. Setup Logging & Error Tracking

**Option 1: Sentry (Recommended)**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Configure `sentry.server.config.ts`:
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Filter sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.authorization;
    }
    return event;
  },
});
```

**Option 2: Custom Logging**

Create `/src/lib/logger.ts`:
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

export default logger;
```

---

## 2. Security Hardening

### A. HTTPS Configuration

**For Vercel/Railway/Render:**
- Automatic HTTPS (no configuration needed)

**For Custom Server:**
```bash
# Use Let's Encrypt with certbot
sudo certbot --nginx -d autolumiku.com -d www.autolumiku.com
```

**Next.js Security Headers**

Create `/middleware.ts` in root:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  // CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

---

### B. Database Security

**Step 1: Create Production Database User**
```sql
-- Create dedicated user with limited permissions
CREATE USER autolumiku_prod WITH PASSWORD 'strong-password-here';

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE autolumiku_prod TO autolumiku_prod;
GRANT USAGE ON SCHEMA public TO autolumiku_prod;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO autolumiku_prod;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO autolumiku_prod;

-- Deny dangerous operations
REVOKE CREATE ON SCHEMA public FROM autolumiku_prod;
REVOKE DROP ON ALL TABLES IN SCHEMA public FROM autolumiku_prod;
```

**Step 2: Enable SSL Connection**
```bash
# In .env.production
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

**Step 3: Connection Pooling**

Install PgBouncer or use Prisma Accelerate:
```bash
# prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL") // For migrations
}
```

```bash
# .env.production
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/db?pgbouncer=true"
DIRECT_DATABASE_URL="postgresql://user:pass@postgres:5432/db"
```

---

### C. Secrets Management

**Option 1: Environment Variables (Basic)**
```bash
# Railway, Vercel, Render
# Use their dashboard to set environment variables
```

**Option 2: AWS Secrets Manager (Advanced)**
```bash
npm install @aws-sdk/client-secrets-manager
```

Create `/src/lib/secrets.ts`:
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

export async function getSecret(secretName: string): Promise<string> {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  return response.SecretString || '';
}
```

---

## 3. Infrastructure Setup

### Option A: Vercel (Recommended for Quick Deployment)

**Pros:**
- Zero configuration
- Automatic HTTPS
- Global CDN
- Automatic scaling
- Easy environment variables

**Steps:**

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Login**
```bash
vercel login
```

3. **Deploy**
```bash
# First deployment
vercel

# Production deployment
vercel --prod
```

4. **Configure Database**
- Use Vercel Postgres or Supabase
- Set `DATABASE_URL` in Vercel dashboard

5. **Configure Environment Variables**
- Go to Vercel Dashboard > Project > Settings > Environment Variables
- Add all variables from `.env.production`

---

### Option B: Railway (Good for Database Included)

**Pros:**
- PostgreSQL included
- Simple deployment
- Good pricing
- Auto-scaling

**Steps:**

1. **Create Railway Account**
```bash
npm install -g @railway/cli
railway login
```

2. **Initialize Project**
```bash
railway init
```

3. **Add PostgreSQL**
```bash
railway add postgresql
```

4. **Deploy**
```bash
railway up
```

5. **Get Database URL**
```bash
railway variables
# Copy DATABASE_URL
```

---

### Option C: Self-Hosted (VPS/Cloud)

**Requirements:**
- Ubuntu 22.04 LTS
- Node.js 18+
- PostgreSQL 15+
- Nginx
- PM2

**Steps:**

1. **Server Setup**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2
```

2. **PostgreSQL Setup**
```bash
sudo -u postgres psql
CREATE DATABASE autolumiku_prod;
CREATE USER autolumiku WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE autolumiku_prod TO autolumiku;
\q
```

3. **Clone & Build**
```bash
git clone https://github.com/your-org/autolumiku.git
cd autolumiku
npm install
npm run build
```

4. **Run Database Migration**
```bash
npx prisma migrate deploy
```

5. **Start with PM2**
```bash
pm2 start npm --name "autolumiku" -- start
pm2 save
pm2 startup
```

6. **Nginx Configuration**
```nginx
server {
    listen 80;
    server_name autolumiku.com www.autolumiku.com;

    location / {
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
}
```

```bash
sudo ln -s /etc/nginx/sites-available/autolumiku /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

7. **SSL Certificate**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d autolumiku.com -d www.autolumiku.com
```

---

## 4. Environment Configuration

### Production Environment Variables

**Create `/env.production` file (DO NOT COMMIT)**

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/autolumiku_prod?sslmode=require"

# JWT
JWT_SECRET="production-secret-min-32-chars-random-string-12345678"
JWT_REFRESH_SECRET="production-refresh-secret-different-from-main-32"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# ZhipuAI
ZHIPUAI_API_KEY="your-production-zhipuai-api-key"
ZHIPUAI_MODEL_VISION="glm-4v-flash"
ZHIPUAI_MODEL_TEXT="glm-4-flash"

# Application
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://app.autolumiku.com"
NEXT_PUBLIC_API_URL="https://api.autolumiku.com"

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET="another-random-32-char-string-for-sessions-prod"
CORS_ORIGIN="https://autolumiku.com,https://app.autolumiku.com"

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="noreply@autolumiku.com"
SMTP_PASSWORD="your-app-specific-password"
EMAIL_FROM="AutoLumiku <noreply@autolumiku.com>"

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_IMAGE_TYPES="image/jpeg,image/png,image/webp"

# Redis (optional, for caching)
REDIS_URL="redis://production-redis:6379"

# Monitoring
SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
LOG_LEVEL="error"

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# Feature Flags
ENABLE_2FA=true
ENABLE_ANALYTICS=true
ENABLE_WHATSAPP=true
```

**Generate Secure Secrets:**
```bash
# Generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Run this 3 times for JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET
```

---

## 5. Database Migration

### Pre-Migration Checklist

- [ ] Backup existing database
- [ ] Test migration on staging
- [ ] Review all migration files
- [ ] Plan rollback procedure
- [ ] Schedule maintenance window

### Migration Steps

**Step 1: Backup Production Database**
```bash
# PostgreSQL backup
pg_dump -h production-host -U postgres -d autolumiku_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Or use cloud provider backup
# AWS RDS: Create snapshot
# Supabase: Use dashboard backup
```

**Step 2: Test Migration on Staging**
```bash
# Set staging database
DATABASE_URL="postgresql://staging-url" npx prisma migrate deploy

# Test application
npm run build
npm start
# Run smoke tests
```

**Step 3: Run Production Migration**
```bash
# Set production database
DATABASE_URL="postgresql://production-url" npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

**Step 4: Verify Migration**
```bash
# Check database schema
npx prisma db pull

# Verify all models
npx prisma studio
# Browse tables to verify structure
```

**Step 5: Seed Initial Data (if needed)**

Create `prisma/seed-production.ts`:
```typescript
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create platform admin tenant
  const platformTenant = await prisma.tenant.create({
    data: {
      name: 'AutoLumiku Platform',
      type: 'PLATFORM',
      status: 'ACTIVE',
    },
  });

  // Create super admin user
  const hashedPassword = await hash('ChangeMe123!', 12);

  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@autolumiku.com',
      password: hashedPassword,
      name: 'Super Admin',
      tenantId: platformTenant.id,
      isActive: true,
      emailVerified: true,
    },
  });

  // Assign super_admin role
  const superAdminRole = await prisma.role.findFirst({
    where: { name: 'super_admin' },
  });

  if (superAdminRole) {
    await prisma.userRole.create({
      data: {
        userId: superAdmin.id,
        roleId: superAdminRole.id,
      },
    });
  }

  console.log('✅ Production seed completed');
  console.log('📧 Super Admin Email: admin@autolumiku.com');
  console.log('🔑 Super Admin Password: ChangeMe123! (CHANGE THIS IMMEDIATELY)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Run seed:
```bash
DATABASE_URL="production-url" npx tsx prisma/seed-production.ts
```

---

## 6. Deployment Steps

### Pre-Deployment

**1. Code Review**
```bash
# Run linter
npm run lint

# Run type check
npm run type-check  # or npx tsc --noEmit

# Run tests (if available)
npm test
```

**2. Build Test**
```bash
# Test production build locally
NODE_ENV=production npm run build

# Test production server locally
NODE_ENV=production npm start
# Visit http://localhost:3000
```

**3. Create Git Tag**
```bash
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0
```

---

### Deployment (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
vercel link

# Set environment variables
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
# ... add all environment variables

# Deploy to production
vercel --prod

# Expected output:
# ✅ Production: https://autolumiku.vercel.app
```

---

### Deployment (Railway)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Set environment variables
railway variables set DATABASE_URL="postgresql://..."
railway variables set JWT_SECRET="..."
# ... add all environment variables

# Deploy
railway up

# Open in browser
railway open
```

---

### Deployment (Self-Hosted)

```bash
# SSH to server
ssh user@your-server.com

# Navigate to project
cd /var/www/autolumiku

# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Build
NODE_ENV=production npm run build

# Run migrations
npx prisma migrate deploy

# Restart PM2
pm2 restart autolumiku

# Check status
pm2 status
pm2 logs autolumiku
```

---

## 7. Post-Deployment Verification

### Automated Health Checks

**Create Health Check Endpoint**

`/src/app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'ZHIPUAI_API_KEY',
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingEnvVars.length > 0) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          error: `Missing environment variables: ${missingEnvVars.join(', ')}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: 'connected',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

**Test Health Check:**
```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-21T10:00:00.000Z",
  "environment": "production",
  "database": "connected"
}
```

---

### Manual Verification Checklist

#### A. Authentication Tests
- [ ] User can register
- [ ] User can login
- [ ] JWT token is generated
- [ ] Refresh token works
- [ ] Session persists after page reload
- [ ] Logout works
- [ ] Password reset works
- [ ] 2FA works (if enabled)

#### B. Multi-Tenant Tests
- [ ] Tenant creation works
- [ ] Tenant branding is applied
- [ ] Subdomain routing works (`tenant.autolumiku.com`)
- [ ] Custom domain works (if configured)
- [ ] Data isolation is enforced
- [ ] Users can only see their tenant's data

#### C. Vehicle Management Tests
- [ ] AI photo extraction works
- [ ] Vehicle creation works
- [ ] Bulk photo upload works
- [ ] Photo quality validation works
- [ ] Vehicle editing works
- [ ] Photo management works
- [ ] Vehicle publishing works
- [ ] Search works

#### D. Inventory Tests
- [ ] Real-time sync works (SSE connection)
- [ ] Version history is recorded
- [ ] Bulk operations work
- [ ] Status workflow enforced
- [ ] Advanced search works
- [ ] Saved searches work

#### E. Public Catalog Tests
- [ ] Public catalog is accessible
- [ ] Vehicle listings load
- [ ] Vehicle detail page works
- [ ] SEO meta tags are present
- [ ] Schema.org data is correct
- [ ] Lead submission works
- [ ] Contact forms work
- [ ] Branding is applied correctly

#### F. Lead Management Tests
- [ ] Lead creation works
- [ ] Lead scoring calculates
- [ ] Lead activities tracked
- [ ] WhatsApp integration works
- [ ] Follow-up tasks created
- [ ] Communication preferences respected

#### G. Analytics Tests
- [ ] Page views tracked
- [ ] Sales analytics load
- [ ] Inventory analytics load
- [ ] Customer analytics load
- [ ] Marketing analytics load
- [ ] Feedback analytics load
- [ ] Dashboard data loads

#### H. Natural Language Tests
- [ ] NL command processing works
- [ ] Voice command works (if enabled)
- [ ] Command history saved
- [ ] Multi-language support works

#### I. Security Tests
- [ ] Rate limiting active
- [ ] Unauthorized access blocked
- [ ] RBAC enforced
- [ ] Tenant isolation enforced
- [ ] HTTPS enforced
- [ ] Security headers present
- [ ] CORS configured correctly

#### J. Performance Tests
- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms
- [ ] Database queries optimized
- [ ] Images load fast (CDN)
- [ ] Real-time updates instant

---

### Performance Monitoring

**Test with Lighthouse:**
```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse https://your-domain.com --output html --output-path ./lighthouse-report.html

# Target scores:
# Performance: > 90
# Accessibility: > 90
# Best Practices: > 90
# SEO: > 90
```

**Load Testing:**
```bash
# Install Artillery
npm install -g artillery

# Create test script: load-test.yml
config:
  target: "https://your-domain.com"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
      - get:
          url: "/api/health"
      - get:
          url: "/api/public/demo/catalog"

# Run test
artillery run load-test.yml
```

---

## 8. Monitoring & Maintenance

### A. Application Monitoring

**Option 1: Sentry (Recommended)**

Setup already done in Step 1F. Monitor at:
- https://sentry.io/organizations/your-org/issues/

**Alerts to configure:**
- Error rate > 1%
- Response time > 1s
- Database errors
- API errors

---

**Option 2: Custom Monitoring**

Create `/src/app/api/admin/monitoring/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const GET = withAuth(async (request, { user }) => {
  // Only super_admin can access
  if (user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const [
    totalTenants,
    totalUsers,
    totalVehicles,
    totalLeads,
    recentErrors,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.vehicle.count(),
    prisma.lead.count(),
    prisma.auditLog.findMany({
      where: {
        action: { contains: 'ERROR' },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return NextResponse.json({
    stats: {
      totalTenants,
      totalUsers,
      totalVehicles,
      totalLeads,
    },
    recentErrors,
    timestamp: new Date().toISOString(),
  });
});
```

---

### B. Database Monitoring

**PostgreSQL Queries to Monitor:**

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('autolumiku_prod'));

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check blocked queries
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

**Setup Automated Monitoring:**

Create cron job for daily checks:
```bash
# /etc/cron.daily/db-health-check
#!/bin/bash
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('autolumiku_prod'));" | mail -s "DB Size Report" admin@autolumiku.com
```

---

### C. Backup Strategy

**Daily Automated Backups:**

Create backup script `/scripts/backup-db.sh`:
```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/var/backups/autolumiku"
DB_NAME="autolumiku_prod"
DB_USER="autolumiku"
DB_HOST="localhost"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup filename with timestamp
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Run backup
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > $BACKUP_FILE

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $BACKUP_FILE"

    # Upload to S3 (optional)
    # aws s3 cp $BACKUP_FILE s3://autolumiku-backups/

    # Delete old backups
    find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

    echo "🗑️  Removed backups older than $RETENTION_DAYS days"
else
    echo "❌ Backup failed"
    # Send alert email
    echo "Backup failed for $DB_NAME" | mail -s "BACKUP FAILED" admin@autolumiku.com
    exit 1
fi
```

Make executable and add to cron:
```bash
chmod +x /scripts/backup-db.sh

# Add to crontab (run daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /scripts/backup-db.sh >> /var/log/backup.log 2>&1
```

---

### D. Uptime Monitoring

**Option 1: UptimeRobot (Free)**
- Sign up at https://uptimerobot.com
- Add monitor for https://your-domain.com/api/health
- Set check interval: 5 minutes
- Configure alerts (email, Slack, SMS)

**Option 2: Custom Monitoring**

Create `/scripts/health-check.sh`:
```bash
#!/bin/bash

URL="https://your-domain.com/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $URL)

if [ $RESPONSE -ne 200 ]; then
    echo "❌ Health check failed: HTTP $RESPONSE"
    # Send alert
    curl -X POST https://hooks.slack.com/your-webhook \
         -d "{\"text\":\"🚨 AutoLumiku is DOWN! HTTP $RESPONSE\"}"
    exit 1
else
    echo "✅ Health check passed"
fi
```

Add to cron (check every 5 minutes):
```bash
*/5 * * * * /scripts/health-check.sh
```

---

### E. Log Rotation

**Setup logrotate:**

Create `/etc/logrotate.d/autolumiku`:
```
/var/www/autolumiku/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reload autolumiku > /dev/null
    endscript
}
```

Test:
```bash
sudo logrotate -d /etc/logrotate.d/autolumiku
```

---

## 9. Rollback Procedures

### A. Database Rollback

**Scenario: Migration failed**

```bash
# Step 1: Restore from backup
gunzip < backup_20251121_020000.sql.gz | psql -h localhost -U autolumiku autolumiku_prod

# Step 2: Verify restoration
psql -h localhost -U autolumiku autolumiku_prod -c "SELECT COUNT(*) FROM \"User\";"

# Step 3: Restart application
pm2 restart autolumiku
```

---

### B. Application Rollback

**Scenario: Deployment broke production**

**For Vercel:**
```bash
# Rollback to previous deployment
vercel rollback
```

**For Railway:**
```bash
# Redeploy previous version
railway rollback
```

**For Self-Hosted:**
```bash
# SSH to server
ssh user@server.com

# Go to project directory
cd /var/www/autolumiku

# Revert to previous commit
git log --oneline  # Find previous commit hash
git checkout <previous-commit-hash>

# Rebuild
npm install
npm run build

# Restart
pm2 restart autolumiku

# Verify
pm2 logs autolumiku
```

---

### C. Emergency Maintenance Mode

Create `/src/middleware/maintenance.ts`:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function maintenanceMiddleware(request: NextRequest) {
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';

  // Allow health checks
  if (request.nextUrl.pathname === '/api/health') {
    return NextResponse.next();
  }

  if (isMaintenanceMode) {
    return new NextResponse(
      JSON.stringify({
        message: 'System under maintenance. Please try again later.',
        estimatedDowntime: '30 minutes',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '1800', // 30 minutes
        },
      }
    );
  }

  return NextResponse.next();
}
```

Enable maintenance mode:
```bash
# Set environment variable
export MAINTENANCE_MODE=true

# Or in Vercel/Railway dashboard
# Set MAINTENANCE_MODE=true

# Restart application
pm2 restart autolumiku  # or redeploy
```

---

## 10. Production Checklist Summary

### Before Go-Live

**Code & Security:**
- [ ] Rate limiting implemented
- [ ] API key management implemented (optional)
- [ ] All secrets generated and secured
- [ ] Environment variables configured
- [ ] Security headers configured
- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] Input validation on all endpoints
- [ ] SQL injection prevented (Prisma ORM)
- [ ] XSS prevented (React auto-escape)

**Database:**
- [ ] Production database created
- [ ] Database user with limited permissions
- [ ] SSL connection enabled
- [ ] Connection pooling configured
- [ ] Migrations tested on staging
- [ ] Backup strategy implemented
- [ ] Initial data seeded

**Infrastructure:**
- [ ] Hosting platform chosen
- [ ] Domain configured
- [ ] SSL certificate issued
- [ ] CDN configured (for images)
- [ ] Email service configured
- [ ] Monitoring setup (Sentry/custom)
- [ ] Uptime monitoring configured
- [ ] Log rotation configured

**Application:**
- [ ] Build passes locally
- [ ] All environment variables set
- [ ] Health check endpoint working
- [ ] Error tracking configured
- [ ] Performance optimized (Lighthouse > 90)
- [ ] Load tested (can handle expected traffic)

**Documentation:**
- [ ] API documentation updated
- [ ] Deployment procedures documented
- [ ] Rollback procedures documented
- [ ] Emergency contacts listed
- [ ] Admin credentials documented (securely)

### Launch Day

1. **Final Backup**
```bash
pg_dump production_db > final_backup_before_launch.sql
```

2. **Deploy to Production**
```bash
vercel --prod
# or
railway up
# or
pm2 restart autolumiku
```

3. **Run Smoke Tests**
- [ ] Homepage loads
- [ ] Login works
- [ ] Create tenant works
- [ ] Upload vehicle works
- [ ] Public catalog loads
- [ ] Lead submission works
- [ ] Analytics load

4. **Monitor for 1 Hour**
- [ ] Check error logs
- [ ] Check performance metrics
- [ ] Check uptime monitor
- [ ] Check user feedback

5. **Announce Launch**
- [ ] Send announcement email
- [ ] Post on social media
- [ ] Update status page

### Post-Launch (First Week)

**Daily Tasks:**
- [ ] Check error logs
- [ ] Review performance metrics
- [ ] Monitor uptime
- [ ] Review user feedback
- [ ] Check database size
- [ ] Verify backups completed

**Weekly Tasks:**
- [ ] Security audit review
- [ ] Performance optimization
- [ ] User feedback analysis
- [ ] Feature request prioritization

---

## 11. Emergency Contacts & Escalation

### Key Personnel

**Technical Lead:**
- Name: [Your Name]
- Email: tech@autolumiku.com
- Phone: +62 xxx-xxxx-xxxx

**DevOps Engineer:**
- Name: [DevOps Name]
- Email: devops@autolumiku.com
- Phone: +62 xxx-xxxx-xxxx

**Database Administrator:**
- Name: [DBA Name]
- Email: dba@autolumiku.com
- Phone: +62 xxx-xxxx-xxxx

### Service Providers

**Hosting:** Vercel/Railway/AWS
- Support: [Provider support email]
- Account ID: [Your account ID]

**Database:** PostgreSQL/Supabase
- Support: [Database support]
- Connection: [Database dashboard URL]

**Domain Registrar:**
- Provider: [e.g., Namecheap, GoDaddy]
- Login: [Dashboard URL]

**Email Service:**
- Provider: [e.g., SendGrid, AWS SES]
- Dashboard: [Dashboard URL]

### Escalation Procedure

**Level 1: Minor Issues (< 5% users affected)**
- Response time: 1 hour
- Action: Log issue, monitor, fix in next release

**Level 2: Medium Issues (5-20% users affected)**
- Response time: 30 minutes
- Action: Investigate, hotfix if critical

**Level 3: Critical Issues (> 20% users affected or complete outage)**
- Response time: 15 minutes
- Action:
  1. Enable maintenance mode
  2. Investigate root cause
  3. Rollback if needed
  4. Fix and redeploy
  5. Post-mortem report

---

## 12. Success Metrics

### Key Performance Indicators (KPIs)

**Technical Metrics:**
- Uptime: > 99.9%
- Response time: < 500ms (p95)
- Error rate: < 0.1%
- Page load time: < 3 seconds
- API success rate: > 99%

**Business Metrics:**
- Active tenants: Track growth
- Total vehicles uploaded: Track growth
- Leads generated: Track per tenant
- User satisfaction: > 4.5/5

**Security Metrics:**
- Failed login attempts: Monitor for brute force
- API abuse attempts: Monitor rate limit hits
- Data breaches: 0 (zero tolerance)

---

## Conclusion

Mengikuti panduan ini akan memastikan deployment yang aman, stable, dan scalable untuk AutoLumiku platform.

**Timeline Estimasi:**
- **Critical tasks (Rate limiting, env vars, etc.):** 4-6 hours
- **Infrastructure setup:** 2-4 hours
- **Testing & verification:** 2-3 hours
- **Total:** 1-2 hari kerja

**Next Steps:**
1. Implement rate limiting (CRITICAL - do first)
2. Configure production environment
3. Choose hosting platform
4. Run final tests
5. Deploy to production
6. Monitor closely for first 24 hours

**Support:**
For questions or issues during deployment, refer to:
- Technical documentation: `/docs`
- API documentation: `/api/docs`
- This deployment guide: `/PRODUCTION_DEPLOYMENT.md`

**Good luck with your production launch! 🚀**

---

**Document Version:** 1.0
**Last Updated:** 2025-11-21
**Maintained By:** AutoLumiku Tech Team
