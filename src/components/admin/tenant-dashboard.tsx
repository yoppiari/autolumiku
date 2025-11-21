'use client';

import React, { useState, useEffect } from 'react';
import { Tenant, TenantHealth } from '@/types/tenant';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface TenantDashboardProps {
  tenants: Tenant[];
  onRefresh: () => Promise<void>;
}

interface TenantStats {
  total: number;
  active: number;
  setupRequired: number;
  suspended: number;
  deactivated: number;
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  database: 'healthy' | 'warning' | 'critical';
  lastCheck: Date;
  uptime: string;
}

export default function TenantDashboard({ tenants, onRefresh }: TenantDashboardProps) {
  const [stats, setStats] = useState<TenantStats>({
    total: 0,
    active: 0,
    setupRequired: 0,
    suspended: 0,
    deactivated: 0,
  });

  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: 'healthy',
    database: 'healthy',
    lastCheck: new Date(),
    uptime: '99.9%',
  });

  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Calculate tenant statistics
    const tenantStats = tenants.reduce(
      (acc, tenant) => {
        acc.total++;
        acc[tenant.status === 'setup_required' ? 'setupRequired' : tenant.status]++;
        return acc;
      },
      { total: 0, active: 0, setupRequired: 0, suspended: 0, deactivated: 0 }
    );

    setStats(tenantStats);
  }, [tenants]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      setSystemHealth(prev => ({
        ...prev,
        lastCheck: new Date(),
      }));
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const healthColor = {
    healthy: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    critical: 'text-red-600 bg-red-50',
  };

  const statusColor = {
    'setup_required': 'text-yellow-600 bg-yellow-50',
    active: 'text-green-600 bg-green-50',
    suspended: 'text-red-600 bg-red-50',
    deactivated: 'text-gray-600 bg-gray-50',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
          <p className="text-sm text-gray-600 mt-1">
            Monitoring status dan kesehatan tenant platform
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="24h">24 Jam</option>
            <option value="7d">7 Hari</option>
            <option value="30d">30 Hari</option>
            <option value="90d">90 Hari</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Tenants */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Tenants</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        {/* Active Tenants */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Aktif</p>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>

        {/* Setup Required */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Setup Required</p>
              <p className="text-2xl font-bold text-gray-900">{stats.setupRequired}</p>
            </div>
          </div>
        </div>

        {/* Issues */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Issues</p>
              <p className="text-2xl font-bold text-gray-900">{stats.suspended + stats.deactivated}</p>
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Kesehatan Sistem</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Status Keseluruhan</span>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${healthColor[systemHealth.overall]}`}>
                {systemHealth.overall.toUpperCase()}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Uptime: {systemHealth.uptime}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Database</span>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${healthColor[systemHealth.database]}`}>
                {systemHealth.database.toUpperCase()}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Last check: {format(systemHealth.lastCheck, 'HH:mm:ss', { locale: id })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">API Response</span>
              <span className="px-2 py-1 text-xs font-semibold rounded-full text-green-600 bg-green-50">
                HEALTHY
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Response time: 245ms avg
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Aktivitas Terkini</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aktivitas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Waktu
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tenants.slice(0, 5).map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                    <div className="text-sm text-gray-500">{tenant.subdomain}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {tenant.status === 'active' ? 'Tenant aktif dan berjalan normal' :
                     tenant.status === 'setup_required' ? 'Menunggu konfigurasi awal' :
                     tenant.status === 'suspended' ? 'Tenant disuspensi' : 'Tenant dinonaktifkan'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor[tenant.status]}`}>
                      {tenant.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(tenant.updatedAt), 'dd MMM yyyy HH:mm', { locale: id })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {tenants.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Belum ada aktivitas tenant
            </div>
          )}
        </div>
      </div>
    </div>
  );
}