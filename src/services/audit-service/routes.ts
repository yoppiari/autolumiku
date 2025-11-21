/**
 * Audit Logging API Routes
 * Story 1.10: Audit Logging for Compliance
 *
 * API endpoints for audit log querying, compliance reporting,
 * and security event monitoring.
 */

import { Router, Request, Response } from 'express';
import { auditService, AuditLogFilters, ComplianceReportParams } from './index';
import { auditDataModification, auditAuthentication } from './middleware';
import { requireAuth, requirePermission, validateTenantContext } from '../../middleware/auth.middleware';
import {
  validateAuditLogQuery,
  validateComplianceReportRequest,
  validateExportRequest,
} from './validation';

const router = Router();

// Apply authentication to all audit routes
router.use(requireAuth);
router.use(validateTenantContext);

/**
 * GET /api/audit/logs
 * Query audit logs with advanced filtering
 * Requires: audit.view permission
 */
router.get('/logs', requirePermission('audit.view', 'audit.manage'), validateAuditLogQuery, async (req: Request, res: Response) => {
  try {
    // Use sanitized and validated data from validation middleware
    const filters: AuditLogFilters = req.sanitizedQuery;

    // Track audit log access
    if (req.auditContext && req.auditContext.userId) {
      await auditService.trackAuditAccess(
        filters.tenantId,
        req.auditContext.userId,
        'SEARCH',
        filters,
        undefined,
        undefined,
        req.auditContext.ipAddress,
        req.auditContext.userAgent
      );
    }

    const result = await auditService.queryLogs(filters.tenantId, filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Failed to query audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query audit logs',
      message: error.message,
    });
  }
});

/**
 * GET /api/audit/summary
 * Get audit summary statistics
 * Requires: audit.view permission
 */
router.get('/summary', requirePermission('audit.view', 'audit.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    // Default to last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const customStartDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : startDate;
    const customEndDate = req.query.endDate ? new Date(req.query.endDate as string) : endDate;

    const summary = await auditService.getAuditSummary(
      tenantId,
      customStartDate,
      customEndDate
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Failed to get audit summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit summary',
      message: error.message,
    });
  }
});

/**
 * GET /api/audit/security/dashboard
 * Get security event dashboard data
 * Requires: security.view or audit.manage permission
 */
router.get('/security/dashboard', requirePermission('security.view', 'audit.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const dashboard = await auditService.getSecurityDashboard(tenantId);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    console.error('Failed to get security dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get security dashboard',
      message: error.message,
    });
  }
});

/**
 * POST /api/audit/reports/compliance
 * Generate Indonesian compliance report
 * Requires: audit.export or audit.manage permission
 */
router.post('/reports/compliance', requirePermission('audit.export', 'audit.manage'), validateComplianceReportRequest, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    // Use sanitized and validated data from validation middleware
    const { tenantId, reportType, periodStart, periodEnd, format } = req.sanitizedBody;

    const params: ComplianceReportParams = {
      reportType,
      periodStart,
      periodEnd,
      format,
    };

    const report = await auditService.generateComplianceReport(tenantId, userId, params);

    res.json({
      success: true,
      data: report,
      message: 'Laporan compliance berhasil dibuat',
    });
  } catch (error: any) {
    console.error('Failed to generate compliance report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate compliance report',
      message: error.message,
    });
  }
});

/**
 * POST /api/audit/export
 * Export audit logs to file
 * Requires: audit.export or audit.manage permission
 */
router.post('/export', requirePermission('audit.export', 'audit.manage'), validateExportRequest, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    // Use sanitized and validated data from validation middleware
    const { tenantId, format, startDate, endDate, action, entityType, category, severity, reason } = req.sanitizedBody;

    const filters: AuditLogFilters = {
      startDate,
      endDate,
      userId: req.sanitizedBody.userId,
      action,
      entityType,
      category,
      severity,
    };

    // Query logs
    const result = await auditService.queryLogs(tenantId, filters);

    // Track export access
    await auditService.trackAuditAccess(
      tenantId,
      userId,
      'EXPORT',
      filters,
      result.total,
      format,
      req.auditContext?.ipAddress,
      req.auditContext?.userAgent,
      reason
    );

    // Convert to requested format
    let exportData: any;
    let contentType: string;
    let filename: string;

    if (format === 'JSON') {
      exportData = JSON.stringify(result.logs, null, 2);
      contentType = 'application/json';
      filename = `audit-logs-${Date.now()}.json`;
    } else {
      // CSV format
      exportData = convertToCSV(result.logs);
      contentType = 'text/csv';
      filename = `audit-logs-${Date.now()}.csv`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);
  } catch (error: any) {
    console.error('Failed to export audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs',
      message: error.message,
    });
  }
});

/**
 * Helper: Convert logs to CSV format
 */
function convertToCSV(logs: any[]): string {
  if (logs.length === 0) return '';

  // CSV headers
  const headers = [
    'ID',
    'Timestamp',
    'User',
    'Action',
    'Entity Type',
    'Entity ID',
    'Description',
    'Severity',
    'Category',
    'IP Address',
  ];

  // CSV rows
  const rows = logs.map((log) => [
    log.id,
    log.createdAt,
    log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
    log.action,
    log.entityType,
    log.entityId,
    log.description,
    log.severity,
    log.category,
    log.ipAddress || '',
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  return csvContent;
}

export default router;
