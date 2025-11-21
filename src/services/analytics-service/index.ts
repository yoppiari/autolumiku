/**
 * Analytics Service - Main Export
 * Epic 7: Analytics & Business Intelligence
 *
 * Central export for all analytics services
 */

// Core Services
export { analyticsEngine } from './analytics-engine';
export { salesAnalyticsService } from './sales-analytics';
export { inventoryAnalyticsService } from './inventory-analytics';
export { customerAnalyticsService } from './customer-analytics';
export { financialAnalyticsService } from './financial-analytics';
export { dataAggregator } from './data-aggregator';
export { cacheManager, CACHE_KEYS } from './cache-manager';

// Types
export * from './types';
