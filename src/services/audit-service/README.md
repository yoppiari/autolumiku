# Audit Logging Service

## Story 1.10: Audit Logging for Compliance

Comprehensive audit logging service for autolumiku with Indonesian compliance features.

## Features

### 1. Complete Audit Trail
- Logs all user actions and system events
- Tracks before/after values for data changes
- Captures contextual information (IP, user agent, session)
- Automatic data change detection and field-level tracking

### 2. Indonesian Compliance Support
- PDPA compliance reporting
- Indonesian tax audit reports (Laporan Pajak)
- Financial audit trails
- Data access request tracking
- 7-year retention for compliance logs
- Indonesian language descriptions

### 3. Security Monitoring
- Real-time security event detection
- Brute force attack detection
- Suspicious activity monitoring
- Automated alerts for critical events
- Threat level classification

### 4. Advanced Filtering & Search
- Date range filtering
- User-based filtering
- Action type filtering
- Category-based filtering
- Full-text search across descriptions
- Tag-based organization

### 5. Multi-tenant Isolation
- Complete tenant data separation
- Tenant-scoped queries
- Secure audit log access tracking

## Installation

```bash
# Install dependencies
npm install

# Run Prisma migrations
npx prisma migrate dev --schema=prisma/audit_logging_schema.prisma
```

## Usage

### Basic Audit Logging

```typescript
import { auditService } from '@/services/audit-service';

// Initialize audit context
const context = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  sessionId: 'session-789',
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
};

// Log an audit event
await auditService.log(context, {
  action: 'CREATE',
  entityType: 'VEHICLE',
  entityId: 'vehicle-001',
  entityName: '2024 Toyota Avanza',
  description: 'User membuat kendaraan baru',
  category: 'VEHICLE_MANAGEMENT',
  newValues: { brand: 'Toyota', model: 'Avanza', year: 2024 },
});
```

### Security Event Logging

```typescript
// Log a security event with automatic alert
await auditService.logSecurityEvent(
  context,
  {
    eventType: 'FAILED_LOGIN',
    eventSeverity: 'MEDIUM',
    eventDescription: 'Login gagal untuk user',
    metadata: { attempts: 3 },
  },
  true // Send alert if HIGH/CRITICAL
);
```

### Query Audit Logs

```typescript
// Query logs with filters
const result = await auditService.queryLogs('tenant-123', {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  userId: 'user-456',
  action: 'DELETE',
  category: 'FINANCIAL',
  severity: 'WARNING',
  searchTerm: 'Toyota',
  limit: 50,
  offset: 0,
});

console.log(`Found ${result.total} logs`);
console.log(`Page ${result.page} of ${Math.ceil(result.total / result.pageSize)}`);
```

### Generate Compliance Report

```typescript
// Generate PDPA compliance report
const report = await auditService.generateComplianceReport(
  'tenant-123',
  'user-456',
  {
    reportType: 'PDPA_COMPLIANCE',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-03-31'),
    format: 'PDF',
  }
);

console.log(`Report generated: ${report.report.id}`);
console.log(`Compliance score: ${report.summary.complianceScore}%`);
```

### Get Security Dashboard

```typescript
// Get real-time security monitoring dashboard
const dashboard = await auditService.getSecurityDashboard('tenant-123');

console.log(`Recent events (24h): ${dashboard.eventStats.last24Hours}`);
console.log(`Critical unresolved: ${dashboard.eventStats.critical}`);
console.log(`Unresolved events: ${dashboard.unresolvedEvents.length}`);
```

## Middleware Usage

### Initialize Audit Context

```typescript
import { initializeAuditContext, auditAPIRequest } from '@/services/audit-service/middleware';

// Express/Next.js route
app.use(initializeAuditContext);
app.use(auditAPIRequest());
```

### Log Data Modifications

```typescript
import { auditDataModification } from '@/services/audit-service/middleware';

// After creating/updating/deleting data
await auditDataModification(
  req,
  'UPDATE',
  'VEHICLE',
  vehicle.id,
  vehicle.name,
  oldValues,
  newValues
);
```

### Log Authentication Events

```typescript
import { auditAuthentication } from '@/services/audit-service/middleware';

// On login
await auditAuthentication(
  context,
  'LOGIN',
  user.id,
  true,
  { loginMethod: 'email' }
);

// On failed login
await auditAuthentication(
  context,
  'FAILED_LOGIN',
  user.id,
  false,
  { reason: 'Invalid password' }
);
```

### Detect Brute Force Attacks

```typescript
import { detectBruteForce } from '@/services/audit-service/middleware';

// Check for brute force attempts
const isBruteForce = await detectBruteForce(context, userId);

if (isBruteForce) {
  // Lock account or implement additional security measures
  return res.status(429).json({ error: 'Too many failed attempts' });
}
```

## API Endpoints

### GET /api/audit/logs
Query audit logs with filters

**Query Parameters:**
- `startDate`: Start date (ISO format)
- `endDate`: End date (ISO format)
- `userId`: Filter by user ID
- `action`: Filter by action type
- `entityType`: Filter by entity type
- `category`: Filter by category
- `severity`: Filter by severity
- `searchTerm`: Search term
- `tags`: Comma-separated tags
- `isCompliance`: Filter compliance logs
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset

### GET /api/audit/summary
Get audit summary statistics

**Query Parameters:**
- `startDate`: Summary start date
- `endDate`: Summary end date

### GET /api/audit/security/dashboard
Get real-time security monitoring dashboard

### POST /api/audit/reports/compliance
Generate Indonesian compliance report

**Request Body:**
```json
{
  "reportType": "PDPA_COMPLIANCE",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-03-31",
  "format": "PDF"
}
```

### POST /api/audit/export
Export audit logs to file

**Request Body:**
```json
{
  "format": "CSV",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "reason": "Monthly compliance report"
}
```

## Database Models

### AuditLog
Main audit log table with comprehensive tracking

### AuditDataChange
Detailed field-level change tracking

### AuditSecurityEvent
Security events and threats

### SecurityAlert
Automated security alerts

### ComplianceReport
Indonesian compliance reports

### AuditLogAccess
Track who accesses audit logs

## Indonesian Compliance Features

### PDPA (Personal Data Protection Act)
- Data access request tracking
- Data deletion tracking
- Consent changes monitoring
- 7-year retention period

### Tax Audit (Audit Pajak)
- Financial transaction logging
- Payment and billing tracking
- Comprehensive audit trails for tax authorities

### Financial Audit
- Revenue and expense tracking
- Financial data modifications
- Audit-ready reporting

## Retention Policies

- **Standard**: 1 year retention
- **Compliance**: 7 years retention (Indonesian legal requirement)
- **Permanent**: No auto-deletion

## Security Alerts

Automatic alerts are sent for:
- CRITICAL severity events
- HIGH severity events
- Brute force attacks detected
- Suspicious activity patterns
- Multiple failed login attempts

Alert types supported:
- Email
- SMS
- Push notifications
- In-app notifications
- Webhooks

## Best Practices

1. **Always initialize audit context** at the start of requests
2. **Use appropriate categories** for better organization
3. **Include descriptive Indonesian descriptions** for clarity
4. **Set compliance flag** for regulatory-required logs
5. **Track sensitive data changes** with proper masking
6. **Regular compliance report generation** for audits
7. **Monitor security dashboard** for threats
8. **Implement brute force detection** on login endpoints

## Testing

Run the comprehensive test suite:

```bash
npm test -- audit-logging.test.ts
```

Tests cover:
- Basic audit logging
- Security event tracking
- Compliance reporting
- Indonesian language support
- Tenant isolation
- Acceptance criteria validation

## License

Proprietary - autolumiku Platform
