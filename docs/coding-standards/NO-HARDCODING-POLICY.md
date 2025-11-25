# 🚫 NO HARDCODING POLICY

**Status:** MANDATORY - STRICTLY ENFORCED
**Last Updated:** 2025-11-25
**Applies To:** All code, all developers, all AI agents (Claude, BMAD)

---

## ⚠️ CRITICAL RULE: HARDCODING IS STRICTLY PROHIBITED

Hardcoding values directly in code is **STRICTLY FORBIDDEN** in this project. This policy is non-negotiable and must be followed by all contributors, including AI coding assistants.

---

## 🎯 Why Hardcoding is Prohibited

1. **Multi-tenant Architecture** - Different showrooms have different IDs, settings, and configurations
2. **Security Risks** - Hardcoded credentials or IDs can leak sensitive information
3. **Maintainability** - Changes require code modifications instead of configuration updates
4. **Testing Difficulty** - Hard to test with different environments and scenarios
5. **Scalability Issues** - Cannot adapt to new tenants or environments without code changes
6. **Production Bugs** - Development values leak into production (like `tenant-1`, `user-1`)

---

## 🚨 Common Hardcoding Violations

### ❌ NEVER Hardcode These Values:

#### 1. Tenant IDs
```typescript
// ❌ WRONG - Hardcoded tenant ID
tenantId: 'tenant-1'
tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed'

// ✅ CORRECT - Get from auth context
const { user } = useAuth();
tenantId: user.tenantId
```

#### 2. User IDs
```typescript
// ❌ WRONG - Hardcoded user ID
authorId: 'user-1'

// ✅ CORRECT - Get from auth context
const { user } = useAuth();
authorId: user.id
```

#### 3. URLs and Endpoints
```typescript
// ❌ WRONG - Hardcoded URLs
const apiUrl = 'http://localhost:3000/api/v1/blog'
const imageUrl = 'https://mysite.com/images/logo.png'

// ✅ CORRECT - Use environment variables
const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/blog`
const imageUrl = `${process.env.NEXT_PUBLIC_CDN_URL}/images/logo.png`
```

#### 4. API Keys and Secrets
```typescript
// ❌ WRONG - Hardcoded API key
const apiKey = 'glm-abc123xyz'

// ✅ CORRECT - Use environment variables
const apiKey = process.env.GLM_API_KEY
```

#### 5. Configuration Values
```typescript
// ❌ WRONG - Hardcoded configuration
const maxUploadSize = 5242880 // 5MB
const defaultLanguage = 'id'

// ✅ CORRECT - Use config file
import { config } from '@/config'
const maxUploadSize = config.upload.maxSize
const defaultLanguage = config.i18n.defaultLanguage
```

#### 6. Database Connection Strings
```typescript
// ❌ WRONG - Hardcoded connection string
const dbUrl = 'postgresql://user:pass@localhost:5432/mydb'

// ✅ CORRECT - Use environment variables
const dbUrl = process.env.DATABASE_URL
```

#### 7. Feature Flags
```typescript
// ❌ WRONG - Hardcoded feature flag
if (true) { // Enable new feature
  showNewDashboard()
}

// ✅ CORRECT - Use feature flag system
if (featureFlags.newDashboard) {
  showNewDashboard()
}
```

---

## ✅ Approved Alternatives

### 1. Environment Variables (.env)
```bash
# .env.local
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_API_URL="http://localhost:3000"
GLM_API_KEY="your-api-key"
```

```typescript
// Usage
const apiUrl = process.env.NEXT_PUBLIC_API_URL
```

### 2. Authentication Context
```typescript
// src/contexts/AuthContext.tsx
export const useAuth = () => {
  const context = useContext(AuthContext);
  return {
    user: context.user,      // { id, tenantId, role, ... }
    tenant: context.tenant,  // { id, name, slug, ... }
    isAuthenticated: context.isAuthenticated,
  };
};

// Usage in components
const { user, tenant } = useAuth();
const tenantId = user.tenantId;
const authorId = user.id;
```

### 3. Configuration Files
```typescript
// src/config/index.ts
export const config = {
  upload: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png'],
  },
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },
  blog: {
    minWordCount: 300,
    maxWordCount: 3000,
    defaultTone: 'CASUAL',
  },
};

// Usage
import { config } from '@/config';
const maxSize = config.upload.maxSize;
```

### 4. Database Queries
```typescript
// ❌ WRONG - Hardcoded tenant filter
const vehicles = await prisma.vehicle.findMany({
  where: { tenantId: 'tenant-1' }
});

// ✅ CORRECT - Dynamic tenant filter
const { user } = useAuth();
const vehicles = await prisma.vehicle.findMany({
  where: { tenantId: user.tenantId }
});
```

### 5. Server-Side with Session
```typescript
// API route
import { getServerSession } from 'next-auth';

export async function POST(req: Request) {
  const session = await getServerSession();
  const tenantId = session.user.tenantId;
  const authorId = session.user.id;

  // Use dynamic values from session
  await createBlogPost({ tenantId, authorId, ...data });
}
```

---

## 🔍 Detection and Prevention

### Automated Checks

#### 1. ESLint Rules (To Be Implemented)
```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Literal[value='tenant-1']",
        "message": "Hardcoded tenant ID 'tenant-1' is prohibited. Use auth context."
      },
      {
        "selector": "Literal[value='user-1']",
        "message": "Hardcoded user ID 'user-1' is prohibited. Use auth context."
      }
    ]
  }
}
```

#### 2. Pre-commit Hooks
```bash
# Search for common hardcoding patterns
grep -r "tenantId: ['\"]" src/
grep -r "authorId: ['\"]" src/
grep -r "http://localhost" src/
```

#### 3. Code Review Checklist
- [ ] No hardcoded tenant IDs
- [ ] No hardcoded user IDs
- [ ] No hardcoded URLs
- [ ] No hardcoded API keys
- [ ] All configuration uses env vars or config files
- [ ] Auth context used for user/tenant data

---

## 🛠️ Migration Strategy

### Phase 1: Audit (Current)
1. Scan entire codebase for hardcoded values
2. Create inventory of all violations
3. Categorize by severity (critical, high, medium, low)

### Phase 2: Create Infrastructure
1. Implement AuthContext with user/tenant data
2. Create centralized config system
3. Set up environment variable validation
4. Add TypeScript types for config

### Phase 3: Replace Hardcoded Values
1. Replace tenant IDs with `user.tenantId`
2. Replace user IDs with `user.id`
3. Replace URLs with env vars
4. Replace config values with config imports

### Phase 4: Prevent Future Violations
1. Add ESLint rules
2. Add pre-commit hooks
3. Update documentation
4. Train team on policy

---

## 📋 Debugging Plan

### Step 1: Find All Hardcoded Values
```bash
# Search for common patterns
grep -rn "tenantId: ['\"]" src/
grep -rn "authorId: ['\"]" src/
grep -rn "userId: ['\"]" src/
grep -rn "http://localhost" src/
grep -rn "https://" src/ --exclude-dir=node_modules
grep -rn "tenant-1" src/
grep -rn "user-1" src/
```

### Step 2: Categorize Findings
- **Critical:** Tenant IDs, User IDs, Auth tokens
- **High:** API URLs, Database connections
- **Medium:** Configuration values, Feature flags
- **Low:** UI strings, default values

### Step 3: Create Fix Plan
For each violation:
1. Identify the correct source of truth
2. Implement dynamic retrieval
3. Test in dev environment
4. Deploy to production

---

## 🎓 Examples from Our Codebase

### Issue Found: Blog Generator (FIXED)
```typescript
// ❌ BEFORE - Hardcoded values
tenantId: 'tenant-1',
authorId: 'user-1',
authorName: 'Admin',

// ⚠️ TEMPORARY FIX - Using actual UUID (still hardcoded!)
tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed',
authorId: 'user-1',
authorName: 'Admin',

// ✅ TARGET - Dynamic values from auth
const { user } = useAuth();
tenantId: user.tenantId,
authorId: user.id,
authorName: user.fullName,
```

### Issue Found: Dashboard Layout
```typescript
// Current status: Reads from localStorage (better, but not ideal)
const storedUser = localStorage.getItem('user');

// ✅ TARGET - Use auth context
const { user, tenant } = useAuth();
```

---

## 🚀 Action Items

### Immediate (Today)
- [x] Create this policy document
- [ ] Scan codebase for hardcoded tenant IDs
- [ ] Scan codebase for hardcoded user IDs
- [ ] Create comprehensive violation report

### Short Term (This Week)
- [ ] Implement AuthContext with proper typing
- [ ] Create centralized config system
- [ ] Replace all hardcoded tenant/user IDs
- [ ] Add environment variable validation

### Medium Term (This Month)
- [ ] Add ESLint rules for hardcoding detection
- [ ] Implement pre-commit hooks
- [ ] Create developer guide
- [ ] Add CI/CD checks

### Long Term (Ongoing)
- [ ] Code review enforcement
- [ ] Regular audits
- [ ] Team training
- [ ] Documentation updates

---

## 📚 Related Documentation

- [Authentication & Authorization](/docs/authentication.md)
- [Environment Variables](/docs/environment-variables.md)
- [Configuration Management](/docs/configuration.md)
- [Multi-tenant Architecture](/docs/architecture.md)

---

## 📝 Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-25 | Initial policy created | Claude Code |
| 2025-11-25 | Added debugging plan | Claude Code |

---

**Remember:** Every hardcoded value is a potential bug waiting to happen in production. Always use dynamic values from auth context, environment variables, or configuration files.

**Questions?** Refer to this document or ask the development team lead.

---

## 🤖 Note for AI Coding Assistants

**Claude, BMAD, and other AI agents:**

When writing code for this project:
1. ✅ ALWAYS ask for user context when you need tenant/user IDs
2. ✅ ALWAYS use environment variables for configuration
3. ✅ ALWAYS use auth context for user/tenant data
4. ❌ NEVER hardcode tenant IDs, user IDs, or any identifiers
5. ❌ NEVER use placeholder values like 'tenant-1' or 'user-1'
6. ❌ NEVER commit code with TODO comments about hardcoding without fixing it first

If you encounter existing hardcoded values:
1. Flag it immediately
2. Suggest the proper fix
3. Implement the fix if authorized
4. Update documentation

**This is not optional. Hardcoding is a critical violation.**
