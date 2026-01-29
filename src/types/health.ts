/**
 * Health Monitoring Types
 * Defines types for platform health monitoring, metrics collection, and alert management
 */

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  timestamp: Date;
  checks: HealthCheck[];
  summary: HealthSummary;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  duration: number; // milliseconds
  message?: string;
  details?: Record<string, any>;
  lastChecked: Date;
}

export interface HealthSummary {
  total: number;
  passing: number;
  warning: number;
  failing: number;
  score: number; // 0-100
}

export interface MetricSample {
  id: string;
  metricName: string;
  value: number | string | boolean;
  timestamp: Date;
  tags: Record<string, string>;
  tenantId?: string;
  source: string; // service or component name
}

export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  description: string;
  unit: string;
  tags: string[];
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number; // percentage
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number; // bytes
    used: number;
    free: number;
    usage: number; // percentage
  };
  disk: {
    total: number; // bytes
    used: number;
    free: number;
    usage: number; // percentage
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  uptime: number; // seconds
}

export interface DatabaseMetrics {
  timestamp: Date;
  connections: {
    active: number;
    idle: number;
    total: number;
    max: number;
  };
  queries: {
    selects: number;
    inserts: number;
    updates: number;
    deletes: number;
    avgDuration: number; // milliseconds
    errors: number;
  };
  performance: {
    cacheHitRate: number; // percentage
    indexUsage: number; // percentage
    slowQueries: number;
  };
  size: {
    database: number; // bytes
    tables: number;
    indexes: number;
  };
}

export interface TenantMetrics {
  tenantId: string;
  timestamp: Date;
  users: {
    total: number;
    active: number;
    new: number;
  };
  api: {
    requests: number;
    errors: number;
    avgResponseTime: number; // milliseconds
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  storage: {
    total: number; // bytes
    used: number;
    files: number;
  };
  database: {
    connections: number;
    queries: number;
    avgResponseTime: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: AlertCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: {
    operator: '>' | '<' | '>=' | '<=' | '=' | '!=' | 'in' | 'not_in';
    value: number | string | boolean | Array<string | number>;
  };
  duration: number; // seconds
  notifications: NotificationChannel[];
  cooldown: number; // seconds
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface AlertCondition {
  metric: string;
  aggregator: 'avg' | 'min' | 'max' | 'sum' | 'count';
  timeWindow: number; // seconds
  groupBy?: string[];
  filters?: Record<string, string>;
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  status: 'firing' | 'resolved' | 'acknowledged';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  startedAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  notificationsSent: number;
  affectedEntities: string[]; // tenant IDs, service names, etc.
}

export interface HealthCheckConfig {
  name: string;
  endpoint?: string;
  timeout: number; // milliseconds
  interval: number; // seconds
  retries: number;
  expectedStatus?: number;
  expectedResponse?: any;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

export interface DashboardConfig {
  id: string;
  name: string;
  description: string;
  panels: DashboardPanel[];
  timeRange: {
    from: Date;
    to: Date;
  };
  refreshInterval: number; // seconds
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface DashboardPanel {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'table' | 'stat' | 'health';
  query: {
    metric: string;
    aggregation?: string;
    filters?: Record<string, string>;
    timeWindow?: number;
  };
  visualization: {
    type: 'line' | 'bar' | 'pie' | 'single_stat' | 'table';
    options?: Record<string, any>;
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'performance' | 'usage' | 'health' | 'custom';
  template: string; // Handlebars template
  parameters: ReportParameter[];
  format: 'pdf' | 'csv' | 'json' | 'html';
  schedule?: {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    recipients: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ReportParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  required: boolean;
  defaultValue?: any;
  options?: Array<{ label: string; value: any }>;
  description?: string;
}

export interface ReportGeneration {
  id: string;
  templateId: string;
  parameters: Record<string, any>;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  format: string;
  fileUrl?: string;
  generatedAt?: Date;
  expiresAt?: Date;
  requestedBy: string;
  createdAt: Date;
}

// API Request/Response Types
export interface HealthCheckRequest {
  checks?: string[]; // specific checks to run
  timeout?: number;
}

export interface MetricsQueryRequest {
  metric: string;
  timeRange: {
    from: Date;
    to: Date;
  };
  aggregation?: 'avg' | 'min' | 'max' | 'sum' | 'count';
  interval?: number; // seconds
  filters?: Record<string, string>;
  groupBy?: string[];
}

export interface MetricsQueryResponse {
  metric: string;
  timeSeries: TimeSeriesData[];
  aggregation?: string;
  interval?: number;
  totalPoints: number;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  tags: Record<string, string>;
}

export interface CreateAlertRuleRequest {
  name: string;
  description: string;
  condition: AlertCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: {
    operator: '>' | '<' | '>=' | '<=' | '=' | '!=' | 'in' | 'not_in';
    value: number | string | boolean | Array<string | number>;
  };
  duration: number;
  notifications: Omit<NotificationChannel, 'id'>[];
  cooldown?: number;
}

export interface AcknowledgeAlertRequest {
  message?: string;
}

// Error Types
export class HealthMonitoringError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'HealthMonitoringError';
  }
}

export class MetricsCollectionError extends HealthMonitoringError {
  constructor(message: string, public source: string, details?: any) {
    super(message, 'METRICS_COLLECTION_ERROR', details);
    this.name = 'MetricsCollectionError';
  }
}

export class AlertError extends HealthMonitoringError {
  constructor(message: string, public ruleId: string, details?: any) {
    super(message, 'ALERT_ERROR', details);
    this.name = 'AlertError';
  }
}
