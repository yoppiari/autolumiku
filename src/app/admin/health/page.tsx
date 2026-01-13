/**
 * Tenant Analytics Dashboard
 * Analytics dashboard for tracking tenant data including vehicle collections, views, inquiries, and sales
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { api } from '@/lib/api-client';

// Analytics types
interface TenantAnalytics {
  mostStocked: VehicleStat[];
  mostViewed: VehicleStat[];
  mostAsked: VehicleStat[];
  mostSold: VehicleStat[];
  tenantSummary: TenantSummary[];
  timeSeriesData: TimeSeriesData[];
}

interface VehicleStat {
  vehicleId: string;
  make: string;
  model: string;
  year: number;
  count: number;
  tenantId?: string;
  tenantName?: string;
  percentage?: number;
}

interface TenantSummary {
  tenantId: string;
  tenantName: string;
  totalVehicles: number;
  soldVehicles: number;
  totalViews: number;
  totalInquiries: number;
  conversionRate: number;
}

interface TimeSeriesData {
  date: string;
  views: number;
  inquiries: number;
  sales: number;
  newVehicles: number;
  timestamp?: number; // Internal for forcing updates
}

const AnalyticsContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Initialize from URL param or default to '7d'
  const initialTimeRange = searchParams.get('timeRange') || '7d';

  const [analytics, setAnalytics] = useState<TenantAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState(initialTimeRange);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [activeChartTab, setActiveChartTab] = useState<'mostStocked' | 'mostViewed' | 'mostAsked' | 'mostSold'>('mostStocked');

  // Sync state with URL if it changes externally (e.g. back button)
  useEffect(() => {
    const param = searchParams.get('timeRange');
    if (param && param !== selectedTimeRange) {
      setSelectedTimeRange(param);
    }
  }, [searchParams]);

  // Handle Time Range Change with URL update
  const handleTimeRangeChange = (newValue: string) => {
    setSelectedTimeRange(newValue);
    const params = new URLSearchParams(searchParams.toString());
    params.set('timeRange', newValue);
    // Replace URL without refreshing
    router.replace(`${pathname}?${params.toString()}`);
  };

  // Initialize selected tenants when data loads
  useEffect(() => {
    if (analytics?.tenantSummary) {
      // By default select all active tenants
      setSelectedTenantIds(prev => prev.length === 0 ? analytics.tenantSummary.map(t => t.tenantId) : prev);
    }
  }, [analytics]);

  // Load analytics data from API
  useEffect(() => {
    const loadAnalyticsData = async () => {
      setIsLoading(true);
      try {
        // Fetch analytics data from API with auth and cache-busting
        const response = await api.get<TenantAnalytics>(`/api/admin/analytics?timeRange=${selectedTimeRange}&_t=${Date.now()}`);

        if (!response.success && response.error) {
          throw new Error(response.error);
        }

        // The analytics API returns data directly (not wrapped in .data)
        // Check if response has analytics fields directly or in .data
        const analyticsData = response.data || response;

        // Transform API data to match our interface
        const transformedAnalytics: TenantAnalytics = {
          mostStocked: (analyticsData as any).mostStocked || [],
          mostViewed: (analyticsData as any).mostViewed || [],
          mostAsked: (analyticsData as any).mostAsked || [],
          mostSold: (analyticsData as any).mostSold || [],
          tenantSummary: (analyticsData as any).tenantSummary || [],
          timeSeriesData: (analyticsData as any).timeSeriesData || []
        };

        setAnalytics(transformedAnalytics);

      } catch (error) {
        console.error('Failed to load analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalyticsData();

    // Set up auto-refresh
    if (autoRefresh) {
      const interval = setInterval(loadAnalyticsData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, selectedTimeRange]);

  // Professional color palette for dynamic mapping
  const COLOR_PALETTE = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
    '#6366f1', '#f97316', '#14b8a6', '#d946ef'
  ];

  // Map tenant IDs to consistent colors
  const tenantColors = React.useMemo(() => {
    const mapping: Record<string, string> = {};
    if (!analytics) return mapping;

    // First pass: use tenant summary to establish base colors
    analytics.tenantSummary.forEach((tenant, index) => {
      mapping[tenant.tenantId] = COLOR_PALETTE[index % COLOR_PALETTE.length];
      mapping[tenant.tenantName] = COLOR_PALETTE[index % COLOR_PALETTE.length];
    });

    // Second pass: ensure any other referenced tenants get a color
    const allStats = [
      ...analytics.mostStocked,
      ...analytics.mostViewed,
      ...analytics.mostAsked,
      ...analytics.mostSold
    ];

    allStats.forEach(stat => {
      if (stat.tenantId && !mapping[stat.tenantId]) {
        // Use hash of ID to pick a color if not in summary
        let hash = 0;
        for (let i = 0; i < stat.tenantId.length; i++) {
          hash = stat.tenantId.charCodeAt(i) + ((hash << 5) - hash);
        }
        mapping[stat.tenantId] = COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
      }
      if (stat.tenantName && !mapping[stat.tenantName]) {
        mapping[stat.tenantName] = mapping[stat.tenantId || ''] || '#3b82f6';
      }
    });

    return mapping;
  }, [analytics]);

  const getTenantColor = (idOrName: string) => tenantColors[idOrName] || '#3b82f6';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Failed to load analytics data</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Tenant Analytics</h1>
          <p className="text-gray-300 mt-1">Comprehensive analytics for tenant vehicle data and performance</p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Time Range Selector */}
          <select
            value={selectedTimeRange}
            onChange={(e) => handleTimeRangeChange(e.target.value)}
            className="px-4 py-2 bg-[#0a3d47] border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>

          {/* Auto Refresh Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-white/10 rounded bg-[#0a3d47]"
            />
            <label htmlFor="autoRefresh" className="text-sm text-gray-300">
              Auto Refresh
            </label>
          </div>

          {/* Refresh Interval */}
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={30}>30s</option>
              <option value={60}>1m</option>
              <option value={300}>5m</option>
              <option value={600}>10m</option>
            </select>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tenant Legend */}
      <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl shadow-sm border border-white/10 flex flex-wrap gap-4 items-center">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tenant Legend:</span>
        {analytics.tenantSummary.map(tenant => (
          <div key={tenant.tenantId} className="flex items-center gap-1.5 text-xs font-medium text-white">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: getTenantColor(tenant.tenantId) }}
            ></span>
            {tenant.tenantName}
          </div>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-2">Total Vehicles</h3>
          <div className="text-3xl font-bold text-blue-600">
            {analytics.tenantSummary.reduce((sum, tenant) => sum + tenant.totalVehicles, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-300 mt-1">Across {analytics.tenantSummary.length} tenants</div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-2">Total Views</h3>
          <div className="text-3xl font-bold text-green-600">
            {analytics.tenantSummary.reduce((sum, tenant) => sum + tenant.totalViews, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-300 mt-1">Last 7 days</div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-2">Total Inquiries</h3>
          <div className="text-3xl font-bold text-yellow-600">
            {analytics.tenantSummary.reduce((sum, tenant) => sum + tenant.totalInquiries, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-300 mt-1">From AI conversations</div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-2">Vehicles Sold</h3>
          <div className="text-3xl font-bold text-purple-600">
            {analytics.tenantSummary.reduce((sum, tenant) => sum + tenant.soldVehicles, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-300 mt-1">Status changed to sold</div>
        </div>
      </div>

      {/* Time Series Chart - Moved Up for Better Visibility */}
      <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">Daily Activity Trends (Real-time)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={analytics.timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#0d4450', border: '1px solid #ffffff20', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
            />
            <Legend />
            <Bar dataKey="views" fill="#3b82f6" name="Views" />
            <Bar dataKey="inquiries" fill="#f59e0b" name="Inquiries" />
            <Bar dataKey="sales" fill="#ef4444" name="Sales" />
            <Bar dataKey="newVehicles" fill="#10b981" name="Vehicle Uploads" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Consolidated Vehicle Statistics Tabs */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl shadow-sm border border-white/10 overflow-hidden">
        <div className="border-b border-white/10 bg-[#0a3d47] px-6 py-4">
          <h3 className="text-lg font-semibold text-white mb-4">Top Performing Vehicles</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'mostViewed', label: 'Most Viewed', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
              { id: 'mostAsked', label: 'Most Asked', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
              { id: 'mostSold', label: 'Most Sold', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
              { id: 'mostStocked', label: 'Most Stocked', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveChartTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${activeChartTab === tab.id
                  ? tab.color
                  : 'bg-[#0a3d47] text-gray-400 hover:bg-[#0d4450] border-white/10'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics[activeChartTab]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey={(data) => `${data.make} ${data.model}`} angle={-45} textAnchor="end" height={80} interval={0} fontSize={12} stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0d4450', border: '1px solid #ffffff20', color: '#fff' }}
                cursor={{ fill: '#ffffff10' }}
                formatter={(value, name, props) => {
                  const data = props.payload;
                  return [
                    <div key="tooltip">
                      <p className="font-bold">{value.toLocaleString()} {activeChartTab === 'mostViewed' ? 'views' : activeChartTab === 'mostAsked' ? 'inquiries' : activeChartTab === 'mostSold' ? 'sold' : 'units'}</p>
                      <p className="text-[10px] text-gray-400">Tenant: {data.tenantName}</p>
                    </div>,
                    'Count'
                  ];
                }}
              />
              <Bar dataKey="count">
                {analytics[activeChartTab].map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={getTenantColor(entry.tenantId || entry.tenantName || 'default')} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tenant Summary Table */}
      <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl shadow-sm border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Tenant Performance Summary</h3>

          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-[#0a3d47] border border-white/10 rounded-lg hover:bg-white/10">
              <span className="mr-1">🏳️</span>
              Filter Tenants
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full ml-1">
                {selectedTenantIds.length}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Checklist */}
            <div className="absolute right-0 mt-2 w-64 bg-[#0d4450] rounded-lg shadow-lg border border-white/10 p-2 hidden group-hover:block z-10">
              <div className="mb-2 pb-2 border-b border-white/10 flex justify-between items-center px-1">
                <span className="text-xs font-bold text-gray-400 uppercase">Select Tenants</span>
                <button
                  onClick={() => setSelectedTenantIds(analytics?.tenantSummary.map(t => t.tenantId) || [])}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  Select All
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {analytics?.tenantSummary.map(tenant => (
                  <label key={tenant.tenantId} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTenantIds.includes(tenant.tenantId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTenantIds([...selectedTenantIds, tenant.tenantId]);
                        } else {
                          setSelectedTenantIds(selectedTenantIds.filter((id: string) => id !== tenant.tenantId));
                        }
                      }}
                      className="rounded border-gray-500 bg-[#0a3d47] text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-sm text-white truncate">{tenant.tenantName}</span>
                    <span
                      className="w-2 h-2 rounded-full ml-auto flex-shrink-0"
                      style={{ backgroundColor: getTenantColor(tenant.tenantId) }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-[#0a3d47]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Vehicles</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Sold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Views</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Inquiries</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Conversion Rate</th>
              </tr>
            </thead>
            <tbody className="bg-white/5 backdrop-blur-sm divide-y divide-white/10">
              {analytics.tenantSummary
                .filter(tenant => selectedTenantIds.includes(tenant.tenantId))
                .map((tenant) => (
                  <tr key={tenant.tenantId} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shadow-sm border border-white/20"
                          style={{ backgroundColor: getTenantColor(tenant.tenantId) }}
                        ></span>
                        {tenant.tenantName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tenant.totalVehicles}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tenant.soldVehicles}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tenant.totalViews.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tenant.totalInquiries}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tenant.conversionRate >= 18 ? 'bg-green-100 text-green-800' :
                        tenant.conversionRate >= 15 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                        {tenant.conversionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AnalyticsDashboard: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <AnalyticsContent />
    </Suspense>
  );
};

export default AnalyticsDashboard;
