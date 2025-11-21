/**
 * Audit Logging Middleware
 * Story 1.10: Audit Logging for Compliance
 *
 * Automatic audit logging middleware for tracking all user actions
 * and system events throughout the application.
 */

import { Request, Response, NextFunction } from 'express';
import { auditService, AuditContext, AuditLogEntry } from './index';

// Extend Express Request to include audit context
declare global {
  namespace Express {
    interface Request {
      auditContext?: AuditContext;
      startTime?: number;
    }
  }
}

/**
 * Initialize audit context from request
 */
export function initializeAuditContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract audit context from request
  req.auditContext = {
    tenantId: req.headers['x-tenant-id'] as string || req.body?.tenantId,
    userId: (req as any).user?.id,
    sessionId: (req as any).session?.id,
    ipAddress: req.ip || req.headers['x-forwarded-for'] as string || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'] as string || `req-${Date.now()}`,
  };

  // Track start time for execution duration
  req.startTime = Date.now();

  next();
}

/**
 * Log API request/response automatically
 */
export function auditAPIRequest(
  options: {
    action?: string;
    category?: string;
    skipPaths?: string[];
    skipMethods?: string[];
  } = {}
) {
  return async function (req: Request, res: Response, next: NextFunction) {
    // Skip certain paths or methods if configured
    if (options.skipPaths?.some((path) => req.path.includes(path))) {
      return next();
    }

    if (options.skipMethods?.includes(req.method)) {
      return next();
    }

    // Store original end function
    const originalEnd = res.end;
    let responseBody: any;

    // Override res.end to capture response
    res.end = function (chunk?: any, encoding?: any, callback?: any): any {
      // Restore original end
      res.end = originalEnd;

      // Capture response body
      if (chunk) {
        try {
          responseBody = JSON.parse(chunk.toString());
        } catch {
          responseBody = chunk.toString();
        }
      }

      // Log the audit entry
      if (req.auditContext) {
        const executionTime = req.startTime ? Date.now() - req.startTime : undefined;

        const entry: AuditLogEntry = {
          action: options.action || determineAction(req.method, req.path),
          entityType: determineEntityType(req.path),
          entityId: determineEntityId(req),
          description: generateDescription(req, res),
          category: options.category || determineCategory(req.path),
          apiEndpoint: req.path,
          httpMethod: req.method,
          statusCode: res.statusCode,
          executionTime,
          metadata: {
            query: req.query,
            params: req.params,
            responseSize: chunk?.length || 0,
          },
          severity: determineSeverity(res.statusCode),
          tags: [req.method.toLowerCase(), ...extractTags(req.path)],
        };

        // Log error details if request failed
        if (res.statusCode >= 400) {
          entry.errorMessage = responseBody?.error?.message || responseBody?.message;
        }

        // Log the audit entry (async, don't wait)
        auditService.log(req.auditContext, entry).catch((error) => {
          console.error('Failed to log audit entry:', error);
        });
      }

      // Call original end
      return originalEnd.call(res, chunk, encoding, callback);
    };

    next();
  };
}

/**
 * Log data modification (CREATE, UPDATE, DELETE) operations
 */
export async function auditDataModification(
  req: Request,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entityType: string,
  entityId: string,
  entityName: string,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  if (!req.auditContext) {
    console.warn('Audit context not initialized');
    return;
  }

  const entry: AuditLogEntry = {
    action,
    entityType,
    entityId,
    entityName,
    description: generateModificationDescription(action, entityType, entityName),
    oldValues,
    newValues,
    changesSummary: generateChangesSummary(oldValues, newValues),
    category: 'DATA_CHANGE',
    severity: determineSeverityForDataChange(action, entityType),
    tags: [action.toLowerCase(), entityType.toLowerCase()],
    isCompliance: isComplianceEntity(entityType),
  };

  await auditService.log(req.auditContext, entry);
}

/**
 * Log authentication events
 */
export async function auditAuthentication(
  context: AuditContext,
  action: 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN' | 'PASSWORD_RESET',
  userId: string,
  success: boolean,
  metadata?: any
): Promise<void> {
  const entry: AuditLogEntry = {
    action,
    entityType: 'USER',
    entityId: userId,
    description: generateAuthDescription(action, success),
    category: 'AUTHENTICATION',
    severity: success ? 'INFO' : 'WARNING',
    metadata,
    tags: ['authentication', action.toLowerCase()],
    isCompliance: true,
    complianceType: 'PDPA',
  };

  await auditService.log(context, entry);

  // Log security event for failed logins
  if (action === 'FAILED_LOGIN') {
    await auditService.logSecurityEvent(
      context,
      {
        eventType: 'FAILED_LOGIN',
        eventSeverity: 'MEDIUM',
        eventDescription: `Login gagal untuk user ${userId}`,
        metadata,
      },
      false // Don't send alert for single failed login
    );
  }
}

/**
 * Log authorization events (permission changes, role assignments)
 */
export async function auditAuthorization(
  req: Request,
  action: string,
  userId: string,
  resourceType: string,
  resourceId: string,
  permissions: any
): Promise<void> {
  if (!req.auditContext) return;

  const entry: AuditLogEntry = {
    action,
    entityType: resourceType,
    entityId: resourceId,
    description: `Perubahan otorisasi: ${action} untuk user ${userId}`,
    newValues: permissions,
    category: 'AUTHORIZATION',
    severity: 'WARNING',
    tags: ['authorization', 'permission'],
    isCompliance: true,
    complianceType: 'PDPA',
  };

  await auditService.log(req.auditContext, entry);
}

/**
 * Log security events
 */
export async function auditSecurityEvent(
  context: AuditContext,
  eventType: string,
  eventSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  description: string,
  metadata?: any
): Promise<void> {
  await auditService.logSecurityEvent(
    context,
    {
      eventType,
      eventSeverity,
      eventDescription: description,
      metadata,
    },
    eventSeverity === 'HIGH' || eventSeverity === 'CRITICAL'
  );
}

/**
 * Helper: Determine action from HTTP method and path
 */
function determineAction(method: string, path: string): string {
  const methodActionMap: Record<string, string> = {
    GET: 'READ',
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };

  return methodActionMap[method] || method;
}

/**
 * Helper: Determine entity type from path
 */
function determineEntityType(path: string): string {
  // Extract entity type from path (e.g., /api/vehicles/123 -> VEHICLE)
  const pathParts = path.split('/').filter(Boolean);

  if (pathParts.length >= 2) {
    const entityPart = pathParts[1];
    return entityPart.toUpperCase().replace(/-/g, '_');
  }

  return 'UNKNOWN';
}

/**
 * Helper: Determine entity ID from request
 */
function determineEntityId(req: Request): string {
  // Try to extract ID from params, query, or body
  return (
    req.params.id ||
    req.params.entityId ||
    req.query.id as string ||
    req.body?.id ||
    `request-${req.auditContext?.requestId}`
  );
}

/**
 * Helper: Determine category from path
 */
function determineCategory(path: string): string {
  if (path.includes('/auth') || path.includes('/login')) return 'AUTHENTICATION';
  if (path.includes('/users') || path.includes('/team')) return 'USER_MANAGEMENT';
  if (path.includes('/vehicles')) return 'VEHICLE_MANAGEMENT';
  if (path.includes('/customers')) return 'CUSTOMER_MANAGEMENT';
  if (path.includes('/tenants')) return 'TENANT_MANAGEMENT';
  if (path.includes('/settings') || path.includes('/config')) return 'CONFIGURATION';
  if (path.includes('/billing') || path.includes('/payment')) return 'FINANCIAL';

  return 'SYSTEM';
}

/**
 * Helper: Determine severity from HTTP status code
 */
function determineSeverity(statusCode: number): 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' {
  if (statusCode >= 500) return 'CRITICAL';
  if (statusCode >= 400) return 'ERROR';
  if (statusCode >= 300) return 'WARNING';
  return 'INFO';
}

/**
 * Helper: Determine severity for data change
 */
function determineSeverityForDataChange(
  action: string,
  entityType: string
): 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' {
  if (action === 'DELETE') {
    // Deletion of critical entities is more severe
    const criticalEntities = ['USER', 'TENANT', 'FINANCIAL'];
    return criticalEntities.includes(entityType) ? 'WARNING' : 'INFO';
  }

  return 'INFO';
}

/**
 * Helper: Check if entity type requires compliance tracking
 */
function isComplianceEntity(entityType: string): boolean {
  const complianceEntities = [
    'USER',
    'CUSTOMER',
    'FINANCIAL',
    'PAYMENT',
    'BILLING',
    'PERSONAL_DATA',
    'CONSENT',
  ];

  return complianceEntities.includes(entityType);
}

/**
 * Helper: Extract tags from path
 */
function extractTags(path: string): string[] {
  const tags: string[] = [];
  const pathParts = path.split('/').filter(Boolean);

  // Add resource tags
  if (pathParts.length >= 2) {
    tags.push(pathParts[1]);
  }

  // Add operation tags
  if (path.includes('/export')) tags.push('export');
  if (path.includes('/import')) tags.push('import');
  if (path.includes('/bulk')) tags.push('bulk');
  if (path.includes('/report')) tags.push('report');

  return tags;
}

/**
 * Helper: Generate human-readable description
 */
function generateDescription(req: Request, res: Response): string {
  const action = determineAction(req.method, req.path);
  const entityType = determineEntityType(req.path);
  const status = res.statusCode >= 400 ? 'gagal' : 'berhasil';

  return `${action} ${entityType} ${status} (${res.statusCode})`;
}

/**
 * Helper: Generate modification description in Bahasa Indonesia
 */
function generateModificationDescription(
  action: string,
  entityType: string,
  entityName: string
): string {
  const actionText: Record<string, string> = {
    CREATE: 'membuat',
    UPDATE: 'mengubah',
    DELETE: 'menghapus',
  };

  return `User ${actionText[action]} ${entityType}: ${entityName}`;
}

/**
 * Helper: Generate authentication description
 */
function generateAuthDescription(action: string, success: boolean): string {
  const actionText: Record<string, string> = {
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    FAILED_LOGIN: 'Login gagal',
    PASSWORD_RESET: 'Reset password',
  };

  const status = success ? 'berhasil' : 'gagal';
  return `${actionText[action]} ${status}`;
}

/**
 * Helper: Generate changes summary
 */
function generateChangesSummary(oldValues: any, newValues: any): string {
  if (!oldValues || !newValues) return '';

  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  allKeys.forEach((key) => {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changes.push(`${key} diubah`);
    }
  });

  return changes.join(', ');
}

/**
 * Middleware to check for multiple failed login attempts
 */
export async function detectBruteForce(
  context: AuditContext,
  userId: string
): Promise<boolean> {
  // Check for multiple failed logins in last 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const recentFailedLogins = await auditService.queryLogs(context.tenantId, {
    userId,
    action: 'FAILED_LOGIN',
    startDate: fifteenMinutesAgo,
  });

  // If more than 5 failed attempts, it's a potential brute force attack
  if (recentFailedLogins.total >= 5) {
    await auditService.logSecurityEvent(context, {
      eventType: 'BRUTE_FORCE_ATTACK',
      eventSeverity: 'HIGH',
      eventDescription: `Terdeteksi ${recentFailedLogins.total} percobaan login gagal untuk user ${userId}`,
      threatLevel: 'HIGH',
      metadata: {
        failedAttempts: recentFailedLogins.total,
        timeWindow: '15 minutes',
      },
    });

    return true;
  }

  return false;
}

/**
 * Middleware to detect suspicious activity patterns
 */
export async function detectSuspiciousActivity(
  context: AuditContext
): Promise<void> {
  // Check for suspicious patterns:
  // 1. Rapid consecutive requests
  // 2. Access to sensitive resources from unusual locations
  // 3. Multiple different user agents in short time

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const recentLogs = await auditService.queryLogs(context.tenantId, {
    userId: context.userId,
    startDate: fiveMinutesAgo,
  });

  // Check for rapid requests (more than 100 in 5 minutes)
  if (recentLogs.total > 100) {
    await auditService.logSecurityEvent(context, {
      eventType: 'SUSPICIOUS_ACTIVITY',
      eventSeverity: 'MEDIUM',
      eventDescription: `Aktivitas tidak biasa terdeteksi: ${recentLogs.total} request dalam 5 menit`,
      threatLevel: 'MEDIUM',
      metadata: {
        requestCount: recentLogs.total,
        timeWindow: '5 minutes',
      },
    });
  }
}

// Export all middleware functions
export default {
  initializeAuditContext,
  auditAPIRequest,
  auditDataModification,
  auditAuthentication,
  auditAuthorization,
  auditSecurityEvent,
  detectBruteForce,
  detectSuspiciousActivity,
};
