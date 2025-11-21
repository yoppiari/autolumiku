/**
 * Platform Health Dashboard
 * Main dashboard for monitoring platform health and performance metrics
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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

// Mock types (would import from actual types)
interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  timestamp: Date;
  checks: HealthCheck[];
  summary: {
    total: number;
    passing: number;
    warning: number;
    failing: number;
    score: number;
  };
}

interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  duration: number;
  message?: string;
  lastChecked: Date;
}

interface MetricsSummary {
  system: {
    cpu: { current: number; average: number; max: number };
    memory: { current: number; average: number; max: number };
    disk: { current: number; average: number; max: number };
  };
  application: {
    requests: { total: number; errors: number; avgResponseTime: number };
    uptime: number;
  };
  tenants: {
    active: number;
    totalUsers: number;
    activeUsers: number;
  };
  database: {
    connections: { active: number; total: number };
    queryPerformance: { avgDuration: number; slowQueries: number };
  };
}

const HealthDashboard: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [metricsSummary, setMetricsSummary] = useState<MetricsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);

  // Mock data for development
  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        // In a real implementation, these would be API calls
        // const healthResponse = await fetch('/api/admin/health/status');
        // const metricsResponse = await fetch('/api/admin/metrics/summary');

        // Mock health status
        const mockHealthStatus: HealthStatus = {
          status: 'healthy',
          timestamp: new Date(),
          checks: [
            { name: 'database', status: 'pass', duration: 45, lastChecked: new Date() },
            { name: 'redis', status: 'pass', duration: 12, lastChecked: new Date() },
            { name: 'external_apis', status: 'pass', duration: 156, lastChecked: new Date() },
            { name: 'disk_space', status: 'warn', duration: 8, message: 'Disk usage at 75%', lastChecked: new Date() },
            { name: 'memory_usage', status: 'pass', duration: 5, lastChecked: new Date() }
          ],
          summary: {
            total: 5,
            passing: 4,
            warning: 1,
            failing: 0,
            score: 90
          }
        };

        // Mock metrics summary
        const mockMetricsSummary: MetricsSummary = {
          system: {
            cpu: { current: 35, average: 42, max: 68 },
            memory: { current: 58, average: 61, max: 73 },
            disk: { current: 75, average: 74, max: 76 }
          },
          application: {
            requests: { total: 15420, errors: 23, avgResponseTime: 145 },
            uptime: 86400 * 7 // 7 days
          },
          tenants: {
            active: 12,
            totalUsers: 485,
            activeUsers: 127
          },
          database: {
            connections: { active: 18, total: 25 },
            queryPerformance: { avgDuration: 42, slowQueries: 3 }
          }
        };

        setHealthStatus(mockHealthStatus);
        setMetricsSummary(mockMetricsSummary);

      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();

    // Set up auto-refresh
    if (autoRefresh) {
      const interval = setInterval(loadDashboardData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, selectedTimeRange]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return 'text-green-600 bg-green-50';
      case 'warning':
      case 'warn':
        return 'text-yellow-600 bg-yellow-50';
      case 'critical':
      case 'fail':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return '✓';
      case 'warning':
      case 'warn':
        return '⚠';
      case 'critical':
      case 'fail':
        return '✗';
      default:
        return '?';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const mockTimeSeriesData = [
    { time: '00:00', cpu: 25, memory: 45, disk: 72 },
    { time: '04:00', cpu: 18, memory: 42, disk: 73 },
    { time: '08:00', cpu: 52, memory: 68, disk: 74 },
    { time: '12:00', cpu: 68, memory: 71, disk: 75 },
    { time: '16:00', cpu: 45, memory: 58, disk: 75 },
    { time: '20:00', cpu: 35, memory: 52, disk: 76 },
    { time: '23:59', cpu: 28, memory: 48, disk: 76 }
  ];

  const mockTenantData = [
    { name: 'Active', value: 12, color: '#10b981' },
    { name: 'Inactive', value: 3, color: '#6b7280' },
    { name: 'Suspended', value: 1, color: '#ef4444' }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Health</h1>
          <p className="text-gray-600 mt-1">Monitor system performance and platform status</p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Time Range Selector */}
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
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
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>1m</option>
              <option value={300}>5m</option>
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

      {/* Overall Health Status */}
      {healthStatus && (
        <div className={`p-6 rounded-xl border-2 ${
          healthStatus.status === 'healthy' ? 'bg-green-50 border-green-200' :
          healthStatus.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
          healthStatus.status === 'critical' ? 'bg-red-50 border-red-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Platform Status</h2>
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(healthStatus.status)}`}>
                  {getStatusIcon(healthStatus.status)} {healthStatus.status.toUpperCase()}
                </span>
                <span className="text-gray-600">
                  Health Score: {healthStatus.summary.score}/100
                </span>
                <span className="text-gray-600">
                  Last checked: {healthStatus.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">
                {healthStatus.summary.passing}/{healthStatus.summary.total}
              </div>
              <div className="text-sm text-gray-600">Services Healthy</div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Cards */}
      {metricsSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* System Health Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">CPU Usage</span>
                  <span className="text-sm font-medium">{metricsSummary.system.cpu.current}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      metricsSummary.system.cpu.current > 80 ? 'bg-red-500' :
                      metricsSummary.system.cpu.current > 60 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${metricsSummary.system.cpu.current}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Memory Usage</span>
                  <span className="text-sm font-medium">{metricsSummary.system.memory.current}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      metricsSummary.system.memory.current > 80 ? 'bg-red-500' :
                      metricsSummary.system.memory.current > 60 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${metricsSummary.system.memory.current}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Disk Usage</span>
                  <span className="text-sm font-medium">{metricsSummary.system.disk.current}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      metricsSummary.system.disk.current > 85 ? 'bg-red-500' :
                      metricsSummary.system.disk.current > 70 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${metricsSummary.system.disk.current}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Application Metrics Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Application</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Uptime</span>
                <span className="text-sm font-medium">{formatUptime(metricsSummary.application.uptime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Requests</span>
                <span className="text-sm font-medium">{metricsSummary.application.requests.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Error Rate</span>
                <span className={`text-sm font-medium ${
                  (metricsSummary.application.requests.errors / metricsSummary.application.requests.total) > 0.01 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {((metricsSummary.application.requests.errors / metricsSummary.application.requests.total) * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Avg Response</span>
                <span className="text-sm font-medium">{metricsSummary.application.requests.avgResponseTime}ms</span>
              </div>
            </div>
          </div>

          {/* Tenant Metrics Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tenants</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active Tenants</span>
                <span className="text-sm font-medium">{metricsSummary.tenants.active}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Users</span>
                <span className="text-sm font-medium">{metricsSummary.tenants.totalUsers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active Users</span>
                <span className="text-sm font-medium">{metricsSummary.tenants.activeUsers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">User Activity</span>
                <span className="text-sm font-medium">
                  {((metricsSummary.tenants.activeUsers / metricsSummary.tenants.totalUsers) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Database Metrics Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Database</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active Connections</span>
                <span className="text-sm font-medium">
                  {metricsSummary.database.connections.active}/{metricsSummary.database.connections.total}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Query Performance</span>
                <span className="text-sm font-medium">{metricsSummary.database.queryPerformance.avgDuration}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Slow Queries</span>
                <span className={`text-sm font-medium ${metricsSummary.database.queryPerformance.slowQueries > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {metricsSummary.database.queryPerformance.slowQueries}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Connection Pool</span>
                <span className="text-sm font-medium">
                  {((metricsSummary.database.connections.active / metricsSummary.database.connections.total) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Performance Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockTimeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="cpu" stroke="#3b82f6" name="CPU %" />
              <Line type="monotone" dataKey="memory" stroke="#10b981" name="Memory %" />
              <Line type="monotone" dataKey="disk" stroke="#f59e0b" name="Disk %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tenant Status Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tenant Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={mockTenantData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {mockTenantData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Health Check Details */}
      {healthStatus && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Health Check Details</h3>
          <div className="space-y-3">
            {healthStatus.checks.map((check) => (
              <div key={check.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${getStatusColor(check.status)}`}>
                    {getStatusIcon(check.status)}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900 capitalize">{check.name.replace('_', ' ')}</div>
                    <div className="text-sm text-gray-600">
                      {check.message || `Response time: ${check.duration}ms`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(check.status)}`}>
                    {check.status.toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {check.lastChecked.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthDashboard;