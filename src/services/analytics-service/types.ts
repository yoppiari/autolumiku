/**
 * Analytics Service Types
 * Epic 7: Analytics & Business Intelligence
 *
 * Type definitions for all analytics metrics and data structures
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

export type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export type ComparisonPeriod = 'previous' | 'last_year' | 'none';

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface MetricValue {
  current: number;
  previous?: number;
  trend?: TrendDirection;
  changePercent?: number;
  changeAbsolute?: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface AnalyticsFilter {
  tenantId: string;
  dateRange: DateRange;
  comparisonPeriod?: ComparisonPeriod;
  userId?: string;
  vehicleId?: string;
  customerId?: string;
  campaignId?: string;
}

// ============================================================================
// SALES ANALYTICS (Story 7.1)
// ============================================================================

export interface SalesMetrics {
  totalSales: MetricValue;
  totalRevenue: MetricValue;
  averageSalePrice: MetricValue;
  conversionRate: MetricValue;
  salesCycleDays: MetricValue;
  closeRate: MetricValue;
}

export interface ConversionFunnelStage {
  stage: 'inquiry' | 'test_drive' | 'negotiation' | 'closed';
  stageLabel: string;
  count: number;
  conversionRate: number; // To next stage
  dropoffRate: number;
}

export interface ConversionFunnel {
  stages: ConversionFunnelStage[];
  overallConversionRate: number;
  totalInquiries: number;
  totalSales: number;
}

export interface SalespersonPerformance {
  userId: string;
  name: string;
  totalSales: number;
  totalRevenue: number;
  averageSalePrice: number;
  conversionRate: number;
  responseTime: number; // Average in minutes
  customerSatisfaction: number; // 0-5 rating
}

export interface SalesByCategoryData {
  category: string;
  salesCount: number;
  revenue: number;
  averagePrice: number;
  percentOfTotal: number;
}

export interface SalesAnalytics {
  metrics: SalesMetrics;
  conversionFunnel: ConversionFunnel;
  salesByPeriod: ChartDataPoint[];
  revenueByPeriod: ChartDataPoint[];
  salesByCategory: SalesByCategoryData[];
  topPerformers: SalespersonPerformance[];
  recentSales: any[]; // Last 10 sales
}

// ============================================================================
// INVENTORY ANALYTICS (Story 7.3)
// ============================================================================

export interface InventoryMetrics {
  totalVehicles: MetricValue;
  totalInventoryValue: MetricValue;
  averageDaysOnLot: MetricValue;
  turnoverRate: MetricValue; // Vehicles sold / total inventory
  soldThisPeriod: MetricValue;
  availableCount: MetricValue;
}

export interface InventoryAgingData {
  ageBracket: '0-30' | '31-60' | '61-90' | '90+';
  vehicleCount: number;
  totalValue: number;
  percentOfInventory: number;
}

export interface TurnoverByCategory {
  make: string;
  model: string;
  totalSold: number;
  averageDaysOnLot: number;
  averagePrice: number;
  turnoverRate: number;
}

export interface SalesVelocity {
  period: string; // Month name or week
  unitsSold: number;
  revenue: number;
  averagePrice: number;
}

export interface InventoryAnalytics {
  metrics: InventoryMetrics;
  agingAnalysis: InventoryAgingData[];
  turnoverByCategory: TurnoverByCategory[];
  salesVelocity: SalesVelocity[];
  slowMovingVehicles: any[]; // Vehicles on lot > 90 days
  fastMovingCategories: TurnoverByCategory[];
}

// ============================================================================
// CUSTOMER ANALYTICS (Story 7.4)
// ============================================================================

export interface CustomerMetrics {
  totalCustomers: MetricValue;
  newCustomers: MetricValue;
  repeatCustomers: MetricValue;
  customerLifetimeValue: MetricValue;
  repeatPurchaseRate: MetricValue;
  referralRate: MetricValue;
}

export interface DemographicData {
  category: string;
  label: string;
  count: number;
  percentage: number;
  averagePurchaseValue?: number;
}

export interface CustomerPreference {
  make: string;
  model: string;
  interestedCount: number;
  inquiryCount: number;
  purchaseCount: number;
  conversionRate: number;
}

export interface CustomerBehavior {
  averageInquiriesBeforePurchase: number;
  averageTestDrives: number;
  preferredContactMethod: {
    method: 'whatsapp' | 'phone' | 'email' | 'in_person';
    percentage: number;
  }[];
  peakInquiryHours: {
    hour: number;
    inquiryCount: number;
  }[];
}

export interface CustomerAnalytics {
  metrics: CustomerMetrics;
  ageDistribution: DemographicData[];
  locationDistribution: DemographicData[];
  incomeDistribution: DemographicData[];
  vehiclePreferences: CustomerPreference[];
  behaviorPatterns: CustomerBehavior;
  topCustomers: any[]; // By lifetime value
}

// ============================================================================
// FINANCIAL ANALYTICS (Story 7.6)
// ============================================================================

export interface FinancialMetrics {
  totalRevenue: MetricValue;
  grossProfit: MetricValue;
  grossMargin: MetricValue; // Percentage
  netProfit: MetricValue;
  operatingExpenses: MetricValue;
  profitMargin: MetricValue; // Percentage
}

export interface RevenueBreakdown {
  category: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  percentOfTotal: number;
}

export interface ExpenseCategory {
  category: 'marketing' | 'operations' | 'salaries' | 'rent' | 'utilities' | 'other';
  label: string;
  amount: number;
  percentOfTotal: number;
  trend: TrendDirection;
}

export interface CashFlow {
  period: string;
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
}

export interface RevenueForecas {
  period: string;
  predictedRevenue: number;
  confidenceRange: {
    low: number;
    high: number;
  };
  basedOnTrend: boolean;
}

export interface FinancialAnalytics {
  metrics: FinancialMetrics;
  revenueByPeriod: ChartDataPoint[];
  revenueBreakdown: RevenueBreakdown[];
  expenseBreakdown: ExpenseCategory[];
  cashFlowAnalysis: CashFlow[];
  profitTrend: ChartDataPoint[];
  forecast: RevenueForecas[];
}

// ============================================================================
// TRAFFIC ANALYTICS (Story 7.2)
// ============================================================================

export interface TrafficMetrics {
  totalVisitors: MetricValue;
  uniqueVisitors: MetricValue;
  pageViews: MetricValue;
  bounceRate: MetricValue;
  averageSessionDuration: MetricValue; // In seconds
  pagesPerSession: MetricValue;
}

export interface TrafficSource {
  source: 'direct' | 'search' | 'social' | 'referral' | 'email' | 'paid';
  label: string;
  visitors: number;
  percentage: number;
  conversionRate: number;
}

export interface PopularVehicle {
  vehicleId: string;
  make: string;
  model: string;
  year: number;
  views: number;
  inquiries: number;
  shares: number;
  conversionRate: number;
}

export interface DeviceBreakdown {
  device: 'mobile' | 'desktop' | 'tablet';
  visitors: number;
  percentage: number;
  bounceRate: number;
  averageSessionDuration: number;
}

export interface TrafficAnalytics {
  metrics: TrafficMetrics;
  trafficByPeriod: ChartDataPoint[];
  trafficSources: TrafficSource[];
  popularVehicles: PopularVehicle[];
  deviceBreakdown: DeviceBreakdown[];
  topPages: {
    path: string;
    pageViews: number;
    uniquePageViews: number;
    averageTimeOnPage: number;
  }[];
}

// ============================================================================
// CAMPAIGN ANALYTICS (Story 7.5)
// ============================================================================

export interface CampaignMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalSpend: MetricValue;
  totalLeads: MetricValue;
  costPerLead: MetricValue;
  costPerAcquisition: MetricValue;
  overallROI: MetricValue; // Return on Investment percentage
}

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  channel: 'facebook' | 'instagram' | 'google' | 'email' | 'sms' | 'whatsapp';
  status: 'active' | 'paused' | 'completed';
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  costPerLead: number;
  costPerAcquisition: number;
  roi: number;
  conversionRate: number;
}

export interface ChannelPerformance {
  channel: string;
  campaigns: number;
  totalSpend: number;
  totalLeads: number;
  totalConversions: number;
  averageROI: number;
  costPerLead: number;
}

export interface CampaignAnalytics {
  metrics: CampaignMetrics;
  campaignPerformance: CampaignPerformance[];
  channelPerformance: ChannelPerformance[];
  spendByPeriod: ChartDataPoint[];
  leadsByPeriod: ChartDataPoint[];
  roiTrend: ChartDataPoint[];
}

// ============================================================================
// CUSTOMER SATISFACTION (Story 7.8)
// ============================================================================

export interface SatisfactionMetrics {
  npsScore: MetricValue; // Net Promoter Score (-100 to 100)
  averageRating: MetricValue; // 0-5 stars
  totalReviews: MetricValue;
  positiveReviews: MetricValue;
  negativeReviews: MetricValue;
  responseRate: MetricValue; // Percentage
}

export interface SentimentDistribution {
  sentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  label: string;
  count: number;
  percentage: number;
}

export interface FeedbackTheme {
  theme: string;
  category: 'service' | 'pricing' | 'quality' | 'communication' | 'other';
  count: number;
  sentiment: 'positive' | 'negative';
  examples: string[];
}

export interface ServiceQuality {
  metric: string;
  label: string;
  score: number; // 0-100
  target: number;
  trend: TrendDirection;
}

export interface SatisfactionAnalytics {
  metrics: SatisfactionMetrics;
  sentimentDistribution: SentimentDistribution[];
  feedbackThemes: FeedbackTheme[];
  serviceQuality: ServiceQuality[];
  npsBreakdown: {
    promoters: number; // 9-10
    passives: number; // 7-8
    detractors: number; // 0-6
  };
  recentReviews: any[];
}

// ============================================================================
// DASHBOARD OVERVIEW
// ============================================================================

export interface DashboardOverview {
  sales: {
    totalRevenue: number;
    totalSales: number;
    trend: TrendDirection;
    changePercent: number;
  };
  inventory: {
    totalVehicles: number;
    totalValue: number;
    turnoverRate: number;
    trend: TrendDirection;
  };
  customers: {
    totalCustomers: number;
    newCustomers: number;
    repeatRate: number;
    trend: TrendDirection;
  };
  traffic: {
    totalVisitors: number;
    conversionRate: number;
    trend: TrendDirection;
  };
  alerts: DashboardAlert[];
  quickStats: QuickStat[];
}

export interface DashboardAlert {
  id: string;
  type: 'warning' | 'info' | 'success' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  createdAt: Date;
}

export interface QuickStat {
  label: string;
  value: number;
  format: 'number' | 'currency' | 'percentage' | 'duration';
  icon?: string;
  trend?: TrendDirection;
  changePercent?: number;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export interface ExportOptions {
  format: ExportFormat;
  fileName: string;
  includeCharts: boolean;
  dateRange: DateRange;
  sections: ExportSection[];
}

export type ExportSection =
  | 'overview'
  | 'sales'
  | 'inventory'
  | 'customers'
  | 'financial'
  | 'traffic'
  | 'campaigns'
  | 'satisfaction';

export interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  error?: string;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  cachedAt: Date;
  expiresAt: Date;
  key: string;
}

export interface CacheOptions {
  ttl: number; // Time to live in seconds
  refreshOnAccess?: boolean;
}

// ============================================================================
// REAL-TIME TYPES
// ============================================================================

export interface RealtimeMetricUpdate {
  tenantId: string;
  metric: string;
  value: number;
  previousValue?: number;
  timestamp: Date;
}

export interface RealtimeAlert {
  tenantId: string;
  type: 'threshold_reached' | 'anomaly_detected' | 'goal_achieved';
  metric: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}
