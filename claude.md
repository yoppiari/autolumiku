# AutoLumiKu - Claude AI Agent Context

**Version**: 1.0
**Last Updated**: 2025-12-11
**Purpose**: Essential context for AI agents working on this project

---

## 🚨 CRITICAL DEPLOYMENT RULES

### ⛔ DEPLOYMENT POLICY - MUST FOLLOW

**ALL deployments MUST be done ONLY via Coolify (cf.avolut.com)**

- ❌ **NEVER** do manual SSH deployments to production
- ❌ **NEVER** run `docker compose` commands manually on production server
- ❌ **NEVER** deploy via `/root/autolumiku-manual` or similar manual directories
- ✅ **ONLY** deploy through Coolify web interface at https://cf.avolut.com

**Source**: `docs/DEPLOYMENT_CHECKLIST.md:261-272`

**Rationale**:
- Coolify provides automated rollback capabilities
- Ensures consistent deployment process
- Maintains deployment audit trail
- Prevents configuration drift
- Manages environment variables securely

**Exception**: Local development and testing only

---

## 🔒 PRODUCTION READINESS STATUS

### Current Status: ❌ NOT PRODUCTION READY (Score: 56/100)

**Source**: `docs/LESSONS_LEARNED.md`

### P0 CRITICAL BLOCKERS (Must Fix Before ANY Production Deployment)

**Estimated Effort**: 2-3 days

1. **Remove Mock Authentication** (1-2 days)
   - Files: `src/app/api/v1/auth/login/route.ts`, `src/app/api/v1/auth/admin/login/route.ts`, `src/app/api/v1/auth/me/route.ts`
   - Issue: Mock users hardcoded in authentication routes
   - Fix: Implement proper JWT with `jsonwebtoken` library, bcrypt password hashing, database-backed user authentication

2. **Fix Secret Exposure in next.config.js** (30 minutes)
   - File: `next.config.js`
   - Issue: Secrets exposed to browser via `env` block
   - Fix: Remove entire `env` block, use `process.env` server-side only, verify no secrets in browser DevTools

3. **Add Authentication to Admin Routes** (1 day)
   - Files: 13 admin routes in `/api/admin/*`
   - Issue: NO authentication on admin endpoints (anyone can access)
   - Fix: Create `withAuth` and `withAdminAuth` middleware, protect all admin routes

4. **Fix PrismaClient Duplication** (30 minutes)
   - Files: 7 service files creating own PrismaClient instances
   - Issue: Connection pool explosion, memory leaks
   - Fix: Use singleton pattern from `src/lib/prisma.ts` everywhere

5. **Remove Default Passwords** (15 minutes)
   - File: `docker-compose.yml`
   - Issue: Default password `changeme` in multiple places
   - Fix: Require environment variables, fail deployment if not set

**DO NOT DEPLOY TO PRODUCTION** until all P0 blockers are resolved.

---

## 📋 PROJECT ARCHITECTURE SUMMARY

### System Design

**Multi-Tenant Architecture** - Dual-domain routing:

1. **Platform Domain**: `auto.lumiku.com/catalog/[slug]`
   - Example: `auto.lumiku.com/catalog/primamobil-id`
   - Default public access

2. **Custom Domains**: `[domain]/`
   - Example: `primamobil.id/` → rewrites to `/catalog/primamobil-id`
   - Clean URLs for SEO
   - Middleware handles rewriting (no redirects)

**Key Implementation**: `src/middleware.ts:86-116`

### Technology Stack

- **Framework**: Next.js 14.2.33 (App Router, standalone output)
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Auth**: JWT (currently Base64 - needs proper signing!)
- **Deployment**: Docker Compose (via Coolify)
- **AI**: Z.AI integration for vehicle processing, WhatsApp bot

### Novel Patterns Implemented

1. **Multi-tenant theme switching** - Dynamic theming per tenant
2. **AI-powered vehicle processing pipeline** - Automated vehicle data extraction
3. **Natural language command processing** - WhatsApp bot with LLM
4. **Real-time multi-tenant synchronization** - Cross-tenant data consistency

**Source**: `docs/architecture.md`

---

## 🐛 KNOWN CRITICAL ISSUES

### Security Issues (HIGH PRIORITY)

1. **JWT Not Properly Signed**
   - Current: Using Base64 encoding
   - Required: Proper JWT signing with `jsonwebtoken` library
   - Impact: Anyone can forge authentication tokens

2. **No Input Validation**
   - No Zod/Joi schemas
   - Direct database insertion without sanitization
   - Risk: SQL injection, XSS, data corruption

3. **No Rate Limiting**
   - All endpoints unprotected
   - Risk: DDoS, brute force attacks

### Code Quality Issues (MEDIUM PRIORITY)

1. **Code Duplication: 23%** (9,735 lines savable)
   - 18 files with duplicated CRUD routes
   - 92+ instances of hardcoded error handling

2. **PrismaClient Instantiated 27 Times**
   - Should use singleton pattern
   - Causes connection pool exhaustion
   - Memory leaks

3. **Inconsistent Error Handling**
   - No standardized error response format
   - Missing Prisma error handling
   - Generic error messages leak implementation details

**Source**: `docs/LESSONS_LEARNED.md`

---

## 🎯 CODING STANDARDS

### DO ✅

```typescript
// 1. Use Prisma singleton
import { prisma } from '@/lib/prisma';

// 2. Proper error handling
try {
  const result = await prisma.vehicle.findUnique({ where: { id } });
  if (!result) {
    return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
  }
  return NextResponse.json(result);
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle Prisma-specific errors
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

// 3. Use environment variables
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET not configured');

// 4. Input validation
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
const validated = schema.parse(body);
```

### DON'T ❌

```typescript
// 1. DON'T create PrismaClient instances
const prisma = new PrismaClient(); // ❌ WRONG

// 2. DON'T use generic error handling
catch (error) {
  console.error(error); // ❌ WRONG - logs too much detail
  return NextResponse.json({ error: error.message }); // ❌ WRONG - leaks internals
}

// 3. DON'T hardcode secrets
const secret = 'my-secret-key'; // ❌ WRONG

// 4. DON'T skip validation
const user = await prisma.user.create({ data: body }); // ❌ WRONG - no validation
```

**Source**: `docs/LESSONS_LEARNED.md#best-practices`

---

## 📊 CODE METRICS

- **Total Lines**: 42,000+ TypeScript
- **Files**: 200+
- **TypeScript Compliance**: 8.5/10
- **Code Duplication**: 23% (9,735 lines)
- **Prisma Schema Quality**: 100/100
- **Circular Dependencies**: 0

**Identified Issues**:
- **P0 Critical**: 5 issues (2-3 days to fix)
- **P1 High Priority**: 23 issues (1 week to fix)
- **P2 Medium Priority**: 45+ issues (2-3 weeks to fix)

**Source**: `docs/LESSONS_LEARNED.md`

---

## 🔧 ENVIRONMENT VARIABLES

### Required for Production

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/db

# Redis
REDIS_URL=redis://host:6379

# Authentication
JWT_SECRET=<64-char random string>  # Generate: openssl rand -hex 64
JWT_REFRESH_SECRET=<64-char random string>
SESSION_SECRET=<64-char random string>

# AI Integration
ZAI_API_KEY=<z.ai API key>
ZAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# WhatsApp Integration
AIMEOW_BASE_URL=<aimeow service URL>
AIMEOW_WEBHOOK_SECRET=<webhook secret>
AIMEOW_WEBHOOK_VERIFY_TOKEN=<verification token>
```

### ⚠️ Security Rules

1. **NEVER** put secrets in code or `next.config.js`
2. **ALWAYS** use Coolify environment variables (not `.env` files in repo)
3. **NEVER** commit `.env` files (already in `.gitignore`)
4. **ALWAYS** use `NEXT_PUBLIC_` prefix for client-side env vars
5. **NEVER** expose sensitive keys to browser

**Source**: `docs/DEPLOYMENT_CHECKLIST.md:70-81`

---

## 🚀 DEPLOYMENT WORKFLOW

### Pre-Deployment Checklist

**BEFORE deploying, verify**:

1. ✅ All P0 blockers fixed (see above)
2. ✅ `npm run build` succeeds with 0 errors
3. ✅ `npm run lint` passes
4. ✅ Environment variables configured in Coolify
5. ✅ Database migrations ready: `npm run db:migrate`
6. ✅ Backup current production database

### Deployment Steps (Via Coolify ONLY)

1. **Code Freeze**: `git checkout main && git pull origin main`
2. **Push to Repository**: `git push origin main`
3. **Trigger Coolify Deployment**:
   - Access: https://cf.avolut.com
   - Navigate to AutoLumiku application
   - Click "Deploy" button
   - Monitor build logs
4. **Health Check**: `curl https://auto.lumiku.com/api/health`
5. **Smoke Tests**: Verify login, dashboard, catalog, API endpoints

### Rollback Procedure (If Deployment Fails)

```bash
# SSH to server (emergency only)
ssh riz@cf.avolut.com

# Stop current container
cd /path/to/coolify-managed-autolumiku
docker compose down app

# Restore previous image
docker tag autolumiku-app:previous autolumiku-app:latest

# Restart
docker compose up -d app

# Verify
curl https://auto.lumiku.com/api/health
```

**Better**: Use Coolify's built-in rollback feature in web interface

**Source**: `docs/DEPLOYMENT_CHECKLIST.md:238-363`

---

## 🐛 RECENT FIXES (Dec 11, 2025)

### Fix: HTML Caching Causing Chunk Loading Failures

**Problem**:
- Browser caching HTML with old chunk hashes
- After rebuild, browser requests `page-9499b8e5bd1214e0.js` (old)
- New build has `page-987ae7a0216d1952.js` (new hash)
- Result: ChunkLoadError → Application error

**Solution**: Added cache-control headers to middleware

```typescript
// src/middleware.ts:110-114
rewriteResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
rewriteResponse.headers.set('Pragma', 'no-cache');
rewriteResponse.headers.set('Expires', '0');
```

**Commit**: 0145086 - "fix: add cache-control headers to prevent HTML caching"

**Testing**: 20x refresh test on primamobil.id → 100% success rate

**Impact**:
- ✅ Resolved refresh instability issues
- ✅ Prevents stale chunk loading errors
- ✅ Ensures browser always fetches fresh HTML

---

## 📚 DOCUMENTATION STRUCTURE

**Primary Documentation**: `/docs/` directory

```
docs/
├── README.md                     # Master index (START HERE)
├── DEPLOYMENT_CHECKLIST.md      # Pre-deployment requirements (CRITICAL)
├── LESSONS_LEARNED.md            # Code review findings (CRITICAL)
├── architecture.md               # System architecture (61K - comprehensive)
├── deployment-guide.md           # Deployment guide
├── deployment/
│   ├── DOCKER_DEPLOYMENT.md     # Docker reference
│   └── DOCKER_QUICKSTART.md     # Quick Docker setup
├── features/
│   └── PHOTO-UPLOAD-FEATURE.md  # Feature specs
└── archive/
    └── (historical docs)
```

**Recently Consolidated** (Dec 11, 2025):
- Merged outdated `/doc/` directory into `/docs/`
- Created organized subdirectories (deployment/, features/, archive/)
- Added master README.md with quick links

**Source**: Git commit d2a8f93

---

## 🎯 PRIORITIZED IMPLEMENTATION ROADMAP

### Week 1: Security Hardening (P0 Blockers)
1. Remove mock authentication (2 days)
2. Fix secret exposure in next.config.js (1 hour)
3. Add authentication to admin routes (1 day)
4. Fix PrismaClient duplication (1 hour)
5. Remove default passwords (30 min)

**Outcome**: Production-ready security baseline

### Week 2: Code Quality (P1 High Priority)
1. Implement input validation (Zod) (2 days)
2. Standardize error handling (2 days)
3. Add rate limiting (1 day)

**Outcome**: Robust error handling and validation

### Week 3: Technical Debt (P2 Medium Priority)
1. Refactor duplicated CRUD routes (2 days)
2. Extract hardcoded error handling (2 days)
3. Implement configuration hierarchy (1 day)

**Outcome**: Reduced code duplication by 23%

### Week 4: Testing & Monitoring
1. Write tests for critical paths (2 days)
2. Set up error tracking (Sentry) (1 day)
3. Implement monitoring dashboard (2 days)

**Outcome**: Production monitoring and observability

**Total Estimated Effort**: 4 weeks

**Source**: `docs/LESSONS_LEARNED.md#recommended-implementation-order`

---

## 🔍 TROUBLESHOOTING QUICK REFERENCE

### Application Returns 503

```bash
# Check container status
docker ps | grep autolumiku

# Check health endpoint
curl http://127.0.0.1:3000/api/health

# Check logs
docker logs autolumiku-app --tail 50

# Restart via Coolify web interface (preferred)
# Or emergency: docker compose restart app
```

### Database Connection Errors

```bash
# Check database container
docker ps | grep postgres

# Test connection
docker exec autolumiku-postgres psql -U autolumiku -d autolumiku_prod -c "SELECT 1"

# Check connection pool (should be ~5-10, not 27)
# If high: PrismaClient duplication issue not fixed
```

### Chunk Loading Errors (ChunkLoadError)

**Symptoms**: "Application error: a client-side exception has occurred"

**Cause**: Stale HTML cache with old chunk hashes

**Solution**: Already fixed in commit 0145086 (cache-control headers)

**Verification**: Hard refresh (Ctrl+Shift+R) should always load latest chunks

**Source**: Recent debugging session (Dec 11, 2025)

---

## 📞 EMERGENCY CONTACTS & RESOURCES

### Server Access
- **Production Server**: root@cf.avolut.com (SSH)
- **Coolify Dashboard**: https://cf.avolut.com
- **Production URL**: https://auto.lumiku.com
- **Custom Domain**: https://primamobil.id

### Key Repositories
- **Main Repo**: (Git remote origin)
- **Documentation**: `/docs/` directory in repo

### External Dependencies
- **Z.AI API**: https://open.bigmodel.cn/api/paas/v4
- **Aimeow WhatsApp Service**: (configured via env vars)

---

## ⚠️ WARNINGS FOR AI AGENTS

### DO NOT

1. ❌ Suggest manual deployments to production
2. ❌ Recommend exposing secrets in next.config.js
3. ❌ Create new PrismaClient instances
4. ❌ Skip input validation
5. ❌ Use Base64 for JWT (must use proper signing)
6. ❌ Deploy without fixing P0 blockers
7. ❌ Run Docker commands on production server manually

### ALWAYS

1. ✅ Check `docs/DEPLOYMENT_CHECKLIST.md` before suggesting deployment
2. ✅ Reference `docs/LESSONS_LEARNED.md` for code quality issues
3. ✅ Use Prisma singleton from `src/lib/prisma.ts`
4. ✅ Validate all user input with Zod
5. ✅ Handle Prisma errors explicitly
6. ✅ Use environment variables for secrets
7. ✅ Deploy ONLY via Coolify

---

## 📝 CHANGELOG

### 2025-12-11
- Added cache-control headers to fix HTML caching issues (commit 0145086)
- Consolidated `/doc/` into `/docs/` directory (commit d2a8f93)
- Created this `claude.md` file with deployment rules and lessons learned
- Stopped manual deployment at `/root/autolumiku-manual` (violated Coolify-only rule)

### Key Lessons Learned
1. **Deployment must be via Coolify ONLY** - Manual deployments violate project policy
2. **HTML caching causes chunk loading failures** - Solved with cache-control headers
3. **Database connection pool was NOT the issue** - Red herring in debugging
4. **Browser cache is powerful** - Must use proper cache headers for HTML

---

**Generated with [Claude Code](https://claude.com/claude-code)**
**Last Updated**: 2025-12-11 by Claude Sonnet 4.5
