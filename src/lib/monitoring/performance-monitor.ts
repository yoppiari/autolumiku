/**
 * Performance Monitoring Service
 * Real-time performance monitoring and optimization for Indonesian users
 * Tracks key metrics and provides automated optimization suggestions
 */

import { Logger } from '@/lib/logger';
import { advancedCache } from '@/lib/cache/advanced-cache';
import { mobileOptimizer } from '@/lib/optimization/mobile-optimizer';

interface PerformanceMetrics {
  timestamp: number;
  loadTime: number;
  renderTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  memoryUsage: number;
  networkLatency: number;
  deviceType: string;
  connectionType: string;
  userAgent: string;
}

interface PerformanceThresholds {
  loadTime: number; // ms
  renderTime: number; // ms
  firstContentfulPaint: number; // ms
  largestContentfulPaint: number; // ms
  firstInputDelay: number; // ms
  cumulativeLayoutShift: number;
  memoryUsage: number; // MB
}

interface AlertRule {
  metric: keyof PerformanceMetrics;
  threshold: number;
  operator: '>' | '<' | '=' | '>=' | '<=';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

interface PerformanceAlert {
  id: string;
  rule: AlertRule;
  value: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

class PerformanceMonitor {
  private logger: Logger;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private observers: PerformanceObserver[] = [];
  private thresholds: PerformanceThresholds;
  private alertRules: AlertRule[];
  private isMonitoring: boolean = false;

  // Indonesian market specific thresholds (more lenient for slower networks)
  private readonly indonesianThresholds: PerformanceThresholds = {
    loadTime: 5000, // 5 seconds (vs 3s standard)
    renderTime: 3000, // 3 seconds (vs 2s standard)
    firstContentfulPaint: 3000, // 3 seconds (vs 1.8s standard)
    largestContentfulPaint: 6000, // 6 seconds (vs 2.5s standard)
    firstInputDelay: 300, // 300ms (vs 100ms standard)
    cumulativeLayoutShift: 0.25, // 0.25 (vs 0.1 standard)
    memoryUsage: 512 // 512MB (vs 256MB standard)
  };

  constructor() {
    this.logger = new Logger('PerformanceMonitor');
    this.thresholds = this.indonesianThresholds;
    this.alertRules = this.createDefaultAlertRules();
    this.initializeMonitoring();
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;

    this.setupPerformanceObservers();
    this.startMetricsCollection();
    this.loadHistoricalData();
  }

  /**
   * Setup Performance API observers
   */
  private setupPerformanceObservers(): void {
    try {
      // Observe navigation timing
      if ('PerformanceObserver' in window) {
        const navigationObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              this.recordNavigationTiming(entry as PerformanceNavigationTiming);
            }
          }
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);

        // Observe paint timing
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordPaintTiming(entry as PerformancePaintTiming);
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(paintObserver);

        // Observe largest contentful paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordLargestContentfulPaint(lastEntry as any);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);

        // Observe first input delay
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordFirstInputDelay(entry as any);
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);

        // Observe layout shift
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              this.recordLayoutShift(entry as any);
            }
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      }

      this.isMonitoring = true;
      this.logger.info('Performance monitoring initialized');

    } catch (error) {
      this.logger.error('Failed to setup performance observers', { error });
    }
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectCurrentMetrics();
    }, 30000); // Collect every 30 seconds
  }

  /**
   * Load historical performance data
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      const cachedData = await advancedCache.get<PerformanceMetrics[]>('performance_metrics_history');
      if (cachedData) {
        this.metrics = cachedData;
        this.logger.info(`Loaded ${cachedData.length} historical performance metrics`);
      }
    } catch (error) {
      this.logger.error('Failed to load historical performance data', { error });
    }
  }

  /**
   * Record navigation timing metrics
   */
  private recordNavigationTiming(entry: PerformanceNavigationTiming): void {
    const loadTime = entry.loadEventEnd - entry.navigationStart;
    const deviceInfo = mobileOptimizer.getDeviceInfo();

    const metric: Partial<PerformanceMetrics> = {
      timestamp: Date.now(),
      loadTime,
      networkLatency: entry.responseStart - entry.requestStart,
      deviceType: deviceInfo?.isMobile ? 'mobile' : 'desktop',
      connectionType: deviceInfo?.connectionSpeed || 'unknown',
      userAgent: navigator.userAgent
    };

    this.updateCurrentMetric(metric);
  }

  /**
   * Record paint timing metrics
   */
  private recordPaintTiming(entry: PerformancePaintTiming): void {
    if (entry.name === 'first-contentful-paint') {
      this.updateCurrentMetric({
        firstContentfulPaint: entry.startTime
      });
    }
  }

  /**
   * Record largest contentful paint
   */
  private recordLargestContentfulPaint(entry: any): void {
    this.updateCurrentMetric({
      largestContentfulPaint: entry.startTime
    });
  }

  /**
   * Record first input delay
   */
  private recordFirstInputDelay(entry: any): void {
    this.updateCurrentMetric({
      firstInputDelay: entry.processingStart - entry.startTime
    });
  }

  /**
   * Record cumulative layout shift
   */
  private recordLayoutShift(entry: any): void {
    // This would need to accumulate values, simplified for demo
    this.updateCurrentMetric({
      cumulativeLayoutShift: entry.value || 0
    });
  }

  /**
   * Collect current performance metrics
   */
  private collectCurrentMetrics(): void {
    const deviceInfo = mobileOptimizer.getDeviceInfo();
    const memoryInfo = (performance as any).memory;

    const currentMetric: Partial<PerformanceMetrics> = {
      timestamp: Date.now(),
      memoryUsage: memoryInfo ? memoryInfo.usedJSHeapSize / 1024 / 1024 : 0,
      deviceType: deviceInfo?.isMobile ? 'mobile' : 'desktop',
      connectionType: deviceInfo?.connectionSpeed || 'unknown',
      userAgent: navigator.userAgent
    };

    this.updateCurrentMetric(currentMetric);
  }

  /**
   * Update current metric with new data
   */
  private updateCurrentMetric(newData: Partial<PerformanceMetrics>): void {
    let currentMetric = this.metrics[this.metrics.length - 1];

    if (!currentMetric || (Date.now() - currentMetric.timestamp) > 60000) {
      // Create new metric if last one is too old
      currentMetric = {
        timestamp: Date.now(),
        loadTime: 0,
        renderTime: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        firstInputDelay: 0,
        cumulativeLayoutShift: 0,
        memoryUsage: 0,
        networkLatency: 0,
        deviceType: 'unknown',
        connectionType: 'unknown',
        userAgent: navigator.userAgent
      };
      this.metrics.push(currentMetric);
    }

    // Update with new data
    Object.assign(currentMetric, newData);

    // Check for alerts
    this.checkAlertRules(currentMetric);

    // Cache metrics
    this.cacheMetrics();
  }

  /**
   * Check alert rules against current metrics
   */
  private checkAlertRules(metric: PerformanceMetrics): void {
    for (const rule of this.alertRules) {
      const value = metric[rule.metric];
      if (value === undefined) continue;

      const triggered = this.evaluateAlertCondition(value, rule.threshold, rule.operator);

      if (triggered) {
        this.createAlert(rule, value);
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateAlertCondition(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '=': return value === threshold;
      default: return false;
    }
  }

  /**
   * Create performance alert
   */
  private createAlert(rule: AlertRule, value: number): void {
    // Check if similar alert already exists and is not resolved
    const existingAlert = this.alerts.find(
      alert => alert.rule.metric === rule.metric &&
                alert.rule.threshold === rule.threshold &&
                !alert.resolved
    );

    if (existingAlert) {
      return; // Avoid duplicate alerts
    }

    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      rule,
      value,
      timestamp: Date.now(),
      resolved: false
    };

    this.alerts.push(alert);
    this.logger.warn('Performance alert triggered', { alert });

    // Cache alerts
    this.cacheAlerts();
  }

  /**
   * Get performance score (0-100)
   */
  getPerformanceScore(): number {
    if (this.metrics.length === 0) return 0;

    const latestMetric = this.metrics[this.metrics.length - 1];
    let score = 100;

    // Deduct points for poor performance
    if (latestMetric.loadTime > this.thresholds.loadTime) {
      score -= 20;
    }
    if (latestMetric.firstContentfulPaint > this.thresholds.firstContentfulPaint) {
      score -= 15;
    }
    if (latestMetric.largestContentfulPaint > this.thresholds.largestContentfulPaint) {
      score -= 15;
    }
    if (latestMetric.firstInputDelay > this.thresholds.firstInputDelay) {
      score -= 15;
    }
    if (latestMetric.cumulativeLayoutShift > this.thresholds.cumulativeLayoutShift) {
      score -= 20;
    }
    if (latestMetric.memoryUsage > this.thresholds.memoryUsage) {
      score -= 15;
    }

    return Math.max(0, score);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    score: number;
    metrics: PerformanceMetrics | null;
    alerts: PerformanceAlert[];
    trends: {
      loadTime: 'improving' | 'stable' | 'degrading';
      memoryUsage: 'increasing' | 'stable' | 'decreasing';
      networkLatency: 'improving' | 'stable' | 'degrading';
    };
    recommendations: string[];
  } {
    const latestMetric = this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
    const activeAlerts = this.alerts.filter(alert => !alert.resolved);
    const score = this.getPerformanceScore();

    return {
      score,
      metrics: latestMetric,
      alerts: activeAlerts,
      trends: this.calculateTrends(),
      recommendations: this.generateRecommendations(latestMetric, activeAlerts)
    };
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(): {
    loadTime: 'improving' | 'stable' | 'degrading';
    memoryUsage: 'increasing' | 'stable' | 'decreasing';
    networkLatency: 'improving' | 'stable' | 'degrading';
  } {
    if (this.metrics.length < 10) {
      return {
        loadTime: 'stable',
        memoryUsage: 'stable',
        networkLatency: 'stable'
      };
    }

    const recent = this.metrics.slice(-10);
    const older = this.metrics.slice(-20, -10);

    const avgRecentLoadTime = recent.reduce((sum, m) => sum + m.loadTime, 0) / recent.length;
    const avgOlderLoadTime = older.reduce((sum, m) => sum + m.loadTime, 0) / older.length;

    const loadTimeTrend = avgRecentLoadTime < avgOlderLoadTime * 0.9 ? 'improving' :
                           avgRecentLoadTime > avgOlderLoadTime * 1.1 ? 'degrading' : 'stable';

    // Similar calculations for other metrics...
    return {
      loadTime: loadTimeTrend,
      memoryUsage: 'stable',
      networkLatency: 'stable'
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    metric: PerformanceMetrics | null,
    alerts: PerformanceAlert[]
  ): string[] {
    const recommendations: string[] = [];

    if (!metric) return recommendations;

    // Load time recommendations
    if (metric.loadTime > this.thresholds.loadTime) {
      recommendations.push('Consider optimizing image sizes and enabling compression for faster load times');
    }

    // Memory usage recommendations
    if (metric.memoryUsage > this.thresholds.memoryUsage) {
      recommendations.push('Implement memory optimization techniques and cleanup unused objects');
    }

    // Network latency recommendations
    if (metric.networkLatency > 1000) {
      recommendations.push('Use CDN and implement aggressive caching for Indonesian users');
    }

    // Alert-specific recommendations
    for (const alert of alerts) {
      switch (alert.rule.metric) {
        case 'firstContentfulPaint':
          recommendations.push('Optimize critical rendering path and minimize render-blocking resources');
          break;
        case 'largestContentfulPaint':
          recommendations.push('Optimize images and lazy load non-critical content');
          break;
        case 'cumulativeLayoutShift':
          recommendations.push('Include size attributes for images and ads to prevent layout shifts');
          break;
        case 'firstInputDelay':
          recommendations.push('Minimize JavaScript execution time and break up long tasks');
          break;
      }
    }

    return recommendations;
  }

  /**
   * Create default alert rules for Indonesian market
   */
  private createDefaultAlertRules(): AlertRule[] {
    return [
      {
        metric: 'loadTime',
        threshold: this.thresholds.loadTime,
        operator: '>',
        severity: 'high',
        message: 'Page load time exceeds threshold'
      },
      {
        metric: 'firstContentfulPaint',
        threshold: this.thresholds.firstContentfulPaint,
        operator: '>',
        severity: 'medium',
        message: 'First contentful paint too slow'
      },
      {
        metric: 'largestContentfulPaint',
        threshold: this.thresholds.largestContentfulPaint,
        operator: '>',
        severity: 'high',
        message: 'Largest contentful paint too slow'
      },
      {
        metric: 'firstInputDelay',
        threshold: this.thresholds.firstInputDelay,
        operator: '>',
        severity: 'medium',
        message: 'First input delay too high'
      },
      {
        metric: 'cumulativeLayoutShift',
        threshold: this.thresholds.cumulativeLayoutShift,
        operator: '>',
        severity: 'low',
        message: 'Layout shift detected'
      },
      {
        metric: 'memoryUsage',
        threshold: this.thresholds.memoryUsage,
        operator: '>',
        severity: 'medium',
        message: 'Memory usage too high'
      },
      {
        metric: 'networkLatency',
        threshold: 2000,
        operator: '>',
        severity: 'medium',
        message: 'Network latency too high'
      }
    ];
  }

  /**
   * Cache metrics to persistent storage
   */
  private async cacheMetrics(): Promise<void> {
    try {
      // Keep only last 1000 metrics
      const metricsToCache = this.metrics.slice(-1000);
      await advancedCache.set('performance_metrics_history', metricsToCache, {
        ttl: 86400, // 24 hours
        tags: ['performance', 'metrics']
      });
    } catch (error) {
      this.logger.error('Failed to cache performance metrics', { error });
    }
  }

  /**
   * Cache alerts to persistent storage
   */
  private async cacheAlerts(): Promise<void> {
    try {
      await advancedCache.set('performance_alerts', this.alerts, {
        ttl: 86400, // 24 hours
        tags: ['performance', 'alerts']
      });
    } catch (error) {
      this.logger.error('Failed to cache performance alerts', { error });
    }
  }

  /**
   * Get metrics for specific time range
   */
  getMetricsForTimeRange(startTime: number, endTime: number): PerformanceMetrics[] {
    return this.metrics.filter(metric =>
      metric.timestamp >= startTime && metric.timestamp <= endTime
    );
  }

  /**
   * Get metrics by device type
   */
  getMetricsByDeviceType(deviceType: string): PerformanceMetrics[] {
    return this.metrics.filter(metric => metric.deviceType === deviceType);
  }

  /**
   * Get metrics by connection type
   */
  getMetricsByConnectionType(connectionType: string): PerformanceMetrics[] {
    return this.metrics.filter(metric => metric.connectionType === connectionType);
  }

  /**
   * Clear all metrics and alerts
   */
  clearData(): void {
    this.metrics = [];
    this.alerts = [];
    this.logger.info('Performance monitoring data cleared');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.isMonitoring = false;
    this.logger.info('Performance monitoring stopped');
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (!this.isMonitoring) {
      this.setupPerformanceObservers();
      this.logger.info('Performance monitoring started');
    }
  }

  /**
   * Export performance data for analysis
   */
  exportData(): {
    metrics: PerformanceMetrics[];
    alerts: PerformanceAlert[];
    thresholds: PerformanceThresholds;
    summary: any;
  } {
    return {
      metrics: this.metrics,
      alerts: this.alerts,
      thresholds: this.thresholds,
      summary: this.getPerformanceSummary()
    };
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export class for custom instances
export { PerformanceMonitor };