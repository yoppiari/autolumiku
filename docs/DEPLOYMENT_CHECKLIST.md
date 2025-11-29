# AutoLumiku - Production Deployment Checklist & Runbook

**Version**: 1.0
**Last Updated**: 2025-11-29
**Environment**: Coolify (cf.avolut.com) → Production (auto.lumiku.com)

---

## 🚨 PRE-DEPLOYMENT BLOCKERS (Must Fix First)

**Status**: ❌ **NOT PRODUCTION READY** - 5 CRITICAL blockers identified

### P0 - CRITICAL (Fix Before ANY Deployment)

- [ ] **1. Remove Mock Authentication** (Estimated: 1-2 days)
  - [ ] Remove mock users from `/src/app/api/v1/auth/login/route.ts`
  - [ ] Remove mock users from `/src/app/api/v1/auth/admin/login/route.ts`
  - [ ] Remove mock users from `/src/app/api/v1/auth/me/route.ts`
  - [ ] Implement proper JWT with `jsonwebtoken` library
  - [ ] Implement bcrypt password hashing
  - [ ] Move user data to database (Prisma User model)
  - [ ] Add token refresh mechanism
  - [ ] Test authentication flow end-to-end

- [ ] **2. Fix next.config.js Secret Exposure** (Estimated: 30 min)
  - [ ] Remove entire `env` block from `/next.config.js`
  - [ ] Verify server-side routes can still access process.env
  - [ ] Confirm NO secrets in browser DevTools Network tab
  - [ ] Test build: `npm run build`

- [ ] **3. Add Authentication to Admin Routes** (Estimated: 1 day)
  - [ ] Create `withAuth` middleware
  - [ ] Create `withAdminAuth` middleware
  - [ ] Add to 13 admin routes:
    - `/api/admin/tenants` (GET, POST)
    - `/api/admin/tenants/[id]` (GET, PUT, DELETE)
    - `/api/admin/tenants/sync-traefik` (POST)
    - `/api/admin/users` (GET, POST)
    - `/api/admin/analytics` (GET)
    - `/api/admin/audit` (GET)
    - `/api/admin/scraper/*` (7 routes)
  - [ ] Test unauthorized access returns 401/403

- [ ] **4. Fix PrismaClient Duplication** (Estimated: 30 min)
  - [ ] Update 7 files to use singleton:
    - `/src/lib/services/lead-service.ts`
    - `/src/lib/services/popular-vehicle-service.ts`
    - `/src/lib/services/scraper-service.ts`
    - `/src/lib/services/catalog/branding.service.ts`
    - `/src/lib/services/catalog/catalog-engine.service.ts`
    - `/src/lib/services/catalog/layout.service.ts`
    - `/src/lib/services/catalog/theme.service.ts`
  - [ ] Replace `const prisma = new PrismaClient()` with `import { prisma } from '@/lib/prisma'`
  - [ ] Test database connections don't exceed limits

- [ ] **5. Remove Default Passwords** (Estimated: 15 min)
  - [ ] Remove `:-changeme` from `docker-compose.yml` (Lines 11, 31, 54, 85)
  - [ ] Update deployment to fail if env vars not set
  - [ ] Document required secrets in deployment guide

**Total Estimated Effort**: 2-3 days
**Blocker Resolution**: Complete ALL P0 before proceeding

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### Environment Setup

#### Required Environment Variables
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `REDIS_URL` - Redis connection string
- [ ] `JWT_SECRET` - Random 64-char string (generate: `openssl rand -hex 64`)
- [ ] `JWT_REFRESH_SECRET` - Different random 64-char string
- [ ] `SESSION_SECRET` - Random 64-char string
- [ ] `ZAI_API_KEY` - z.ai API key for AI features
- [ ] `ZAI_BASE_URL` - z.ai API endpoint (default: https://open.bigmodel.cn/api/paas/v4)
- [ ] `AIMEOW_BASE_URL` - Aimeow WhatsApp service URL
- [ ] `AIMEOW_WEBHOOK_SECRET` - Secret for webhook validation
- [ ] `AIMEOW_WEBHOOK_VERIFY_TOKEN` - Token for webhook challenge

#### Optional But Recommended
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` - Email service
- [ ] `SENTRY_DSN` - Error tracking
- [ ] `LOG_LEVEL` - Set to `error` for production

#### Environment Validation Script
```bash
# Run before deployment
node -e "
const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ZAI_API_KEY'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('Missing required env vars:', missing);
  process.exit(1);
}
console.log('✅ All required env vars present');
"
```

---

### Database Preparation

- [ ] **Database Migration**
  ```bash
  npm run db:migrate
  ```

- [ ] **Database Seeding** (Optional - for demo data)
  ```bash
  npm run db:seed
  ```

- [ ] **Verify Database Connection**
  ```bash
  curl https://auto.lumiku.com/api/health
  # Should return: {"status":"ok","database":"connected"}
  ```

- [ ] **Check Database Indexes**
  - Verify indexes on: `tenantId`, `status`, `createdAt`, `email`, `slug`
  - Run EXPLAIN on slow queries

---

### Security Hardening

- [ ] **Secrets Management**
  - [ ] All secrets stored in Coolify environment variables (NOT in code)
  - [ ] No `.env` file in repository
  - [ ] No secrets in `next.config.js`
  - [ ] `.env.example` updated with all required vars

- [ ] **Authentication**
  - [ ] JWT signing implemented (not Base64)
  - [ ] Password hashing with bcrypt (min 12 rounds)
  - [ ] Token expiration configured (15m access, 7d refresh)
  - [ ] Refresh token rotation enabled

- [ ] **Rate Limiting** (If implemented)
  - [ ] Auth endpoints: 5 requests / 15 min per IP
  - [ ] API endpoints: 100 requests / min per IP
  - [ ] Admin endpoints: 50 requests / min per IP

- [ ] **CORS Configuration**
  - [ ] Dynamic CORS based on tenant domain
  - [ ] No `Access-Control-Allow-Origin: *` in production

- [ ] **Security Headers**
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `X-Frame-Options: DENY`
  - [ ] `X-XSS-Protection: 1; mode=block`
  - [ ] CSP configured appropriately

---

### Code Quality Checks

- [ ] **TypeScript Build**
  ```bash
  npm run build
  # Should complete with 0 errors
  ```

- [ ] **Linting**
  ```bash
  npm run lint
  # Should pass with no critical errors
  ```

- [ ] **Tests** (When implemented)
  ```bash
  npm test
  # Should pass all tests
  ```

- [ ] **Docker Build Test**
  ```bash
  docker compose build app
  # Should complete successfully
  ```

---

### Feature Verification

- [ ] **Health Check Endpoint**
  - [ ] `/api/health` returns 200 OK
  - [ ] Database connectivity verified
  - [ ] Response includes environment info

- [ ] **Authentication Flow**
  - [ ] Login with valid credentials works
  - [ ] Login with invalid credentials fails (401)
  - [ ] JWT token issued on successful login
  - [ ] Protected routes require valid token
  - [ ] Token expiration enforced

- [ ] **Multi-Tenancy**
  - [ ] Tenant isolation working (queries filtered by tenantId)
  - [ ] Custom domains routing correctly
  - [ ] Subdomain routing working (.autolumiku.com)

- [ ] **AI Features**
  - [ ] Vehicle AI identification working
  - [ ] Blog content generation working
  - [ ] WhatsApp AI responding correctly
  - [ ] Z.AI API key valid and working

- [ ] **File Uploads**
  - [ ] Vehicle photo upload working
  - [ ] File size limits enforced
  - [ ] File type validation working
  - [ ] Images stored in correct location

---

### Performance Checks

- [ ] **Database Connection Pooling**
  - [ ] Single PrismaClient instance used
  - [ ] Connection pool size appropriate (2-5 for small deployments)
  - [ ] No connection leaks

- [ ] **Image Optimization**
  - [ ] Sharp library working for image processing
  - [ ] Images resized appropriately
  - [ ] Thumbnails generated

- [ ] **Caching** (If implemented)
  - [ ] Redis connection working
  - [ ] Cache keys properly namespaced by tenant

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Pre-Deployment

1. **Code Freeze**
   ```bash
   git checkout main
   git pull origin main
   git log -5  # Verify latest commits
   ```

2. **Final Code Review**
   - [ ] Review recent commits since last deployment
   - [ ] Verify no debug code/console.logs in production
   - [ ] Check no TODO comments for critical features

3. **Backup Current Production** (If applicable)
   ```bash
   # Backup database
   ssh riz@cf.avolut.com 'docker exec autolumiku-postgres pg_dump -U autolumiku autolumiku_prod > backup-$(date +%Y%m%d-%H%M%S).sql'
   ```

---

### Step 2: Coolify Deployment

1. **Push to Repository**
   ```bash
   git push origin main
   ```

2. **Trigger Deployment in Coolify**
   - Access: https://cf.avolut.com
   - Navigate to AutoLumiku application
   - Click "Deploy" button
   - Monitor build logs

3. **Monitor Build Process**
   - [ ] Git pull successful
   - [ ] Dependencies installed
   - [ ] TypeScript compilation successful
   - [ ] Prisma client generated
   - [ ] Next.js build completed
   - [ ] Docker image built
   - [ ] Container started

4. **Health Check**
   ```bash
   # Wait 30 seconds for app to start
   sleep 30

   # Check health endpoint
   curl https://auto.lumiku.com/api/health

   # Expected response:
   # {"status":"ok","database":"connected","timestamp":"..."}
   ```

---

### Step 3: Post-Deployment Verification

1. **Smoke Tests**
   ```bash
   # Homepage loads
   curl -I https://auto.lumiku.com/
   # Should return: HTTP/2 200

   # API health
   curl https://auto.lumiku.com/api/health
   # Should return: {"status":"ok"...}

   # Database connection
   # (Health check already verifies this)
   ```

2. **Functional Tests**
   - [ ] Login page loads
   - [ ] Admin login works
   - [ ] Dashboard displays correctly
   - [ ] Vehicle listing loads
   - [ ] Vehicle details page works
   - [ ] Blog pages load
   - [ ] Public catalog works
   - [ ] WhatsApp AI setup accessible

3. **Error Monitoring**
   - [ ] Check logs for errors:
     ```bash
     ssh riz@cf.avolut.com 'docker logs autolumiku-app --tail 100'
     ```
   - [ ] No critical errors in last 100 lines
   - [ ] No database connection errors
   - [ ] No Prisma errors

4. **Performance Checks**
   - [ ] Homepage loads < 3 seconds
   - [ ] API responses < 1 second
   - [ ] Database queries optimized
   - [ ] No memory leaks (check `docker stats`)

---

## 🔧 ROLLBACK PROCEDURE

If deployment fails or critical issues found:

### Quick Rollback

```bash
# SSH to server
ssh riz@cf.avolut.com

# Stop current container
cd /path/to/autolumiku
docker compose down app

# Restore previous image (if tagged)
docker tag autolumiku-app:previous autolumiku-app:latest

# Restart
docker compose up -d app

# Verify
curl https://auto.lumiku.com/api/health
```

### Database Rollback (If needed)

```bash
# Restore from backup
ssh riz@cf.avolut.com
docker exec -i autolumiku-postgres psql -U autolumiku autolumiku_prod < backup-YYYYMMDD-HHMMSS.sql
```

---

## 📊 MONITORING & MAINTENANCE

### Health Monitoring

**Automated Health Checks**:
```bash
# Set up cron job for monitoring
*/5 * * * * curl -f https://auto.lumiku.com/api/health || echo "Health check failed" | mail -s "AutoLumiku Down" admin@example.com
```

**Manual Checks**:
- [ ] Daily: Check application logs
- [ ] Weekly: Review error rates
- [ ] Weekly: Check database size
- [ ] Monthly: Review performance metrics

### Log Locations

```bash
# Application logs
docker logs autolumiku-app

# Database logs
docker logs autolumiku-postgres

# Redis logs
docker logs autolumiku-redis

# Nginx/Traefik logs (Coolify manages)
docker logs traefik
```

### Common Issues & Solutions

#### Issue: App returns 503
**Solution**:
```bash
# Check container status
docker ps | grep autolumiku

# Check health endpoint
curl http://127.0.0.1:3000/api/health

# Check logs
docker logs autolumiku-app --tail 50

# Restart if needed
docker compose restart app
```

#### Issue: Database connection errors
**Solution**:
```bash
# Check database container
docker ps | grep postgres

# Check database logs
docker logs autolumiku-postgres --tail 50

# Test connection
docker exec autolumiku-postgres psql -U autolumiku -d autolumiku_prod -c "SELECT 1"

# Restart database (caution!)
docker compose restart postgres
```

#### Issue: Out of memory
**Solution**:
```bash
# Check memory usage
docker stats

# If PrismaClient duplication not fixed:
# - Multiple connection pools consuming memory
# - Fix: Apply FASE 3B recommendation

# Restart app to free memory
docker compose restart app
```

---

## 🎯 POST-DEPLOYMENT TASKS

### Immediate (Day 1)

- [ ] Monitor error logs for 24 hours
- [ ] Verify all critical features working
- [ ] Check database performance
- [ ] Monitor memory/CPU usage
- [ ] Test from different devices/browsers

### Short-term (Week 1)

- [ ] Implement rate limiting (if not done)
- [ ] Add input validation library (Zod)
- [ ] Fix PrismaClient duplication (if not done)
- [ ] Set up error tracking (Sentry)
- [ ] Configure backup automation

### Medium-term (Month 1)

- [ ] Write tests for critical paths
- [ ] Implement proper error handling
- [ ] Refactor code duplication
- [ ] Add monitoring dashboard
- [ ] Set up CI/CD pipeline

---

## 📚 REFERENCE DOCUMENTATION

### Internal Docs
- **Lessons Learned**: `/docs/LESSONS_LEARNED.md`
- **BMAD Workflows**: `/.claude/commands/bmad/bmm/workflows/`
- **Architecture Docs**: `/.claude/commands/bmad/bmm/workflows/architecture.md`

### External Resources
- **Coolify Docs**: https://coolify.io/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Prisma Best Practices**: https://www.prisma.io/docs/guides/performance-and-optimization
- **Docker Compose**: https://docs.docker.com/compose/

### Emergency Contacts
- **Developer**: [Your contact info]
- **Server Admin**: riz@cf.avolut.com
- **Domain Registrar**: [Domain provider]

---

## ✅ FINAL PRE-DEPLOYMENT CHECKLIST

Print this checklist and check each item before deploying:

### Critical Security (ALL must be YES)
- [ ] Mock authentication removed?
- [ ] Real JWT implemented with signing?
- [ ] Secrets removed from next.config.js?
- [ ] Admin routes protected with auth?
- [ ] Default passwords removed from docker-compose?
- [ ] All secrets in Coolify environment (not code)?
- [ ] Database password strong (not 'changeme')?
- [ ] JWT_SECRET is random 64+ characters?

### Code Quality (ALL must be YES)
- [ ] `npm run build` succeeds with 0 errors?
- [ ] `npm run lint` passes?
- [ ] PrismaClient singleton used (not duplicated)?
- [ ] All environment variables documented?
- [ ] No hardcoded credentials in code?
- [ ] No console.log in production code?

### Infrastructure (ALL must be YES)
- [ ] DATABASE_URL configured in Coolify?
- [ ] REDIS_URL configured in Coolify?
- [ ] All required env vars set in Coolify?
- [ ] Health check endpoint working?
- [ ] Docker compose build succeeds?
- [ ] Backup procedure tested?

### Testing (ALL must be YES)
- [ ] Login/logout works locally?
- [ ] Admin panel accessible locally?
- [ ] API endpoints respond correctly?
- [ ] Database migrations run successfully?
- [ ] File uploads working locally?

**If ALL boxes checked**: ✅ Ready to deploy
**If ANY box unchecked**: ❌ Fix issues before deploying

---

## 📞 SUPPORT & TROUBLESHOOTING

### Quick Diagnostic Commands

```bash
# Full system status
ssh riz@cf.avolut.com << 'EOF'
  echo "=== Docker Status ==="
  docker ps | grep autolumiku

  echo -e "\n=== App Health ==="
  curl -s http://127.0.0.1:3000/api/health | jq

  echo -e "\n=== Memory Usage ==="
  docker stats --no-stream | grep autolumiku

  echo -e "\n=== Recent Logs ==="
  docker logs autolumiku-app --tail 20
EOF
```

### Performance Baseline

**Expected Performance**:
- Homepage: < 2 seconds
- API health check: < 100ms
- Database queries: < 500ms average
- Memory usage: < 512MB per container
- CPU usage: < 50% average

**If performance degraded**:
1. Check database connection pool (should be 1, not 8)
2. Check for memory leaks in logs
3. Review slow query logs
4. Check Redis connection

---

**Checklist Version**: 1.0
**Last Updated**: 2025-11-29
**Next Review**: After first production deployment

---

**Generated with** [Claude Code](https://claude.com/claude-code)
