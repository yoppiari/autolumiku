/**
 * Audit Logging Service
 * Story 1.10: Audit Logging for Compliance
 *
 * Comprehensive audit logging service with Indonesian compliance features:
 * - Complete audit trail for all user actions
 * - Tenant isolation and data security
 * - Indonesian compliance reporting (PDPA, Tax, Financial)
 * - Real-time security monitoring and alerts
 * - Advanced filtering and search capabilities
 * - Automatic data retention management
 */

import { PrismaClient } from '@prisma/client';

// Audit log context interface
export interface AuditContext {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

// Audit log entry interface
export interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  description: string;
  oldValues?: any;
  newValues?: any;
  changesSummary?: string;
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  category: string;
  apiEndpoint?: string;
  httpMethod?: string;
  statusCode?: number;
  errorMessage?: string;
  executionTime?: number;
  metadata?: any;
  tags?: string[];
  isCompliance?: boolean;
  complianceType?: string;
}

// Security event interface
export interface SecurityEvent {
  eventType: string;
  eventSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  eventDescription: string;
  threatLevel?: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: any;
}

// Compliance report interface
export interface ComplianceReportParams {
  reportType: 'TAX_AUDIT' | 'FINANCIAL_AUDIT' | 'PDPA_COMPLIANCE' | 'DATA_ACCESS_REQUEST' | 'RIGHT_TO_DELETION' | 'DATA_BREACH_REPORT' | 'REGULATORY_SUBMISSION';
  periodStart: Date;
  periodEnd: Date;
  format?: 'PDF' | 'EXCEL' | 'CSV';
}

// Audit log query filters
export interface AuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: string;
  entityType?: string;
  category?: string;
  severity?: string;
  searchTerm?: string;
  tags?: string[];
  isCompliance?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Main Audit Logging Service Class
 */
export class AuditLoggingService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Log an audit event
   * Automatically captures context and creates comprehensive audit trail
   */
  async log(context: AuditContext, entry: AuditLogEntry): Promise<any> {
    try {
      // Determine retention policy based on compliance flag
      const retentionPolicy = entry.isCompliance ? 'compliance' : 'standard';
      const expiresAt = this.calculateExpirationDate(retentionPolicy);

      // Create audit log entry
      const auditLog = await this.prisma.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          sessionId: context.sessionId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          entityName: entry.entityName,
          description: entry.description,
          oldValues: entry.oldValues,
          newValues: entry.newValues,
          changesSummary: entry.changesSummary,
          severity: entry.severity || 'INFO',
          category: entry.category,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          apiEndpoint: entry.apiEndpoint,
          httpMethod: entry.httpMethod,
          statusCode: entry.statusCode,
          errorMessage: entry.errorMessage,
          executionTime: entry.executionTime,
          metadata: entry.metadata,
          tags: entry.tags || [],
          isCompliance: entry.isCompliance || false,
          complianceType: entry.complianceType,
          retentionPolicy,
          expiresAt,
        },
      });

      // Track data changes for compliance if old and new values exist
      if (entry.oldValues && entry.newValues) {
        await this.trackDataChanges(auditLog.id, entry.oldValues, entry.newValues);
      }

      return auditLog;
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw error to prevent disrupting main application flow
      return null;
    }
  }

  /**
   * Log a security event with optional alert
   */
  async logSecurityEvent(
    context: AuditContext,
    event: SecurityEvent,
    sendAlert: boolean = true
  ): Promise<any> {
    try {
      // Create audit log for the security event
      const auditLog = await this.log(context, {
        action: event.eventType,
        entityType: 'SECURITY_EVENT',
        entityId: `security-${Date.now()}`,
        description: event.eventDescription,
        severity: 'CRITICAL',
        category: 'SECURITY',
        metadata: event.metadata,
        tags: ['security', event.eventType.toLowerCase()],
      });

      // Create security event record
      const securityEvent = await this.prisma.auditSecurityEvent.create({
        data: {
          auditLogId: auditLog?.id,
          tenantId: context.tenantId,
          userId: context.userId,
          eventType: event.eventType,
          eventSeverity: event.eventSeverity,
          eventDescription: event.eventDescription,
          threatLevel: event.threatLevel || 'MEDIUM',
          ipAddress: context.ipAddress,
          deviceInfo: {
            userAgent: context.userAgent,
          },
          metadata: event.metadata,
        },
      });

      // Send alert to administrators if requested
      if (sendAlert && (event.eventSeverity === 'HIGH' || event.eventSeverity === 'CRITICAL')) {
        await this.sendSecurityAlert(securityEvent);
      }

      return securityEvent;
    } catch (error) {
      console.error('Failed to log security event:', error);
      return null;
    }
  }

  /**
   * Query audit logs with advanced filtering
   */
  async queryLogs(
    tenantId: string,
    filters: AuditLogFilters
  ): Promise<{ logs: any[]; total: number; page: number; pageSize: number }> {
    // Build where clause
    const where: any = { tenantId };

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.category) where.category = filters.category;
    if (filters.severity) where.severity = filters.severity;
    if (filters.isCompliance !== undefined) where.isCompliance = filters.isCompliance;

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      };
    }

    if (filters.searchTerm) {
      where.OR = [
        { description: { contains: filters.searchTerm, mode: 'insensitive' } },
        { entityName: { contains: filters.searchTerm, mode: 'insensitive' } },
        { changesSummary: { contains: filters.searchTerm, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await this.prisma.auditLog.count({ where });

    // Get paginated results
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        dataChanges: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return {
      logs,
      total,
      page,
      pageSize: limit,
    };
  }

  /**
   * Generate Indonesian compliance report
   */
  async generateComplianceReport(
    tenantId: string,
    userId: string,
    params: ComplianceReportParams
  ): Promise<any> {
    // Get relevant audit logs for the period
    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: params.periodStart,
          lte: params.periodEnd,
        },
        isCompliance: true,
        ...(params.reportType === 'PDPA_COMPLIANCE' && {
          OR: [
            { category: 'DATA_CHANGE' },
            { category: 'USER_MANAGEMENT' },
            { category: 'AUTHORIZATION' },
          ],
        }),
        ...(params.reportType === 'TAX_AUDIT' && {
          category: 'FINANCIAL',
        }),
      },
      include: {
        user: true,
        dataChanges: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Calculate compliance score
    const complianceScore = this.calculateComplianceScore(logs);

    // Generate findings
    const findings = this.analyzComplianceFindings(logs, params.reportType);

    // Create compliance report record
    const report = await this.prisma.complianceReport.create({
      data: {
        tenantId,
        reportType: params.reportType,
        reportPeriod: this.formatReportPeriod(params.periodStart, params.periodEnd),
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        generatedBy: userId,
        reportStatus: 'draft',
        reportFormat: params.format || 'PDF',
        totalRecords: logs.length,
        complianceScore,
        findings,
        recommendations: this.generateRecommendations(findings),
      },
    });

    return {
      report,
      logs,
      summary: {
        totalRecords: logs.length,
        complianceScore,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
      },
    };
  }

  /**
   * Get audit summary statistics
   */
  async getAuditSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    // Total audit logs
    const totalLogs = await this.prisma.auditLog.count({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    // Logs by category
    const logsByCategory = await this.prisma.auditLog.groupBy({
      by: ['category'],
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: true,
    });

    // Logs by severity
    const logsBySeverity = await this.prisma.auditLog.groupBy({
      by: ['severity'],
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: true,
    });

    // Security events
    const securityEvents = await this.prisma.auditSecurityEvent.count({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    // Unresolved security events
    const unresolvedSecurityEvents = await this.prisma.auditSecurityEvent.count({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
        isResolved: false,
      },
    });

    // Most active users
    const activeUsers = await this.prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
        userId: { not: null },
      },
      _count: true,
      orderBy: {
        _count: {
          userId: 'desc',
        },
      },
      take: 10,
    });

    return {
      totalLogs,
      logsByCategory,
      logsBySeverity,
      securityEvents,
      unresolvedSecurityEvents,
      activeUsers,
      period: {
        start: startDate,
        end: endDate,
      },
    };
  }

  /**
   * Get security event dashboard data
   */
  async getSecurityDashboard(tenantId: string): Promise<any> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Recent security events
    const recentEvents = await this.prisma.auditSecurityEvent.findMany({
      where: {
        tenantId,
        createdAt: { gte: last24Hours },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Unresolved events
    const unresolvedEvents = await this.prisma.auditSecurityEvent.findMany({
      where: {
        tenantId,
        isResolved: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Event statistics
    const eventStats = {
      last24Hours: await this.prisma.auditSecurityEvent.count({
        where: { tenantId, createdAt: { gte: last24Hours } },
      }),
      last7Days: await this.prisma.auditSecurityEvent.count({
        where: { tenantId, createdAt: { gte: last7Days } },
      }),
      critical: await this.prisma.auditSecurityEvent.count({
        where: { tenantId, eventSeverity: 'CRITICAL', isResolved: false },
      }),
      high: await this.prisma.auditSecurityEvent.count({
        where: { tenantId, eventSeverity: 'HIGH', isResolved: false },
      }),
    };

    // Threat level distribution
    const threatDistribution = await this.prisma.auditSecurityEvent.groupBy({
      by: ['threatLevel'],
      where: {
        tenantId,
        createdAt: { gte: last7Days },
      },
      _count: true,
    });

    return {
      recentEvents,
      unresolvedEvents,
      eventStats,
      threatDistribution,
    };
  }

  /**
   * Track audit log access (who viewed audit logs)
   */
  async trackAuditAccess(
    tenantId: string,
    userId: string,
    accessType: 'VIEW' | 'EXPORT' | 'SEARCH',
    filters?: any,
    resultCount?: number,
    exportFormat?: string,
    ipAddress?: string,
    userAgent?: string,
    accessReason?: string
  ): Promise<void> {
    await this.prisma.auditLogAccess.create({
      data: {
        tenantId,
        userId,
        accessType,
        filters,
        resultCount,
        exportFormat,
        ipAddress,
        userAgent,
        accessReason,
      },
    });
  }

  /**
   * Helper: Track individual field changes for compliance
   */
  private async trackDataChanges(
    auditLogId: string,
    oldValues: any,
    newValues: any
  ): Promise<void> {
    const changes = this.detectChanges(oldValues, newValues);

    const dataChanges = changes.map((change) => ({
      auditLogId,
      fieldName: change.field,
      fieldPath: change.path,
      oldValue: String(change.oldValue),
      newValue: String(change.newValue),
      valueType: typeof change.newValue,
      changeType: change.type,
      isSensitive: this.isSensitiveField(change.field),
    }));

    if (dataChanges.length > 0) {
      await this.prisma.auditDataChange.createMany({
        data: dataChanges,
      });
    }
  }

  /**
   * Helper: Detect changes between old and new values
   */
  private detectChanges(oldObj: any, newObj: any, path: string = ''): any[] {
    const changes: any[] = [];

    // Handle null/undefined
    if (!oldObj && !newObj) return changes;
    if (!oldObj) return [{ field: path || 'root', path, oldValue: null, newValue: newObj, type: 'CREATED' }];
    if (!newObj) return [{ field: path || 'root', path, oldValue: oldObj, newValue: null, type: 'DELETED' }];

    // Compare objects
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    allKeys.forEach((key) => {
      const fieldPath = path ? `${path}.${key}` : key;
      const oldVal = oldObj[key];
      const newVal = newObj[key];

      if (oldVal === undefined && newVal !== undefined) {
        changes.push({
          field: key,
          path: fieldPath,
          oldValue: null,
          newValue: newVal,
          type: 'CREATED',
        });
      } else if (oldVal !== undefined && newVal === undefined) {
        changes.push({
          field: key,
          path: fieldPath,
          oldValue: oldVal,
          newValue: null,
          type: 'DELETED',
        });
      } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field: key,
          path: fieldPath,
          oldValue: oldVal,
          newValue: newVal,
          type: 'MODIFIED',
        });
      }
    });

    return changes;
  }

  /**
   * Helper: Check if field is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn'];
    return sensitiveFields.some((sf) => fieldName.toLowerCase().includes(sf.toLowerCase()));
  }

  /**
   * Helper: Calculate expiration date based on retention policy
   */
  private calculateExpirationDate(policy: string): Date | null {
    const now = new Date();
    switch (policy) {
      case 'standard':
        // 1 year retention
        return new Date(now.setFullYear(now.getFullYear() + 1));
      case 'compliance':
        // 7 years retention for Indonesian compliance
        return new Date(now.setFullYear(now.getFullYear() + 7));
      case 'permanent':
        return null;
      default:
        return new Date(now.setFullYear(now.getFullYear() + 1));
    }
  }

  /**
   * Helper: Calculate compliance score
   */
  private calculateComplianceScore(logs: any[]): number {
    // Simple compliance score based on audit completeness
    if (logs.length === 0) return 0;

    const scoredLogs = logs.filter((log) => log.dataChanges && log.dataChanges.length > 0);
    return (scoredLogs.length / logs.length) * 100;
  }

  /**
   * Helper: Analyze compliance findings
   */
  private analyzComplianceFindings(logs: any[], reportType: string): any {
    const findings: any = {
      totalLogs: logs.length,
      criticalIssues: [],
      warnings: [],
      recommendations: [],
    };

    // Check for sensitive data changes
    logs.forEach((log) => {
      if (log.dataChanges) {
        const sensitiveChanges = log.dataChanges.filter((dc: any) => dc.isSensitive);
        if (sensitiveChanges.length > 0) {
          findings.criticalIssues.push({
            type: 'SENSITIVE_DATA_CHANGE',
            description: `Perubahan data sensitif terdeteksi pada ${log.entityType}`,
            timestamp: log.createdAt,
            affectedEntity: log.entityId,
          });
        }
      }
    });

    // Add Indonesian-specific findings
    if (reportType === 'PDPA_COMPLIANCE') {
      findings.pdpaCompliance = {
        dataAccessRequests: logs.filter((l) => l.action === 'DATA_ACCESS_REQUEST').length,
        dataDeletionRequests: logs.filter((l) => l.action === 'DELETE').length,
        consentChanges: logs.filter((l) => l.entityType === 'USER_CONSENT').length,
      };
    }

    return findings;
  }

  /**
   * Helper: Generate recommendations based on findings
   */
  private generateRecommendations(findings: any): string {
    const recommendations: string[] = [];

    if (findings.criticalIssues && findings.criticalIssues.length > 0) {
      recommendations.push('Tinjau dan dokumentasikan semua perubahan data sensitif');
      recommendations.push('Pastikan approval yang tepat untuk modifikasi data kritis');
    }

    if (findings.warnings && findings.warnings.length > 0) {
      recommendations.push('Tingkatkan monitoring untuk aktivitas yang mencurigakan');
    }

    recommendations.push('Lakukan audit berkala untuk memastikan compliance');
    recommendations.push('Update dokumentasi prosedur keamanan data');

    return recommendations.join('; ');
  }

  /**
   * Helper: Format report period
   */
  private formatReportPeriod(start: Date, end: Date): string {
    const startYear = start.getFullYear();
    const startMonth = start.getMonth() + 1;
    const endMonth = end.getMonth() + 1;

    if (startYear === end.getFullYear() && startMonth === endMonth) {
      return `${startYear}-${String(startMonth).padStart(2, '0')}`;
    }

    const startQuarter = Math.ceil(startMonth / 3);
    const endQuarter = Math.ceil(endMonth / 3);

    if (startYear === end.getFullYear() && startQuarter === endQuarter) {
      return `${startYear}-Q${startQuarter}`;
    }

    return `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`;
  }

  /**
   * Helper: Send security alert to administrators
   */
  private async sendSecurityAlert(securityEvent: any): Promise<void> {
    try {
      // Get tenant administrators
      const admins = await this.prisma.user.findMany({
        where: {
          // TODO: Add proper admin role filter
          isActive: true,
        },
        take: 5, // Limit to avoid spam
      });

      // Create alerts for each admin
      const alerts = admins.map((admin) => ({
        securityEventId: securityEvent.id,
        tenantId: securityEvent.tenantId,
        alertType: 'EMAIL', // Default to email, can expand to SMS, PUSH
        recipientUserId: admin.id,
        recipientEmail: admin.email,
        subject: `[KEAMANAN] ${securityEvent.eventType} - ${securityEvent.eventSeverity}`,
        message: `Event keamanan terdeteksi: ${securityEvent.eventDescription}`,
        priority: securityEvent.eventSeverity === 'CRITICAL' ? 'URGENT' : 'HIGH',
        status: 'pending',
      }));

      await this.prisma.securityAlert.createMany({
        data: alerts,
      });
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }
}

// Export singleton instance
export const auditService = new AuditLoggingService();
