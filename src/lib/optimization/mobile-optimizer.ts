/**
 * Mobile Optimization Service
 * Optimizes content and performance for Indonesian mobile devices and networks
 * Handles low-bandwidth scenarios, slow connections, and various device capabilities
 */

import { Logger } from '@/lib/logger';
import { advancedCache } from '@/lib/cache/advanced-cache';

interface DeviceInfo {
  userAgent: string;
  isMobile: boolean;
  isLowEnd: boolean;
  connectionSpeed: 'slow' | 'medium' | 'fast';
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  memory: number;
  platform: string;
}

interface OptimizationConfig {
  lowBandwidthMode: boolean;
  compressionLevel: number;
  imageQuality: number;
  enableAnimations: boolean;
  prefetchResources: boolean;
  cacheStrategy: 'aggressive' | 'normal' | 'minimal';
  batchSize: number;
  lazyLoadThreshold: number;
}

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  networkLatency: number;
  deviceMemory: number;
  connectionType: string;
}

class MobileOptimizer {
  private logger: Logger;
  private deviceInfo: DeviceInfo | null = null;
  private optimizationConfig: OptimizationConfig;
  private performanceMetrics: PerformanceMetrics[] = [];

  constructor() {
    this.logger = new Logger('MobileOptimizer');
    this.optimizationConfig = this.getDefaultConfig();
    this.initializeDeviceDetection();
  }

  /**
   * Initialize device detection for Indonesian market
   */
  private initializeDeviceDetection(): void {
    if (typeof window !== 'undefined') {
      this.detectDeviceCapabilities();
      this.optimizeForDevice();
    }
  }

  /**
   * Detect device capabilities and network conditions
   */
  private detectDeviceCapabilities(): void {
    const userAgent = navigator.userAgent;
    const connection = (navigator as any).connection ||
                     (navigator as any).mozConnection ||
                     (navigator as any).webkitConnection;

    // Detect if it's a mobile device (common in Indonesia)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    // Detect low-end devices (common in Indonesian market)
    const isLowEnd = this.detectLowEndDevice(userAgent);

    // Estimate connection speed
    const connectionSpeed = this.estimateConnectionSpeed(connection);

    // Get screen dimensions
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const pixelRatio = window.devicePixelRatio || 1;

    // Get device memory if available
    const memory = (navigator as any).deviceMemory || 4; // Default to 4GB

    this.deviceInfo = {
      userAgent,
      isMobile,
      isLowEnd,
      connectionSpeed,
      screenWidth,
      screenHeight,
      pixelRatio,
      memory,
      platform: this.detectPlatform(userAgent)
    };

    this.logger.info('Device capabilities detected', this.deviceInfo);
  }

  /**
   * Detect low-end devices common in Indonesian market
   */
  private detectLowEndDevice(userAgent: string): boolean {
    const lowEndIndicators = [
      'Android 4.', 'Android 5.', 'Android 6.', // Older Android versions
      'Chrome/5', 'Chrome/6', 'Chrome/7', // Older Chrome versions
      'Opera Mini', // Common in Indonesia for low-end devices
      'UCBrowser', // Popular in Indonesia
      '320x480', '480x800', // Common low resolutions
      'RAM 512MB', 'RAM 1GB' // Low memory indicators
    ];

    return lowEndIndicators.some(indicator => userAgent.includes(indicator));
  }

  /**
   * Estimate connection speed for Indonesian networks
   */
  private estimateConnectionSpeed(connection: any): 'slow' | 'medium' | 'fast' {
    if (!connection) {
      // Fallback estimation based on common Indonesian mobile networks
      return 'medium'; // Conservative default
    }

    const effectiveType = connection.effectiveType;
    const downlink = connection.downlink; // Mbps

    if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 0.1) {
      return 'slow';
    } else if (effectiveType === '3g' || downlink < 1.5) {
      return 'medium';
    } else {
      return 'fast';
    }
  }

  /**
   * Detect platform for Indonesian market
   */
  private detectPlatform(userAgent: string): string {
    if (userAgent.includes('Android')) return 'android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'ios';
    if (userAgent.includes('Opera Mini') || userAgent.includes('UCBrowser')) return 'feature-phone';
    return 'unknown';
  }

  /**
   * Get default optimization configuration
   */
  private getDefaultConfig(): OptimizationConfig {
    return {
      lowBandwidthMode: false,
      compressionLevel: 6, // 1-9, higher is more compression
      imageQuality: 80, // 1-100
      enableAnimations: true,
      prefetchResources: true,
      cacheStrategy: 'normal',
      batchSize: 20,
      lazyLoadThreshold: 200 // pixels
    };
  }

  /**
   * Optimize settings based on device capabilities
   */
  private optimizeForDevice(): void {
    if (!this.deviceInfo) return;

    const config = { ...this.optimizationConfig };

    // Adjust for low-end devices
    if (this.deviceInfo.isLowEnd) {
      config.lowBandwidthMode = true;
      config.compressionLevel = 9; // Maximum compression
      config.imageQuality = 60; // Lower image quality
      config.enableAnimations = false; // Disable animations
      config.prefetchResources = false; // No prefetching
      config.cacheStrategy = 'aggressive'; // Aggressive caching
      config.batchSize = 10; // Smaller batches
      config.lazyLoadThreshold = 100; // Earlier lazy loading
    }

    // Adjust for connection speed
    if (this.deviceInfo.connectionSpeed === 'slow') {
      config.lowBandwidthMode = true;
      config.compressionLevel = 9;
      config.imageQuality = 50;
      config.enableAnimations = false;
      config.prefetchResources = false;
      config.cacheStrategy = 'aggressive';
      config.batchSize = 5;
      config.lazyLoadThreshold = 50;
    } else if (this.deviceInfo.connectionSpeed === 'medium') {
      config.imageQuality = 70;
      config.enableAnimations = true;
      config.cacheStrategy = 'normal';
      config.batchSize = 15;
      config.lazyLoadThreshold = 150;
    }

    // Adjust for mobile devices
    if (this.deviceInfo.isMobile) {
      config.lazyLoadThreshold = 100; // Earlier lazy loading on mobile
      config.batchSize = Math.min(config.batchSize, 15); // Smaller batches on mobile
    }

    // Adjust for screen size (common sizes in Indonesia)
    if (this.deviceInfo.screenWidth <= 360) {
      // Small screen phones
      config.imageQuality = Math.min(config.imageQuality, 70);
      config.batchSize = Math.min(config.batchSize, 10);
    }

    // Adjust for memory constraints
    if (this.deviceInfo.memory <= 2) {
      config.cacheStrategy = 'minimal';
      config.batchSize = Math.min(config.batchSize, 8);
    }

    this.optimizationConfig = config;
    this.cacheOptimizationConfig();
  }

  /**
   * Cache optimization configuration for quick access
   */
  private cacheOptimizationConfig(): void {
    advancedCache.set('mobile_optimization_config', this.optimizationConfig, {
      ttl: 3600, // 1 hour
      tags: ['mobile', 'optimization']
    });
  }

  /**
   * Get current optimization configuration
   */
  getConfig(): OptimizationConfig {
    return this.optimizationConfig;
  }

  /**
   * Get device information
   */
  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  /**
   * Optimize images for Indonesian mobile networks
   */
  optimizeImageUrl(url: string, options: {
    width?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}): string {
    if (!this.deviceInfo) return url;

    const {
      width = this.deviceInfo.screenWidth,
      quality = this.optimizationConfig.imageQuality,
      format = this.deviceInfo.isLowEnd ? 'jpeg' : 'webp'
    } = options;

    // Add optimization parameters
    const params = new URLSearchParams({
      w: width.toString(),
      q: quality.toString(),
      f: format,
      'fit': 'max',
      'auto': 'format'
    });

    // Add low bandwidth mode parameter
    if (this.optimizationConfig.lowBandwidthMode) {
      params.append('lb', '1');
    }

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${params.toString()}`;
  }

  /**
   * Optimize API response for mobile
   */
  optimizeApiResponse<T>(data: T, options: {
    compress?: boolean;
    excludeFields?: string[];
    batchSize?: number;
  } = {}): T {
    if (!this.deviceInfo || !this.optimizationConfig.lowBandwidthMode) {
      return data;
    }

    let optimizedData = { ...data };

    // Exclude specified fields for low bandwidth
    if (options.excludeFields) {
      options.excludeFields.forEach(field => {
        delete (optimizedData as any)[field];
      });
    }

    // Limit array sizes
    if (Array.isArray(optimizedData)) {
      const maxSize = options.batchSize || this.optimizationConfig.batchSize;
      optimizedData = optimizedData.slice(0, maxSize) as T;
    }

    return optimizedData;
  }

  /**
   * Get recommended batch size for data loading
   */
  getBatchSize(defaultSize: number = 20): number {
    return Math.min(defaultSize, this.optimizationConfig.batchSize);
  }

  /**
   * Determine if lazy loading should be used
   */
  shouldLazyLoad(elementPosition: number): boolean {
    return elementPosition > this.optimizationConfig.lazyLoadThreshold;
  }

  /**
   * Get network-aware timeout values
   */
  getTimeouts(): {
    api: number;
    image: number;
    animation: number;
  } {
    const baseTimeouts = {
      api: 10000, // 10 seconds
      image: 5000, // 5 seconds
      animation: 300 // 300ms
    };

    if (!this.deviceInfo) return baseTimeouts;

    const multiplier = this.deviceInfo.connectionSpeed === 'slow' ? 2.5 :
                       this.deviceInfo.connectionSpeed === 'medium' ? 1.5 : 1;

    return {
      api: baseTimeouts.api * multiplier,
      image: baseTimeouts.image * multiplier,
      animation: this.optimizationConfig.enableAnimations ? baseTimeouts.animation * multiplier : 0
    };
  }

  /**
   * Record performance metrics
   */
  recordPerformanceMetrics(metrics: Omit<PerformanceMetrics, 'timestamp'>): void {
    const fullMetrics: PerformanceMetrics = {
      ...metrics,
      timestamp: Date.now()
    } as any;

    this.performanceMetrics.push(fullMetrics);

    // Keep only last 100 metrics
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics.shift();
    }

    // Cache metrics for analysis
    advancedCache.set('performance_metrics', this.performanceMetrics, {
      ttl: 3600,
      tags: ['performance', 'mobile']
    });

    this.logger.debug('Performance metrics recorded', fullMetrics);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    avgLoadTime: number;
    avgRenderTime: number;
    avgNetworkLatency: number;
    deviceDistribution: Record<string, number>;
    connectionDistribution: Record<string, number>;
  } {
    if (this.performanceMetrics.length === 0) {
      return {
        avgLoadTime: 0,
        avgRenderTime: 0,
        avgNetworkLatency: 0,
        deviceDistribution: {},
        connectionDistribution: {}
      };
    }

    const avgLoadTime = this.performanceMetrics.reduce((sum, m) => sum + m.loadTime, 0) / this.performanceMetrics.length;
    const avgRenderTime = this.performanceMetrics.reduce((sum, m) => sum + m.renderTime, 0) / this.performanceMetrics.length;
    const avgNetworkLatency = this.performanceMetrics.reduce((sum, m) => sum + m.networkLatency, 0) / this.performanceMetrics.length;

    return {
      avgLoadTime,
      avgRenderTime,
      avgNetworkLatency,
      deviceDistribution: this.calculateDeviceDistribution(),
      connectionDistribution: this.calculateConnectionDistribution()
    };
  }

  /**
   * Calculate device type distribution
   */
  private calculateDeviceDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};

    // Add current device if detected
    if (this.deviceInfo) {
      const deviceType = this.deviceInfo.isLowEnd ? 'low-end' : 'high-end';
      const platform = this.deviceInfo.platform;
      const key = `${platform}-${deviceType}`;
      distribution[key] = (distribution[key] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Calculate connection type distribution
   */
  private calculateConnectionDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};

    if (this.deviceInfo) {
      const speed = this.deviceInfo.connectionSpeed;
      distribution[speed] = (distribution[speed] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Generate optimization recommendations for Indonesian market
   */
  generateRecommendations(): Array<{
    type: 'performance' | 'user-experience' | 'network';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    implementation: string;
  }> {
    const recommendations = [];

    if (!this.deviceInfo) {
      return recommendations;
    }

    // Low-end device recommendations
    if (this.deviceInfo.isLowEnd) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'Optimize for Low-End Devices',
        description: 'Indonesian users often use low-end Android devices with limited memory',
        implementation: 'Use lightweight components, reduce animation complexity, implement efficient data loading'
      });

      recommendations.push({
        type: 'network',
        priority: 'high',
        title: 'Compress All Resources',
        description: 'Indonesian mobile networks can be slow and unreliable',
        implementation: 'Enable gzip compression, use WebP images, minify CSS/JS, implement service worker caching'
      });
    }

    // Network speed recommendations
    if (this.deviceInfo.connectionSpeed === 'slow') {
      recommendations.push({
        type: 'network',
        priority: 'high',
        title: 'Implement Offline Support',
        description: 'Indonesian users may experience intermittent connectivity',
        implementation: 'Use service workers, cache critical resources, implement offline-first approach'
      });

      recommendations.push({
        type: 'user-experience',
        priority: 'medium',
        title: 'Optimize Loading States',
        description: 'Slow networks require good loading feedback',
        implementation: 'Show skeleton screens, implement progressive loading, provide clear progress indicators'
      });
    }

    // Mobile-specific recommendations
    if (this.deviceInfo.isMobile) {
      recommendations.push({
        type: 'user-experience',
        priority: 'medium',
        title: 'Optimize Touch Interactions',
        description: 'Indonesian users prefer simple, touch-friendly interfaces',
        implementation: 'Use larger tap targets (44px minimum), implement swipe gestures, avoid hover-dependent features'
      });
    }

    // Memory constraints
    if (this.deviceInfo.memory <= 2) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Reduce Memory Usage',
        description: 'Low memory devices require efficient memory management',
        implementation: 'Implement virtual scrolling, lazy load images, cleanup unused components, reduce bundle size'
      });
    }

    return recommendations;
  }

  /**
   * Create Indonesian market-specific configuration
   */
  createIndonesianConfig(): OptimizationConfig {
    return {
      lowBandwidthMode: true, // Conservative for Indonesian networks
      compressionLevel: 8, // High compression
      imageQuality: 70, // Balanced quality
      enableAnimations: true, // But simple ones
      prefetchResources: false, // No prefetching on slow networks
      cacheStrategy: 'aggressive', // Aggressive caching
      batchSize: 10, // Smaller batches
      lazyLoadThreshold: 100 // Earlier lazy loading
    };
  }

  /**
   * Reset optimizer and detect device again
   */
  reset(): void {
    this.deviceInfo = null;
    this.optimizationConfig = this.getDefaultConfig();
    this.performanceMetrics = [];

    if (typeof window !== 'undefined') {
      this.initializeDeviceDetection();
    }
  }
}

// Export singleton instance
export const mobileOptimizer = new MobileOptimizer();

// Export class for custom instances
export { MobileOptimizer };