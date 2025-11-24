# autolumiku Architecture Specification

**Author:** Yoppi
**Date:** 2025-11-20
**Version:** 1.0
**Architecture Type:** Multi-tenant SaaS with AI Integration

---

## Executive Summary

autolumiku is a **multi-tenant SaaS platform** that revolutionizes automotive showroom digital presence through AI-powered automation. The architecture must support **1000+ concurrent showrooms** with complete data isolation, **real-time AI processing** for vehicle identification, and **mobile-first responsive catalogs** with dynamic branding.

**Primary Architectural Challenges:**
- **Multi-tenant data isolation** while maintaining shared AI processing resources
- **AI-powered computer vision** pipeline for vehicle identification from photos
- **Natural language processing** for Bahasa Indonesia commands
- **Real-time inventory synchronization** across multiple customer touchpoints
- **Dynamic branding system** for tenant customization without code deployment

**Key Technical Decisions:**
- **Microservices architecture** with service isolation for scalability
- **Event-driven architecture** for real-time updates and AI processing
- **Hybrid database strategy** (PostgreSQL for structured data, MongoDB for flexible content)
- **CDN-first static content delivery** for mobile performance in Indonesia
- **API-first design** for future integrations and multi-platform support

## Project Initialization

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CloudFront CDN (Global)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Customer Websites│  │ Admin Dashboard │  │ Mobile Apps      │  │
│  │ (Tenant-branded) │  │ (Multi-tenant)   │  │ (Future)         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    API Gateway        │
                    │   (AWS API Gateway)   │
                    │  + Authentication     │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐    ┌────────▼────────┐    ┌───────▼────────┐
│   Frontend     │    │   Backend       │    │   AI Services  │
│   Services     │    │   Services      │    │                │
│                │    │                │    │                │
│ • Next.js      │    │ • User Service  │    │ • Vision API   │
│ • React        │    │ • Tenant Service│    │ • GPT-4        │
│ • Tailwind     │    │ • Inventory     │    │ • NLP Pipeline  │
│                │    │ • Website Gen   │    │                │
└────────────────┘    └────────────────┘    └────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐    ┌────────▼────────┐    ┌───────▼────────┐
│   PostgreSQL   │    │    MongoDB      │    │    Redis       │
│                │    │                │    │                │
│ • Tenants      │    │ • Vehicles      │    │ • Sessions     │
│ • Users        │    │ • Photos        │    │ • Cache        │
│ • Roles        │    │ • Generated     │    │ • Queues       │
│ • Audit Logs   │    │   Content       │    │                │
└────────────────┘    └────────────────┘    └────────────────┘
```

## Decision Summary

| Category | Decision | Version | Affects Epics | Rationale |
| -------- | -------- | ------- | ------------- | --------- |
| **Architecture Pattern** | Microservices with Event-Driven Communication | 1.0 | All | Enables independent scaling, fault isolation, and real-time processing |
| **Multi-Tenancy Strategy** | Database-per-tenant with shared services | 1.0 | FR1-10 | Complete data isolation while maintaining operational efficiency |
| **Frontend Framework** | Next.js 14 with App Router | 1.0 | FR27-32 | Server-side rendering for SEO, mobile performance, and tenant branding |
| **Primary Database** | PostgreSQL 15 + MongoDB 7.0 | 1.0 | All | PostgreSQL for structured data, MongoDB for flexible vehicle content |
| **AI Integration** | OpenAI GPT-4 + Google Vision API v1 | 1.0 | FR16-26 | Industry-leading AI capabilities with proven automotive use cases |
| **File Storage** | AWS S3 + CloudFront CDN | 1.0 | FR49-52 | Scalable storage with global CDN for Indonesian market |
| **Authentication** | JWT with Refresh Tokens + 2FA | 1.0 | FR11-15 | Secure session management across devices and tenants |
| **Infrastructure** | AWS Indonesia (ap-southeast-3) | 1.0 | All | Compliance with Indonesian data regulations and latency optimization |

## Project Structure

```
autolumiku/
├── apps/
│   ├── web/                          # Next.js customer-facing websites
│   │   ├── app/                      # App Router (Next.js 14)
│   │   │   ├── [tenant]/             # Dynamic tenant routing
│   │   │   │   ├── page.tsx         # Tenant home page
│   │   │   │   ├── vehicles/
│   │   │   │   │   └── page.tsx     # Vehicle listings
│   │   │   │   └── vehicles/[slug]/
│   │   │   │       └── page.tsx     # Vehicle details
│   │   │   ├── api/                  # API routes
│   │   │   │   ├── vehicles/        # Vehicle APIs
│   │   │   │   └── contact/         # Contact forms
│   │   │   └── globals.css          # Global styles
│   │   ├── components/               # Reusable UI components
│   │   │   ├── ui/                  # shadcn/ui components
│   │   │   ├── automotive/          # Vehicle-specific components
│   │   │   │   ├── VehicleCard.tsx
│   │   │   │   ├── StatusBadge.tsx
│   │   │   │   └── PhotoGallery.tsx
│   │   │   └── tenant/              # Tenant branding components
│   │   ├── lib/                     # Utility libraries
│   │   │   ├── tenant.ts            # Tenant resolution
│   │   │   ├── theme.ts             # Dynamic theming
│   │   │   └── api.ts               # API clients
│   │   └── public/                  # Static assets
│   │       └── tenants/             # Tenant-specific assets
│   │           └── [tenant-id]/
│   │               ├── logo.png
│   │               └── favicon.ico
│   │
│   └── admin/                        # Admin dashboard (separate app)
│       ├── app/
│       │   ├── dashboard/
│       │   ├── inventory/
│       │   ├── ai-commands/
│       │   ├── settings/
│       │   └── layout.tsx
│       ├── components/
│       │   ├── admin/               # Admin-specific components
│       │   │   ├── TenantSelector.tsx
│       │   │   ├── VehicleUpload.tsx
│       │   │   └── AICommandInput.tsx
│       │   └── shared/              # Shared with web app
│       └── lib/
│
├── services/                         # Backend microservices
│   ├── user-service/
│   │   ├── src/
│   │   │   ├── controllers/         # API endpoints
│   │   │   ├── models/              # Data models
│   │   │   ├── services/            # Business logic
│   │   │   ├── middleware/          # Auth, validation, logging
│   │   │   └── config/              # Database, external services
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── tenant-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   ├── tenant.controller.ts
│   │   │   │   ├── branding.controller.ts
│   │   │   │   └── subscription.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── tenant.service.ts
│   │   │   │   ├── branding.service.ts
│   │   │   │   └── theme.service.ts
│   │   │   └── models/
│   │   │       ├── tenant.model.ts
│   │   │       └── branding.model.ts
│   │   └── Dockerfile
│   │
│   ├── inventory-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   ├── vehicle.controller.ts
│   │   │   │   ├── photo.controller.ts
│   │   │   │   └── status.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── vehicle.service.ts
│   │   │   │   ├── photo.service.ts
│   │   │   │   └── ai-processing.service.ts
│   │   │   └── models/
│   │   │       ├── vehicle.model.ts
│   │   │       └── photo.model.ts
│   │   └── Dockerfile
│   │
│   ├── ai-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   ├── vision.controller.ts
│   │   │   │   ├── nlp.controller.ts
│   │   │   │   └── pricing.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── vision.service.ts      # Google Vision API
│   │   │   │   ├── nlp.service.ts        # GPT-4 integration
│   │   │   │   ├── pricing.service.ts    # Market analysis
│   │   │   │   └── description.service.ts # Content generation
│   │   │   ├── models/
│   │   │   │   ├── ai-request.model.ts
│   │   │   │   └── ai-response.model.ts
│   │   │   └── external/
│   │   │       ├── openai.client.ts
│   │   │       └── google-vision.client.ts
│   │   └── Dockerfile
│   │
│   ├── website-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   ├── site.controller.ts
│   │   │   │   ├── seo.controller.ts
│   │   │   │   └── analytics.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── site-generator.service.ts
│   │   │   │   ├── seo.service.ts
│   │   │   │   └── analytics.service.ts
│   │   │   └── templates/
│   │   │       ├── vehicle-template.ts
│   │   │       ├── listing-template.ts
│   │   │       └── seo-template.ts
│   │   └── Dockerfile
│   │
│   └── notification-service/
│       ├── src/
│       │   ├── controllers/
│       │   │   ├── email.controller.ts
│       │   │   ├── whatsapp.controller.ts
│       │   │   └── webhook.controller.ts
│       │   ├── services/
│       │   │   ├── email.service.ts
│       │   │   ├── whatsapp.service.ts
│       │   │   └── webhook.service.ts
│       │   └── templates/
│       │       ├── email/
│       │       └── whatsapp/
│       └── Dockerfile
│
├── shared/                            # Shared libraries and utilities
│   ├── types/                         # TypeScript definitions
│   │   ├── tenant.types.ts
│   │   ├── vehicle.types.ts
│   │   ├── user.types.ts
│   │   └── ai.types.ts
│   ├── utils/                         # Utility functions
│   │   ├── validation.ts
│   │   ├── encryption.ts
│   │   ├── image-processing.ts
│   │   └── tenant-resolution.ts
│   ├── constants/                     # Application constants
│   │   ├── database.ts
│   │   ├── errors.ts
│   │   └── permissions.ts
│   └── config/                        # Shared configuration
│       ├── database.ts
│       ├── redis.ts
│       └── external-apis.ts
│
├── infrastructure/                    # Infrastructure as Code
│   ├── terraform/                     # AWS resources
│   │   ├── modules/
│   │   │   ├── vpc/
│   │   │   ├── rds/
│   │   │   ├── documentdb/
│   │   │   ├── s3/
│   │   │   ├── cloudfront/
│   │   │   └── ecs/
│   │   ├── environments/
│   │   │   ├── dev/
│   │   │   ├── staging/
│   │   │   └── prod/
│   │   └── main.tf
│   ├── docker/                        # Docker configurations
│   │   ├── nginx/
│   │   ├── app/
│   │   └── monitoring/
│   └── kubernetes/                    # K8s manifests (future)
│       ├── namespaces/
│       ├── deployments/
│       └── services/
│
├── scripts/                          # Utility scripts
│   ├── setup/
│   │   ├── tenant-setup.sh          # New tenant provisioning
│   │   ├── database-migrate.sh       # Database migrations
│   │   └── ssl-setup.sh             # SSL certificate setup
│   ├── deployment/
│   │   ├── deploy.sh                # Main deployment script
│   │   ├── rollback.sh              # Rollback procedures
│   │   └── health-check.sh          # Health check utilities
│   └── maintenance/
│       ├── backup.sh                # Data backup procedures
│       ├── cleanup.sh               # Log and temp file cleanup
│       └── monitoring-setup.sh      # Monitoring configuration
│
├── docs/                             # Documentation
│   ├── architecture/                 # Architecture documentation
│   ├── api/                          # API documentation
│   ├── deployment/                   # Deployment guides
│   └── user-guide/                   # User documentation
│
├── tests/                            # Test suites
│   ├── unit/                         # Unit tests
│   ├── integration/                  # Integration tests
│   ├── e2e/                          # End-to-end tests
│   └── performance/                  # Performance tests
│
├── .github/                          # GitHub Actions workflows
│   ├── workflows/
│   │   ├── ci.yml                   # Continuous integration
│   │   ├── deploy.yml               # Deployment pipelines
│   │   ├── security.yml             # Security scanning
│   │   └── performance.yml          # Performance monitoring
│   └── templates/
│
├── package.json                      # Root package.json (workspaces)
├── pnpm-workspace.yaml              # PNPM workspace configuration
├── docker-compose.yml               # Local development
├── .env.example                      # Environment variables template
└── README.md                         # Project documentation
```

## Epic to Architecture Mapping

| Epic | Architecture Components | Technical Implementation | Data Flow |
| ---- | ---------------------- | ---------------------- | --------- |
| **Multi-Tenant Platform** (FR1-5) | Tenant Service + Database-per-tenant | PostgreSQL schema per tenant + tenant resolution middleware | Request → Tenant Resolution → Isolated Database |
| **User Management** (FR11-15) | User Service + Auth Service | JWT with refresh tokens + RBAC per tenant | Login → JWT → Role validation → Resource access |
| **AI Vehicle Upload** (FR16-21) | AI Service + Inventory Service + S3 | Event-driven processing pipeline | Upload → S3 → AI Processing → MongoDB → PostgreSQL |
| **Natural Language Interface** (FR22-26) | AI Service + NLP Service | GPT-4 API + command parsing middleware | Command → NLP Service → Intent resolution → Action execution |
| **Website Generation** (FR27-32) | Website Service + CDN | Static site generation + CloudFront distribution | Vehicle update → Website Service → Static generation → CDN |
| **Inventory Management** (FR33-38) | Inventory Service + Event Bus | Real-time synchronization across services | Status change → Event → Multiple service updates |
| **Customer Engagement** (FR39-43) | Notification Service + Webhooks | WhatsApp integration + email notifications | Customer inquiry → Notification Service → WhatsApp/Email |
| **Analytics & Reporting** (FR44-48) | Analytics Service + Data Warehouse | Real-time dashboards + batch reporting | User action → Event → Analytics processing → Dashboard |

---

**Checkpoint 1: Architecture Overview Complete** ✅

## Technology Stack Details

### Core Technologies

**Frontend Stack:**
- **Next.js 14** with App Router for server-side rendering and SEO optimization
- **React 18** with concurrent features for smooth UI interactions
- **TypeScript 5** for type safety and better developer experience
- **Tailwind CSS 3.4** with shadcn/ui component library for rapid UI development
- **Framer Motion** for micro-interactions and animations (respecting reduced motion preferences)

**Backend Stack:**
- **Node.js 20** LTS with **TypeScript** for API services
- **Express.js** for REST API endpoints with **helmet** for security headers
- **Prisma 5** as ORM for PostgreSQL with type-safe database operations
- **Mongoose 7** for MongoDB operations with schema validation
- **Bull Queue 4** for background job processing and AI task orchestration

**Database & Storage:**
- **PostgreSQL 15** with **PostGIS** extension for geographic data
- **MongoDB 7.0** Atlas for flexible vehicle content and AI-generated data
- **Redis 7** for session management, caching, and real-time data
- **AWS S3** for file storage with lifecycle policies
- **CloudFront CDN** for global content delivery

**AI & Machine Learning:**
- **OpenAI GPT-4 Turbo** for natural language processing and content generation
- **Google Vision API v1** for vehicle identification from photos
- **Hugging Face Transformers** for Indonesian language models (fine-tuning)
- **TensorFlow.js** for client-side image preprocessing

**Infrastructure & DevOps:**
- **AWS ECS Fargate** for container orchestration
- **AWS Application Load Balancer** with SSL termination
- **Terraform** for infrastructure as code
- **GitHub Actions** for CI/CD pipelines
- **Prometheus + Grafana** for monitoring and alerting
- **ELK Stack** for centralized logging

### Integration Points

**External Service Integrations:**
```typescript
// AI Service Integration Configuration
interface AIServiceConfig {
  openai: {
    apiKey: string;
    model: 'gpt-4-turbo-preview';
    maxTokens: 4000;
    temperature: 0.7;
  };
  googleVision: {
    credentials: GoogleCredentials;
    projectId: string;
    features: ['LABEL_DETECTION', 'OBJECT_LOCALIZATION'];
  };
}

// WhatsApp Integration (Business API)
interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  webhooks: {
    inboundMessages: '/webhooks/whatsapp/messages';
    messageStatus: '/webhooks/whatsapp/status';
  };
}

// CDN Configuration
interface CDNConfig {
  cloudFront: {
    distributionId: string;
    customDomains: string[];
    sslCertificate: string;
  };
  s3: {
    bucket: string;
    region: 'ap-southeast-3';
    storageClass: 'INTELLIGENT_TIERING';
  };
}
```

**Internal Service Communication:**
```typescript
// Event Bus Configuration
interface EventBusConfig {
  redis: {
    host: string;
    port: number;
    password: string;
  };
  channels: {
    vehicleUploads: 'vehicle.uploads';
    statusChanges: 'vehicle.status';
    aiProcessing: 'ai.processing';
    tenantEvents: 'tenant.events';
  };
}

// API Gateway Routing
interface APIGatewayConfig {
  routes: {
    '/api/v1/users': 'user-service:3001';
    '/api/v1/inventory': 'inventory-service:3002';
    '/api/v1/ai': 'ai-service:3003';
    '/api/v1/tenants': 'tenant-service:3004';
  };
  rateLimiting: {
    default: '1000/hour';
    aiProcessing: '100/hour';
    photoUpload: '50/minute';
  };
}
```

## Novel Pattern Designs

### Pattern 1: Multi-Tenant Theme Switching System

**Challenge:** Dynamic branding per tenant without code deployment

**Solution:** Runtime theme generation with CSS Custom Properties

```typescript
interface TenantTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    scale: number; // For accessibility (1.0 - 1.5)
  };
  branding: {
    logoUrl: string;
    faviconUrl: string;
    customCSS?: string;
  };
}

// Dynamic Theme Application
class TenantThemeProvider {
  private themeCache = new Map<string, string>();

  async generateThemeCSS(theme: TenantTheme): Promise<string> {
    if (this.themeCache.has(theme.id)) {
      return this.themeCache.get(theme.id)!;
    }

    const css = `
      :root {
        --tenant-primary: ${theme.colors.primary};
        --tenant-secondary: ${theme.colors.secondary};
        --tenant-accent: ${theme.colors.accent};
        --tenant-background: ${theme.colors.background};
        --tenant-surface: ${theme.colors.surface};
        --tenant-font-heading: ${theme.typography.headingFont};
        --tenant-font-body: ${theme.typography.bodyFont};
        --tenant-font-scale: ${theme.typography.scale};
      }

      .tenant-${theme.id} {
        --primary-color: var(--tenant-primary);
        --secondary-color: var(--tenant-secondary);
        /* ... more CSS custom properties */
      }
    `;

    this.themeCache.set(theme.id, css);
    return css;
  }
}
```

### Pattern 2: AI-Powered Vehicle Processing Pipeline

**Challenge:** Reliable photo processing with real-time feedback

**Solution:** Event-driven pipeline with status tracking

```typescript
interface VehicleUploadEvent {
  id: string;
  tenantId: string;
  userId: string;
  photos: string[];
  metadata: {
    uploadTime: Date;
    estimatedProcessingTime: number;
  };
}

class VehicleProcessingPipeline {
  async processUpload(event: VehicleUploadEvent) {
    // Step 1: Photo Validation
    await this.validatePhotos(event.photos);
    await this.updateStatus(event.id, 'PHOTO_VALIDATED');

    // Step 2: AI Analysis (parallel processing)
    const [visionResult, ocrResult] = await Promise.all([
      this.analyzeWithVision(event.photos),
      this.extractTextWithOCR(event.photos)
    ]);
    await this.updateStatus(event.id, 'AI_ANALYSIS_COMPLETE');

    // Step 3: Content Generation
    const generatedContent = await this.generateVehicleContent({
      vision: visionResult,
      ocr: ocrResult,
      context: await this.getTenantContext(event.tenantId)
    });
    await this.updateStatus(event.id, 'CONTENT_GENERATED');

    // Step 4: Vehicle Creation
    const vehicle = await this.createVehicleListing({
      ...generatedContent,
      tenantId: event.tenantId,
      userId: event.userId,
      photos: event.photos
    });
    await this.updateStatus(event.id, 'COMPLETE');

    return vehicle;
  }

  private async updateStatus(vehicleId: string, status: string) {
    // Emit real-time status update
    await this.eventBus.emit('vehicle.status.updated', {
      vehicleId,
      status,
      timestamp: new Date()
    });
  }
}
```

### Pattern 3: Natural Language Command Processing

**Challenge:** Context-aware command interpretation for automotive domain

**Solution:** Multi-stage NLP pipeline with context awareness

```typescript
interface NLCommand {
  raw: string;
  intent: string;
  entities: Map<string, any>;
  context: {
    tenantId: string;
    userId: string;
    previousCommands?: string[];
  };
  confidence: number;
}

class NaturalLanguageProcessor {
  async processCommand(input: string, context: NLPContext): Promise<NLCommand> {
    // Stage 1: Preprocessing
    const preprocessed = await this.preprocess(input, context);

    // Stage 2: Intent Recognition
    const intent = await this.recognizeIntent(preprocessed, context);

    // Stage 3: Entity Extraction
    const entities = await this.extractEntities(preprocessed, intent);

    // Stage 4: Context Validation
    const validated = await this.validateWithContext({
      intent,
      entities,
      context
    });

    return {
      raw: input,
      intent: validated.intent,
      entities: validated.entities,
      context,
      confidence: validated.confidence
    };
  }

  private async recognizeIntent(text: string, context: NLPContext) {
    const prompt = `
      As an automotive showroom assistant, interpret this command: "${text}"

      Context:
      - User role: ${context.userRole}
      - Tenant: ${context.tenantName}
      - Previous actions: ${context.previousActions?.join(', ') || 'none'}

      Possible intents:
      - UPLOAD_VEHICLE: Upload new vehicle photos
      - UPDATE_STATUS: Change vehicle status (available/booked/sold)
      - GENERATE_CONTENT: Create descriptions or marketing content
      - SEARCH_VEHICLES: Find specific vehicles
      - UPDATE_PRICING: Change vehicle prices
      - CREATE_PROMOTION: Generate promotional campaigns

      Return intent and confidence score.
    `;

    return await this.openai.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
  }
}
```

### Pattern 4: Real-time Multi-tenant Synchronization

**Challenge:** Keep tenant-specific catalogs in sync across all channels

**Solution:** Event sourcing with eventual consistency

```typescript
interface TenantEvent {
  id: string;
  tenantId: string;
  type: 'VEHICLE_CREATED' | 'VEHICLE_UPDATED' | 'VEHICLE_DELETED' | 'STATUS_CHANGED';
  aggregateId: string;
  data: any;
  timestamp: Date;
  version: number;
}

class TenantEventStore {
  async saveEvent(event: TenantEvent): Promise<void> {
    // Save to event store
    await this.eventRepository.save(event);

    // Emit to event bus for real-time updates
    await this.eventBus.emit(`tenant.${event.tenantId}.events`, event);

    // Update read models asynchronously
    await this.updateReadModels(event);
  }

  private async updateReadModels(event: TenantEvent) {
    switch (event.type) {
      case 'VEHICLE_CREATED':
        await this.vehicleReadModel.create(event.data);
        await this.searchIndex.index(event.data);
        await this.websiteGenerator.updateSite(event.tenantId);
        break;

      case 'STATUS_CHANGED':
        await this.vehicleReadModel.updateStatus(event.aggregateId, event.data.status);
        await this.searchIndex.updateStatus(event.aggregateId, event.data.status);
        await this.websiteGenerator.updateVehiclePage(event.tenantId, event.aggregateId);
        break;
    }
  }
}

class RealtimeSyncService {
  subscribeToTenantEvents(tenantId: string) {
    return this.eventBus.subscribe(`tenant.${tenantId}.events`, (event) => {
      // Update connected clients
      this.websocketServer.clients
        .filter(client => client.tenantId === tenantId)
        .forEach(client => client.send(JSON.stringify(event)));

      // Update CDN cache
      this.invalidateCDNCache(tenantId, event);

      // Update search indexes
      this.updateSearchIndex(event);
    });
  }
}
```

---

**Checkpoint 2: Technology Stack & Novel Patterns Complete** ✅

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents:

### Pattern 1: Multi-Tenant Data Access Pattern

**Purpose:** Ensure all services properly handle tenant isolation and data security

```typescript
interface TenantContext {
  tenantId: string;
  userId: string;
  userRole: 'admin' | 'sales' | 'readonly';
  permissions: string[];
}

abstract class BaseService {
  protected abstract validateTenantAccess(context: TenantContext, resourceId: string): Promise<boolean>;
  protected abstract getTenantConnection(tenantId: string): Promise<DatabaseConnection>;
}

class VehicleService extends BaseService {
  async getVehicle(vehicleId: string, context: TenantContext): Promise<Vehicle> {
    // 1. Validate tenant access
    const hasAccess = await this.validateTenantAccess(context, vehicleId);
    if (!hasAccess) {
      throw new UnauthorizedError('Access denied to vehicle');
    }

    // 2. Use tenant-specific database connection
    const connection = await this.getTenantConnection(context.tenantId);

    // 3. Query with tenant isolation
    const vehicle = await connection
      .select()
      .from('vehicles')
      .where('id', '=', vehicleId)
      .andWhere('tenant_id', '=', context.tenantId)
      .first();

    return vehicle;
  }

  protected async validateTenantAccess(context: TenantContext, resourceId: string): Promise<boolean> {
    // Check if user belongs to tenant
    const userTenant = await this.userRepository.getUserTenant(context.userId);
    if (userTenant !== context.tenantId) {
      return false;
    }

    // Check role-based permissions
    switch (context.userRole) {
      case 'admin':
        return true;
      case 'sales':
        return await this.checkSalesPermissions(context.userId, resourceId);
      case 'readonly':
        return true; // Read-only access
      default:
        return false;
    }
  }
}
```

### Pattern 2: AI Service Integration Pattern

**Purpose:** Standardize AI service calls with proper error handling and cost management

```typescript
interface AIRequest {
  type: 'vision' | 'nlp' | 'generation';
  input: any;
  context: {
    tenantId: string;
    userId: string;
    requestId: string;
  };
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
}

interface AIResponse {
  result: any;
  confidence: number;
  cost: number;
  tokensUsed: number;
  processingTime: number;
}

class AIServiceClient {
  private rateLimiters = new Map<string, RateLimiter>();
  private costTracker = new Map<string, number>();

  async processRequest(request: AIRequest): Promise<AIResponse> {
    // 1. Check rate limits
    await this.checkRateLimit(request.context.tenantId, request.type);

    // 2. Track costs
    const estimatedCost = this.estimateCost(request.type, request.options);
    await this.checkBudget(request.context.tenantId, estimatedCost);

    // 3. Process request
    const startTime = Date.now();
    let result: any;
    let confidence: number;
    let tokensUsed: number;

    try {
      switch (request.type) {
        case 'vision':
          ({ result, confidence } = await this.processVisionRequest(request.input));
          break;
        case 'nlp':
          ({ result, confidence, tokensUsed } = await this.processNLPRequest(request));
          break;
        case 'generation':
          ({ result, tokensUsed } = await this.processGenerationRequest(request));
          confidence = 0.8; // Default for generation
          break;
        default:
          throw new Error(`Unsupported AI request type: ${request.type}`);
      }

      const processingTime = Date.now() - startTime;
      const actualCost = this.calculateCost(request.type, tokensUsed);

      // 4. Log usage for billing
      await this.logUsage({
        ...request.context,
        type: request.type,
        cost: actualCost,
        tokensUsed,
        processingTime
      });

      return {
        result,
        confidence,
        cost: actualCost,
        tokensUsed,
        processingTime
      };

    } catch (error) {
      await this.logError(request.context, error);
      throw new AIServiceError(`AI processing failed: ${error.message}`);
    }
  }

  private async checkRateLimit(tenantId: string, type: string): Promise<void> {
    const key = `${tenantId}:${type}`;
    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, new RateLimiter({
        windowMs: 60 * 1000, // 1 minute
        max: type === 'vision' ? 10 : 100, // Different limits per type
      }));
    }

    const rateLimiter = this.rateLimiters.get(key)!;
    const canProceed = await rateLimiter.check();
    if (!canProceed) {
      throw new RateLimitError(`Rate limit exceeded for ${type}`);
    }
  }
}
```

### Pattern 3: Event-Driven Communication Pattern

**Purpose:** Standardize inter-service communication with reliability guarantees

```typescript
interface EventMessage {
  id: string;
  type: string;
  source: string;
  data: any;
  metadata: {
    timestamp: Date;
    correlationId: string;
    retryCount: number;
    maxRetries: number;
  };
}

class EventBus {
  private publishers = new Map<string, Publisher>();
  private subscribers = new Map<string, Subscriber[]>();

  async publish(event: EventMessage): Promise<void> {
    const publisher = this.getPublisher(event.type);

    try {
      await publisher.publish({
        ...event,
        metadata: {
          ...event.metadata,
          timestamp: new Date(),
          retryCount: 0
        }
      });

      await this.logEvent(event, 'PUBLISHED');
    } catch (error) {
      await this.handlePublishError(event, error);
      throw error;
    }
  }

  async subscribe(eventType: string, handler: EventHandler): Promise<void> {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }

    const subscriber = this.createSubscriber(eventType);
    subscriber.onMessage(async (message: EventMessage) => {
      try {
        await this.processMessage(message, handler);
      } catch (error) {
        await this.handleMessageError(message, error);
      }
    });

    this.subscribers.get(eventType)!.push(subscriber);
  }

  private async processMessage(message: EventMessage, handler: EventHandler): Promise<void> {
    // 1. Validate message structure
    this.validateMessage(message);

    // 2. Check for duplicate processing
    if (await this.isDuplicate(message.id)) {
      return;
    }

    // 3. Process the message
    const startTime = Date.now();
    await handler(message);
    const processingTime = Date.now() - startTime;

    // 4. Log successful processing
    await this.logEvent(message, 'PROCESSED', { processingTime });

    // 5. Mark as processed
    await this.markAsProcessed(message.id);
  }

  private async handleMessageError(message: EventMessage, error: Error): Promise<void> {
    const retryCount = message.metadata.retryCount + 1;

    if (retryCount <= message.metadata.maxRetries) {
      // Retry with exponential backoff
      const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s, etc.

      setTimeout(async () => {
        await this.publish({
          ...message,
          metadata: {
            ...message.metadata,
            retryCount
          }
        });
      }, delay);

      await this.logEvent(message, 'RETRY_SCHEDULED', {
        retryCount,
        nextRetryAt: new Date(Date.now() + delay)
      });
    } else {
      // Max retries exceeded - send to dead letter queue
      await this.sendToDeadLetterQueue(message, error);
      await this.logEvent(message, 'FAILED', {
        error: error.message,
        retryCount
      });
    }
  }
}
```

### Pattern 4: Caching Strategy Pattern

**Purpose:** Optimize performance with consistent caching across services

```typescript
interface CacheConfig {
  ttl: number; // Time to live in seconds
  strategy: 'write-through' | 'write-behind' | 'cache-aside';
  invalidateOn: string[]; // Events that should invalidate this cache
  maxSize?: number; // Maximum cache size
}

class CacheManager {
  private caches = new Map<string, Cache>();
  private invalidators = new Map<string, Invalidator>();

  async get<T>(key: string, fetcher: () => Promise<T>, config: CacheConfig): Promise<T> {
    const cache = this.getCache(key);

    // Try to get from cache first
    const cached = await cache.get(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch and store
    const data = await fetcher();

    switch (config.strategy) {
      case 'cache-aside':
        await cache.set(key, data, config.ttl);
        break;
      case 'write-through':
        await cache.set(key, data, config.ttl);
        await this.persistToDatabase(key, data);
        break;
      case 'write-behind':
        await cache.set(key, data, config.ttl);
        // Persist asynchronously
        this.persistToDatabase(key, data).catch(console.error);
        break;
    }

    return data;
  }

  async invalidate(pattern: string, event: string): Promise<void> {
    const keys = await this.getKeysByPattern(pattern);

    for (const key of keys) {
      const cache = this.getCache(key);
      await cache.delete(key);
    }

    await this.logInvalidation(pattern, event, keys.length);
  }

  setupAutoInvalidation(keyPattern: string, events: string[]): void {
    events.forEach(event => {
      if (!this.invalidators.has(event)) {
        this.invalidators.set(event, []);
      }

      this.invalidators.get(event)!.push(keyPattern);
    });

    // Subscribe to events
    events.forEach(event => {
      this.eventBus.subscribe(event, async (message) => {
        const patterns = this.invalidators.get(event) || [];
        for (const pattern of patterns) {
          await this.invalidate(pattern, event);
        }
      });
    });
  }
}
```

## Consistency Rules

### Naming Conventions

**Database Naming:**
- Tables: `snake_case` (e.g., `vehicle_listings`, `user_sessions`)
- Columns: `snake_case` (e.g., `created_at`, `tenant_id`)
- Indexes: `idx_table_column(s)` (e.g., `idx_vehicles_tenant_id`)
- Foreign Keys: `fk_table_column` (e.g., `fk_vehicles_tenant_id`)

**API Endpoints:**
- Routes: `kebab-case` (e.g., `/api/v1/vehicle-listings`, `/api/v1/user-profiles`)
- Query Parameters: `camelCase` (e.g., `?page=1&pageSize=20&sortBy=createdAt`)
- Response Fields: `camelCase` (e.g., `vehicleId`, `createdAt`, `listingPrice`)

**Code Conventions:**
- Classes: `PascalCase` (e.g., `VehicleService`, `TenantRepository`)
- Functions/Methods: `camelCase` (e.g., `processUpload()`, `validateTenant()`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_PHOTOS_PER_VEHICLE`, `DEFAULT_TTL`)
- Variables: `camelCase` (e.g., `tenantId`, `vehicleData`, `processingQueue`)

**File Naming:**
- TypeScript Files: `PascalCase` for classes/components (e.g., `VehicleCard.tsx`, `TenantService.ts`)
- Utility Files: `kebab-case` (e.g., `image-processing.ts`, `tenant-validation.ts`)
- Config Files: `kebab-case` (e.g., `database.config.ts`, `ai-services.config.ts`)

### Service Communication Standards

**API Response Format:**
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    requestId: string;
    timestamp: string;
  };
}
```

**Error Handling Standards:**
```typescript
interface ErrorContext {
  tenantId: string;
  userId: string;
  requestId: string;
  operation: string;
  timestamp: Date;
}

class BaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public context: ErrorContext,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends BaseError {
  constructor(message: string, context: ErrorContext, public field: string) {
    super(message, 'VALIDATION_ERROR', context, 400);
    this.field = field;
  }
}

class AuthorizationError extends BaseError {
  constructor(message: string, context: ErrorContext) {
    super(message, 'AUTHORIZATION_ERROR', context, 403);
  }
}
```

### Security Patterns

**Input Validation:**
```typescript
class VehicleValidationPipe {
  async transform(data: any, context: ExecutionContext): Promise<VehicleDTO> {
    // 1. Sanitize input
    const sanitized = this.sanitizeInput(data);

    // 2. Validate required fields
    const requiredFields = ['make', 'model', 'year', 'price'];
    for (const field of requiredFields) {
      if (!sanitized[field]) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    // 3. Validate data types and ranges
    if (sanitized.year < 1900 || sanitized.year > new Date().getFullYear() + 1) {
      throw new ValidationError('Invalid year value');
    }

    if (sanitized.price < 0 || sanitized.price > 10000000000) {
      throw new ValidationError('Invalid price range');
    }

    // 4. Check tenant-specific rules
    await this.validateTenantRules(sanitized, context.tenantId);

    return sanitized;
  }
}
```

**Rate Limiting Implementation:**
```typescript
class RateLimitMiddleware {
  private limiters = new Map<string, RateLimiter>();

  async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    const tenantId = request.user.tenantId;
    const userId = request.user.id;
    const endpoint = request.route.path;

    // Different limits per endpoint type
    const limits = this.getLimitsForEndpoint(endpoint);

    const key = `${tenantId}:${userId}:${endpoint}`;
    const limiter = this.getLimiter(key, limits);

    const result = await limiter.check();

    response.set({
      'X-RateLimit-Limit': limits.max,
      'X-RateLimit-Remaining': result.remaining,
      'X-RateLimit-Reset': result.resetTime
    });

    if (!result.allowed) {
      throw new RateLimitError('Rate limit exceeded');
    }

    next();
  }
}
```

---

**Checkpoint 3: Implementation Patterns Complete** ✅

## Security Architecture

### Authentication & Authorization

**JWT Token Structure:**
```typescript
interface JWTPayload {
  sub: string; // User ID
  tenantId: string;
  role: 'admin' | 'sales' | 'readonly';
  permissions: string[];
  iat: number; // Issued at
  exp: number; // Expires at
  iss: 'autolumiku'; // Issuer
  aud: 'autolumiku-api'; // Audience
}
```

**Multi-Factor Authentication:**
- Primary: Email/Password with bcrypt
- Secondary: Time-based OTP (TOTP) for admin users
- Session management with refresh tokens
- Device fingerprinting for anomaly detection

### Data Protection

**Encryption Strategy:**
- **In Transit:** TLS 1.3 for all API communications
- **At Rest:** AES-256 encryption for databases
- **In Memory:** Sensitive data encrypted in application memory
- **File Storage:** Server-side encryption for S3 objects

**Data Isolation:**
- Database-per-tenant model for complete isolation
- Row-level security for shared resources
- Separate S3 buckets per tenant with proper IAM policies
- Redis namespace isolation per tenant

### Compliance & Audit

**Audit Logging:**
```typescript
interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  oldValues?: any;
  newValues?: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  result: 'SUCCESS' | 'FAILURE';
}
```

**Compliance Features:**
- GDPR-compliant data handling and right to deletion
- Indonesian data protection law compliance
- Regular security audits and penetration testing
- PCI DSS compliance for payment processing (future)

---

## Performance & Scalability

### Caching Strategy

**Multi-Level Caching:**
1. **CDN Cache:** Static assets and API responses (5 minutes)
2. **Application Cache:** Redis for frequently accessed data (1 hour)
3. **Database Cache:** Query result caching (15 minutes)
4. **Browser Cache:** Static resources with proper headers

### Database Optimization

**Read Replicas:**
- Primary database for writes
- 3 read replicas for read operations
- Automatic failover and load balancing

**Indexing Strategy:**
- Composite indexes for common query patterns
- Partial indexes for filtered queries
- Full-text search indexes for vehicle search

### Performance Monitoring

**Key Metrics:**
- API response times (P95 < 500ms)
- Database query performance (P95 < 100ms)
- AI processing time (P95 < 30 seconds)
- CDN hit ratio (> 90%)
- Error rate (< 0.1%)

---

**Checkpoint 4: Security & Performance Complete** ✅

## Final Architecture Summary

### Architecture Decisions

| Decision | Rationale | Trade-offs | Alternatives Considered |
|----------|-----------|------------|-------------------------|
| **Microservices Architecture** | Independent scaling, fault isolation, team autonomy | Increased complexity, network latency | Monolith, Modular Monolith |
| **Database-per-Tenant** | Complete data isolation, compliance, security | Higher infrastructure costs, management overhead | Shared database with row-level security |
| **Event-Driven Communication** | Real-time updates, loose coupling, scalability | Eventual consistency, debugging complexity | Direct API calls, Message Queues |
| **Next.js with App Router** | SEO optimization, performance, developer experience | Learning curve, framework lock-in | React SPA, Vue.js, Angular |
| **Hybrid Database Strategy** | PostgreSQL for structured data, MongoDB for flexibility | Data synchronization complexity | Single database solution |

### Technical Risk Mitigation

**High-Risk Areas:**
1. **AI Service Dependencies:** Multiple providers, fallback mechanisms, cost controls
2. **Multi-Tenant Complexity:** Extensive testing, isolation validation, monitoring
3. **Real-Time Performance:** Comprehensive monitoring, load testing, fallback strategies
4. **Data Migration:** Phased rollout, rollback procedures, data validation

**Mitigation Strategies:**
- Circuit breakers for external service calls
- Comprehensive logging and monitoring
- Automated testing at all levels
- Blue-green deployment strategy
- Regular disaster recovery drills

---

**✅ Architecture Specification Complete**

This architecture provides a solid foundation for building autolumiku as a scalable, secure, and maintainable multi-tenant SaaS platform. The design balances technical excellence with practical considerations for the Indonesian automotive market and senior user requirements.

**Next Steps:**
1. Epic breakdown from architecture decisions
2. Implementation readiness validation
3. Sprint planning for development execution
## Authentication & Routing Architecture

### **CRITICAL ROUTING RULES - DO NOT MODIFY**

The platform uses **strict role-based routing separation** between Super Admin (platform management) and Showroom Admin (tenant management). These routes are **immutable** and must never be changed:

#### Super Admin Routes (Platform Management)
- **Login URL:** `/admin/login` (FIXED - Never change)
- **Dashboard:** `/admin` (FIXED - Never change)
- **Role Required:** `super_admin`
- **Features:**
  - `/admin` - Platform overview & tenant monitoring
  - `/admin/tenants` - Multi-tenant management
  - `/admin/users` - Cross-tenant user management
  - `/admin/health` - Platform health & analytics
  - `/admin/audit` - System-wide audit logs
  - `/admin/settings` - Platform configuration

**Protection Logic:**
```typescript
// src/app/admin/layout.tsx
if (userData.role !== 'super_admin') {
  window.location.href = '/dashboard'; // Redirect non-superadmin
}
```

#### Showroom Admin Routes (Tenant Management)
- **Login URL:** `/login` (FIXED - Never change)
- **Dashboard:** `/dashboard` (FIXED - Never change)
- **Role Required:** `admin`, `tenant_admin`, `staff` (must have `tenantId`)
- **Features:**
  - `/dashboard` - Showroom overview & statistics
  - `/dashboard/vehicles` - Vehicle inventory management
  - `/dashboard/leads` - Customer leads & WhatsApp integration
  - `/dashboard/users` - Showroom staff management
  - `/dashboard/settings` - Showroom configuration

**Protection Logic:**
```typescript
// src/app/dashboard/layout.tsx
if (!userData.tenantId) {
  window.location.href = '/admin/login'; // Not a showroom user
}
```

### Authentication Flow

```
┌─────────────────┐          ┌──────────────────┐
│  Super Admin    │          │  Showroom Admin  │
│  Login          │          │  Login           │
│  /admin/login   │          │  /login          │
└────────┬────────┘          └────────┬─────────┘
         │                            │
         ├── Validate credentials     ├── Validate credentials
         │   via /api/v1/auth/admin  │   via /api/v1/auth/login
         │   /login                   │
         │                            │
         ├── Check role               ├── Check tenantId
         │   Must be: super_admin     │   Must exist
         │                            │
         ▼                            ▼
┌─────────────────┐          ┌──────────────────┐
│  /admin         │          │  /dashboard      │
│  Platform Mgmt  │          │  Showroom Mgmt   │
└─────────────────┘          └──────────────────┘
```

### Logout Behavior

**Role-based redirect:**
```typescript
// Super admin logout
if (userRole === 'super_admin') {
  window.location.href = '/admin/login';
}

// Showroom admin logout
else {
  window.location.href = '/login';
}
```

### Why These Routes Are Fixed

1. **Security:** Prevents privilege escalation attacks
2. **Multi-tenancy:** Clear separation of platform vs tenant operations
3. **User Experience:** Different user types have different mental models
4. **Audit Compliance:** Route-based access logs for compliance
5. **Documentation:** Consistent URLs in all documentation and training materials

**⚠️ WARNING:** Changing these routes will break:
- Authentication flows
- Role-based access control
- User documentation
- Integration tests
- Production deployments

