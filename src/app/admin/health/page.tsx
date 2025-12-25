/**
 * Tenant Analytics Dashboard
 * Analytics dashboard for tracking tenant data including vehicle collections, views, inquiries, and sales
 */

'use client';

import React, { useState, useEffect } from 'react';
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
  mostCollected: VehicleStat[];
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
}

const AnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<TenantAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60);

  // Load analytics data from API
  useEffect(() => {
    const loadAnalyticsData = async () => {
      setIsLoading(true);
      try {
        // Fetch analytics data from API with auth
        const analyticsData = await api.get(`/api/admin/analytics?timeRange=${selectedTimeRange}`);

        if (!analyticsData.success && analyticsData.error) {
          throw new Error(analyticsData.error);
        }

        // Transform API data to match our interface
        const transformedAnalytics: TenantAnalytics = {
          mostCollected: analyticsData.mostCollected || [],
          mostViewed: analyticsData.mostViewed || [],
          mostAsked: analyticsData.mostAsked || [],
          mostSold: analyticsData.mostSold || [],
          tenantSummary: analyticsData.tenantSummary || [],
          timeSeriesData: analyticsData.timeSeriesData || []
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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

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
        <div className="text-gray-500">Failed to load analytics data</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tenant Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive analytics for tenant vehicle data and performance</p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Time Range Selector */}
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="autoRefresh" className="text-sm text-gray-700">
              Auto Refresh
            </label>
          </div>

          {/* Refresh Interval */}
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Vehicles</h3>
          <div className="text-3xl font-bold text-blue-600">
            {analytics.tenantSummary.reduce((sum, tenant) => sum + tenant.totalVehicles, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">Across {analytics.tenantSummary.length} tenants</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Views</h3>
          <div className="text-3xl font-bold text-green-600">
            {analytics.tenantSummary.reduce((sum, tenant) => sum + tenant.totalViews, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">Last 7 days</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Inquiries</h3>
          <div className="text-3xl font-bold text-yellow-600">
            {analytics.tenantSummary.reduce((sum, tenant) => sum + tenant.totalInquiries, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">From AI conversations</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Vehicles Sold</h3>
          <div className="text-3xl font-bold text-purple-600">
            {analytics.tenantSummary.reduce((sum, tenant) => sum + tenant.soldVehicles, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">Status changed to sold</div>
        </div>
      </div>

      {/* Charts Row 1 - Most Collected & Most Viewed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Collected Vehicles */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Collected Vehicles</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.mostCollected}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={(data) => `${data.make} ${data.model}`} angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [`${value} vehicles`, 'Count']}
                labelFormatter={(label) => `Vehicle: ${label}`}
              />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Most Viewed Vehicles */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Viewed Vehicles</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.mostViewed}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={(data) => `${data.make} ${data.model}`} angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [`${value.toLocaleString()} views`, 'Views']}
                labelFormatter={(label) => `Vehicle: ${label}`}
              />
              <Bar dataKey="count" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 - Most Asked & Most Sold */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Asked Vehicles */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Asked Vehicles (AI Conversations)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.mostAsked}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={(data) => `${data.make} ${data.model}`} angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [`${value} inquiries`, 'Inquiries']}
                labelFormatter={(label) => `Vehicle: ${label}`}
              />
              <Bar dataKey="count" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Most Sold Vehicles */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Sold Vehicles</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.mostSold}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={(data) => `${data.make} ${data.model}`} angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [`${value} sold`, 'Sold']}
                labelFormatter={(label) => `Vehicle: ${label}`}
              />
              <Bar dataKey="count" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time Series Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Trends (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="views" fill="#3b82f6" name="Views" />
            <Bar dataKey="inquiries" fill="#f59e0b" name="Inquiries" />
            <Bar dataKey="sales" fill="#ef4444" name="Sales" />
            <Bar dataKey="newVehicles" fill="#10b981" name="New Vehicles" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tenant Summary Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tenant Performance Summary</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Vehicles</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Views</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inquiries</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion Rate</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.tenantSummary.map((tenant) => (
                <tr key={tenant.tenantId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tenant.tenantName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.totalVehicles}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.soldVehicles}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.totalViews.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.totalInquiries}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tenant.conversionRate >= 18 ? 'bg-green-100 text-green-800' :
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

export default AnalyticsDashboard;