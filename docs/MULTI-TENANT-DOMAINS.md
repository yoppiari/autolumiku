# Multi-Tenant Domain Setup

This guide explains how AutoLumiku's multi-tenant domain system works and how to add domains for tenants.

## Architecture Overview

```
┌─────────────────────┐
│  Tenant Domain      │
│  (any domain)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Traefik Proxy      │ ← Auto-reloads from autolmk.yaml
│  (cf.avolut.com)    │ ← Explicit routes for each domain
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Nginx (Container)  │ ← Accepts all domains (server_name _)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Next.js Middleware │ ← Extracts domain from Host header
│  (src/middleware.ts)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Database Lookup    │
│  WHERE domain = ?   │
└─────────────────────┘
```

## How It Works

### 1. Traefik Layer (Entry Point)
**File**: `/data/coolify/proxy/dynamic/autolmk.yaml` (on Coolify host)

Traefik routes incoming requests based on **explicit domain matching**:
- Each tenant domain gets its own HTTP and HTTPS route
- Each route gets a dedicated Let's Encrypt SSL certificate
- **NO wildcard** - all domains must be explicitly configured

### 2. Next.js Middleware Layer
**File**: `src/middleware.ts`

Middleware extracts domain from the Host header:
```typescript
// Extracts from Host header
x-tenant-domain: showroom1.com
```

### 3. Database Resolution
**File**: `src/lib/tenant.ts`

The `getTenantFromHeaders()` function queries the database:
```sql
SELECT * FROM tenants
WHERE domain = 'showroom1.com'
AND status = 'active'
```

**Simple**: Each tenant has ONE domain field (`Tenant.domain`)

## Adding a Domain for a Tenant

**All domains must be explicitly configured in Traefik** for proper SSL certificate management.

### Steps:

1. **Update Database**:
   ```sql
   UPDATE tenants
   SET domain = 'showroom1.com'
   WHERE id = 'tenant-uuid';
   ```

   Or via Admin UI: `/admin/tenants/[id]/edit`

2. **Sync Traefik Config**:
   ```bash
   # From local machine
   npm run traefik:sync

   # Or from Coolify host
   docker exec autolumiku-app npm run traefik:sync
   ```

3. **Configure DNS** (tenant configures their DNS):
   ```
   # For custom domain (e.g., showroom1.com)
   A    @         <server-ip>
   CNAME www      showroom1.com

   # For subdomain (e.g., showroom1.autolumiku.com)
   # Already configured in main DNS
   ```

4. **Wait for SSL**: Let's Encrypt will automatically provision a certificate in ~1-2 minutes

**Result**: Each domain gets:
- ✅ Dedicated SSL certificate
- ✅ Explicit Traefik routing
- ✅ Automatic HTTPS redirect

## Managing Traefik Configuration

### Manual Update

SSH to Coolify host and edit directly:
```bash
ssh root@cf.avolut.com
vim /data/coolify/proxy/dynamic/autolmk.yaml
# Traefik auto-reloads in ~30 seconds
```

### Automated Update (Recommended)

Run the sync script to regenerate config from database:

```bash
# From local development
npm run traefik:sync

# From Coolify host
ssh root@cf.avolut.com "docker exec autolumiku-app npm run traefik:sync"

# Or schedule as cron job
0 */6 * * * docker exec autolumiku-app npm run traefik:sync
```

The script:
1. Fetches all active tenants from database
2. Generates Traefik routes for each custom domain
3. Uploads config to `/data/coolify/proxy/dynamic/autolmk.yaml`
4. Traefik auto-reloads

## Domain Types Supported

Each tenant has **ONE domain** (`Tenant.domain`). This can be:

### 1. Custom Domain
**Example**: `showroom1.com`, `mobilbekas.co.id`

**Database**: `Tenant.domain = 'showroom1.com'`

**Usage**: Full white-label experience with tenant's own domain

### 2. Subdomain
**Example**: `showroom1.autolumiku.com`, `primamobil.autolumiku.com`

**Database**: `Tenant.domain = 'showroom1.autolumiku.com'`

**Usage**: Multi-tenant under main platform domain

### 3. Slug-based (Fallback)
**Example**: `auto.lumiku.com/catalog/showroom1`

**Database**: No `Tenant.domain` set, uses `Tenant.slug` for URL path

**Usage**: Backward compatibility when no domain is configured

## Tenant Resolution

When a request comes in, the system resolves the tenant:

1. **Extract domain** from Host header via middleware
2. **Query database**: `WHERE domain = '{host}' AND status = 'active'`
3. **Load tenant** data and serve content

## URL Generation

Use `getTenantUrl(tenantId)` to get the URL for a tenant:

```typescript
import { getTenantUrl } from '@/lib/tenant';

const url = await getTenantUrl(tenant.id);
// Returns: https://showroom1.com (if domain is set)
// Falls back to: https://auto.lumiku.com/catalog/{slug}
```

## CORS Configuration

Use `getTenantCorsOrigins(tenantId)` for API routes:

```typescript
import { getTenantCorsOrigins } from '@/lib/tenant';

const allowedOrigins = await getTenantCorsOrigins(tenant.id);
// Returns: [
//   'https://showroom1.com',
//   'http://showroom1.com',
//   'http://localhost:3000',  // dev only
// ]
```

## SSL/TLS Certificates

**All domains** get dedicated Let's Encrypt certificates:

- Each domain in Traefik config gets its own SSL cert
- Certificates are automatically provisioned by Traefik
- Certificates auto-renew before expiration
- Domain must be reachable via DNS for Let's Encrypt validation

**Certificate Provisioning**:
1. Tenant domain added to database
2. Traefik config synced with `npm run traefik:sync`
3. DNS pointed to server (A record)
4. Let's Encrypt validates domain ownership
5. Certificate issued (~1-2 minutes)

## Troubleshooting

### Domain Not Working

1. **Check DNS**:
   ```bash
   dig showroom1.com
   # Should point to your server IP
   ```

2. **Check Traefik Config**:
   ```bash
   ssh root@cf.avolut.com
   cat /data/coolify/proxy/dynamic/autolmk.yaml | grep showroom1
   ```

3. **Check Database**:
   ```sql
   SELECT t.slug, tb.customDomain, tb.subdomain
   FROM tenants t
   LEFT JOIN tenant_branding tb ON t.id = tb.tenantId
   WHERE t.status = 'active';
   ```

4. **Check Traefik Logs**:
   ```bash
   ssh root@cf.avolut.com
   docker logs coolify-proxy
   ```

### SSL Certificate Issues

1. **Force Certificate Renewal**:
   ```bash
   # Remove existing cert and restart Traefik
   ssh root@cf.avolut.com
   docker restart coolify-proxy
   ```

2. **Check DNS Propagation**:
   ```bash
   nslookup showroom1.com
   ```
   DNS must be fully propagated before Let's Encrypt can validate

3. **Check Rate Limits**:
   Let's Encrypt has limits: 50 certs/week per domain
   Use staging environment for testing

## Production Checklist

Before adding a custom domain in production:

- [ ] Tenant has updated their DNS records (A/CNAME)
- [ ] DNS has propagated (check with `dig` or `nslookup`)
- [ ] Database updated with custom domain
- [ ] Traefik config synced (if using dedicated SSL)
- [ ] Test HTTP redirect to HTTPS works
- [ ] Test SSL certificate is valid
- [ ] Test tenant-specific content loads correctly

## Security Notes

1. **Wildcard Cert**: While convenient, wildcard certs are sensitive. If compromised, all subdomains are affected.
2. **DNS Validation**: Ensure proper DNS ownership before adding custom domains.
3. **Rate Limiting**: Consider rate limiting per domain in Traefik middleware.
4. **DDoS Protection**: Use Cloudflare or similar CDN for custom domains.

## Examples

### Example 1: Add Subdomain for New Tenant

```typescript
// 1. Create tenant with subdomain
await prisma.tenant.create({
  data: {
    name: 'Showroom 1',
    slug: 'showroom-1',
    domain: 'showroom1.autolumiku.com',
    status: 'active',
    createdBy: userId,
  }
});

// 2. Sync Traefik (REQUIRED)
npm run traefik:sync

// 3. Access via: https://showroom1.autolumiku.com
```

### Example 2: Add Custom Domain for Existing Tenant

```typescript
// 1. Update tenant domain
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    domain: 'showroom1.com',
  }
});

// 2. Sync Traefik (REQUIRED)
npm run traefik:sync

// 3. Tenant updates DNS:
// A    @         <server-ip>
// CNAME www      showroom1.com

// 4. Wait for DNS propagation (15min - 48hrs)
// 5. Let's Encrypt auto-provisions SSL (~2min)
// 6. Access via: https://showroom1.com
```

## Advanced: Automating Domain Addition

Create a webhook or admin API endpoint:

```typescript
// src/app/api/admin/tenants/[id]/domain/route.ts
export async function POST(req: Request) {
  const { customDomain } = await req.json();

  // Update database
  await prisma.tenantBranding.update({
    where: { tenantId: params.id },
    data: { customDomain }
  });

  // Trigger Traefik sync
  execSync('npm run traefik:sync');

  return Response.json({ success: true });
}
```

## Summary

- **One tenant = One domain** (`Tenant.domain`)
- **Explicit routing** - all domains configured in Traefik (no wildcards)
- **Dedicated SSL** - each domain gets its own Let's Encrypt certificate
- **Automatic sync** - `npm run traefik:sync` updates Traefik config
- **Simple resolution** - middleware extracts domain, database lookup by `WHERE domain = ?`
- **Volume mount** - container can modify Traefik config directly via mounted volume

### Key Differences from Typical Multi-Tenant:

✅ **What we do**: Explicit routes per domain in Traefik
❌ **What we don't do**: Wildcard catch-all routes

✅ **What we do**: One `domain` field per tenant
❌ **What we don't do**: Separate `customDomain` and `subdomain` fields

✅ **What we do**: Sync Traefik after adding domain
❌ **What we don't do**: Automatic domain detection

**Why?** Better SSL certificate management, explicit control, and proper Let's Encrypt integration.

Happy multi-tenanting! 🚀
