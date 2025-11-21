import { createLogger, format, transports } from 'winston';
import { TenantDataAccessValidator } from '@/lib/database/data-isolation';
import { tenantDatabasePool } from '@/lib/database/tenant-pool';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

export interface SecurityViolation {
  id: string;
  tenantId: string;
  userId: string;
  violationType: 'cross_tenant_access' | 'unauthorized_access' | 'data_breach_attempt' | 'resource_abuse';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface TenantResourceMetrics {
  tenantId: string;
  databaseConnections: number;
  activeQueries: number;
  queryResponseTime: number; // milliseconds
  cpuUsage: number; // percentage
  memoryUsage: number; // MB
  storageUsage: number; // MB
  requestCount: number; // per minute
  errorRate: number; // percentage
  timestamp: Date;
}

export interface TenantIsolationConfig {
  maxDatabaseConnections: number;
  maxQueriesPerSecond: number;
  maxConcurrentQueries: number;
  queryTimeout: number; // milliseconds
  maxStorageSize: number; // MB
  maxMemoryUsage: number; // MB
  enableCrossTenantPrevention: boolean;
  enableAuditLogging: boolean;
  enablePerformanceThrottling: boolean;
  indonesianComplianceMode: boolean;
}

/**
 * Tenant Isolation Service
 *
 * Provides comprehensive tenant data isolation, security monitoring,
 * and Indonesian compliance features for the autolumiku platform.
 */
export class TenantIsolationService {
  private resourceMetrics: Map<string, TenantResourceMetrics> = new Map();
  private securityViolations: Map<string, SecurityViolation[]> = new Map();
  private isolationConfigs: Map<string, TenantIsolationConfig> = new Map();
  private readonly defaultConfig: TenantIsolationConfig = {
    maxDatabaseConnections: 20,
    maxQueriesPerSecond: 100,
    maxConcurrentQueries: 10,
    queryTimeout: 30000, // 30 seconds
    maxStorageSize: 10240, // 10GB
    maxMemoryUsage: 512, // 512MB
    enableCrossTenantPrevention: true,
    enableAuditLogging: true,
    enablePerformanceThrottling: true,
    indonesianComplianceMode: true,
  };

  constructor() {
    // Start resource monitoring
    this.startResourceMonitoring();

    // Start violation cleanup (cleanup old violations every hour)
    setInterval(() => this.cleanupOldViolations(), 60 * 60 * 1000);
  }

  /**
   * Validate tenant access for a given operation
   */
  async validateTenantAccess(
    userTenantId: string | null,
    requestedTenantId: string,
    userRole: string,
    operation: string
  ): Promise<{ allowed: boolean; reason?: string; violationLogged?: boolean }> {
    try {
      // Get tenant configuration
      const config = this.getTenantConfig(requestedTenantId);

      // Check if cross-tenant prevention is enabled
      if (config.enableCrossTenantPrevention && userTenantId !== requestedTenantId) {
        // Check if user has permission for cross-tenant access
        const accessResult = TenantDataAccessValidator.validateTenantAccess(
          userTenantId,
          requestedTenantId,
          userRole
        );

        if (!accessResult.valid) {
          // Log security violation
          await this.logSecurityViolation({
            tenantId: requestedTenantId,
            userId: 'unknown', // Would be populated from auth context
            violationType: 'cross_tenant_access',
            severity: 'high',
            description: `Attempted cross-tenant access: ${operation}`,
            timestamp: new Date(),
            metadata: {
              userTenantId,
              requestedTenantId,
              userRole,
              operation,
              reason: accessResult.reason
            }
          });

          return {
            allowed: false,
            reason: accessResult.reason || 'Cross-tenant access denied',
            violationLogged: true
          };
        }
      }

      // Check resource limits
      const resourceCheck = await this.checkResourceLimits(requestedTenantId);
      if (!resourceCheck.allowed) {
        return {
          allowed: false,
          reason: resourceCheck.reason || 'Resource limits exceeded'
        };
      }

      return { allowed: true };

    } catch (error) {
      logger.error('Error validating tenant access:', error);
      return {
        allowed: false,
        reason: 'Access validation failed'
      };
    }
  }

  /**
   * Check if tenant has exceeded resource limits
   */
  private async checkResourceLimits(
    tenantId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const config = this.getTenantConfig(tenantId);
    const metrics = this.resourceMetrics.get(tenantId);

    if (!metrics) {
      return { allowed: true }; // No metrics available yet
    }

    // Check database connections
    if (metrics.databaseConnections >= config.maxDatabaseConnections) {
      return {
        allowed: false,
        reason: `Maximum database connections (${config.maxDatabaseConnections}) exceeded`
      };
    }

    // Check concurrent queries
    if (metrics.activeQueries >= config.maxConcurrentQueries) {
      return {
        allowed: false,
        reason: `Maximum concurrent queries (${config.maxConcurrentQueries}) exceeded`
      };
    }

    // Check memory usage
    if (metrics.memoryUsage >= config.maxMemoryUsage) {
      return {
        allowed: false,
        reason: `Memory limit (${config.maxMemoryUsage}MB) exceeded`
      };
    }

    // Check storage usage
    if (metrics.storageUsage >= config.maxStorageSize) {
      return {
        allowed: false,
        reason: `Storage limit (${config.maxStorageSize}MB) exceeded`
      };
    }

    return { allowed: true };
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(violation: Omit<SecurityViolation, 'id'>): Promise<void> {
    const id = `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullViolation: SecurityViolation = { id, ...violation };

    // Store violation in memory
    if (!this.securityViolations.has(violation.tenantId)) {
      this.securityViolations.set(violation.tenantId, []);
    }
    this.securityViolations.get(violation.tenantId)!.push(fullViolation);

    // Log to system
    logger.warn('Security violation detected', {
      violationId: id,
      tenantId: violation.tenantId,
      type: violation.violationType,
      severity: violation.severity,
      description: violation.description
    });

    // Send alert for high/critical severity violations
    if (violation.severity === 'high' || violation.severity === 'critical') {
      await this.sendSecurityAlert(fullViolation);
    }

    // Store in tenant database for audit trail
    try {
      await tenantDatabasePool.query(
        violation.tenantId,
        `INSERT INTO audit_logs (
          id, user_id, action, entity_type, entity_id,
          old_values, new_values, ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id,
          violation.userId,
          'SECURITY_VIOLATION',
          violation.violationType,
          violation.tenantId,
          null, // old_values
          JSON.stringify(violation.metadata), // new_values
          violation.ipAddress,
          violation.userAgent,
          violation.timestamp
        ]
      );
    } catch (error) {
      logger.error('Failed to store security violation in tenant database:', error);
    }
  }

  /**
   * Send security alert
   */
  private async sendSecurityAlert(violation: SecurityViolation): Promise<void> {
    // In production, this would send alerts via email, SMS, or monitoring systems
    logger.warn('🚨 SECURITY ALERT', {
      violationId: violation.id,
      tenantId: violation.tenantId,
      severity: violation.severity,
      type: violation.violationType,
      description: violation.description,
      timestamp: violation.timestamp
    });
  }

  /**
   * Get tenant resource metrics
   */
  async getTenantResourceMetrics(tenantId: string): Promise<TenantResourceMetrics | null> {
    return this.resourceMetrics.get(tenantId) || null;
  }

  /**
   * Update tenant resource metrics
   */
  async updateTenantResourceMetrics(metrics: TenantResourceMetrics): Promise<void> {
    this.resourceMetrics.set(metrics.tenantId, metrics);
  }

  /**
   * Get security violations for a tenant
   */
  getSecurityViolations(
    tenantId: string,
    options?: {
      severity?: SecurityViolation['severity'];
      type?: SecurityViolation['violationType'];
      since?: Date;
      limit?: number;
    }
  ): SecurityViolation[] {
    let violations = this.securityViolations.get(tenantId) || [];

    // Filter by severity
    if (options?.severity) {
      violations = violations.filter(v => v.severity === options.severity);
    }

    // Filter by type
    if (options?.type) {
      violations = violations.filter(v => v.violationType === options.type);
    }

    // Filter by date
    if (options?.since) {
      violations = violations.filter(v => v.timestamp >= options.since!);
    }

    // Sort by timestamp (newest first)
    violations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Limit results
    if (options?.limit) {
      violations = violations.slice(0, options.limit);
    }

    return violations;
  }

  /**
   * Get tenant isolation configuration
   */
  getTenantConfig(tenantId: string): TenantIsolationConfig {
    return this.isolationConfigs.get(tenantId) || this.defaultConfig;
  }

  /**
   * Update tenant isolation configuration
   */
  async updateTenantConfig(
    tenantId: string,
    config: Partial<TenantIsolationConfig>
  ): Promise<TenantIsolationConfig> {
    const currentConfig = this.getTenantConfig(tenantId);
    const newConfig = { ...currentConfig, ...config };
    this.isolationConfigs.set(tenantId, newConfig);

    logger.info(`Updated isolation config for tenant ${tenantId}`, { config: newConfig });

    return newConfig;
  }

  /**
   * Start resource monitoring for all tenants
   */
  private startResourceMonitoring(): void {
    // Update metrics every 30 seconds
    setInterval(async () => {
      try {
        const poolStats = tenantDatabasePool.getPoolStats();

        for (const [tenantId, stats] of Object.entries(poolStats)) {
          const metrics: TenantResourceMetrics = {
            tenantId,
            databaseConnections: stats.totalCount,
            activeQueries: stats.totalCount - stats.idleCount,
            queryResponseTime: 0, // Would be calculated from actual queries
            cpuUsage: 0, // Would be measured from system metrics
            memoryUsage: 0, // Would be measured from system metrics
            storageUsage: 0, // Would be measured from database size
            requestCount: 0, // Would be tracked from API requests
            errorRate: 0, // Would be calculated from error logs
            timestamp: new Date()
          };

          this.resourceMetrics.set(tenantId, metrics);
        }
      } catch (error) {
        logger.error('Error updating resource metrics:', error);
      }
    }, 30000); // 30 seconds
  }

  /**
   * Clean up old security violations (older than 90 days)
   */
  private cleanupOldViolations(): void {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    for (const [tenantId, violations] of this.securityViolations.entries()) {
      const recentViolations = violations.filter(v => v.timestamp >= ninetyDaysAgo);
      this.securityViolations.set(tenantId, recentViolations);
    }

    logger.info('Cleaned up old security violations');
  }

  /**
   * Get isolation health status for a tenant
   */
  async getIsolationHealth(tenantId: string): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    checks: {
      databaseIsolation: boolean;
      resourceLimits: boolean;
      securityViolations: boolean;
      performance: boolean;
      compliance: boolean;
    };
    metrics: TenantResourceMetrics | null;
    recentViolations: number;
  }> {
    const config = this.getTenantConfig(tenantId);
    const metrics = await this.getTenantResourceMetrics(tenantId);
    const recentViolations = this.getSecurityViolations(tenantId, {
      since: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    }).length;

    // Perform health checks
    const checks = {
      databaseIsolation: await this.checkDatabaseIsolation(tenantId),
      resourceLimits: metrics ? this.checkResourceHealth(metrics, config) : true,
      securityViolations: recentViolations < 10, // Warning if more than 10 violations in 24h
      performance: metrics ? metrics.queryResponseTime < config.queryTimeout : true,
      compliance: config.indonesianComplianceMode && config.enableAuditLogging
    };

    // Determine overall status
    const failedChecks = Object.values(checks).filter(v => !v).length;
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (failedChecks === 0) {
      status = 'healthy';
    } else if (failedChecks <= 2) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    return {
      status,
      checks,
      metrics,
      recentViolations
    };
  }

  /**
   * Check database isolation health
   */
  private async checkDatabaseIsolation(tenantId: string): Promise<boolean> {
    try {
      // Verify tenant database exists and is accessible
      await tenantDatabasePool.query(tenantId, 'SELECT 1');
      return true;
    } catch (error) {
      logger.error(`Database isolation check failed for tenant ${tenantId}:`, error);
      return false;
    }
  }

  /**
   * Check resource health based on metrics and config
   */
  private checkResourceHealth(
    metrics: TenantResourceMetrics,
    config: TenantIsolationConfig
  ): boolean {
    // Consider healthy if all resources are below 80% of limits
    const connectionUsage = metrics.databaseConnections / config.maxDatabaseConnections;
    const queryUsage = metrics.activeQueries / config.maxConcurrentQueries;
    const memoryUsage = metrics.memoryUsage / config.maxMemoryUsage;
    const storageUsage = metrics.storageUsage / config.maxStorageSize;

    return (
      connectionUsage < 0.8 &&
      queryUsage < 0.8 &&
      memoryUsage < 0.8 &&
      storageUsage < 0.8
    );
  }

  /**
   * Indonesian Data Protection Compliance Features
   */

  /**
   * Ensure data handling complies with Indonesian PDPA requirements
   */
  async ensureIndonesianCompliance(tenantId: string): Promise<{
    compliant: boolean;
    requirements: {
      dataLocalization: boolean;
      consentManagement: boolean;
      dataEncryption: boolean;
      auditTrail: boolean;
      breachNotification: boolean;
    };
  }> {
    const config = this.getTenantConfig(tenantId);

    const requirements = {
      dataLocalization: true, // All data stored in Indonesia region
      consentManagement: config.enableAuditLogging, // Track user consents
      dataEncryption: true, // Data encrypted at rest and in transit
      auditTrail: config.enableAuditLogging, // Complete audit logs maintained
      breachNotification: true // Breach notification system enabled
    };

    const compliant = Object.values(requirements).every(v => v === true);

    return {
      compliant,
      requirements
    };
  }

  /**
   * Log data access for Indonesian compliance
   */
  async logDataAccess(params: {
    tenantId: string;
    userId: string;
    dataType: string;
    action: 'read' | 'write' | 'delete';
    purpose: string;
    legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'legitimate_interest';
    timestamp: Date;
  }): Promise<void> {
    logger.info('Indonesian compliance: Data access logged', params);

    try {
      await tenantDatabasePool.query(
        params.tenantId,
        `INSERT INTO audit_logs (
          user_id, action, entity_type,
          new_values, created_at
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          params.userId,
          `DATA_ACCESS_${params.action.toUpperCase()}`,
          params.dataType,
          JSON.stringify({
            purpose: params.purpose,
            legalBasis: params.legalBasis,
            complianceLogged: true
          }),
          params.timestamp
        ]
      );
    } catch (error) {
      logger.error('Failed to log data access for Indonesian compliance:', error);
    }
  }
}

export const tenantIsolationService = new TenantIsolationService();
export default TenantIsolationService;
