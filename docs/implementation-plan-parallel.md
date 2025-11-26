# Implementation Plan - Parallel Batches
**Project:** AutoLumiku - Complete Remaining Epic Features
**Strategy:** Parallel implementation in manageable batches
**Estimated Total Time:** 40-50 hours (across all batches)

---

## 🎯 BATCH 1: Foundation & Quick Wins (8-10 hours)
**Goal:** Complete Epic 5 + Setup Epic 1 Subscription
**Priority:** HIGH - Customer-facing features
**Complexity:** MEDIUM

### Parallel Track A: Epic 5.9 - Business Info Management
**Files to Create/Modify: 6 files**
```
1. Database Schema:
   - prisma/schema.prisma
     Add to Tenant model:
     - phoneNumber, phoneNumberSecondary
     - whatsappNumber
     - email
     - address, city, province, postalCode
     - googleMapsUrl, latitude, longitude
     - businessHours (JSON)
     - socialMedia (JSON: instagram, facebook, tiktok)

2. API Endpoint:
   - src/app/api/v1/tenants/[id]/business-info/route.ts
     PUT endpoint to update business info

3. Admin UI:
   - src/app/dashboard/settings/business/page.tsx
     Form with all business info fields
     Google Maps picker integration
     Social media links

4. Catalog Integration:
   - src/components/catalog/CatalogFooter.tsx (NEW)
     Display business info in footer
   - src/app/catalog/[slug]/contact/page.tsx (NEW)
     Contact page with map
   - Update CatalogHeader.tsx with phone/WA buttons
```

### Parallel Track B: Epic 1 - Subscription Status (Simplified)
**Files to Create/Modify: 5 files**
```
1. Super Admin UI:
   - src/app/admin/tenants/[id]/subscription/page.tsx (NEW)
     Form to assign subscription to tenant:
     - Plan selector (Basic/Professional/Enterprise)
     - Status (Active/Trial/Suspended/Expired)
     - Period dates (start, end)
     - Usage limits config

2. API Endpoint:
   - src/app/api/v1/tenants/[id]/subscription/route.ts
     PUT to update subscription

3. Showroom Admin View (Read-only):
   - src/components/dashboard/SubscriptionCard.tsx (NEW)
     Display subscription info card
   - Add to src/app/dashboard/page.tsx
     Show subscription status in dashboard
   - Add to src/app/dashboard/settings/page.tsx
     View-only subscription details
```

**Parallel Dependencies:** None (can run simultaneously)
**Estimated Time:**
- Track A: 4-5 hours
- Track B: 3-4 hours
**Total Batch 1:** 8-10 hours

---

## 🎯 BATCH 2: Catalog Enhancement (10-12 hours)
**Goal:** Complete Epic 5 (Stories 5.7 & 5.8)
**Priority:** HIGH - Differentiation features
**Complexity:** HIGH

### Parallel Track A: Story 5.7 - Layout Customization
**Files to Create/Modify: 7 files**
```
1. Database Schema:
   - prisma/schema.prisma
     Add CatalogLayout model:
     - tenantId (relation to Tenant)
     - layoutType (GRID/LIST/FEATURED)
     - heroSection (JSON: enabled, title, subtitle, imageUrl)
     - featuredVehicleIds (String[])
     - sectionOrder (String[])
     - navigationMenu (JSON)

2. Service:
   - src/lib/services/catalog/layout.service.ts (NEW)
     CRUD operations for layout config

3. API Endpoints:
   - src/app/api/v1/catalog/layout/route.ts (NEW)
     GET/PUT layout config

4. Admin UI:
   - src/app/dashboard/catalog/layout/page.tsx (NEW)
     Layout customization interface:
     - Template selector
     - Featured vehicles multi-select
     - Hero banner upload
     - Section order drag & drop
     - Preview button

5. Catalog Implementation:
   - Update src/app/catalog/[slug]/page.tsx
     Apply layout config (hero, sections, order)
   - src/components/catalog/HeroSection.tsx (NEW)
     Hero banner component
```

### Parallel Track B: Story 5.8 - Multiple Themes
**Files to Create/Modify: 8 files**
```
1. Theme System:
   - src/lib/themes/theme-definitions.ts (NEW)
     Define 4 themes with CSS variables:
     - Modern (current)
     - Classic
     - Luxury
     - Minimal

2. Database:
   - Add to Tenant model: selectedTheme (String)

3. Service:
   - src/lib/services/catalog/theme.service.ts (NEW)
     Theme switching logic

4. API:
   - src/app/api/v1/catalog/theme/route.ts (NEW)
     GET/PUT theme selection

5. Admin UI:
   - src/app/dashboard/catalog/themes/page.tsx (NEW)
     Theme gallery with previews
     Live preview modal
     Apply theme button

6. Components:
   - src/components/catalog/ThemePreview.tsx (NEW)
     Theme preview card
   - src/components/catalog/ThemeProvider.tsx (NEW)
     Apply theme CSS variables

7. Catalog Integration:
   - Update catalog pages to use ThemeProvider
   - Dynamic CSS loading based on theme
```

**Parallel Dependencies:** None (independent tracks)
**Estimated Time:**
- Track A: 6-7 hours
- Track B: 5-6 hours
**Total Batch 2:** 10-12 hours

---

## 🎯 BATCH 3: Lead Management System (8-10 hours)
**Goal:** Complete Epic 6 - Real Lead Tracking & Management
**Priority:** HIGH - Revenue generation
**Complexity:** MEDIUM

### Parallel Track A: Lead Tracking Infrastructure
**Files to Create/Modify: 6 files**
```
1. Database Schema:
   - prisma/schema.prisma
     Add Lead model:
     - tenantId, vehicleId
     - source (WHATSAPP/PHONE/FORM/WEBSITE)
     - customerName, phone, email
     - message, notes
     - status (NEW/CONTACTED/INTERESTED/NOT_INTERESTED/CONVERTED)
     - assignedTo (userId)
     - createdAt, lastContactAt

2. API Endpoints:
   - src/app/api/v1/leads/route.ts (NEW)
     GET (list), POST (create)
   - src/app/api/v1/leads/[id]/route.ts (NEW)
     GET, PUT, DELETE
   - src/app/api/v1/leads/track/route.ts (NEW)
     POST - Track WhatsApp click

3. Service:
   - src/lib/services/lead-service.ts (NEW)
     Lead CRUD operations
     Statistics calculations
```

### Parallel Track B: WhatsApp Integration & Settings
**Files to Create/Modify: 5 files**
```
1. Database Schema:
   - Add WhatsAppSettings model:
     - tenantId
     - phoneNumber, isActive
     - defaultMessage, autoReply
     - workingHours (JSON)

2. API Endpoints:
   - src/app/api/v1/whatsapp-settings/route.ts (NEW)
     GET/PUT WhatsApp settings

3. Update Catalog:
   - Update VehicleCard.tsx
     Send tracking event before opening WhatsApp
   - Update vehicle detail page
     Same tracking integration

4. Admin UI (replace mock):
   - Update src/app/dashboard/leads/whatsapp-settings/page.tsx
     Connect to real API
     Save to database
```

### Parallel Track C: Message Templates & Dashboard
**Files to Create/Modify: 6 files**
```
1. Database:
   - Add MessageTemplate model:
     - tenantId, name, category
     - content (with {{variables}})
     - isActive

2. API:
   - src/app/api/v1/message-templates/route.ts (NEW)
     CRUD for templates

3. Admin UI:
   - src/app/dashboard/leads/templates/page.tsx (NEW)
     Template management interface
     Variable helper

4. Dashboard Update:
   - Update src/app/dashboard/leads/page.tsx
     Connect to real Lead API
     Real-time stats
     Lead status updates
```

**Parallel Dependencies:**
- Track A → Track B (Track B needs Lead model)
- Track C can run parallel to A & B
**Estimated Time:**
- Track A: 3-4 hours
- Track B: 2-3 hours
- Track C: 3-4 hours
**Total Batch 3:** 8-10 hours

---

## 🎯 BATCH 4: Analytics Foundation (6-8 hours)
**Goal:** Setup Analytics Infrastructure & Basic Tracking
**Priority:** MEDIUM - Data collection
**Complexity:** MEDIUM

### Parallel Track A: Event Tracking System
**Files to Create/Modify: 5 files**
```
1. Database:
   - prisma/schema.prisma
     Add AnalyticsEvent model:
     - tenantId, vehicleId, userId (optional)
     - eventType (PAGE_VIEW/PHOTO_CLICK/WHATSAPP_CLICK/PHONE_CLICK/etc)
     - metadata (JSON)
     - sessionId, ipAddress, userAgent
     - timestamp

2. Service:
   - src/lib/services/analytics/tracking-service.ts (NEW)
     Track events
     Session management

3. API:
   - src/app/api/v1/analytics/track/route.ts (NEW)
     POST event tracking

4. Client-Side:
   - src/lib/analytics/tracker.ts (NEW)
     Client-side tracking utility
   - Integrate in catalog pages (page views, clicks)
```

### Parallel Track B: Analytics Aggregation Service
**Files to Create/Modify: 4 files**
```
1. Service:
   - src/lib/services/analytics/aggregation-service.ts (NEW)
     Calculate daily/weekly/monthly stats
     Generate reports

2. API:
   - src/app/api/v1/analytics/dashboard/route.ts (NEW)
     Replace mock data with real aggregations

3. Update existing:
   - Update src/app/api/admin/analytics/route.ts
     Use real data from aggregation service
```

**Parallel Dependencies:** Track A must complete before Track B
**Estimated Time:**
- Track A: 3-4 hours
- Track B: 3-4 hours
**Total Batch 4:** 6-8 hours (sequential)

---

## 🎯 BATCH 5: Analytics Dashboards (Part 1) (8-10 hours)
**Goal:** Epic 7 - Stories 7.1, 7.2, 7.3
**Priority:** MEDIUM - Business insights
**Complexity:** MEDIUM-HIGH

### Parallel Track A: Story 7.1 - Sales Performance
**Files to Create/Modify: 4 files**
```
1. Service:
   - src/lib/services/analytics/sales-analytics.ts (NEW)
     Conversion funnel calculation
     Sales team performance
     Win/loss analysis

2. API:
   - src/app/api/v1/analytics/sales/route.ts (NEW)
     Sales metrics endpoint

3. Dashboard UI:
   - src/app/dashboard/analytics/sales/page.tsx (NEW)
     Sales funnel visualization
     Team performance charts
     Conversion metrics
```

### Parallel Track B: Story 7.2 - Website Traffic
**Files to Create/Modify: 4 files**
```
1. Service:
   - src/lib/services/analytics/traffic-analytics.ts (NEW)
     Traffic analysis from AnalyticsEvent
     Engagement metrics
     Popular vehicles

2. API:
   - src/app/api/v1/analytics/traffic/route.ts (NEW)

3. Dashboard UI:
   - src/app/dashboard/analytics/traffic/page.tsx (NEW)
     Traffic charts (daily/weekly)
     Top vehicles by views
     Engagement heatmap
```

### Parallel Track C: Story 7.3 - Inventory Analytics
**Files to Create/Modify: 4 files**
```
1. Service:
   - src/lib/services/analytics/inventory-analytics.ts (NEW)
     Days on lot calculation
     Turnover rates
     Aging report

2. API:
   - src/app/api/v1/analytics/inventory/route.ts (NEW)

3. Dashboard UI:
   - src/app/dashboard/analytics/inventory/page.tsx (NEW)
     Inventory aging chart
     Turnover metrics
     Fast/slow movers
```

**Parallel Dependencies:** All need Batch 4 complete
**Estimated Time:**
- Track A: 3-4 hours
- Track B: 3-4 hours
- Track C: 2-3 hours
**Total Batch 5:** 8-10 hours

---

## 🎯 BATCH 6: Analytics Dashboards (Part 2) (8-10 hours)
**Goal:** Epic 7 - Stories 7.4, 7.5, 7.6
**Priority:** LOW-MEDIUM - Advanced insights
**Complexity:** MEDIUM-HIGH

### Parallel Track A: Story 7.4 - Customer Analytics
**Files to Create/Modify: 4 files**
```
1. Database:
   - Add Customer model (basic demographics)

2. Service:
   - src/lib/services/analytics/customer-analytics.ts (NEW)

3. API + UI:
   - src/app/api/v1/analytics/customers/route.ts (NEW)
   - src/app/dashboard/analytics/customers/page.tsx (NEW)
```

### Parallel Track B: Story 7.5 - Marketing Campaigns
**Files to Create/Modify: 4 files**
```
1. Database:
   - Add Campaign model (UTM tracking)

2. Service:
   - src/lib/services/analytics/campaign-analytics.ts (NEW)

3. API + UI:
   - src/app/api/v1/analytics/campaigns/route.ts (NEW)
   - src/app/dashboard/analytics/campaigns/page.tsx (NEW)
```

### Parallel Track C: Story 7.6 - Financial Analytics
**Files to Create/Modify: 4 files**
```
1. Service:
   - src/lib/services/analytics/financial-analytics.ts (NEW)
     Revenue trends
     Profit margins
     Forecasting

2. API + UI:
   - src/app/api/v1/analytics/financial/route.ts (NEW)
   - src/app/dashboard/analytics/financial/page.tsx (NEW)
     Revenue charts
     Profitability analysis
```

**Parallel Dependencies:** Independent
**Estimated Time:**
- Track A: 3-4 hours
- Track B: 2-3 hours
- Track C: 3-4 hours
**Total Batch 6:** 8-10 hours

---

## 🎯 BATCH 7: Final Polish & Feedback System (4-6 hours)
**Goal:** Epic 7.8 - Customer Satisfaction + Competitor Analytics Enhancement
**Priority:** LOW - Nice to have
**Complexity:** MEDIUM

### Track A: Story 7.8 - Feedback System
**Files to Create/Modify: 6 files**
```
1. Database:
   - Add CustomerFeedback model (rating, review, NPS)

2. Public Form:
   - src/app/catalog/[slug]/feedback/page.tsx (NEW)
     Post-purchase survey form

3. Service + API:
   - src/lib/services/analytics/feedback-analytics.ts (NEW)
   - src/app/api/v1/analytics/feedback/route.ts (NEW)

4. Dashboard:
   - src/app/dashboard/analytics/feedback/page.tsx (NEW)
     NPS score, sentiment analysis
```

### Track B: Story 7.7 Enhancement - Competitor Dashboard
**Files to Create/Modify: 3 files**
```
1. Service:
   - src/lib/services/analytics/competitor-analytics.ts (NEW)
     Use existing scraper data
     Price comparison charts

2. Dashboard:
   - src/app/dashboard/analytics/competitors/page.tsx (NEW)
     Competitor price comparison
     Market position
```

**Estimated Time:** 4-6 hours

---

## 📊 EXECUTION SUMMARY

| Batch | Focus | Hours | Files | Priority | Dependencies |
|-------|-------|-------|-------|----------|--------------|
| **Batch 1** | Epic 5.9 + Subscription | 8-10 | 11 | HIGH | None |
| **Batch 2** | Epic 5.7 & 5.8 (Catalog) | 10-12 | 15 | HIGH | None |
| **Batch 3** | Epic 6 (Leads) | 8-10 | 17 | HIGH | None |
| **Batch 4** | Analytics Foundation | 6-8 | 9 | MEDIUM | None |
| **Batch 5** | Analytics Part 1 | 8-10 | 12 | MEDIUM | Batch 4 |
| **Batch 6** | Analytics Part 2 | 8-10 | 12 | LOW-MED | Batch 4 |
| **Batch 7** | Feedback & Polish | 4-6 | 9 | LOW | None |
| **TOTAL** | **All Epics Complete** | **40-50** | **85** | - | - |

---

## 🚀 RECOMMENDED EXECUTION ORDER

**Week 1:**
- Day 1-2: Batch 1 (Business Info + Subscription)
- Day 3-4: Batch 2 (Layout + Themes)

**Week 2:**
- Day 5-6: Batch 3 (Leads System)
- Day 7: Batch 4 (Analytics Foundation)

**Week 3:**
- Day 8-9: Batch 5 (Analytics Part 1)
- Day 10: Batch 6 (Analytics Part 2)

**Week 4:**
- Day 11: Batch 7 (Polish)
- Day 12: Testing & Bug fixes

---

## ✅ PARALLELIZATION STRATEGY

**Within Each Batch:**
- Independent tracks can be developed simultaneously
- Use separate feature branches for each track
- Merge to develop after track completion
- Minimal merge conflicts (different files)

**Example Batch 1 Execution:**
```
Developer A: Epic 5.9 (Business Info) → 6 files
Developer B: Epic 1 (Subscription) → 5 files
Total Time: 5 hours (instead of 9 sequential)
```

**Example Batch 2 Execution:**
```
Developer A: Layout Customization → 7 files
Developer B: Theme System → 8 files
Total Time: 7 hours (instead of 13 sequential)
```

---

## 🎯 DELIVERABLES PER BATCH

Each batch produces:
1. ✅ Working features (tested)
2. ✅ Database migrations (if needed)
3. ✅ API endpoints (documented)
4. ✅ UI components (responsive)
5. ✅ Git commit + push
6. ✅ Updated BMAD workflow status

---

**Apakah rencana ini sudah sesuai? Mau mulai dari Batch mana?** 🚀
