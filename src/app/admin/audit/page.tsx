/**
 * Audit Logs Dashboard
 * Story 1.10: Platform-wide audit logging for compliance
 */

'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

interface AuditLog {
  id: string;
  timestamp: Date;
  tenantId: string;
  tenantName: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  actionType: 'create' | 'update' | 'delete' | 'access' | 'security';
  resource: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failed';
  details?: {
    before?: any;
    after?: any;
    reason?: string;
  };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setIsLoading(true);

      const data = await api.get('/api/admin/audit?limit=100');

      if (data.success && data.data) {
        const mappedLogs: AuditLog[] = data.data.map((log: any) => ({
          id: log.id,
          timestamp: new Date(log.createdAt),
          tenantId: log.tenantId,
          tenantName: log.tenant?.name || 'Unknown',
          userId: log.userId || '',
          userName: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
          userEmail: log.user?.email || '',
          action: log.action,
          actionType: getActionType(log.action),
          resource: log.resourceType,
          resourceId: log.resourceId || '',
          ipAddress: log.ipAddress || '',
          userAgent: log.userAgent || '',
          status: 'success' as const,
          details: {
            before: log.oldValue,
            after: log.newValue,
          },
        }));
        setLogs(mappedLogs);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionType = (action: string): 'create' | 'update' | 'delete' | 'access' | 'security' => {
    if (action.includes('CREATE')) return 'create';
    if (action.includes('UPDATE')) return 'update';
    if (action.includes('DELETE')) return 'delete';
    if (action.includes('LOGIN') || action.includes('SECURITY')) return 'security';
    return 'access';
  };

  const [filters, setFilters] = useState({
    tenantId: '',
    actionType: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const actionTypeColors = {
    create: 'bg-green-100 text-green-800',
    update: 'bg-blue-100 text-blue-800',
    delete: 'bg-red-100 text-red-800',
    access: 'bg-yellow-100 text-yellow-800',
    security: 'bg-purple-100 text-purple-800',
  };

  const statusColors = {
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  const filteredLogs = logs.filter(log => {
    if (filters.tenantId && log.tenantId !== filters.tenantId) return false;
    if (filters.actionType && log.actionType !== filters.actionType) return false;
    if (filters.status && log.status !== filters.status) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        log.userName.toLowerCase().includes(searchLower) ||
        log.userEmail.toLowerCase().includes(searchLower) ||
        log.action.toLowerCase().includes(searchLower) ||
        log.tenantName.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const exportLogs = () => {
    // Mock export functionality
    alert('Export audit logs as CSV - Feature coming soon');
  };

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-gray-600 mt-1">Comprehensive audit trail for compliance and security</p>
          </div>
          <button
            onClick={exportLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Events</div>
          <div className="text-2xl font-bold text-gray-900">{logs.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Success Rate</div>
          <div className="text-2xl font-bold text-green-600">
            {Math.round((logs.filter(l => l.status === 'success').length / logs.length) * 100)}%
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Failed Attempts</div>
          <div className="text-2xl font-bold text-red-600">
            {logs.filter(l => l.status === 'failed').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Security Events</div>
          <div className="text-2xl font-bold text-purple-600">
            {logs.filter(l => l.actionType === 'security').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Search</label>
            <input
              type="text"
              placeholder="User, action, tenant..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Action Type</label>
            <select
              value={filters.actionType}
              onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="access">Access</option>
              <option value="security">Security</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {filteredLogs.length} of {logs.length} events
          </div>
          <button
            onClick={() => setFilters({
              tenantId: '',
              actionType: '',
              status: '',
              dateFrom: '',
              dateTo: '',
              search: '',
            })}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.timestamp.toLocaleString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{log.userName}</div>
                      <div className="text-xs text-gray-500">{log.userEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.tenantName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{log.action}</div>
                      <div className="text-xs text-gray-500">{log.resource}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${actionTypeColors[log.actionType]}`}>
                        {log.actionType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[log.status]}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page 1 of 1
            </div>
            <div className="flex space-x-2">
              <button
                disabled
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md text-gray-400 cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md text-gray-400 cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
