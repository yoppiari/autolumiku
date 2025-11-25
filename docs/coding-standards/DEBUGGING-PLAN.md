# 🔧 Debugging Plan: Eliminate All Hardcoding

**Created:** 2025-11-25
**Status:** 📋 PLANNING
**Priority:** 🔴 CRITICAL
**Estimated Time:** 20 hours

---

## 🎯 Objective

Eliminate all hardcoded values from the codebase and implement a proper authentication context system that provides user and tenant information dynamically.

---

## 📊 Current Status

- ✅ Audit completed
- ✅ Policy documented
- ✅ 51+ violations identified
- ⏳ Fixes pending

---

## 🗺️ Execution Plan

### Phase 1: Foundation (4-6 hours) - CRITICAL PRIORITY

#### Task 1.1: Create AuthContext System
**File:** `src/contexts/AuthContext.tsx` (NEW)
**Priority:** 🔴 CRITICAL
**Time:** 2 hours

**Implementation:**
```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'manager' | 'staff';
  tenantId: string | null;
  phoneNumber?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

export interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

// Context
const AuthContext = createContext<AuthContextType | null>(null);

// Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('authToken');

        if (storedUser && storedToken) {
          const userData: User = JSON.parse(storedUser);
          setUser(userData);

          // Fetch tenant data if user has tenantId
          if (userData.tenantId) {
            const tenantResponse = await fetch(`/api/v1/tenants/${userData.tenantId}`);
            if (tenantResponse.ok) {
              const tenantData = await tenantResponse.json();
              setTenant(tenantData.data);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('authToken', data.token);

    // Fetch tenant data
    if (data.user.tenantId) {
      const tenantResponse = await fetch(`/api/v1/tenants/${data.user.tenantId}`);
      if (tenantResponse.ok) {
        const tenantData = await tenantResponse.json();
        setTenant(tenantData.data);
      }
    }
  };

  const logout = () => {
    setUser(null);
    setTenant(null);
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
  };

  const refreshUser = async () => {
    try {
      const response = await fetch('/api/v1/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));

        if (data.user.tenantId) {
          const tenantResponse = await fetch(`/api/v1/tenants/${data.user.tenantId}`);
          if (tenantResponse.ok) {
            const tenantData = await tenantResponse.json();
            setTenant(tenantData.data);
          }
        }
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Testing:**
```typescript
// Test in any component
const { user, tenant, isAuthenticated } = useAuth();
console.log('User:', user);
console.log('Tenant:', tenant);
console.log('Authenticated:', isAuthenticated);
```

---

#### Task 1.2: Update Root Layout
**File:** `src/app/layout.tsx`
**Priority:** 🔴 CRITICAL
**Time:** 15 minutes

**Changes:**
```typescript
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

#### Task 1.3: Fix Auth API Routes
**Files:**
- `src/app/api/v1/auth/login/route.ts`
- `src/app/api/v1/auth/me/route.ts`

**Priority:** 🔴 CRITICAL
**Time:** 2 hours

**Current Issues:**
- Returns hardcoded `tenantId: 'tenant-1'`
- Uses mock user data instead of database queries

**Fix for login/route.ts:**
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    // Query real user from database
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Return user data (NO HARDCODING!)
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        tenantId: user.tenantId,  // FROM DATABASE, NOT HARDCODED!
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Fix for me/route.ts:**
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    // Query real user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        tenantId: user.tenantId,  // FROM DATABASE!
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### Phase 2: Blog System (2-3 hours) - HIGH PRIORITY

#### Task 2.1: Fix Blog Generator
**File:** `src/app/dashboard/blog/generate/page.tsx`
**Lines:** 111, 147, 148
**Priority:** 🔴 HIGH
**Time:** 1 hour

**Current Code:**
```typescript
// ❌ WRONG
tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed',
authorId: 'user-1',
```

**Fixed Code:**
```typescript
'use client';

import { useAuth } from '@/contexts/AuthContext';

export default function BlogGeneratorPage() {
  const { user } = useAuth();

  // ... rest of component

  const handleGenerate = async () => {
    // ✅ CORRECT - Use auth context
    const response = await fetch('/api/v1/blog/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        topic,
        tone,
        targetLocation,
        tenantId: user?.tenantId, // FROM AUTH CONTEXT!
      }),
    });
  };

  const handleSave = async (status: 'DRAFT' | 'PUBLISHED') => {
    const { relatedTopics, ...blogData } = editedBlog;

    // ✅ CORRECT - Use auth context
    const response = await fetch('/api/v1/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...blogData,
        category,
        tone,
        targetLocation,
        status,
        tenantId: user?.tenantId,        // FROM AUTH CONTEXT!
        authorId: user?.id,              // FROM AUTH CONTEXT!
        authorName: user?.fullName,      // FROM AUTH CONTEXT!
      }),
    });
  };
}
```

**Testing:**
1. Login as user@showroom.com
2. Go to /dashboard/blog/generate
3. Generate a blog post
4. Save as draft
5. Verify in database that tenantId and authorId are correct

---

#### Task 2.2: Fix Blog List Page
**File:** `src/app/dashboard/blog/page.tsx`
**Line:** 84
**Priority:** 🔴 HIGH
**Time:** 30 minutes

**Changes:**
```typescript
'use client';

import { useAuth } from '@/contexts/AuthContext';

export default function BlogListPage() {
  const { user } = useAuth();

  useEffect(() => {
    const fetchBlogs = async () => {
      // ✅ Use user.tenantId from auth context
      const response = await fetch(`/api/v1/blog?tenantId=${user?.tenantId}`);
      const data = await response.json();
      setBlogs(data.data);
    };

    if (user?.tenantId) {
      fetchBlogs();
    }
  }, [user]);
}
```

---

### Phase 3: Dashboard Leads System (2-3 hours) - HIGH PRIORITY

#### Task 3.1: Fix Leads Page
**File:** `src/app/dashboard/leads/page.tsx`
**Lines:** 89, 104, 121, 138, 150, 164
**Priority:** 🔴 HIGH
**Time:** 1.5 hours

**Strategy:**
Replace all mock data with real API calls using `user.tenantId`

**Fixed Code:**
```typescript
'use client';

import { useAuth } from '@/contexts/AuthContext';

export default function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    const fetchLeads = async () => {
      if (!user?.tenantId) return;

      // ✅ Query with real tenant ID
      const response = await fetch(`/api/v1/leads?tenantId=${user.tenantId}`);
      const data = await response.json();
      setLeads(data.data);
    };

    fetchLeads();
  }, [user]);

  // Remove all mock data arrays
}
```

---

#### Task 3.2: Fix WhatsApp Settings
**File:** `src/app/dashboard/leads/whatsapp-settings/page.tsx`
**Lines:** 44, 60, 76, 134
**Priority:** 🟠 MEDIUM
**Time:** 1 hour

**Same strategy:** Replace mock data with auth context

---

### Phase 4: Admin Pages (3-4 hours) - MEDIUM PRIORITY

#### Task 4.1: Fix Admin Users Page
**Files:**
- `src/app/admin/users/page.tsx`
- `src/app/admin/users/create/page.tsx`

**Priority:** 🟠 MEDIUM
**Time:** 2 hours

**Note:** Admin pages might need to show ALL tenants, not filter by user.tenantId

---

#### Task 4.2: Fix Admin Leads
**File:** `src/app/admin/leads/page.tsx`
**Priority:** 🟠 MEDIUM
**Time:** 1 hour

---

#### Task 4.3: Fix Admin Audit
**File:** `src/app/admin/audit/page.tsx`
**Priority:** 🟠 MEDIUM
**Time:** 1 hour

---

### Phase 5: API Routes (2-3 hours) - MEDIUM PRIORITY

#### Task 5.1: Fix Admin Analytics API
**File:** `src/app/api/admin/analytics/route.ts`
**Lines:** 47-51
**Priority:** 🟠 MEDIUM
**Time:** 2 hours

**Current:** Returns mock data with hardcoded tenant IDs
**Fix:** Query real analytics from database

---

### Phase 6: Prevention (2-3 hours) - HIGH PRIORITY

#### Task 6.1: Add ESLint Rules
**File:** `.eslintrc.json`
**Priority:** 🟠 HIGH
**Time:** 1 hour

**Add rules:**
```json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Property[key.name='tenantId'] > Literal[value=/tenant-/]",
        "message": "Hardcoded tenantId is prohibited. Use useAuth() hook to get user.tenantId"
      },
      {
        "selector": "Property[key.name='tenantId'] > Literal[value=/^[0-9a-f]{8}-/]",
        "message": "Hardcoded tenantId UUID is prohibited. Use useAuth() hook to get user.tenantId"
      },
      {
        "selector": "Property[key.name='userId'] > Literal[value=/user-/]",
        "message": "Hardcoded userId is prohibited. Use useAuth() hook to get user.id"
      },
      {
        "selector": "Property[key.name='authorId'] > Literal[value=/user-/]",
        "message": "Hardcoded authorId is prohibited. Use useAuth() hook to get user.id"
      }
    ]
  }
}
```

---

#### Task 6.2: Add Pre-commit Hook
**File:** `.husky/pre-commit` (NEW)
**Priority:** 🟠 HIGH
**Time:** 30 minutes

**Setup Husky:**
```bash
npm install -D husky
npx husky install
npx husky add .husky/pre-commit "npm run lint:hardcode"
```

**Add script to package.json:**
```json
{
  "scripts": {
    "lint:hardcode": "node scripts/check-hardcoding.js"
  }
}
```

**Create check script:**
```javascript
// scripts/check-hardcoding.js
const { execSync } = require('child_process');

const patterns = [
  { pattern: "tenantId: ['\\\"]tenant-", message: "Hardcoded tenant ID" },
  { pattern: "userId: ['\\\"]user-", message: "Hardcoded user ID" },
  { pattern: "authorId: ['\\\"]user-", message: "Hardcoded author ID" },
];

let hasViolations = false;

patterns.forEach(({ pattern, message }) => {
  try {
    const result = execSync(
      `grep -r "${pattern}" src/ --include="*.ts" --include="*.tsx"`,
      { encoding: 'utf8' }
    );
    if (result) {
      console.error(`\n❌ ${message} found:`);
      console.error(result);
      hasViolations = true;
    }
  } catch (e) {
    // No matches found (grep exit code 1)
  }
});

if (hasViolations) {
  console.error('\n🚫 Commit rejected: Hardcoded values detected');
  console.error('Please use useAuth() hook instead\n');
  process.exit(1);
}

console.log('✅ No hardcoded values found');
```

---

## 📋 Testing Checklist

After each phase, test the following:

### Phase 1 Testing
- [ ] AuthContext loads user from localStorage
- [ ] Login API returns real user with correct tenantId
- [ ] /api/v1/auth/me returns correct user data
- [ ] Logout clears user data

### Phase 2 Testing
- [ ] Blog generation uses correct tenantId
- [ ] Blog save uses correct authorId
- [ ] Blog list filters by tenantId
- [ ] Multiple users see different blogs

### Phase 3 Testing
- [ ] Leads filtered by tenantId
- [ ] New leads created with correct tenantId
- [ ] WhatsApp settings per tenant

### Phase 4 Testing
- [ ] Admin can see all tenants
- [ ] User creation assigns correct tenantId
- [ ] Audit logs show correct tenant/user

### Phase 6 Testing
- [ ] ESLint catches new hardcoding
- [ ] Pre-commit hook blocks bad code
- [ ] CI/CD pipeline validates

---

## 🎯 Success Metrics

- ✅ Zero hardcoded tenant IDs in src/
- ✅ Zero hardcoded user IDs in src/
- ✅ All pages use useAuth() hook
- ✅ ESLint rules active and working
- ✅ Pre-commit hooks preventing violations
- ✅ 100% of tests passing
- ✅ Production deployment successful

---

## ⚠️ Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Test each phase thoroughly |
| Database schema changes needed | Medium | Review Prisma schema first |
| Performance degradation | Low | Use proper indexing |
| Session management issues | Medium | Implement proper JWT validation |

---

## 📅 Timeline

| Week | Phase | Deliverable |
|------|-------|-------------|
| Week 1 Day 1-2 | Phase 1 | AuthContext + Auth APIs |
| Week 1 Day 3 | Phase 2 | Blog System Fixed |
| Week 1 Day 4-5 | Phase 3 | Leads System Fixed |
| Week 2 Day 1-2 | Phase 4 | Admin Pages Fixed |
| Week 2 Day 3 | Phase 5 | API Routes Fixed |
| Week 2 Day 4-5 | Phase 6 | Prevention + Testing |

---

## 🚀 Getting Started

### Immediate Next Steps

1. **Review this plan** with team lead
2. **Create feature branch:** `git checkout -b fix/eliminate-hardcoding`
3. **Start with Phase 1:** AuthContext is foundation for everything
4. **Test thoroughly** after each phase
5. **Commit frequently** with clear messages

### Commands to Run

```bash
# Create feature branch
git checkout -b fix/eliminate-hardcoding

# Install dependencies (if needed)
npm install bcryptjs jsonwebtoken
npm install -D @types/bcryptjs @types/jsonwebtoken

# Create directories
mkdir -p src/contexts
mkdir -p scripts

# Run tests after each phase
npm run test

# Lint check
npm run lint

# Type check
npm run type-check
```

---

## 📝 Progress Tracking

Use this checklist to track progress:

### Phase 1: Foundation
- [ ] AuthContext created
- [ ] Root layout updated
- [ ] Login API fixed
- [ ] Me API fixed
- [ ] Testing completed

### Phase 2: Blog System
- [ ] Blog generator fixed
- [ ] Blog list fixed
- [ ] Testing completed

### Phase 3: Leads
- [ ] Leads page fixed
- [ ] WhatsApp settings fixed
- [ ] Testing completed

### Phase 4: Admin
- [ ] Users page fixed
- [ ] Leads page fixed
- [ ] Audit page fixed
- [ ] Testing completed

### Phase 5: APIs
- [ ] Analytics API fixed
- [ ] Testing completed

### Phase 6: Prevention
- [ ] ESLint rules added
- [ ] Pre-commit hooks added
- [ ] CI/CD updated
- [ ] Testing completed

---

**Document maintained by:** Development Team
**Last updated:** 2025-11-25
**Next review:** After Phase 1 completion
