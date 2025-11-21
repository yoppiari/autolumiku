/**
 * Security Monitoring Service
 * Monitors and alerts on unauthorized access attempts and suspicious activities
 * Part of Story 1.8: Role-Based Access Control
 */

import { DatabaseClient } from '@/lib/database';
import { Logger } from '@/lib/logger';
import { Cache } from '@/lib/cache';

export interface SecurityEvent {
  eventType: 'UNAUTHORIZED_ACCESS' | 'PERMISSION_DENIED' | 'SUSPICIOUS_ACTIVITY' | 'ROLE_ESCALATION_ATTEMPT' | 'AUDIT_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  tenantId: string;
  resourceType?: string;
  resourceId?: string;
  attemptedAction?: string;
  deniedPermission?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
}

export interface SecurityAlert {
  id: string;
  eventType: string;
  severity: string;
  tenantId: string;
  userId?: string;
  message: string;
  detectedAt: Date;
  notifiedTo: string[];
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export class SecurityMonitoringService {
  private readonly logger: Logger;
  private readonly cache: Cache;
  private readonly alertThresholds: Map<string, number>;

  constructor(
    private readonly db: DatabaseClient
  ) {
    this.logger = new Logger('SecurityMonitoringService');
    this.cache = new Cache('security_monitoring', 300); // 5 minute cache

    // Configure alert thresholds
    this.alertThresholds = new Map([
      ['failed_permission_checks', 5], // 5 failed checks in 5 minutes
      ['unauthorized_access_attempts', 3], // 3 unauthorized attempts in 5 minutes
      ['role_escalation_attempts', 1], // Any role escalation attempt is critical
      ['audit_violations', 2] // 2 audit violations in 5 minutes
    ]);
  }

  /**
   * Log security event and check if alert should be triggered
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Log event to database
      const query = `
        INSERT INTO security_events (
          tenant_id, user_id, event_type, severity,
          resource_type, resource_id, attempted_action,
          denied_permission, ip_address, user_agent,
          details, detected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING id
      `;

      await this.db.query(query, [
        event.tenantId,
        event.userId || null,
        event.eventType,
        event.severity,
        event.resourceType || null,
        event.resourceId || null,
        event.attemptedAction || null,
        event.deniedPermission || null,
        event.ipAddress || null,
        event.userAgent || null,
        JSON.stringify(event.details || {})
      ]);

      // Log to application logger
      this.logger.warn('Security event detected', {
        ...event,
        timestamp: new Date().toISOString()
      });

      // Check if alert threshold is reached
      await this.checkAlertThreshold(event);

      // Update rate limiting counters
      await this.updateRateLimitCounters(event);

    } catch (error) {
      this.logger.error('Failed to log security event', { error, event });
      throw error;
    }
  }

  /**
   * Check if alert threshold is reached and create alert if needed
   */
  private async checkAlertThreshold(event: SecurityEvent): Promise<void> {
    const key = this.getEventKey(event);
    const threshold = this.alertThresholds.get(key) || 5;

    // Get event count in last 5 minutes
    const cacheKey = `security_event_count:${event.tenantId}:${key}:${event.userId || 'system'}`;
    const countStr = await this.cache.get(cacheKey);
    const count = countStr ? parseInt(countStr) + 1 : 1;

    await this.cache.set(cacheKey, count.toString(), 300); // 5 minute expiry

    if (count >= threshold) {
      await this.createSecurityAlert(event, count);
    }
  }

  /**
   * Get event key for threshold tracking
   */
  private getEventKey(event: SecurityEvent): string {
    switch (event.eventType) {
      case 'PERMISSION_DENIED':
        return 'failed_permission_checks';
      case 'UNAUTHORIZED_ACCESS':
        return 'unauthorized_access_attempts';
      case 'ROLE_ESCALATION_ATTEMPT':
        return 'role_escalation_attempts';
      case 'AUDIT_VIOLATION':
        return 'audit_violations';
      default:
        return 'suspicious_activity';
    }
  }

  /**
   * Create security alert and notify admins
   */
  private async createSecurityAlert(event: SecurityEvent, count: number): Promise<void> {
    try {
      const message = this.generateAlertMessage(event, count);

      // Create alert in database
      const query = `
        INSERT INTO security_alerts (
          tenant_id, user_id, event_type, severity,
          message, detected_at, resolved
        ) VALUES ($1, $2, $3, $4, $5, NOW(), false)
        RETURNING id
      `;

      const result = await this.db.query(query, [
        event.tenantId,
        event.userId || null,
        event.eventType,
        event.severity,
        message
      ]);

      const alertId = result.rows[0].id;

      // Log critical alert
      this.logger.error('Security alert created', {
        alertId,
        event,
        count,
        message
      });

      // Notify admins (implementation would integrate with notification service)
      await this.notifyAdmins(event.tenantId, alertId, message, event.severity);

    } catch (error) {
      this.logger.error('Failed to create security alert', { error, event });
    }
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(event: SecurityEvent, count: number): string {
    const eventTypeMessages = {
      'UNAUTHORIZED_ACCESS': `${count} unauthorized access attempts detected`,
      'PERMISSION_DENIED': `${count} failed permission checks detected`,
      'ROLE_ESCALATION_ATTEMPT': `Role escalation attempt detected`,
      'AUDIT_VIOLATION': `${count} audit violations detected`,
      'SUSPICIOUS_ACTIVITY': `${count} suspicious activities detected`
    };

    let message = eventTypeMessages[event.eventType] || `Security event detected: ${event.eventType}`;

    if (event.userId) {
      message += ` by user ${event.userId}`;
    }

    if (event.resourceType && event.resourceId) {
      message += ` on ${event.resourceType} ${event.resourceId}`;
    }

    if (event.deniedPermission) {
      message += `. Attempted permission: ${event.deniedPermission}`;
    }

    return message;
  }

  /**
   * Notify tenant admins about security alert
   */
  private async notifyAdmins(
    tenantId: string,
    alertId: string,
    message: string,
    severity: string
  ): Promise<void> {
    try {
      // Get tenant admins
      const adminQuery = `
        SELECT DISTINCT tm.user_id, u.email, u.first_name, u.last_name
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        JOIN team_member_roles tmr ON tm.id = tmr.team_member_id
        JOIN dealership_roles dr ON tmr.role_id = dr.id
        JOIN role_permissions rp ON dr.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE tm.tenant_id = $1
          AND tm.is_active = true
          AND p.code IN ('security.alerts.view', 'tenant.manage')
          AND tmr.effective_from <= CURRENT_TIMESTAMP
          AND (tmr.effective_until IS NULL OR tmr.effective_until > CURRENT_TIMESTAMP)
      `;

      const result = await this.db.query(adminQuery, [tenantId]);
      const admins = result.rows;

      if (admins.length === 0) {
        this.logger.warn('No admins found to notify for security alert', {
          tenantId,
          alertId
        });
        return;
      }

      // Record notification (actual notification would be handled by notification service)
      const notificationQuery = `
        UPDATE security_alerts
        SET notified_to = $1, notified_at = NOW()
        WHERE id = $2
      `;

      const adminEmails = admins.map(admin => admin.email);
      await this.db.query(notificationQuery, [adminEmails, alertId]);

      this.logger.info('Security alert notification sent', {
        alertId,
        tenantId,
        adminCount: admins.length,
        severity
      });

    } catch (error) {
      this.logger.error('Failed to notify admins', { error, tenantId, alertId });
    }
  }

  /**
   * Update rate limiting counters for user/tenant
   */
  private async updateRateLimitCounters(event: SecurityEvent): Promise<void> {
    if (!event.userId) return;

    const key = `rate_limit:${event.tenantId}:${event.userId}:${event.eventType}`;
    const countStr = await this.cache.get(key);
    const count = countStr ? parseInt(countStr) + 1 : 1;

    // Set with 1 hour expiry
    await this.cache.set(key, count.toString(), 3600);

    // If rate limit exceeded, log additional event
    if (count > 10) {
      this.logger.warn('User exceeded security event rate limit', {
        userId: event.userId,
        tenantId: event.tenantId,
        eventType: event.eventType,
        count
      });
    }
  }

  /**
   * Get security events for tenant
   */
  async getSecurityEvents(
    tenantId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      eventType?: string;
      severity?: string;
      userId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any[]> {
    try {
      const {
        startDate,
        endDate,
        eventType,
        severity,
        userId,
        limit = 100,
        offset = 0
      } = options;

      let whereClause = 'WHERE tenant_id = $1';
      const queryParams: any[] = [tenantId];
      let paramIndex = 2;

      if (startDate) {
        whereClause += ` AND detected_at >= $${paramIndex}`;
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND detected_at <= $${paramIndex}`;
        queryParams.push(endDate);
        paramIndex++;
      }

      if (eventType) {
        whereClause += ` AND event_type = $${paramIndex}`;
        queryParams.push(eventType);
        paramIndex++;
      }

      if (severity) {
        whereClause += ` AND severity = $${paramIndex}`;
        queryParams.push(severity);
        paramIndex++;
      }

      if (userId) {
        whereClause += ` AND user_id = $${paramIndex}`;
        queryParams.push(userId);
        paramIndex++;
      }

      const query = `
        SELECT
          se.*,
          u.email as user_email,
          u.first_name || ' ' || u.last_name as user_name
        FROM security_events se
        LEFT JOIN users u ON se.user_id = u.id
        ${whereClause}
        ORDER BY se.detected_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);

      const result = await this.db.query(query, queryParams);
      return result.rows;

    } catch (error) {
      this.logger.error('Failed to get security events', { error, tenantId, options });
      throw error;
    }
  }

  /**
   * Get active security alerts for tenant
   */
  async getActiveAlerts(tenantId: string): Promise<SecurityAlert[]> {
    try {
      const query = `
        SELECT
          sa.*,
          u.email as user_email,
          u.first_name || ' ' || u.last_name as user_name
        FROM security_alerts sa
        LEFT JOIN users u ON sa.user_id = u.id
        WHERE sa.tenant_id = $1 AND sa.resolved = false
        ORDER BY sa.severity DESC, sa.detected_at DESC
      `;

      const result = await this.db.query(query, [tenantId]);
      return result.rows;

    } catch (error) {
      this.logger.error('Failed to get active alerts', { error, tenantId });
      throw error;
    }
  }

  /**
   * Resolve security alert
   */
  async resolveAlert(
    alertId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE security_alerts
        SET resolved = true,
            resolved_at = NOW(),
            resolved_by = $1,
            resolution = $2
        WHERE id = $3
      `;

      await this.db.query(query, [resolvedBy, resolution, alertId]);

      this.logger.info('Security alert resolved', {
        alertId,
        resolvedBy,
        resolution
      });

    } catch (error) {
      this.logger.error('Failed to resolve alert', { error, alertId, resolvedBy });
      throw error;
    }
  }

  /**
   * Get security statistics for tenant
   */
  async getSecurityStatistics(
    tenantId: string,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<any> {
    try {
      const periodHours = {
        'day': 24,
        'week': 168,
        'month': 720
      };

      const query = `
        SELECT
          event_type,
          severity,
          COUNT(*) as event_count,
          COUNT(DISTINCT user_id) as affected_users,
          MAX(detected_at) as last_occurrence
        FROM security_events
        WHERE tenant_id = $1
          AND detected_at >= NOW() - INTERVAL '${periodHours[period]} hours'
        GROUP BY event_type, severity
        ORDER BY event_count DESC
      `;

      const result = await this.db.query(query, [tenantId]);

      return {
        period,
        statistics: result.rows,
        totalEvents: result.rows.reduce((sum, row) => sum + parseInt(row.event_count), 0),
        criticalEvents: result.rows
          .filter(row => row.severity === 'CRITICAL')
          .reduce((sum, row) => sum + parseInt(row.event_count), 0)
      };

    } catch (error) {
      this.logger.error('Failed to get security statistics', { error, tenantId, period });
      throw error;
    }
  }
}
