/**
 * WhatsApp AI Staff Management Page
 * Manage staff access for WhatsApp commands
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// ==================== TYPES ====================

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Staff {
  id: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
  canUploadVehicle: boolean;
  canUpdateStatus: boolean;
  canViewAnalytics: boolean;
  canManageLeads: boolean;
  user: User;
  stats?: {
    totalCommands: number;
    todayCommands: number;
    lastCommand: {
      executedAt: string;
      commandType: string;
      success: boolean;
    } | null;
  };
}

interface StaffStats {
  activeStaff: number;
  commandsToday: number;
  successRate: number;
}

interface CommandLog {
  id: string;
  command: string;
  commandType: string;
  parameters: any;
  success: boolean;
  resultMessage: string | null;
  error: string | null;
  vehicleId: string | null;
  leadId: string | null;
  executedAt: string;
}

// ==================== MAIN COMPONENT ====================

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [stats, setStats] = useState<StaffStats>({ activeStaff: 0, commandsToday: 0, successRate: 0 });
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    phoneNumber: '',
    role: 'staff',
    canUploadVehicle: true,
    canUpdateStatus: true,
    canViewAnalytics: false,
    canManageLeads: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load data
  useEffect(() => {
    loadData();
  }, [searchQuery, roleFilter, statusFilter]);

  const loadData = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return;

      const parsedUser = JSON.parse(storedUser);
      const currentTenantId = parsedUser.tenantId;
      setTenantId(currentTenantId);

      // Build query params
      const params = new URLSearchParams({
        tenantId: currentTenantId,
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`/api/v1/whatsapp-ai/staff?${params}`);
      const data = await response.json();

      if (data.success) {
        setStaffList(data.data.staff);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return;

      const parsedUser = JSON.parse(storedUser);
      const currentTenantId = parsedUser.tenantId;

      const response = await fetch(`/api/v1/users?tenantId=${currentTenantId}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.data || data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleAddStaff = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/v1/whatsapp-ai/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, tenantId }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Staff berhasil ditambahkan!' });
        setShowAddModal(false);
        loadData();
        resetForm();
      } else {
        setMessage({ type: 'error', text: data.error || 'Gagal menambahkan staff' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat menambahkan staff' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditStaff = async () => {
    if (!selectedStaff) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/v1/whatsapp-ai/staff/${selectedStaff.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Staff berhasil diupdate!' });
        setShowEditModal(false);
        loadData();
        resetForm();
      } else {
        setMessage({ type: 'error', text: data.error || 'Gagal mengupdate staff' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat mengupdate staff' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Yakin ingin menonaktifkan staff ini?')) return;

    try {
      const response = await fetch(`/api/v1/whatsapp-ai/staff/${staffId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Staff berhasil dinonaktifkan!' });
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Gagal menonaktifkan staff' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat menonaktifkan staff' });
    }
  };

  const handleViewLogs = async (staff: Staff) => {
    setSelectedStaff(staff);
    setShowLogsModal(true);

    try {
      const response = await fetch(`/api/v1/whatsapp-ai/staff/${staff.id}/logs`);
      const data = await response.json();

      if (data.success) {
        setCommandLogs(data.data.logs);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const openAddModal = () => {
    loadUsers();
    setShowAddModal(true);
    resetForm();
  };

  const openEditModal = (staff: Staff) => {
    setSelectedStaff(staff);
    setFormData({
      userId: staff.user.id,
      phoneNumber: staff.phoneNumber,
      role: staff.role,
      canUploadVehicle: staff.canUploadVehicle,
      canUpdateStatus: staff.canUpdateStatus,
      canViewAnalytics: staff.canViewAnalytics,
      canManageLeads: staff.canManageLeads,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      userId: '',
      phoneNumber: '',
      role: 'staff',
      canUploadVehicle: true,
      canUpdateStatus: true,
      canViewAnalytics: false,
      canManageLeads: true,
    });
    setSelectedStaff(null);
  };

  const getPermissionBadges = (staff: Staff) => {
    const permissions = [];
    if (staff.canUploadVehicle) permissions.push('Upload');
    if (staff.canUpdateStatus) permissions.push('Status');
    if (staff.canViewAnalytics) permissions.push('Analytics');
    if (staff.canManageLeads) permissions.push('Leads');
    return permissions;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/whatsapp-ai" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to WhatsApp AI
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-gray-600 mt-1">Kelola akses staff untuk WhatsApp commands</p>
          </div>
          <button
            onClick={openAddModal}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md hover:shadow-lg"
          >
            + Add Staff
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
        >
          <p className={`${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
            {message.text}
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Active Staff</h3>
            <span className="text-2xl">👥</span>
          </div>
          <div className="text-3xl font-bold text-blue-600">{stats.activeStaff}</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Commands Today</h3>
            <span className="text-2xl">⚡</span>
          </div>
          <div className="text-3xl font-bold text-purple-600">{stats.commandsToday}</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
            <span className="text-2xl">✅</span>
          </div>
          <div className="text-3xl font-bold text-green-600">{stats.successRate}%</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="🔍 Search by phone or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">All Roles</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Belum ada staff. Klik "Add Staff" untuk menambahkan.
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-lg">📱</span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {staff.user.firstName} {staff.user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{staff.phoneNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {staff.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {getPermissionBadges(staff).map((perm) => (
                          <span
                            key={perm}
                            className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${staff.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                          }`}
                      >
                        {staff.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        <div className="font-medium text-gray-900">
                          {staff.stats?.totalCommands || 0} commands
                        </div>
                        <div className="text-xs text-gray-500">
                          {staff.stats?.todayCommands || 0} today
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewLogs(staff)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Logs"
                        >
                          📊
                        </button>
                        <button
                          onClick={() => openEditModal(staff)}
                          className="text-orange-600 hover:text-orange-900"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(staff.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Deactivate"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add New Staff</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select User</label>
                <select
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">-- Select User --</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp Phone Number</label>
                <input
                  type="text"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="+62812345678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Format: +62xxx atau 62xxx</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canUploadVehicle}
                      onChange={(e) => setFormData({ ...formData, canUploadVehicle: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Can Upload Vehicle (via /upload command)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canUpdateStatus}
                      onChange={(e) => setFormData({ ...formData, canUpdateStatus: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Can Update Status (via /status command)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canViewAnalytics}
                      onChange={(e) => setFormData({ ...formData, canViewAnalytics: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Can View Analytics (via /stats command)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canManageLeads}
                      onChange={(e) => setFormData({ ...formData, canManageLeads: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Can Manage Leads</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStaff}
                disabled={isSaving || !formData.userId || !formData.phoneNumber}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Adding...' : 'Add Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Edit Staff</h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedStaff.user.firstName} {selectedStaff.user.lastName}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp Phone Number</label>
                <input
                  type="text"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canUploadVehicle}
                      onChange={(e) => setFormData({ ...formData, canUploadVehicle: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Can Upload Vehicle</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canUpdateStatus}
                      onChange={(e) => setFormData({ ...formData, canUpdateStatus: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Can Update Status</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canViewAnalytics}
                      onChange={(e) => setFormData({ ...formData, canViewAnalytics: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Can View Analytics</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canManageLeads}
                      onChange={(e) => setFormData({ ...formData, canManageLeads: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">Can Manage Leads</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditStaff}
                disabled={isSaving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Command Logs Modal */}
      {showLogsModal && selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Command History</h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedStaff.user.firstName} {selectedStaff.user.lastName} ({selectedStaff.phoneNumber})
              </p>
            </div>
            <div className="p-6">
              {commandLogs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Belum ada command log</p>
              ) : (
                <div className="space-y-3">
                  {commandLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`border rounded-lg p-4 ${log.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded ${log.success
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                              }`}
                          >
                            {log.commandType}
                          </span>
                          <span className="ml-2 text-sm text-gray-600">
                            {new Date(log.executedAt).toLocaleString('id-ID')}
                          </span>
                        </div>
                        <span className="text-xl">{log.success ? '✅' : '❌'}</span>
                      </div>
                      <div className="text-sm font-mono text-gray-700 mb-2">{log.command}</div>
                      {log.resultMessage && (
                        <div className="text-sm text-gray-600 whitespace-pre-wrap">
                          {log.resultMessage}
                        </div>
                      )}
                      {log.error && (
                        <div className="text-sm text-red-600 mt-2">Error: {log.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
