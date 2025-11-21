# Epic 7 Implementation Plan
## Analytics & Business Intelligence

**Status**: 🚀 **READY TO START**
**Date**: November 20, 2025
**Implementation Strategy**: Parallel (3 Streams)

---

## Epic Overview

**Goal**: Provide comprehensive analytics and business intelligence for showroom owners to make data-driven decisions.

### Stories to Implement

✅ **Story 7.1**: Lead Conversion & Sales Performance Analytics
✅ **Story 7.2**: Website Traffic & Customer Engagement Analytics
✅ **Story 7.3**: Inventory Turnover & Sales Velocity Analysis
✅ **Story 7.4**: Customer Demographics & Behavior Analysis
✅ **Story 7.5**: Marketing Campaign Performance Tracking
✅ **Story 7.6**: Financial Performance & Revenue Analytics
✅ **Story 7.7**: Competitor Analysis & Market Position
✅ **Story 7.8**: Customer Satisfaction & Feedback Analytics

---

## Implementation Strategy

### Parallel Development (3 Streams)

**Stream A: Backend Analytics Services**
- Analytics service layer
- Data aggregation queries
- Metrics calculation engine
- Caching layer for performance
- Real-time data processing

**Stream B: Dashboard UI Components**
- Main analytics dashboard layout
- KPI cards and metrics display
- Filter and date range controls
- Responsive grid layout
- Loading states and error handling

**Stream C: Data Visualization**
- Chart components (line, bar, pie, area)
- Interactive graphs with drill-down
- Trend indicators and comparisons
- Export functionality (PDF, Excel, CSV)
- Real-time chart updates

---

## Architecture

### Backend Services

```
/src/services/analytics-service/
├── types.ts                    - Analytics types & interfaces
├── analytics-engine.ts         - Core analytics calculation
├── sales-analytics.ts          - Sales & conversion metrics
├── inventory-analytics.ts      - Inventory turnover metrics
├── customer-analytics.ts       - Customer behavior metrics
├── financial-analytics.ts      - Revenue & financial metrics
├── traffic-analytics.ts        - Website traffic metrics
├── campaign-analytics.ts       - Marketing campaign metrics
├── data-aggregator.ts          - Data aggregation utilities
└── cache-manager.ts            - Analytics caching layer
```

### Frontend Components

```
/src/components/analytics/
├── AnalyticsDashboard.tsx      - Main dashboard container
├── KPICard.tsx                 - Metric display card
├── SalesChart.tsx              - Sales performance chart
├── InventoryChart.tsx          - Inventory metrics chart
├── CustomerChart.tsx           - Customer demographics chart
├── RevenueChart.tsx            - Revenue trends chart
├── TrafficChart.tsx            - Website traffic chart
├── ConversionFunnel.tsx        - Lead conversion funnel
├── DateRangePicker.tsx         - Date range selector
├── MetricComparison.tsx        - Period comparison
├── TrendIndicator.tsx          - Trend up/down indicator
└── ExportButton.tsx            - Export functionality
```

### API Routes

```
/src/app/api/v1/analytics/
├── sales/route.ts              - Sales metrics
├── inventory/route.ts          - Inventory metrics
├── customers/route.ts          - Customer metrics
├── financial/route.ts          - Financial metrics
├── traffic/route.ts            - Website traffic metrics
├── campaigns/route.ts          - Campaign metrics
├── overview/route.ts           - Dashboard overview
└── export/route.ts             - Data export
```

---

## Key Metrics to Track

### Sales Performance (Story 7.1)
- **Conversion Rates**: Inquiry → Test Drive → Purchase
- **Sales Cycle Duration**: Average days from inquiry to sale
- **Sales by Category**: Performance by vehicle type
- **Sales by Salesperson**: Individual performance tracking
- **Lead Response Time**: Average time to respond to inquiries
- **Close Rate**: Percentage of leads converted to sales

### Website Traffic (Story 7.2)
- **Visitor Metrics**: Unique visitors, page views, bounce rate
- **Engagement Metrics**: Avg session duration, pages per session
- **Popular Vehicles**: Most viewed, most inquired, most shared
- **Traffic Sources**: Direct, search, social, referral
- **Conversion Rate**: Website visit → inquiry submission
- **Device Breakdown**: Mobile vs desktop vs tablet

### Inventory Performance (Story 7.3)
- **Turnover Rate**: Average days on lot per vehicle
- **Sales Velocity**: Units sold per month by category
- **Inventory Value**: Total inventory worth
- **Aging Analysis**: Vehicles by age (0-30, 31-60, 61-90, 90+ days)
- **Seasonal Trends**: Month-over-month comparisons
- **Price Performance**: Discount rates and price adjustments

### Customer Analytics (Story 7.4)
- **Demographics**: Age, location, income distribution
- **Preferences**: Popular makes/models, price ranges
- **Behavior Patterns**: Browse patterns, inquiry timing
- **Customer Lifetime Value**: Average value per customer
- **Repeat Purchase Rate**: Returning customer percentage
- **Referral Rate**: Customer referrals and sources

### Marketing Performance (Story 7.5)
- **Campaign ROI**: Cost per lead, cost per acquisition
- **Channel Performance**: Performance by marketing channel
- **Lead Quality**: Lead-to-sale conversion by source
- **Budget Efficiency**: Spend vs results by campaign
- **Attribution**: Multi-touch attribution analysis
- **A/B Test Results**: Campaign variant performance

### Financial Metrics (Story 7.6)
- **Revenue Trends**: Daily, weekly, monthly, yearly
- **Profit Margins**: Gross margin by vehicle category
- **Operating Expenses**: Cost breakdown and trends
- **Cash Flow**: Money in vs money out
- **Profitability**: Net profit and profit growth
- **Forecasting**: Predicted revenue based on trends

### Competitor Analysis (Story 7.7)
- **Price Comparison**: Your prices vs competitor prices
- **Inventory Gap Analysis**: Opportunities in market
- **Market Share**: Your position vs competitors
- **Pricing Recommendations**: Suggested price adjustments
- **Competitive Alerts**: Competitor price changes
- **Market Trends**: Local market demand patterns

### Customer Satisfaction (Story 7.8)
- **NPS Score**: Net Promoter Score tracking
- **Satisfaction Ratings**: Average customer ratings
- **Feedback Themes**: Common positive/negative themes
- **Service Quality**: Response time, resolution rate
- **Review Analysis**: Sentiment analysis of reviews
- **Improvement Areas**: Data-driven recommendations

---

## Database Queries & Aggregations

### Sales Analytics Queries

```sql
-- Sales by period
SELECT
  DATE_TRUNC('month', "createdAt") as month,
  COUNT(*) as total_sales,
  SUM(price) as total_revenue,
  AVG(price) as avg_sale_price
FROM vehicles
WHERE status = 'SOLD' AND "tenantId" = $1
GROUP BY month
ORDER BY month DESC;

-- Conversion funnel
SELECT
  COUNT(CASE WHEN status = 'inquiry' THEN 1 END) as inquiries,
  COUNT(CASE WHEN status = 'test_drive' THEN 1 END) as test_drives,
  COUNT(CASE WHEN status = 'negotiation' THEN 1 END) as negotiations,
  COUNT(CASE WHEN status = 'sold' THEN 1 END) as sales
FROM customer_leads
WHERE "tenantId" = $1 AND "createdAt" >= $2;

-- Sales by salesperson
SELECT
  u."firstName", u."lastName",
  COUNT(v.id) as vehicles_sold,
  SUM(v.price) as total_revenue,
  AVG(v.price) as avg_sale_price
FROM vehicles v
JOIN users u ON v."createdBy" = u.id
WHERE v.status = 'SOLD' AND v."tenantId" = $1
GROUP BY u.id, u."firstName", u."lastName"
ORDER BY vehicles_sold DESC;
```

### Inventory Analytics Queries

```sql
-- Inventory turnover
SELECT
  make, model,
  COUNT(*) as total_units,
  AVG(EXTRACT(DAY FROM ("updatedAt" - "createdAt"))) as avg_days_on_lot,
  AVG(price) as avg_price
FROM vehicles
WHERE "tenantId" = $1 AND status = 'SOLD'
GROUP BY make, model
ORDER BY avg_days_on_lot ASC;

-- Inventory aging
SELECT
  CASE
    WHEN age_days <= 30 THEN '0-30 days'
    WHEN age_days <= 60 THEN '31-60 days'
    WHEN age_days <= 90 THEN '61-90 days'
    ELSE '90+ days'
  END as age_bracket,
  COUNT(*) as vehicle_count,
  SUM(price) as total_value
FROM (
  SELECT id, price,
    EXTRACT(DAY FROM (NOW() - "createdAt")) as age_days
  FROM vehicles
  WHERE "tenantId" = $1 AND status IN ('PUBLISHED', 'DRAFT')
) subquery
GROUP BY age_bracket;
```

### Customer Analytics Queries

```sql
-- Customer demographics
SELECT
  age_group,
  COUNT(*) as customer_count,
  AVG(purchase_value) as avg_purchase
FROM customers
WHERE "tenantId" = $1
GROUP BY age_group;

-- Popular vehicle preferences
SELECT
  v.make, v.model,
  COUNT(DISTINCT cl."customerId") as interested_customers,
  COUNT(cl.id) as total_inquiries,
  AVG(v.price) as avg_price
FROM customer_leads cl
JOIN vehicles v ON cl."vehicleId" = v.id
WHERE cl."tenantId" = $1
GROUP BY v.make, v.model
ORDER BY interested_customers DESC
LIMIT 10;
```

---

## UI Components Detail

### AnalyticsDashboard Component

**Features**:
- Grid layout with responsive breakpoints
- Date range selector (Today, Week, Month, Quarter, Year, Custom)
- Period comparison (vs previous period, vs last year)
- Real-time data refresh
- Export dashboard to PDF
- Customizable widget layout

**Layout**:
```
┌─────────────────────────────────────────────┐
│  Analytics Dashboard                   [⚙️]  │
│  [Date Range: Last 30 Days ▾] [Compare ▾]   │
├─────────────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│  │ KPI │ │ KPI │ │ KPI │ │ KPI │ │ KPI │  │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  │
├─────────────────────────────────────────────┤
│  ┌────────────────┐  ┌─────────────────┐   │
│  │ Sales Chart    │  │ Conversion      │   │
│  │ [Line Graph]   │  │ Funnel          │   │
│  └────────────────┘  └─────────────────┘   │
├─────────────────────────────────────────────┤
│  ┌────────────────┐  ┌─────────────────┐   │
│  │ Inventory      │  │ Customer        │   │
│  │ Turnover       │  │ Demographics    │   │
│  └────────────────┘  └─────────────────┘   │
├─────────────────────────────────────────────┤
│  ┌────────────────────────────────────┐    │
│  │ Revenue Trends (Area Chart)        │    │
│  └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### KPICard Component

**Props**:
- `title`: Metric name
- `value`: Current value
- `previousValue`: Comparison value
- `trend`: 'up' | 'down' | 'neutral'
- `trendPercentage`: Change percentage
- `icon`: Display icon
- `format`: 'number' | 'currency' | 'percentage'

**Example**:
```tsx
<KPICard
  title="Total Sales"
  value={1250000000}
  previousValue={1100000000}
  trend="up"
  trendPercentage={13.6}
  icon={<TrendingUp />}
  format="currency"
/>
```

### Chart Components

**SalesChart**:
- Line/Area chart for revenue over time
- Multiple series support (revenue, units sold, avg price)
- Zoom and pan functionality
- Tooltip with detailed info
- Export to image/CSV

**ConversionFunnel**:
- Funnel visualization for lead conversion
- Step-by-step breakdown
- Conversion rate between stages
- Click to drill down into stage details

**InventoryChart**:
- Bar chart for inventory by category
- Stacked bars for status breakdown
- Sortable by various metrics
- Color-coded by performance

---

## Chart Library

Using **Recharts** for React:
- Responsive charts
- Customizable styling
- Animation support
- TypeScript support
- Active maintenance

```bash
npm install recharts
npm install @types/recharts --save-dev
```

---

## Real-Time Updates

### WebSocket Integration

```typescript
// Real-time analytics updates
const socket = useWebSocket('/api/v1/analytics/live');

socket.on('metrics:update', (data) => {
  updateDashboard(data);
});

socket.on('alert:threshold', (alert) => {
  showNotification(alert);
});
```

### Caching Strategy

**Redis Cache**:
- Cache expensive queries for 5 minutes
- Real-time metrics cached for 30 seconds
- Daily/monthly aggregates cached for 1 hour
- Cache invalidation on data changes

```typescript
// Cache keys
const CACHE_KEYS = {
  salesMetrics: (tenantId, period) => `analytics:sales:${tenantId}:${period}`,
  inventoryMetrics: (tenantId) => `analytics:inventory:${tenantId}`,
  customerMetrics: (tenantId, period) => `analytics:customers:${tenantId}:${period}`,
};
```

---

## Performance Optimization

### Query Optimization
- Use database indexes on frequently queried columns
- Materialize complex aggregations
- Use database views for common queries
- Implement query result pagination

### Frontend Optimization
- Lazy load chart components
- Virtualize large data tables
- Debounce filter changes
- Use React.memo for expensive components
- Implement progressive loading (show KPIs first, then charts)

### Caching Layers
- **Browser Cache**: Chart data for current session
- **Redis Cache**: Pre-aggregated metrics
- **Database Views**: Complex calculations
- **CDN Cache**: Static dashboard assets

---

## Export Functionality

### Supported Formats

**PDF Export**:
- Dashboard snapshot with all charts
- Branded header with showroom logo
- Date range and filters applied
- Print-optimized layout

**Excel Export**:
- Multiple sheets for different metrics
- Raw data tables
- Pivot-ready format
- Formatted numbers and dates

**CSV Export**:
- Simple data export
- One metric per file
- UTF-8 encoding for Indonesian characters

---

## Mobile Responsiveness

### Breakpoints

```typescript
const breakpoints = {
  mobile: '640px',   // 1 column layout
  tablet: '768px',   // 2 column layout
  desktop: '1024px', // 3-4 column layout
  wide: '1280px',    // Full dashboard layout
};
```

### Mobile Optimizations
- Vertical scrolling for charts
- Swipeable chart carousel
- Simplified KPI cards
- Touch-friendly controls
- Reduced data points for performance

---

## Testing Strategy

### Unit Tests
- Analytics calculation functions
- Data aggregation utilities
- Metric formatting helpers
- Date range calculations

### Integration Tests
- API endpoint responses
- Database query results
- Cache hit/miss scenarios
- Real-time updates

### E2E Tests
- Dashboard loading and rendering
- Filter application
- Chart interactions
- Export functionality
- Mobile responsiveness

---

## Security Considerations

✅ **Tenant Isolation**: All queries filtered by tenantId
✅ **Role-Based Access**: Analytics visible to Admin and Manager roles only
✅ **Data Sanitization**: All user inputs sanitized
✅ **Rate Limiting**: Prevent excessive API calls
✅ **Audit Logging**: Track who accessed what analytics
✅ **Export Permissions**: Restrict data export to authorized users

---

## Implementation Timeline

### Phase 1: Foundation (Stream A)
- Analytics service layer (2-3 hours)
- Data aggregation queries (2 hours)
- Cache manager (1 hour)
- API routes (2 hours)

### Phase 2: UI Components (Stream B)
- Dashboard layout (1 hour)
- KPI cards (1 hour)
- Filter controls (1 hour)
- Date range picker (1 hour)

### Phase 3: Visualizations (Stream C)
- Chart components (3-4 hours)
- Interactive features (2 hours)
- Export functionality (1 hour)
- Real-time updates (1 hour)

**Total Estimated Time**: 15-18 hours for complete Epic 7

---

## Success Metrics

### Technical Metrics
- Dashboard load time < 2 seconds
- Chart rendering < 500ms
- API response time < 300ms (cached) / < 2s (uncached)
- Real-time update latency < 1 second
- 99.9% uptime for analytics services

### Business Metrics
- 100% of showroom owners access analytics weekly
- Average 5+ metrics viewed per session
- Export feature used by 60%+ of users
- Mobile access > 40% of total views
- User satisfaction rating > 4.5/5

---

## Next Steps

1. **Start with Stream A**: Build analytics backend services
2. **Parallel Stream B**: Create dashboard UI components
3. **Parallel Stream C**: Implement chart visualizations
4. **Integration**: Connect all pieces together
5. **Testing**: Comprehensive testing across all components
6. **Documentation**: Complete API and component docs
7. **Deployment**: Roll out to production with monitoring

---

**Ready to start Epic 7 implementation?** 🚀

Lanjutkan dengan implementasi parallel (3 streams sekaligus)?
