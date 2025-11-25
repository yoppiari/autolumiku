# Vehicle Data Scraper - Super Admin Integration Plan

**Story:** 2.10 - Super Admin Vehicle Data Scraper
**Date:** 2025-11-24
**Status:** Planning Phase
**Priority:** High (Feeds AI system with fresh market data)

---

## Executive Summary

Integration of the working OLX Puppeteer scraper into the super admin panel, providing a web-based interface for managing popular vehicle database updates. This enables platform administrators to refresh market data on-demand, ensuring AI vehicle identification and price validation remain accurate.

### Current Status
✅ **Scraper Core Complete** - Puppeteer-based scraper successfully extracts 40+ vehicles from OLX Indonesia
✅ **Data Extraction Working** - Make, model, year (75% accuracy), price (100% accuracy)
⚠️ **Location Partial** - ~25% extraction rate (acceptable for MVP)
⏳ **Super Admin Integration** - Not yet implemented

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Super Admin Panel                         │
│  /admin/data-management/scraper                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Scraper Management API                          │
│  POST /api/admin/scraper/run                                │
│  GET  /api/admin/scraper/status                             │
│  GET  /api/admin/scraper/history                            │
│  POST /api/admin/scraper/import                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           Scraper Service (Existing)                         │
│  scripts/scrapers/puppeteer-olx-scraper.ts                  │
│  - Browser automation with Puppeteer                         │
│  - Data extraction & parsing                                 │
│  - Rate limiting & error handling                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Staging Database                                │
│  ScraperJob, ScraperResult tables                           │
│  - Store raw scraped data                                    │
│  - Admin review before import                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼ (After admin approval)
┌─────────────────────────────────────────────────────────────┐
│         Popular Vehicle Database                             │
│  PopularVehicle table                                        │
│  - Production data for AI                                    │
│  - Used by vehicle identification                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

#### 1. ScraperJob
Tracks scraper execution history

```prisma
model ScraperJob {
  id            String   @id @default(uuid())
  status        String   // 'running', 'completed', 'failed', 'cancelled'
  startedAt     DateTime @default(now())
  completedAt   DateTime?

  // Configuration
  source        String   // 'OLX'
  targetCount   Int      @default(50)

  // Results
  vehiclesFound Int      @default(0)
  vehiclesNew   Int      @default(0)
  vehiclesUpdated Int    @default(0)
  duplicates    Int      @default(0)
  errors        Json?    // Array of error messages

  // Metadata
  executedBy    String   // Admin user ID
  duration      Int?     // Seconds

  results       ScraperResult[]

  @@map("scraper_jobs")
}
```

#### 2. ScraperResult
Stores raw scraped data for admin review

```prisma
model ScraperResult {
  id            String   @id @default(uuid())
  jobId         String
  job           ScraperJob @relation(fields: [jobId], references: [id], onDelete: Cascade)

  // Scraped data
  source        String   // 'OLX'
  make          String
  model         String
  year          Int
  price         BigInt   // IDR cents
  priceDisplay  String
  location      String?
  url           String

  // Status
  status        String   // 'pending', 'approved', 'rejected', 'duplicate'
  reviewedAt    DateTime?
  reviewedBy    String?

  // Duplicate detection
  matchedVehicleId String? // If duplicate found
  confidence    Int      @default(0) // 0-100

  createdAt     DateTime @default(now())

  @@map("scraper_results")
}
```

#### 3. ScraperConfig
Configuration and rules

```prisma
model ScraperConfig {
  id                    String   @id @default(uuid())
  key                   String   @unique
  value                 Json
  description           String?
  updatedAt             DateTime @updatedAt
  updatedBy             String

  @@map("scraper_config")
}
```

**Default configs:**
- `duplicate_threshold`: 80 (confidence score for duplicate matching)
- `auto_import`: false (require manual review)
- `max_vehicles`: 500
- `price_validation_rules`: {...}
- `known_makes`: ["Toyota", "Honda", ...]

---

## Implementation Phases

### Phase 1: Backend Foundation (Day 1-2)

#### Tasks:
1. **Database Migrations**
   - Create ScraperJob, ScraperResult, ScraperConfig tables
   - Add indexes for performance
   - Seed default config

2. **Scraper Service Wrapper**
   - File: `src/lib/services/scraper-service.ts`
   - Wrap existing Puppeteer scraper
   - Add job tracking and logging
   - Implement duplicate detection algorithm
   - Handle staging data storage

3. **API Routes**
   - `POST /api/admin/scraper/run` - Start scraper job
   - `GET /api/admin/scraper/status/:jobId` - Check progress
   - `GET /api/admin/scraper/jobs` - List job history
   - `GET /api/admin/scraper/results/:jobId` - View scraped data
   - `POST /api/admin/scraper/import/:jobId` - Import to production
   - `POST /api/admin/scraper/reject/:resultId` - Reject specific result

**Files to create:**
```
src/
├── lib/
│   └── services/
│       └── scraper-service.ts          # NEW
├── app/
│   └── api/
│       └── admin/
│           └── scraper/
│               ├── run/
│               │   └── route.ts        # NEW
│               ├── status/
│               │   └── [jobId]/
│               │       └── route.ts    # NEW
│               ├── jobs/
│               │   └── route.ts        # NEW
│               ├── results/
│               │   └── [jobId]/
│               │       └── route.ts    # NEW
│               └── import/
│                   └── [jobId]/
│                       └── route.ts    # NEW
```

**Estimated:** 8-10 hours

---

### Phase 2: Super Admin UI (Day 3-4)

#### Tasks:
1. **Scraper Dashboard Page**
   - File: `src/app/admin/data-management/scraper/page.tsx`
   - Stats cards: Last run, total vehicles, data freshness
   - "Run Scraper" button with confirmation dialog
   - Job history table with filters

2. **Real-Time Progress View**
   - WebSocket or polling for live updates
   - Progress bar and status messages
   - Cancel job button

3. **Results Review Table**
   - File: `src/app/admin/data-management/scraper/results/[jobId]/page.tsx`
   - Filterable/searchable table
   - Show: make, model, year, price, status, duplicate indicator
   - Bulk actions: approve all, reject all
   - Individual actions: approve, reject, view details

4. **Configuration Panel**
   - File: `src/app/admin/data-management/scraper/config/page.tsx`
   - Edit duplicate threshold
   - Manage auto-import setting
   - Configure price validation rules

**Files to create:**
```
src/
└── app/
    └── admin/
        └── data-management/
            └── scraper/
                ├── page.tsx                    # Dashboard
                ├── results/
                │   └── [jobId]/
                │       └── page.tsx           # Results review
                └── config/
                    └── page.tsx               # Configuration
```

**UI Components needed:**
- ScraperDashboard
- JobHistoryTable
- ProgressIndicator
- ResultsTable
- ConfigForm
- StatsCards

**Estimated:** 10-12 hours

---

### Phase 3: Integration & Testing (Day 5)

#### Tasks:
1. **Duplicate Detection Algorithm**
   - Fuzzy matching for make/model
   - Year comparison (exact match)
   - Price similarity check
   - Confidence scoring

2. **Data Import Flow**
   - Validate data quality
   - Create/update PopularVehicle records
   - Handle conflicts (keep newer price, preserve manual edits)
   - Audit logging

3. **Error Handling**
   - Graceful failure recovery
   - Detailed error logs
   - Admin notifications for critical errors

4. **Testing**
   - Unit tests for scraper service
   - Integration tests for API routes
   - E2E tests for admin UI flow
   - Test duplicate detection accuracy

**Estimated:** 8 hours

---

### Phase 4: Polish & Documentation (Day 6)

#### Tasks:
1. **Performance Optimization**
   - Add caching for job status
   - Optimize database queries
   - Add indexes for large datasets

2. **Security Hardening**
   - Super admin role check middleware
   - Rate limiting on scraper API
   - CSRF protection
   - Input validation

3. **Documentation**
   - User guide for super admin
   - API documentation
   - Troubleshooting guide
   - Configuration reference

4. **Monitoring & Alerts**
   - Log scraper execution metrics
   - Alert on repeated failures
   - Track data quality metrics

**Estimated:** 4 hours

---

## Total Effort Estimate

| Phase | Duration | Hours |
|-------|----------|-------|
| Phase 1: Backend Foundation | 1-2 days | 8-10h |
| Phase 2: Super Admin UI | 2-3 days | 10-12h |
| Phase 3: Integration & Testing | 1 day | 8h |
| Phase 4: Polish & Documentation | 0.5 day | 4h |
| **TOTAL** | **5-6 days** | **30-34 hours** |

---

## UI Mockup (Text Description)

### Scraper Dashboard (`/admin/data-management/scraper`)

```
┌─────────────────────────────────────────────────────────────┐
│  🔧 Vehicle Data Scraper                          [Run Scraper]│
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Last Run     │  │ Total Vehicles│  │ Data Freshness│     │
│  │ 2 hours ago  │  │     412       │  │   🟢 Fresh    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ New Today    │  │ Updated Today │  │ Pending Review│     │
│  │      8       │  │      24       │  │      12       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  📊 Recent Jobs                                              │
│                                                               │
│  ┌─────────┬──────────┬────────┬─────────┬──────────────┐  │
│  │ Time    │ Status   │ Found  │ Imported│ Action       │  │
│  ├─────────┼──────────┼────────┼─────────┼──────────────┤  │
│  │ 2h ago  │ ✅ Done  │   40   │   32    │ [View]       │  │
│  │ 1d ago  │ ✅ Done  │   38   │   35    │ [View]       │  │
│  │ 3d ago  │ ❌ Failed│    0   │    0    │ [Retry]      │  │
│  └─────────┴──────────┴────────┴─────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Results Review Page (`/admin/data-management/scraper/results/[jobId]`)

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                         │
│                                                               │
│  Job #abc123 - Completed 2 hours ago                         │
│  Found: 40 vehicles | New: 32 | Duplicates: 8               │
│                                                               │
│  [Approve All] [Reject All]       🔍 Search: [________]     │
│                                                               │
│  ┌───────┬────────┬──────┬──────┬──────────┬────────────┐  │
│  │ Brand │ Model  │ Year │ Price│ Status   │ Action     │  │
│  ├───────┼────────┼──────┼──────┼──────────┼────────────┤  │
│  │Toyota │Avanza  │ 2020 │118jt │ ⏳Pending│[✓][✗][👁]│  │
│  │Honda  │Brio    │ 2019 │167jt │ ⏳Pending│[✓][✗][👁]│  │
│  │Toyota │Avanza  │ 2020 │120jt │ 🔄Dup(85%)│[✓][✗][👁]│  │
│  │BMW    │X1      │ 2024 │399jt │ ⏳Pending│[✓][✗][👁]│  │
│  └───────┴────────┴──────┴──────┴──────────┴────────────┘  │
│                                                               │
│  Showing 1-10 of 40                        [1][2][3][4][>]  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Smart Duplicate Detection
```typescript
// Algorithm
function detectDuplicate(newVehicle, existingVehicles) {
  for (const existing of existingVehicles) {
    let confidence = 0;

    // Exact make match
    if (newVehicle.make === existing.make) confidence += 40;

    // Fuzzy model match
    const modelSimilarity = calculateSimilarity(newVehicle.model, existing.model);
    confidence += modelSimilarity * 30;

    // Year match
    if (newVehicle.year === existing.year) confidence += 20;

    // Price similarity (within 10%)
    const priceDiff = Math.abs(newVehicle.price - existing.price) / existing.price;
    if (priceDiff < 0.1) confidence += 10;

    if (confidence >= duplicateThreshold) {
      return { isDuplicate: true, confidence, match: existing };
    }
  }

  return { isDuplicate: false };
}
```

### 2. Real-Time Progress Updates

Use Server-Sent Events (SSE) for live progress:

```typescript
// API: /api/admin/scraper/stream/:jobId
export async function GET(req, { params }) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Poll job status and send updates
      const interval = setInterval(async () => {
        const job = await getJobStatus(params.jobId);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(job)}\n\n`));

        if (job.status !== 'running') {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

### 3. Bulk Import with Conflict Resolution

```typescript
async function importResults(jobId: string, options: ImportOptions) {
  const results = await getApprovedResults(jobId);

  for (const result of results) {
    const existing = await findExistingVehicle(result);

    if (existing) {
      // Update only if price changed significantly
      if (Math.abs(result.price - existing.price) > existing.price * 0.05) {
        await updateVehicle(existing.id, {
          usedCarPrices: mergePrice(existing.usedCarPrices, result),
          updatedAt: new Date()
        });
      }
    } else {
      // Create new vehicle
      await createVehicle(result);
    }
  }

  await markJobAsImported(jobId);
}
```

---

## Security Considerations

1. **Authorization**
   - Only super admin role can access scraper
   - JWT validation on all API routes
   - Rate limiting: max 5 scraper runs per day

2. **Data Validation**
   - Sanitize all scraped data
   - Validate year range (1980-2025)
   - Price sanity checks (10M - 10B IDR)
   - Known makes whitelist

3. **Error Handling**
   - Graceful degradation if scraper fails
   - Rollback on partial import failure
   - Detailed error logging without exposing internals

---

## Testing Strategy

### Unit Tests
- Duplicate detection algorithm
- Price parsing and validation
- Data transformation logic

### Integration Tests
- API routes with auth
- Database operations
- Scraper service wrapper

### E2E Tests
- Complete scraper flow: run → review → import
- Error scenarios: failed scrape, duplicate handling
- Permission checks

---

## Future Enhancements (Post-MVP)

1. **Scheduled Scraping**
   - Cron job for automatic daily runs
   - Email notifications on completion

2. **Multi-Source Support**
   - Add Mobil123 scraper
   - Add Carmudi scraper
   - Source comparison and deduplication

3. **Advanced Analytics**
   - Price trend visualization
   - Popular vehicle insights
   - Market demand indicators

4. **Machine Learning Integration**
   - Auto-categorization of variants
   - Price prediction model
   - Anomaly detection

---

## Success Criteria

✅ Super admin can run scraper on-demand
✅ Real-time progress visible during execution
✅ Scraped data presented for review before import
✅ Duplicate detection prevents data pollution
✅ Import updates PopularVehicle table successfully
✅ AI system uses updated data for identification
✅ Execution time < 5 minutes for 50 vehicles
✅ Error rate < 5% on successful scrapes

---

## Dependencies

- ✅ Puppeteer scraper (already working)
- ✅ PopularVehicle database schema (Story 2.9)
- ⏳ Super admin role setup
- ⏳ Admin panel layout

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OLX blocks scraper | High | Use residential proxies, rotate user agents |
| Scraper runs too long | Medium | Add timeout (5 min), pagination support |
| Duplicate detection false positives | Medium | Tunable threshold, manual review |
| Database lock on import | Low | Use transactions, batch inserts |

---

**Document Version:** 1.0
**Last Updated:** 2025-11-24
**Owner:** Platform Team
**Reviewers:** CTO, Product Manager
