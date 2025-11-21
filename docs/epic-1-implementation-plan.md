# Epic 1: Multi-Tenant Foundation - Implementation Plan

**Date**: November 20, 2025
**Status**: 🎯 **READY TO IMPLEMENT**
**Priority**: P0 - Foundation (Must Complete Before Other Epics)

---

## Executive Summary

Epic 1 establishes the production-ready multi-tenant foundation. The good news: **Database schema is 100% complete**! Our task is to build the UI, services, and APIs on top of this solid foundation.

### What We Have ✅
- ✅ Complete Prisma schema (778 lines)
- ✅ 21 models covering all Epic 1 requirements
- ✅ Multi-tenant data isolation in schema
- ✅ RBAC (Role, Permission, RolePermission)
- ✅ Subscription & Billing models
- ✅ Security & Audit models
- ✅ Health monitoring models
- ✅ Session management models

### What We Need to Build 🔨
- 🔨 Admin dashboard UI
- 🔨 Onboarding wizard
- 🔨 Team management interfaces
- 🔨 API endpoints (25+ routes)
- 🔨 Middleware (auth, tenant context, RBAC)
- 🔨 Services (auth, subscription, audit)

---

## Implementation Strategy

### Approach: 3 Parallel Streams (Like Epic 3 & 7)

**Stream A: Core Services & Middleware** (Foundation)
- Authentication service
- RBAC middleware
- Tenant context middleware
- Audit logging service
- Session management

**Stream B: Admin Dashboard** (Platform Admin)
- Tenant CRUD
- Platform health monitoring
- Global settings management
- Security alerts dashboard

**Stream C: Tenant Features** (Showroom Admin)
- Onboarding wizard
- Team management
- Billing dashboard
- Branding configuration
- Audit log viewer

**Estimated Timeline**: 3-4 days for full Epic 1

---

## Story Breakdown & Implementation Order

### Phase 1: Foundation Layer (Stories 1.7, 1.8, 1.9, 1.12)
**Priority**: P0 - Required for everything else
**Estimated**: 1 day

#### Story 1.7: User Account Creation & Authentication
**Coverage**: FR11
**What to Build**:
- [ ] `/src/services/auth-service.ts` - Authentication service
  - register(), login(), logout()
  - verifyEmail(), sendPasswordReset(), resetPassword()
  - generateTokens(), validateToken()
- [ ] `/src/middleware/auth.ts` - Auth middleware
  - requireAuth(), optionalAuth()
  - validateSession(), refreshToken()
- [ ] `/src/app/api/v1/auth/register/route.ts` - Registration API
- [ ] `/src/app/api/v1/auth/login/route.ts` - Login API
- [ ] `/src/app/api/v1/auth/logout/route.ts` - Logout API
- [ ] `/src/app/api/v1/auth/verify-email/route.ts` - Email verification
- [ ] `/src/app/api/v1/auth/forgot-password/route.ts` - Password reset request
- [ ] `/src/app/api/v1/auth/reset-password/route.ts` - Password reset confirm

**Dependencies**: bcryptjs for password hashing, jsonwebtoken for JWTs

---

#### Story 1.8: Role-Based Access Control
**Coverage**: FR12
**What to Build**:
- [ ] `/src/services/rbac-service.ts` - RBAC service
  - checkPermission(userId, resource, action)
  - getUserRoles(userId)
  - getUserPermissions(userId)
  - assignRole(userId, roleId)
- [ ] `/src/middleware/rbac.ts` - Permission middleware
  - requirePermission(resource, action)
  - requireRole(roleName)
- [ ] `/src/lib/rbac/permissions.ts` - Permission definitions
  - PERMISSIONS constant with all permissions
- [ ] `/src/lib/rbac/roles.ts` - Role definitions
  - DEFAULT_ROLES constant (root_admin, showroom_admin, sales, read_only)
- [ ] `/src/app/api/v1/admin/roles/route.ts` - Role management API

**Default Roles to Seed**:
```typescript
- root_admin: All platform permissions
- showroom_admin: Full showroom management
- sales_person: Inventory + customer management
- read_only: View-only access
```

---

#### Story 1.9: Secure Session Management
**Coverage**: FR13
**What to Build**:
- [ ] `/src/services/session-service.ts` - Session service
  - createSession(userId, deviceInfo)
  - validateSession(accessToken)
  - refreshSession(refreshToken)
  - revokeSession(sessionId)
  - getActiveSessions(userId)
- [ ] `/src/middleware/session.ts` - Session middleware
  - trackActivity(), detectSuspiciousActivity()
- [ ] `/src/app/api/v1/sessions/route.ts` - Session management API
- [ ] `/src/app/api/v1/sessions/[id]/revoke/route.ts` - Revoke session

**Security Features**:
- Session timeout after 30 days inactive
- Track device, IP, location
- Max 5 failed login attempts → lock for 30 minutes
- Suspicious activity alerts

---

#### Story 1.12: Complete Tenant Data Isolation
**Coverage**: FR5
**What to Build**:
- [ ] `/src/middleware/tenant-context.ts` - Tenant isolation middleware
  - extractTenantId() from subdomain/domain
  - injectTenantContext() into all queries
  - validateTenantAccess()
- [ ] `/src/lib/tenant-prisma.ts` - Tenant-scoped Prisma client
  - withTenant(tenantId) wrapper
  - Automatic WHERE tenantId filter
- [ ] `/src/hooks/useTenant.ts` - React hook for tenant context

**Isolation Strategy**:
```typescript
// Every Prisma query auto-includes tenantId
prisma.vehicle.findMany({
  where: { tenantId: getCurrentTenantId(), ...otherFilters }
})
```

---

### Phase 2: Admin Dashboard (Stories 1.1, 1.2, 1.3, 1.11)
**Priority**: P1 - Platform management
**Estimated**: 1 day

#### Story 1.1: Platform Admin Tenant Creation
**Coverage**: FR1, FR5
**What to Build**:
- [ ] `/src/app/admin/tenants/page.tsx` - Tenant list page
- [ ] `/src/app/admin/tenants/new/page.tsx` - Create tenant form
- [ ] `/src/app/admin/tenants/[id]/page.tsx` - Tenant detail page
- [ ] `/src/components/admin/TenantForm.tsx` - Tenant creation form
- [ ] `/src/components/admin/TenantList.tsx` - Tenant list with filters
- [ ] `/src/app/api/v1/admin/tenants/route.ts` - Tenant CRUD API
- [ ] `/src/app/api/v1/admin/tenants/[id]/route.ts` - Single tenant API
- [ ] `/src/services/tenant-service.ts` - Tenant management service

**Features**:
- Create tenant with name, slug, domain
- Auto-generate unique subdomain
- Set status (active, suspended, canceled)
- View all tenants with filters
- Edit tenant configuration

---

#### Story 1.2: Tenant Branding Configuration
**Coverage**: FR2
**What to Build**:
- [ ] `/src/app/admin/tenants/[id]/branding/page.tsx` - Branding page
- [ ] `/src/components/admin/BrandingForm.tsx` - Branding configuration
- [ ] `/src/app/api/v1/admin/tenants/[id]/branding/route.ts` - Branding API
- [ ] `/src/app/api/v1/admin/tenants/[id]/logo/route.ts` - Logo upload
- [ ] `/src/services/r2-storage-service.ts` - R2 upload service (reuse from Epic 2)

**Features**:
- Upload logo to Cloudflare R2
- Color picker for primary/secondary colors
- Theme selection (light/dark/auto)
- Preview branding
- Save branding configuration

---

#### Story 1.3: Platform Health Monitoring
**Coverage**: FR3, FR4
**What to Build**:
- [ ] `/src/app/admin/health/page.tsx` - Health dashboard
- [ ] `/src/components/admin/HealthMetrics.tsx` - Metrics display
- [ ] `/src/components/admin/SystemStatus.tsx` - System status cards
- [ ] `/src/app/api/v1/admin/health/route.ts` - Health check API
- [ ] `/src/app/api/v1/admin/metrics/route.ts` - Metrics API
- [ ] `/src/services/health-check-service.ts` - Health monitoring service

**Metrics to Monitor**:
- Database connectivity (response time)
- Active tenants count
- API response times
- Error rates
- Memory/CPU usage
- Disk space

**Health Checks**:
```typescript
- Database: SELECT 1 (< 100ms = healthy)
- Redis: PING (if using Redis)
- R2 Storage: HEAD request
- API: Self-ping
```

---

#### Story 1.11: Global Platform Settings Management
**Coverage**: FR4
**What to Build**:
- [ ] `/src/app/admin/settings/page.tsx` - Settings dashboard
- [ ] `/src/components/admin/SettingEditor.tsx` - Setting editor component
- [ ] `/src/app/api/v1/admin/settings/route.ts` - Settings CRUD API
- [ ] `/src/app/api/v1/admin/settings/[key]/route.ts` - Single setting API
- [ ] `/src/services/settings-service.ts` - Settings management service

**Global Settings Categories**:
```typescript
{
  platform: {
    maintenance_mode: boolean,
    maintenance_message: string,
    max_tenants: number,
    default_trial_days: number
  },
  billing: {
    base_price_per_month: number,
    tax_rate: number,
    currency: "IDR"
  },
  security: {
    session_timeout_days: number,
    max_login_attempts: number,
    lockout_duration_minutes: number
  },
  indonesian_regional: {
    supported_provinces: string[],
    supported_cities: string[]
  }
}
```

---

### Phase 3: Tenant Features (Stories 1.4, 1.5, 1.6, 1.10)
**Priority**: P2 - Showroom functionality
**Estimated**: 1.5 days

#### Story 1.4: Guided Tenant Onboarding
**Coverage**: FR6
**What to Build**:
- [ ] `/src/app/onboarding/page.tsx` - Onboarding wizard
- [ ] `/src/components/onboarding/WizardStep.tsx` - Step wrapper
- [ ] `/src/components/onboarding/steps/BusinessInfo.tsx` - Step 1
- [ ] `/src/components/onboarding/steps/BrandingSetup.tsx` - Step 2
- [ ] `/src/components/onboarding/steps/TeamInvite.tsx` - Step 3
- [ ] `/src/components/onboarding/steps/BillingSetup.tsx` - Step 4
- [ ] `/src/components/onboarding/steps/Complete.tsx` - Step 5
- [ ] `/src/app/api/v1/onboarding/status/route.ts` - Onboarding status
- [ ] `/src/app/api/v1/onboarding/complete/route.ts` - Mark complete

**Wizard Steps**:
1. **Business Information**: Name, address, phone, NPWP
2. **Branding**: Logo, colors, theme
3. **Team Setup**: Invite first team members
4. **Billing**: Subscription plan selection
5. **Complete**: Welcome message + dashboard tour

---

#### Story 1.5: Showroom Team Management
**Coverage**: FR9
**What to Build**:
- [ ] `/src/app/team/members/page.tsx` - Team members list
- [ ] `/src/app/team/members/invite/page.tsx` - Invite member form
- [ ] `/src/components/team/MemberList.tsx` - Member list with actions
- [ ] `/src/components/team/InviteForm.tsx` - Invitation form
- [ ] `/src/components/team/RoleSelector.tsx` - Role selection component
- [ ] `/src/app/api/v1/team/members/route.ts` - Team members API
- [ ] `/src/app/api/v1/team/invitations/route.ts` - Invitation API
- [ ] `/src/app/api/v1/team/invitations/accept/route.ts` - Accept invitation
- [ ] `/src/services/team-service.ts` - Team management service
- [ ] `/src/services/email-service.ts` - Email sending service

**Features**:
- Send email invitations with unique token
- Set role during invitation
- View pending/active/suspended members
- Resend invitation
- Remove team member
- Change member role

**Email Templates**:
- Team invitation email (Indonesian + English)
- Welcome email after accepting

---

#### Story 1.6: Subscription & Billing Access
**Coverage**: FR10
**What to Build**:
- [ ] `/src/app/team/billing/page.tsx` - Billing dashboard
- [ ] `/src/components/billing/SubscriptionCard.tsx` - Subscription status
- [ ] `/src/components/billing/InvoiceList.tsx` - Invoice history
- [ ] `/src/components/billing/PaymentHistory.tsx` - Payment records
- [ ] `/src/components/billing/PlanSelector.tsx` - Plan upgrade/downgrade
- [ ] `/src/app/api/v1/billing/subscription/route.ts` - Subscription API
- [ ] `/src/app/api/v1/billing/invoices/route.ts` - Invoices API
- [ ] `/src/app/api/v1/billing/invoices/[id]/download/route.ts` - Invoice PDF
- [ ] `/src/app/api/v1/billing/payments/route.ts` - Payments API
- [ ] `/src/services/billing-service.ts` - Billing service
- [ ] `/src/services/invoice-generator.ts` - PDF invoice generator

**Features**:
- View current subscription status
- See trial days remaining
- View invoice history
- Download invoices as PDF
- Payment history
- Upgrade/downgrade plan
- Update payment method

**Subscription Plans**:
```typescript
{
  basic: {
    name: "Basic",
    price: 299000, // Rp 299k/month
    features: ["Up to 50 vehicles", "1 showroom location"]
  },
  professional: {
    name: "Professional",
    price: 599000, // Rp 599k/month
    features: ["Up to 200 vehicles", "3 showroom locations", "Analytics"]
  },
  enterprise: {
    name: "Enterprise",
    price: 1499000, // Rp 1.499jt/month
    features: ["Unlimited vehicles", "Unlimited locations", "Priority support"]
  }
}
```

---

#### Story 1.10: Audit Logging for Compliance
**Coverage**: FR15
**What to Build**:
- [ ] `/src/app/team/audit/page.tsx` - Audit log viewer
- [ ] `/src/components/audit/AuditLogTable.tsx` - Log table with filters
- [ ] `/src/components/audit/AuditLogDetail.tsx` - Detailed log view
- [ ] `/src/components/audit/AuditExport.tsx` - Export functionality
- [ ] `/src/app/api/v1/audit/logs/route.ts` - Audit logs API
- [ ] `/src/app/api/v1/audit/logs/export/route.ts` - Export audit logs
- [ ] `/src/services/audit-service.ts` - Audit logging service
- [ ] `/src/middleware/audit.ts` - Auto-audit middleware

**Features**:
- View all audit logs for tenant
- Filter by user, action, resource type, date range
- Search logs by keyword
- Export logs to CSV/JSON
- View before/after values for changes
- Compliance-ready formatting

**Auto-Logged Actions**:
- All CREATE, UPDATE, DELETE operations
- LOGIN, LOGOUT events
- Permission changes
- Setting modifications
- Security events

---

## Technical Architecture

### Middleware Stack
```typescript
// Request flow:
Request
  → extractTenantContext (get tenantId from domain)
  → requireAuth (validate session)
  → requirePermission (check RBAC)
  → auditLog (log action)
  → Route Handler
  → Response
```

### Service Layer Structure
```
/src/services/
  auth-service.ts        - Authentication
  session-service.ts     - Session management
  rbac-service.ts        - Role & permissions
  tenant-service.ts      - Tenant CRUD
  team-service.ts        - Team management
  billing-service.ts     - Subscription & billing
  audit-service.ts       - Audit logging
  email-service.ts       - Email sending
  health-check-service.ts - Platform monitoring
  settings-service.ts    - Global settings
```

### API Routes Structure
```
/src/app/api/v1/
  auth/
    register/route.ts
    login/route.ts
    logout/route.ts
    verify-email/route.ts
    forgot-password/route.ts
    reset-password/route.ts

  admin/
    tenants/
      route.ts              # GET list, POST create
      [id]/route.ts         # GET, PATCH, DELETE
      [id]/branding/route.ts
      [id]/logo/route.ts
    health/route.ts
    metrics/route.ts
    settings/route.ts
    roles/route.ts

  team/
    members/route.ts
    invitations/route.ts
    invitations/accept/route.ts

  billing/
    subscription/route.ts
    invoices/route.ts
    invoices/[id]/download/route.ts
    payments/route.ts

  sessions/
    route.ts              # GET list
    [id]/revoke/route.ts  # POST revoke

  audit/
    logs/route.ts
    logs/export/route.ts
```

---

## Dependencies

### New Packages Needed
```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3",              // Password hashing
    "jsonwebtoken": "^9.0.2",          // JWT tokens
    "nodemailer": "^6.9.8",            // Email sending
    "pdfkit": "^0.14.0",               // PDF generation (invoices)
    "date-fns": "^3.0.6",              // Date utilities
    "zod": "^3.22.4"                   // Validation (already have?)
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/nodemailer": "^6.4.14",
    "@types/pdfkit": "^0.13.4"
  }
}
```

### Environment Variables
```env
# JWT Secrets
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-refresh-secret-key"
JWT_EXPIRY="30d"
JWT_REFRESH_EXPIRY="90d"

# Email (using Gmail SMTP for development)
EMAIL_FROM="noreply@autolumiku.com"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-specific-password"

# Session
SESSION_TIMEOUT_DAYS="30"
MAX_LOGIN_ATTEMPTS="5"
LOCKOUT_DURATION_MINUTES="30"

# Platform
PLATFORM_NAME="AutoLumiKu"
PLATFORM_URL="https://autolumiku.com"
DEFAULT_TRIAL_DAYS="14"

# R2 Storage (already configured from Epic 2)
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="autolumiku-assets"
```

---

## Testing Strategy

### Unit Tests
- [ ] Test auth service (login, register, password reset)
- [ ] Test RBAC service (permission checking)
- [ ] Test tenant isolation
- [ ] Test session management
- [ ] Test audit logging

### Integration Tests
- [ ] Test complete registration flow
- [ ] Test tenant creation + onboarding
- [ ] Test team invitation flow
- [ ] Test subscription + billing
- [ ] Test permission enforcement

### E2E Tests (Manual)
- [ ] Create root admin account
- [ ] Create first tenant as admin
- [ ] Complete onboarding wizard
- [ ] Invite team member
- [ ] Team member accepts + logs in
- [ ] Verify RBAC permissions
- [ ] Check audit logs

---

## Database Seeding

### Seed Data Required
```typescript
// /prisma/seed.ts

1. Create Root Admin User
   - email: admin@autolumiku.com
   - role: root_admin
   - All permissions

2. Create Default Roles
   - root_admin: Full platform access
   - showroom_admin: Showroom management
   - sales_person: Sales operations
   - read_only: View access

3. Create Default Permissions (100+ permissions)
   - tenant:create, tenant:read, tenant:update, tenant:delete
   - user:create, user:read, user:update, user:delete
   - vehicle:create, vehicle:read, vehicle:update, vehicle:delete
   - etc...

4. Create Demo Tenant (optional)
   - name: "Demo Showroom"
   - slug: "demo"
   - status: active
   - With sample data

5. Create Global Settings
   - Platform defaults
   - Billing configuration
   - Security settings
```

---

## Success Criteria

### Definition of Done for Epic 1

**Phase 1: Foundation ✅**
- [ ] User can register, login, logout
- [ ] Email verification works
- [ ] Password reset works
- [ ] Sessions are created and validated
- [ ] RBAC middleware blocks unauthorized access
- [ ] All queries include tenantId filter
- [ ] Unit tests pass

**Phase 2: Admin Dashboard ✅**
- [ ] Root admin can create tenants
- [ ] Root admin can configure tenant branding
- [ ] Health dashboard shows system status
- [ ] Global settings can be edited
- [ ] Metrics are tracked

**Phase 3: Tenant Features ✅**
- [ ] New tenant completes onboarding wizard
- [ ] Showroom admin can invite team members
- [ ] Team members receive invitation emails
- [ ] Billing dashboard shows subscription status
- [ ] Invoices can be downloaded
- [ ] Audit logs are viewable and exportable

**Overall ✅**
- [ ] All 12 Epic 1 stories complete
- [ ] All API endpoints tested
- [ ] All UI components functional
- [ ] Documentation updated
- [ ] Ready for Epic 4 implementation

---

## File Summary

### New Files to Create

**Services**: 10 files
- auth-service.ts
- session-service.ts
- rbac-service.ts
- tenant-service.ts
- team-service.ts
- billing-service.ts
- audit-service.ts
- email-service.ts
- health-check-service.ts
- settings-service.ts

**Middleware**: 4 files
- auth.ts
- rbac.ts
- tenant-context.ts
- audit.ts

**API Routes**: 25+ files
- Auth routes (6 files)
- Admin routes (8 files)
- Team routes (3 files)
- Billing routes (4 files)
- Session routes (2 files)
- Audit routes (2 files)

**UI Pages**: 15+ files
- Admin pages (6 files)
- Onboarding pages (1 wizard with 5 steps)
- Team pages (2 files)
- Billing pages (1 file)
- Audit pages (1 file)

**Components**: 25+ files
- Admin components (8 files)
- Onboarding components (6 files)
- Team components (4 files)
- Billing components (4 files)
- Audit components (3 files)

**Total**: ~80 new files

**Estimated Lines of Code**:
- Services: ~3,000 lines
- Middleware: ~800 lines
- API Routes: ~2,500 lines
- UI Pages: ~2,000 lines
- Components: ~3,000 lines
- **Total**: ~11,300 lines

---

## Next Steps

1. **Install Dependencies**
   ```bash
   npm install bcryptjs jsonwebtoken nodemailer pdfkit date-fns
   npm install -D @types/bcryptjs @types/jsonwebtoken @types/nodemailer @types/pdfkit
   ```

2. **Create .env Variables**
   - Add JWT secrets
   - Configure email SMTP
   - Set session config

3. **Start Implementation**
   - Begin with Phase 1 (Foundation)
   - Parallel streams for faster delivery
   - Test each phase before moving to next

4. **Database Seed**
   - Create seed script
   - Run: `npx prisma db seed`

---

**Epic 1 Implementation Plan Complete** ✅
**Status**: Ready to start coding
**Next**: Install dependencies and begin Phase 1 implementation
