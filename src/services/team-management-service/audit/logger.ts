/**
 * Team Activity Audit Logger
 * Handles comprehensive audit logging for all team management activities
 */

import { DatabaseClient } from '@/lib/database';
import { Logger } from '@/lib/logger';
import {
  TeamActivityLog,
  ActivityAction,
  EntityType,
  ActivityLogsQuery,
  PaginatedResponse
} from '@/lib/types/team';

interface LogEntry {
  action: ActivityAction;
  entityType: EntityType;
  entityId: string;
  performedBy?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changesSummary?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  batchId?: string;
  correlationId?: string;
}

export class AuditLogger {
  private readonly logger: Logger;

  constructor(
    private readonly db: DatabaseClient,
    private readonly tenantId: string
  ) {
    this.logger = new Logger('TeamAuditLogger');
  }

  /**
   * Log a team activity
   */
  async log(entry: LogEntry): Promise<string> {
    const logId = await this.db.transaction(async (tx) => {
      const query = `
        INSERT INTO team_activity_logs (
          tenant_id, action, entity_type, entity_id, performed_by,
          old_values, new_values, changes_summary, ip_address,
          user_agent, session_id, batch_id, correlation_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;

      const params = [
        this.tenantId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.performedBy,
        entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        entry.newValues ? JSON.stringify(entry.newValues) : null,
        entry.changesSummary,
        entry.ipAddress,
        entry.userAgent,
        entry.sessionId,
        entry.batchId,
        entry.correlationId
      ];

      const result = await tx.query(query, params);
      const logId = result.rows[0].id;

      this.logger.info('Activity logged', {
        logId,
        tenantId: this.tenantId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        performedBy: entry.performedBy
      });

      return logId;
    });

    return logId;
  }

  /**
   * Log a batch of activities (same operation affecting multiple entities)
   */
  async logBatch(
    entries: LogEntry[],
    batchId?: string
  ): Promise<string[]> {
    const actualBatchId = batchId || this.generateBatchId();
    const logIds: string[] = [];

    await this.db.transaction(async (tx) => {
      for (const entry of entries) {
        const logId = await this.log({
          ...entry,
          batchId: actualBatchId
        });
        logIds.push(logId);
      }
    });

    this.logger.info('Batch activities logged', {
      batchId: actualBatchId,
      count: entries.length,
      tenantId: this.tenantId
    });

    return logIds;
  }

  /**
   * Get activity logs with filtering and pagination
   */
  async getActivityLogs(query: ActivityLogsQuery = {}): Promise<PaginatedResponse<TeamActivityLog>> {
    const {
      page = 1,
      limit = 20,
      entityType,
      entityId,
      performedBy,
      action,
      dateFrom,
      dateTo
    } = query;

    const offset = (page - 1) * limit;
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [this.tenantId];
    let paramIndex = 2;

    if (entityType) {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(entityType);
    }

    if (entityId) {
      conditions.push(`entity_id = $${paramIndex++}`);
      params.push(entityId);
    }

    if (performedBy) {
      conditions.push(`performed_by = $${paramIndex++}`);
      params.push(performedBy);
    }

    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }

    if (dateFrom) {
      conditions.push(`performed_at >= $${paramIndex++}`);
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push(`performed_at <= $${paramIndex++}`);
      params.push(dateTo);
    }

    // Main query
    const selectQuery = `
      SELECT *
      FROM team_activity_logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY performed_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM team_activity_logs
      WHERE ${conditions.join(' AND ')}
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);

      const [logsResult, countResult] = await Promise.all([
        this.db.query(selectQuery, params),
        this.db.query(countQuery, params.slice(0, -2)) // Remove limit and offset for count
      ]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      const logs = logsResult.rows.map(row => this.mapRowToActivityLog(row));

      return {
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get activity logs for a specific entity
   */
  async getEntityHistory(
    entityType: EntityType,
    entityId: string,
    limit: number = 50
  ): Promise<TeamActivityLog[]> {
    const query = `
      SELECT *
      FROM team_activity_logs
      WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
      ORDER BY performed_at DESC
      LIMIT $4
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId, entityType, entityId, limit]);
      return result.rows.map(row => this.mapRowToActivityLog(row));
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get activity logs for a specific user
   */
  async getUserActivity(
    userId: string,
    limit: number = 50
  ): Promise<TeamActivityLog[]> {
    const query = `
      SELECT *
      FROM team_activity_logs
      WHERE tenant_id = $1 AND performed_by = $2
      ORDER BY performed_at DESC
      LIMIT $3
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId, userId, limit]);
      return result.rows.map(row => this.mapRowToActivityLog(row));
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get recent activities for dashboard
   */
  async getRecentActivities(limit: number = 10): Promise<TeamActivityLog[]> {
    const query = `
      SELECT tal.*,
        u.first_name,
        u.last_name,
        u.email
      FROM team_activity_logs tal
      LEFT JOIN users u ON tal.performed_by = u.id
      WHERE tal.tenant_id = $1
      ORDER BY tal.performed_at DESC
      LIMIT $2
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId, limit]);
      return result.rows.map(row => ({
        ...this.mapRowToActivityLog(row),
        performer: row.performed_by ? {
          id: row.performed_by,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email
        } : null
      }));
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStatistics(
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<any> {
    const dateCondition = dateFrom && dateTo
      ? `AND performed_at BETWEEN $2 AND $3`
      : '';

    const query = `
      SELECT
        COUNT(*) as total_activities,
        COUNT(DISTINCT performed_by) as unique_users,
        COUNT(DISTINCT entity_id) as unique_entities,
        COUNT(CASE WHEN action = 'create' THEN 1 END) as creates,
        COUNT(CASE WHEN action = 'update' THEN 1 END) as updates,
        COUNT(CASE WHEN action = 'delete' THEN 1 END) as deletes,
        COUNT(CASE WHEN action = 'invite' THEN 1 END) as invites,
        COUNT(CASE WHEN action = 'assign_role' THEN 1 END) as role_assignments
      FROM team_activity_logs
      WHERE tenant_id = $1 ${dateCondition}
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);

      const params = dateFrom && dateTo
        ? [this.tenantId, dateFrom, dateTo]
        : [this.tenantId];

      const result = await this.db.query(query, params);
      return result.rows[0];
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get activities by action type
   */
  async getActivitiesByAction(
    action: ActivityAction,
    limit: number = 20
  ): Promise<TeamActivityLog[]> {
    const query = `
      SELECT tal.*,
        u.first_name,
        u.last_name
      FROM team_activity_logs tal
      LEFT JOIN users u ON tal.performed_by = u.id
      WHERE tal.tenant_id = $1 AND tal.action = $2
      ORDER BY tal.performed_at DESC
      LIMIT $3
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId, action, limit]);
      return result.rows.map(row => this.mapRowToActivityLog(row));
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Search activity logs
   */
  async searchActivities(
    searchTerm: string,
    limit: number = 20
  ): Promise<TeamActivityLog[]> {
    const query = `
      SELECT tal.*,
        u.first_name,
        u.last_name
      FROM team_activity_logs tal
      LEFT JOIN users u ON tal.performed_by = u.id
      WHERE tal.tenant_id = $1 AND (
        tal.changes_summary ILIKE $2 OR
        tal.entity_type ILIKE $2 OR
        tal.action ILIKE $2 OR
        tal.correlation_id ILIKE $2
      )
      ORDER BY tal.performed_at DESC
      LIMIT $3
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId, `%${searchTerm}%`, limit]);
      return result.rows.map(row => this.mapRowToActivityLog(row));
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Get audit trail for compliance reporting
   */
  async getComplianceReport(
    dateFrom: Date,
    dateTo: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<any> {
    const query = `
      SELECT
        tal.id,
        tal.performed_at,
        tal.action,
        tal.entity_type,
        tal.entity_id,
        tal.changes_summary,
        u.first_name as performer_first_name,
        u.last_name as performer_last_name,
        u.email as performer_email,
        tal.ip_address,
        tal.source_system
      FROM team_activity_logs tal
      LEFT JOIN users u ON tal.performed_by = u.id
      WHERE tal.tenant_id = $1
        AND tal.performed_at BETWEEN $2 AND $3
      ORDER BY tal.performed_at ASC
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId, dateFrom, dateTo]);

      if (format === 'csv') {
        return this.convertToCSV(result.rows);
      }

      return {
        period: { from: dateFrom, to: dateTo },
        totalRecords: result.rows.length,
        records: result.rows
      };
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  /**
   * Clean up old audit logs (retention policy)
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const query = `
      DELETE FROM team_activity_logs
      WHERE tenant_id = $1 AND performed_at < $2
      RETURNING id
    `;

    try {
      await this.db.query(`SET app.current_tenant_id = '${this.tenantId}'`);
      const result = await this.db.query(query, [this.tenantId, cutoffDate]);
      const deletedCount = result.rows.length;

      this.logger.info('Old audit logs cleaned up', {
        tenantId: this.tenantId,
        deletedCount,
        cutoffDate
      });

      return deletedCount;
    } finally {
      await this.db.query('RESET app.current_tenant_id');
    }
  }

  // Private helper methods

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapRowToActivityLog(row: any): TeamActivityLog {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      performedBy: row.performed_by,
      performedAt: new Date(row.performed_at),
      oldValues: row.old_values ? JSON.parse(row.old_values) : undefined,
      newValues: row.new_values ? JSON.parse(row.new_values) : undefined,
      changesSummary: row.changes_summary,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      sessionId: row.session_id,
      batchId: row.batch_id,
      correlationId: row.correlation_id,
      sourceSystem: row.source_system
    };
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Add header row
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}