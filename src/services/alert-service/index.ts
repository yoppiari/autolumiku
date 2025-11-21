/**
 * Alert Service
 * Manages alert rules, detection, and notifications
 */

import {
  AlertRule,
  Alert,
  AlertCondition,
  NotificationChannel,
  MetricsQueryRequest,
  AlertError
} from '../../types/health';
import { EventEmitter } from 'events';

export interface AlertServiceConfig {
  checkInterval: number; // seconds
  maxActiveAlerts: number;
  notificationRetries: number;
  defaultCooldown: number; // seconds
}

export interface AlertNotification {
  alertId: string;
  channel: NotificationChannel;
  message: string;
  details: any;
  attempt: number;
  sentAt?: Date;
  error?: string;
}

export class AlertService extends EventEmitter {
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private notificationQueue: AlertNotification[] = [];
  private checkIntervalId?: NodeJS.Timeout;
  private metricsService: any; // Would be properly typed

  constructor(
    private config: AlertServiceConfig,
    metricsService?: any
  ) {
    super();
    this.metricsService = metricsService;
    this.initializeDefaultRules();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    // High CPU Usage Alert
    this.createAlertRule({
      name: 'High CPU Usage',
      description: 'Alert when CPU usage exceeds 80% for 5 minutes',
      enabled: true,
      condition: {
        metric: 'system.cpu.usage',
        aggregator: 'avg',
        timeWindow: 300, // 5 minutes
        groupBy: ['source']
      },
      severity: 'high',
      threshold: {
        operator: '>',
        value: 80
      },
      duration: 300, // 5 minutes
      notifications: [
        {
          id: 'default-email',
          type: 'email',
          config: {
            recipients: ['admin@autolumiku.com'],
            template: 'high_cpu_usage'
          },
          enabled: true
        }
      ],
      cooldown: 900, // 15 minutes
      createdBy: 'system'
    });

    // High Memory Usage Alert
    this.createAlertRule({
      name: 'High Memory Usage',
      description: 'Alert when memory usage exceeds 85% for 3 minutes',
      enabled: true,
      condition: {
        metric: 'system.memory.usage',
        aggregator: 'avg',
        timeWindow: 180, // 3 minutes
        groupBy: ['source']
      },
      severity: 'high',
      threshold: {
        operator: '>',
        value: 85
      },
      duration: 180, // 3 minutes
      notifications: [
        {
          id: 'default-email',
          type: 'email',
          config: {
            recipients: ['admin@autolumiku.com'],
            template: 'high_memory_usage'
          },
          enabled: true
        }
      ],
      cooldown: 900,
      createdBy: 'system'
    });

    // Disk Space Alert
    this.createAlertRule({
      name: 'Low Disk Space',
      description: 'Alert when disk usage exceeds 90%',
      enabled: true,
      condition: {
        metric: 'system.disk.usage',
        aggregator: 'max',
        timeWindow: 60, // 1 minute
        groupBy: ['source']
      },
      severity: 'critical',
      threshold: {
        operator: '>',
        value: 90
      },
      duration: 60, // 1 minute
      notifications: [
        {
          id: 'default-email',
          type: 'email',
          config: {
            recipients: ['admin@autolumiku.com'],
            template: 'low_disk_space'
          },
          enabled: true
        },
        {
          id: 'urgent-sms',
          type: 'sms',
          config: {
            recipients: ['+628123456789'],
            template: 'urgent_alert'
          },
          enabled: true
        }
      ],
      cooldown: 600, // 10 minutes
      createdBy: 'system'
    });

    // Database Connection Alert
    this.createAlertRule({
      name: 'Database Connection Issues',
      description: 'Alert when database connections exceed 80% of maximum',
      enabled: true,
      condition: {
        metric: 'database.connections.active',
        aggregator: 'avg',
        timeWindow: 120, // 2 minutes
        groupBy: ['source']
      },
      severity: 'medium',
      threshold: {
        operator: '>',
        value: 80
      },
      duration: 120, // 2 minutes
      notifications: [
        {
          id: 'default-email',
          type: 'email',
          config: {
            recipients: ['admin@autolumiku.com'],
            template: 'database_connections'
          },
          enabled: true
        }
      ],
      cooldown: 900,
      createdBy: 'system'
    });

    // Application Error Rate Alert
    this.createAlertRule({
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds 5% over 10 minutes',
      enabled: true,
      condition: {
        metric: 'error_rate',
        aggregator: 'avg',
        timeWindow: 600, // 10 minutes
        groupBy: ['service']
      },
      severity: 'medium',
      threshold: {
        operator: '>',
        value: 5
      },
      duration: 300, // 5 minutes
      notifications: [
        {
          id: 'default-email',
          type: 'email',
          config: {
            recipients: ['admin@autolumiku.com'],
            template: 'high_error_rate'
          },
          enabled: true
        }
      ],
      cooldown: 1200, // 20 minutes
      createdBy: 'system'
    });
  }

  /**
   * Create a new alert rule
   */
  createAlertRule(ruleData: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): AlertRule {
    const rule: AlertRule = {
      ...ruleData,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.alertRules.set(rule.id, rule);
    this.emit('ruleCreated', rule);
    return rule;
  }

  /**
   * Update an existing alert rule
   */
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): AlertRule {
    const existingRule = this.alertRules.get(ruleId);
    if (!existingRule) {
      throw new AlertError('Alert rule not found', ruleId);
    }

    const updatedRule: AlertRule = {
      ...existingRule,
      ...updates,
      id: ruleId,
      updatedAt: new Date()
    };

    this.alertRules.set(ruleId, updatedRule);
    this.emit('ruleUpdated', updatedRule);
    return updatedRule;
  }

  /**
   * Delete an alert rule
   */
  deleteAlertRule(ruleId: string): boolean {
    const deleted = this.alertRules.delete(ruleId);
    if (deleted) {
      this.emit('ruleDeleted', ruleId);
    }
    return deleted;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get enabled alert rules
   */
  getEnabledAlertRules(): AlertRule[] {
    return this.getAlertRules().filter(rule => rule.enabled);
  }

  /**
   * Get an alert rule by ID
   */
  getAlertRule(ruleId: string): AlertRule | undefined {
    return this.alertRules.get(ruleId);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): Alert | undefined {
    return this.activeAlerts.get(alertId);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string, message?: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new AlertError('Alert not found', alertId);
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    this.emit('alertAcknowledged', alert);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new AlertError('Alert not found', alertId);
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();

    // Remove from active alerts after a delay
    setTimeout(() => {
      this.activeAlerts.delete(alertId);
      this.emit('alertResolved', alert);
    }, 60000); // Keep resolved alerts for 1 minute
  }

  /**
   * Start alert monitoring
   */
  startMonitoring(): void {
    if (this.checkIntervalId) {
      this.stopMonitoring();
    }

    this.checkIntervalId = setInterval(async () => {
      try {
        await this.checkAlertRules();
      } catch (error) {
        console.error('Alert monitoring error:', error);
        this.emit('monitoringError', error);
      }
    }, this.config.checkInterval * 1000);

    this.emit('monitoringStarted');
  }

  /**
   * Stop alert monitoring
   */
  stopMonitoring(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = undefined;
      this.emit('monitoringStopped');
    }
  }

  /**
   * Check all enabled alert rules
   */
  async checkAlertRules(): Promise<void> {
    const enabledRules = this.getEnabledAlertRules();

    for (const rule of enabledRules) {
      try {
        await this.evaluateAlertRule(rule);
      } catch (error) {
        console.error(`Failed to evaluate alert rule ${rule.name}:`, error);
      }
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateAlertRule(rule: AlertRule): Promise<void> {
    if (!this.metricsService) {
      return; // Skip evaluation if metrics service not available
    }

    try {
      // Query metrics for the rule
      const query: MetricsQueryRequest = {
        metric: rule.condition.metric,
        timeRange: {
          from: new Date(Date.now() - rule.condition.timeWindow * 1000),
          to: new Date()
        },
        aggregation: rule.condition.aggregator,
        filters: rule.condition.filters,
        groupBy: rule.condition.groupBy
      };

      const result = await this.metricsService.queryMetrics(query);

      if (result.timeSeries.length === 0) {
        return; // No data available for this metric
      }

      // Get the latest value
      const latestValue = result.timeSeries[result.timeSeries.length - 1].value;
      const isThresholdBreached = this.evaluateThreshold(latestValue, rule.threshold);

      // Check if there's already an active alert for this rule
      const existingAlert = Array.from(this.activeAlerts.values())
        .find(alert => alert.ruleId === rule.id && alert.status === 'firing');

      if (isThresholdBreached && !existingAlert) {
        // Create new alert
        await this.createAlert(rule, latestValue, result.timeSeries);
      } else if (!isThresholdBreached && existingAlert) {
        // Resolve existing alert
        this.resolveAlert(existingAlert.id);
      }

    } catch (error) {
      console.error(`Error evaluating alert rule ${rule.name}:`, error);
    }
  }

  /**
   * Evaluate threshold condition
   */
  private evaluateThreshold(value: number, threshold: AlertRule['threshold']): boolean {
    switch (threshold.operator) {
      case '>':
        return value > Number(threshold.value);
      case '<':
        return value < Number(threshold.value);
      case '>=':
        return value >= Number(threshold.value);
      case '<=':
        return value <= Number(threshold.value);
      case '=':
        return value === Number(threshold.value);
      case '!=':
        return value !== Number(threshold.value);
      case 'in':
        return Array.isArray(threshold.value) && threshold.value.includes(value);
      case 'not_in':
        return Array.isArray(threshold.value) && !threshold.value.includes(value);
      default:
        return false;
    }
  }

  /**
   * Create a new alert
   */
  private async createAlert(rule: AlertRule, value: number, timeSeries: any[]): Promise<void> {
    if (this.activeAlerts.size >= this.config.maxActiveAlerts) {
      console.warn('Maximum active alerts reached, skipping new alert');
      return;
    }

    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      status: 'firing',
      severity: rule.severity,
      message: this.generateAlertMessage(rule, value),
      details: {
        currentValue: value,
        threshold: rule.threshold,
        timeWindow: rule.condition.timeWindow,
        affectedEntities: this.extractAffectedEntities(timeSeries)
      },
      startedAt: new Date(),
      notificationsSent: 0,
      affectedEntities: this.extractAffectedEntities(timeSeries)
    };

    this.activeAlerts.set(alert.id, alert);
    this.emit('alertCreated', alert);

    // Send notifications
    await this.sendNotifications(alert, rule);
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, value: number): string {
    return `${rule.name}: ${rule.description} (Current value: ${value}, Threshold: ${rule.threshold.value})`;
  }

  /**
   * Extract affected entities from time series data
   */
  private extractAffectedEntities(timeSeries: any[]): string[] {
    const entities = new Set<string>();
    timeSeries.forEach(ts => {
      if (ts.tags && ts.tags.tenantId) {
        entities.add(ts.tags.tenantId);
      }
      if (ts.tags && ts.tags.source) {
        entities.add(ts.tags.source);
      }
    });
    return Array.from(entities);
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    for (const channel of rule.notifications) {
      if (!channel.enabled) {
        continue;
      }

      const notification: AlertNotification = {
        alertId: alert.id,
        channel,
        message: alert.message,
        details: alert.details,
        attempt: 1
      };

      this.notificationQueue.push(notification);
    }

    // Process notification queue
    this.processNotificationQueue();
  }

  /**
   * Process notification queue
   */
  private async processNotificationQueue(): Promise<void> {
    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift()!;

      try {
        await this.sendNotification(notification);
        notification.sentAt = new Date();
        alert.notificationsSent++;
      } catch (error) {
        notification.error = error.message;

        // Retry if not exceeded max retries
        if (notification.attempt < this.config.notificationRetries) {
          notification.attempt++;
          this.notificationQueue.push(notification);

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          console.error(`Failed to send notification after ${this.config.notificationRetries} attempts:`, error);
          this.emit('notificationFailed', notification);
        }
      }
    }
  }

  /**
   * Send a single notification
   */
  private async sendNotification(notification: AlertNotification): Promise<void> {
    switch (notification.channel.type) {
      case 'email':
        await this.sendEmailNotification(notification);
        break;
      case 'slack':
        await this.sendSlackNotification(notification);
        break;
      case 'webhook':
        await this.sendWebhookNotification(notification);
        break;
      case 'sms':
        await this.sendSMSNotification(notification);
        break;
      default:
        throw new Error(`Unsupported notification type: ${notification.channel.type}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: AlertNotification): Promise<void> {
    // This would integrate with actual email service
    console.log(`Sending email notification: ${notification.message}`);

    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(notification: AlertNotification): Promise<void> {
    // This would integrate with Slack API
    console.log(`Sending Slack notification: ${notification.message}`);

    // Simulate Slack sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(notification: AlertNotification): Promise<void> {
    const { url, headers, method = 'POST' } = notification.channel.config;

    if (!url) {
      throw new Error('Webhook URL is required');
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        alertId: notification.alertId,
        message: notification.message,
        details: notification.details
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.statusText}`);
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(notification: AlertNotification): Promise<void> {
    // This would integrate with SMS service
    console.log(`Sending SMS notification: ${notification.message}`);

    // Simulate SMS sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(): {
    totalRules: number;
    enabledRules: number;
    activeAlerts: number;
    alertsBySeverity: Record<string, number>;
    recentAlerts: Alert[];
  } {
    const activeAlerts = this.getActiveAlerts();
    const alertsBySeverity = activeAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentAlerts = activeAlerts
      .filter(alert => alert.startedAt > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 10);

    return {
      totalRules: this.alertRules.size,
      enabledRules: this.getEnabledAlertRules().length,
      activeAlerts: activeAlerts.length,
      alertsBySeverity,
      recentAlerts
    };
  }

  /**
   * Check if monitoring is active
   */
  isMonitoringActive(): boolean {
    return !!this.checkIntervalId;
  }

  /**
   * Get configuration
   */
  getConfig(): AlertServiceConfig {
    return { ...this.config };
  }
}