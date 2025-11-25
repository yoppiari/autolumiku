# 🔍 Hardcoding Audit Report

**Generated:** 2025-11-25
**Status:** 🚨 CRITICAL - Multiple violations found
**Priority:** HIGH - Immediate action required

---

## 📊 Summary

| Category | Count | Severity |
|----------|-------|----------|
| Hardcoded Tenant IDs | 47+ | 🔴 CRITICAL |
| Hardcoded User IDs | 3+ | 🔴 CRITICAL |
| Hardcoded Author IDs | 1 | 🔴 CRITICAL |
| Hardcoded URLs | 0 | ✅ OK |

**Total Violations: 51+**

---

## 🚨 CRITICAL: Hardcoded Tenant IDs (47+ instances)

### Blog System
**File:** `src/app/dashboard/blog/page.tsx`
- Line 84: `tenantId: 'tenant-1'` ❌

**File:** `src/app/dashboard/blog/generate/page.tsx`
- Line 111: `tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed'` ❌
- Line 147: `tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed'` ❌

**Impact:** Blog posts will be created for wrong tenant in multi-tenant scenarios

---

### Dashboard Leads System
**File:** `src/app/dashboard/leads/page.tsx`
- Line 89: `tenantId: 'tenant-1'` ❌
- Line 104: `tenantId: 'tenant-1'` ❌
- Line 121: `tenantId: 'tenant-2'` ❌
- Line 138: `tenantId: 'tenant-1'` ❌
- Line 150: `tenantId: 'tenant-1'` ❌
- Line 164: `tenantId: 'tenant-2'` ❌

**Impact:** Leads shown/created for wrong tenant, data leakage between tenants

---

### WhatsApp Settings (Dashboard)
**File:** `src/app/dashboard/leads/whatsapp-settings/page.tsx`
- Line 44: `tenantId: 'tenant-1'` ❌
- Line 60: `tenantId: 'tenant-2'` ❌
- Line 76: `tenantId: 'tenant-3'` ❌
- Line 134: `tenantId: 'tenant-1'` ❌

**Impact:** WhatsApp settings applied to wrong tenant

---

### Admin Users Management
**File:** `src/app/admin/users/page.tsx`
- Line 73: `tenantId: 'tenant-1'` ❌
- Line 86: `tenantId: 'tenant-1'` ❌
- Line 99: `tenantId: 'tenant-1'` ❌
- Line 112: `tenantId: 'tenant-2'` ❌

**File:** `src/app/admin/users/create/page.tsx`
- Line 39: `tenantId: ''` ❌ (Empty string, should be from dropdown)

**Impact:** Users created/shown for wrong tenant

---

### Admin Leads System
**File:** `src/app/admin/leads/page.tsx`
- Line 89: `tenantId: 'tenant-1'` ❌
- Line 104: `tenantId: 'tenant-1'` ❌
- Line 121: `tenantId: 'tenant-2'` ❌
- Line 138: `tenantId: 'tenant-1'` ❌
- Line 150: `tenantId: 'tenant-1'` ❌
- Line 164: `tenantId: 'tenant-2'` ❌

**Impact:** Admin sees leads from wrong tenant

---

### WhatsApp Settings (Admin)
**File:** `src/app/admin/leads/whatsapp-settings/page.tsx`
- Line 44: `tenantId: 'tenant-1'` ❌
- Line 60: `tenantId: 'tenant-2'` ❌
- Line 76: `tenantId: 'tenant-3'` ❌
- Line 134: `tenantId: 'tenant-1'` ❌

**Impact:** Duplicate of dashboard issue, WhatsApp settings for wrong tenant

---

### Audit Log System
**File:** `src/app/admin/audit/page.tsx`
- Line 37: `tenantId: 'tenant-1'` ❌
- Line 53: `tenantId: 'tenant-2'` ❌
- Line 73: `tenantId: 'tenant-1'` ❌
- Line 92: `tenantId: ''` ❌
- Line 249: `tenantId: ''` ❌

**Impact:** Audit logs show incorrect tenant information

---

### API Routes - Admin Users
**File:** `src/app/api/admin/users/route.ts`
- Line 27: `tenantId: 'tenant-1'` ❌
- Line 40: `tenantId: 'tenant-1'` ❌
- Line 53: `tenantId: 'tenant-1'` ❌
- Line 66: `tenantId: 'tenant-2'` ❌

**Impact:** API returns mock data with hardcoded tenant IDs

---

### API Routes - Admin Analytics
**File:** `src/app/api/admin/analytics/route.ts`
- Line 47: `tenantId: '1'` ❌
- Line 48: `tenantId: '2'` ❌
- Line 49: `tenantId: '3'` ❌
- Line 50: `tenantId: '4'` ❌
- Line 51: `tenantId: '5'` ❌

**Impact:** Analytics data hardcoded, not using real tenant data

---

### API Routes - Auth
**File:** `src/app/api/v1/auth/login/route.ts`
- Line 12: `tenantId: 'tenant-1'` ❌
- Line 24: `tenantId: 'tenant-1'` ❌

**File:** `src/app/api/v1/auth/me/route.ts`
- Line 22: `tenantId: 'tenant-1'` ❌
- Line 33: `tenantId: 'tenant-1'` ❌

**Impact:** Authentication always returns tenant-1, breaks multi-tenancy

---

## 🚨 CRITICAL: Hardcoded User IDs

**File:** `src/app/admin/audit/page.tsx`
- Line 39: `userId: 'user-1'` ❌
- Line 55: `userId: 'user-2'` ❌
- Line 75: `userId: 'user-3'` ❌

**Impact:** Audit logs show wrong user

---

## 🚨 CRITICAL: Hardcoded Author IDs

**File:** `src/app/dashboard/blog/generate/page.tsx`
- Line 148: `authorId: 'user-1'` ❌

**Impact:** Blog posts created with wrong author

---

## ✅ Good News: No Hardcoded URLs

No instances of `http://localhost` found in source code. Good job!

---

## 🎯 Root Cause Analysis

### Why This Happened
1. **No Auth Context** - No centralized way to get current user/tenant
2. **Mock Data Pattern** - Started with mock data during development
3. **Copy-Paste** - Mock data patterns copied across files
4. **No Code Review** - Hardcoding not caught during development
5. **No Linting** - No automated checks for hardcoded values

### Risk Assessment
- **Severity:** 🔴 CRITICAL
- **Probability:** 100% (already happening)
- **Impact:**
  - Data shown to wrong tenants (security breach)
  - Data saved to wrong tenant (data corruption)
  - Multi-tenancy completely broken
  - Production deployment would fail catastrophically

---

## 🛠️ Fix Strategy

### Phase 1: Emergency Fixes (Priority 1 - Today)
**Files that MUST be fixed immediately:**

1. ✅ `src/app/dashboard/blog/generate/page.tsx` (PARTIALLY FIXED)
   - Still has hardcoded UUID
   - Need to use auth context

2. ❌ `src/app/api/v1/auth/login/route.ts`
   - Auth system returns wrong tenant
   - CRITICAL - breaks everything downstream

3. ❌ `src/app/api/v1/auth/me/route.ts`
   - User info endpoint returns wrong tenant
   - CRITICAL - breaks everything downstream

### Phase 2: High Priority (This Week)
**Files with user-facing impact:**

4. `src/app/dashboard/blog/page.tsx`
5. `src/app/dashboard/leads/page.tsx`
6. `src/app/dashboard/leads/whatsapp-settings/page.tsx`
7. `src/app/admin/users/page.tsx`
8. `src/app/admin/leads/page.tsx`

### Phase 3: Medium Priority (Next Week)
**Files with mock data (dev only):**

9. `src/app/api/admin/users/route.ts`
10. `src/app/api/admin/analytics/route.ts`
11. `src/app/admin/audit/page.tsx`

---

## 📋 Detailed Fix Plan

### Step 1: Create Auth Context (Priority 1)
```typescript
// src/contexts/AuthContext.tsx
export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    // Read from localStorage or session
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      // Fetch tenant data
      fetchTenant(userData.tenantId).then(setTenant);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, tenant, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

### Step 2: Update Root Layout
```typescript
// src/app/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### Step 3: Replace Hardcoded Values
```typescript
// BEFORE (❌ WRONG)
const response = await fetch('/api/v1/blog', {
  body: JSON.stringify({
    ...data,
    tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed',
    authorId: 'user-1',
  })
});

// AFTER (✅ CORRECT)
const { user } = useAuth();
const response = await fetch('/api/v1/blog', {
  body: JSON.stringify({
    ...data,
    tenantId: user.tenantId,
    authorId: user.id,
  })
});
```

### Step 4: Fix Auth Routes
```typescript
// src/app/api/v1/auth/login/route.ts
// BEFORE (❌)
const mockUser = {
  id: 'user-123',
  tenantId: 'tenant-1', // HARDCODED!
  // ...
};

// AFTER (✅)
// Query database for real user
const user = await prisma.user.findUnique({
  where: { email },
  include: { tenant: true }
});

return NextResponse.json({
  user: {
    id: user.id,
    tenantId: user.tenantId,
    tenant: user.tenant,
    // ...
  }
});
```

---

## 🔒 Prevention Measures

### 1. ESLint Configuration
Create `.eslintrc.js` rule:
```javascript
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Property[key.name='tenantId'][value.type='Literal']",
        "message": "Hardcoded tenantId is prohibited. Use useAuth() hook."
      },
      {
        "selector": "Property[key.name='userId'][value.type='Literal']",
        "message": "Hardcoded userId is prohibited. Use useAuth() hook."
      },
      {
        "selector": "Property[key.name='authorId'][value.type='Literal']",
        "message": "Hardcoded authorId is prohibited. Use useAuth() hook."
      }
    ]
  }
}
```

### 2. Pre-commit Hook
Create `.husky/pre-commit`:
```bash
#!/bin/sh
echo "🔍 Checking for hardcoded values..."

# Check for common patterns
if grep -r "tenantId: ['\"]" src/ --include="*.ts" --include="*.tsx" | grep -v "// TODO"; then
  echo "❌ ERROR: Hardcoded tenantId found!"
  echo "Please use useAuth() hook instead."
  exit 1
fi

echo "✅ No hardcoded values found"
```

### 3. TypeScript Strict Mode
```typescript
// src/types/auth.ts
type TenantId = string & { readonly __brand: 'TenantId' };
type UserId = string & { readonly __brand: 'UserId' };

// This prevents using raw strings as IDs
function createBlogPost(tenantId: TenantId, authorId: UserId) {
  // ...
}

// ❌ This won't compile:
createBlogPost('tenant-1', 'user-1');

// ✅ This is required:
const { user } = useAuth();
createBlogPost(user.tenantId as TenantId, user.id as UserId);
```

---

## 📊 Estimated Effort

| Phase | Files to Fix | Estimated Time | Priority |
|-------|--------------|----------------|----------|
| Phase 1: Auth Context | 3 files | 4 hours | 🔴 Critical |
| Phase 2: Dashboard | 8 files | 8 hours | 🟠 High |
| Phase 3: Admin/Mock | 5 files | 4 hours | 🟡 Medium |
| Phase 4: Testing | All | 4 hours | 🟢 Normal |
| **TOTAL** | **16+ files** | **20 hours** | - |

---

## ✅ Success Criteria

- [ ] Zero hardcoded tenant IDs in production code
- [ ] Zero hardcoded user IDs in production code
- [ ] Auth context implemented and working
- [ ] All pages use `useAuth()` hook
- [ ] ESLint rules prevent new violations
- [ ] Pre-commit hooks active
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated

---

## 🚀 Next Steps

1. **Immediate (Today):**
   - [ ] Create AuthContext implementation
   - [ ] Fix auth routes (`login`, `me`)
   - [ ] Test authentication flow

2. **Short Term (This Week):**
   - [ ] Fix all dashboard pages
   - [ ] Fix blog system
   - [ ] Fix leads system
   - [ ] Test multi-tenant scenarios

3. **Medium Term (Next Week):**
   - [ ] Fix admin pages
   - [ ] Replace mock data with real queries
   - [ ] Add ESLint rules
   - [ ] Add pre-commit hooks

4. **Long Term (Ongoing):**
   - [ ] Code review all PRs
   - [ ] Regular audits
   - [ ] Team training
   - [ ] Monitor production logs

---

## 📝 Notes

- This audit found 51+ violations, but there may be more
- Mock data files (like seeder scripts) are excluded from this audit
- Test files are excluded from this audit
- Some violations may be in copied files (admin vs dashboard duplicates)

---

**Report Generated By:** Claude Code
**Review Required By:** Development Team Lead
**Action Required:** IMMEDIATE

---

## 🔗 Related Documents

- [No Hardcoding Policy](/docs/coding-standards/NO-HARDCODING-POLICY.md)
- [Authentication & Authorization](/docs/authentication.md)
- [Multi-tenant Architecture](/docs/architecture.md)
