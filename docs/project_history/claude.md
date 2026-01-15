# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run lint:hardcode  # Check for hardcoded values
npm run test:run     # Run Jest tests
npm run test:unit    # Run unit tests only
npm run test:integration  # Run integration tests
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database
```

## Architecture Overview

AutoLumiKu is a multi-tenant vehicle showroom SaaS platform built with Next.js 14 (App Router).

### Multi-Tenant Routing

The system supports two domain types:
- **Platform Domain**: `auto.lumiku.com/catalog/[slug]` - Standard tenant catalog access
- **Custom Domains**: `primamobil.id/` → rewrites to `/catalog/primamobil-id` via middleware

Domain-to-slug mapping is in `src/middleware.ts:51-54`. The middleware handles:
- Custom domain detection and URL rewriting
- Tenant headers injection (`x-tenant-slug`, `x-is-custom-domain`)
- Static file proxying for URL-encoded paths

### Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages (login, signup, reset)
│   ├── (showroom)/        # Public catalog pages
│   ├── admin/             # Admin dashboard pages
│   ├── api/               # API routes
│   │   ├── admin/         # Admin APIs (tenant, user, scraper management)
│   │   ├── public/        # Public APIs (catalog, branding)
│   │   └── v1/            # Versioned APIs (auth, aimeow webhook)
│   └── catalog/[slug]/    # Tenant-specific catalog pages
├── components/            # React components
├── lib/                   # Shared utilities and services
│   ├── ai/               # AI services (Z.AI integration)
│   ├── auth/             # JWT and auth middleware
│   └── services/         # Business logic services
│       ├── catalog/      # Catalog engine, branding, SEO
│       └── whatsapp-ai/  # WhatsApp AI automation
└── types/                # TypeScript type definitions
```

### Tech Stack

- **Framework**: Next.js 14.2 (App Router, standalone output)
- **Database**: PostgreSQL with Prisma ORM (`prisma/schema.prisma`)
- **Cache**: Redis (ioredis)
- **AI**: Z.AI integration (`src/lib/ai/zai-client.ts`)
- **Deployment**: Docker via Coolify (cf.avolut.com)

### Key Services

- **Prisma singleton**: `src/lib/prisma.ts` - Always import from here
- **Tenant resolution**: `src/lib/tenant.ts`
- **Auth guard**: `src/lib/services/auth-guard.service.ts`
- **Catalog engine**: `src/lib/services/catalog/catalog-engine.service.ts`
- **WhatsApp AI**: `src/lib/services/whatsapp-ai/message-orchestrator.service.ts`

## Critical Rules

### Deployment

All deployments MUST go through Coolify (cf.avolut.com). No manual SSH or docker compose on production.

### Code Patterns

**Always:**
```typescript
// Use Prisma singleton
import { prisma } from '@/lib/prisma';

// Validate input with Zod
const schema = z.object({ email: z.string().email() });
const validated = schema.parse(body);
```

**Never:**
```typescript
// DON'T create new PrismaClient instances
const prisma = new PrismaClient();

// DON'T expose secrets in next.config.js env block
// DON'T skip input validation
```

### Environment Variables

Server-side secrets use `process.env` directly. For client-side vars, use `NEXT_PUBLIC_` prefix. Never add secrets to `next.config.js`.

Required env vars: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ZAI_API_KEY`

## Known Issues

See `docs/LESSONS_LEARNED.md` for production readiness status (56/100) and P0 blockers:
- Mock authentication in auth routes
- Unprotected admin endpoints
- PrismaClient duplication in 7 service files

See `docs/DEPLOYMENT_CHECKLIST.md` before any deployment.
