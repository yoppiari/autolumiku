/**
 * Audit Logs Dashboard
 * Story 1.10: Platform-wide audit logging for compliance
 */

'use client';

import React, { useState } from 'react';

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
  const [logs, setLogs] = useState<AuditLog[]>([
    {
      id: '1',
      timestamp: new Date('2025-11-23T10:30:00'),
      tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed' // MOCK_DATA,
      tenantName: 'Showroom Jakarta Premium',
      userId: 'f8e7d6c5-b4a3-4c5d-8e9f-1a2b3c4d5e6f' // MOCK_DATA,
      userName: 'Admin Showroom',
      userEmail: 'admin@showroomjakarta.com',
      action: 'CREATE_VEHICLE',
      actionType: 'create',
      resource: 'vehicle',
      resourceId: 'veh-123',
      ipAddress: '103.140.192.45',
      userAgent: 'Mozilla/5.0...',
      status: 'success',
    },
    {
      id: '2',
      timestamp: new Date('2025-11-23T10:25:00'),
      tenantId: '5536722c-78e5-4dcd-9d35-d16858add414' // MOCK_DATA,
      tenantName: 'Auto Center Surabaya',
      userId: 'a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d' // MOCK_DATA,
      userName: 'Manager Sales',
      userEmail: 'manager@autocenter.com',
      action: 'UPDATE_PRICE',
      actionType: 'update',
      resource: 'vehicle',
      resourceId: 'veh-456',
      ipAddress: '36.85.71.22',
      userAgent: 'Mozilla/5.0...',
      status: 'success',
      details: {
        before: { price: 200000000 },
        after: { price: 195000000 },
      },
    },
    {
      id: '3',
      timestamp: new Date('2025-11-23T10:20:00'),
      tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed' // MOCK_DATA,
      tenantName: 'Showroom Jakarta Premium',
      userId: '9e8d7c6b-5a4f-4e3d-2c1b-0a9b8c7d6e5f' // MOCK_DATA,
      userName: 'Sales Staff',
      userEmail: 'sales@showroomjakarta.com',
      action: 'LOGIN_FAILED',
      actionType: 'security',
      resource: 'auth',
      resourceId: 'auth-789',
      ipAddress: '103.140.192.45',
      userAgent: 'Mozilla/5.0...',
      status: 'failed',
      details: {
        reason: 'Invalid password',
      },
    },
  ]);

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
