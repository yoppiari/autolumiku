/**
 * Team Analytics Dashboard Component
 * Comprehensive analytics dashboard for team performance metrics
 * Supports various report types and data visualization
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  Clock,
  Target,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  BarChart3,
  Activity,
  Eye,
  Settings
} from 'lucide-react';

interface TeamMetrics {
  totalMembers: number;
  activeMembers: number;
  onlineMembers: number;
  newMembersThisMonth: number;
  membersByRole: Array<{
    roleName: string;
    displayName: string;
    count: number;
    percentage: number;
  }>;
  membersByDepartment: Array<{
    department: string;
    count: number;
    percentage: number;
  }>;
}

interface PerformanceMetrics {
  memberId: string;
  memberName: string;
  role: string;
  department: string;
  leadResponseTime: {
    average: number;
    median: number;
    best: number;
    worst: number;
  };
  inventoryUpdates: number;
  customerInteractions: number;
  appointmentsBooked: number;
  salesClosed: number;
  revenueGenerated: number;
  activityScore: number;
  lastActiveTime: Date | null;
}

interface AnalyticsData {
  period: {
    startDate: Date;
    endDate: Date;
    type: string;
    days: number;
  };
  teamMetrics: TeamMetrics;
  performanceMetrics: PerformanceMetrics[];
  insights: Array<{
    type: 'positive' | 'warning' | 'info';
    title: string;
    description: string;
    metric: string;
    recommendation?: string;
  }>;
}

interface AnalyticsDashboardProps {
  className?: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  className = ''
}) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState('monthly');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [includeInsights, setIncludeInsights] = useState(true);
  const [includeHeatmap, setIncludeHeatmap] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load analytics data
  useEffect(() => {
    loadAnalytics();
  }, [reportType, dateRange, includeInsights, includeHeatmap]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        type: reportType,
        includeInsights: includeInsights.toString(),
        includeHeatmap: includeHeatmap.toString()
      });

      if (dateRange.startDate && dateRange.endDate) {
        params.append('startDate', dateRange.startDate);
        params.append('endDate', dateRange.endDate);
      }

      const response = await fetch(`/api/team/analytics?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load analytics data');
      }

      const result = await response.json();
      setAnalyticsData(result.data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv' | 'excel') => {
    setExporting(true);

    try {
      const exportData = {
        format,
        reportType,
        includeInsights,
        includeHeatmap,
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate })
      };

      const response = await fetch('/api/team/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(exportData)
      });

      if (!response.ok) {
        throw new Error('Failed to export analytics');
      }

      const result = await response.json();

      // Create download link
      const blob = new Blob([result.data.content], {
        type: result.data.mimeType
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const getInsightBgColor = (type: string) => {
    switch (type) {
      case 'positive':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const topPerformers = analyticsData?.performanceMetrics
    ?.sort((a, b) => b.activityScore - a.activityScore)
    .slice(0, 5) || [];

  if (loading && !analyticsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error && !analyticsData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team Analytics</h2>
          <p className="text-gray-600">
            {analyticsData && (
              <>Showing data for {analyticsData.period.days} days ({formatDate(analyticsData.period.startDate)} - {formatDate(analyticsData.period.endDate)})</>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Report Type Selector */}
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">Last 24 Hours</option>
            <option value="weekly">Last 7 Days</option>
            <option value="monthly">Last 30 Days</option>
            <option value="quarterly">Last 90 Days</option>
            <option value="yearly">Last Year</option>
          </select>

          {/* Date Range Inputs */}
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Start date"
          />
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="End date"
          />

          {/* Refresh Button */}
          <button
            onClick={loadAnalytics}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Buttons */}
          <div className="flex gap-1">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleExport('excel')}
              disabled={exporting}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Include Options */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={includeInsights}
            onChange={(e) => setIncludeInsights(e.target.checked)}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Include Insights</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={includeHeatmap}
            onChange={(e) => setIncludeHeatmap(e.target.checked)}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Include Activity Heatmap</span>
        </label>
      </div>

      {analyticsData && (
        <>
          {/* Team Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Members</p>
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.teamMetrics.totalMembers}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Members</p>
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.teamMetrics.activeMembers}</p>
                  <p className="text-xs text-gray-500">
                    {Math.round((analyticsData.teamMetrics.activeMembers / analyticsData.teamMetrics.totalMembers) * 100)}% of total
                  </p>
                </div>
                <Activity className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Online Now</p>
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.teamMetrics.onlineMembers}</p>
                </div>
                <Eye className="w-8 h-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">New This Month</p>
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.teamMetrics.newMembersThisMonth}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </div>

          {/* Role and Department Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Members by Role */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Members by Role</h3>
              <div className="space-y-3">
                {analyticsData.teamMetrics.membersByRole.map((role, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{role.displayName}</span>
                        <span className="text-sm text-gray-500">{role.count} ({role.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${role.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Members by Department */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Members by Department</h3>
              <div className="space-y-3">
                {analyticsData.teamMetrics.membersByDepartment.map((dept, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{dept.department}</span>
                        <span className="text-sm text-gray-500">{dept.count} ({dept.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${dept.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Member</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Role</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Dept.</th>
                    <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Activity Score</th>
                    <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Interactions</th>
                    <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Sales</th>
                    <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topPerformers.map((member, index) => (
                    <tr key={member.memberId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <div className="font-medium text-gray-900">{member.memberName}</div>
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-600">{member.role}</td>
                      <td className="py-3 px-3 text-sm text-gray-600">{member.department}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {member.activityScore}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-sm text-gray-600">
                        {member.customerInteractions}
                      </td>
                      <td className="py-3 px-3 text-center text-sm text-gray-600">
                        {member.salesClosed}
                      </td>
                      <td className="py-3 px-3 text-center text-sm text-gray-600">
                        {formatCurrency(member.revenueGenerated)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Insights */}
          {includeInsights && analyticsData.insights.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">AI-Powered Insights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analyticsData.insights.map((insight, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${getInsightBgColor(insight.type)}`}
                  >
                    <div className="flex items-start space-x-3">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{insight.title}</h4>
                        <p className="text-sm text-gray-700 mt-1">{insight.description}</p>
                        {insight.recommendation && (
                          <p className="text-sm text-gray-600 mt-2 italic">
                            <strong>Recommendation:</strong> {insight.recommendation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;