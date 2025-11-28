/**
 * Staff WhatsApp Management
 * Manage staff access untuk WhatsApp commands
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface StaffAuth {
  id: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
  canUploadVehicle: boolean;
  canUpdateStatus: boolean;
  canViewAnalytics: boolean;
  canManageLeads: boolean;
  lastCommandAt?: string;
  commandCount: number;
  createdAt: string;
}

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState<StaffAuth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({
    phoneNumber: '',
    role: 'staff',
    canUploadVehicle: true,
    canUpdateStatus: true,
    canViewAnalytics: false,
    canManageLeads: true,
  });
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load staff list
  useEffect(() => {
    loadStaffList();
  }, []);

  const loadStaffList = async () => {
    setIsLoading(true);

    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        console.error('No user found');
        return;
      }

      const parsedUser = JSON.parse(storedUser);
      const tenantId = parsedUser.tenantId;

      const response = await fetch(`/api/v1/whatsapp-ai/staff?tenantId=${tenantId}`);
      const data = await response.json();

      if (data.success) {
        setStaffList(data.data);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.phoneNumber) {
      setSaveMessage({ type: 'error', text: 'Nomor telepon wajib diisi!' });
      return;
    }

    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return;

      const parsedUser = JSON.parse(storedUser);
      const tenantId = parsedUser.tenantId;

      const response = await fetch('/api/v1/whatsapp-ai/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...newStaff }),
      });

      const data = await response.json();

      if (data.success) {
        setSaveMessage({ type: 'success', text: 'Staff berhasil ditambahkan!' });
        setIsAddingStaff(false);
        setNewStaff({
          phoneNumber: '',
          role: 'staff',
          canUploadVehicle: true,
          canUpdateStatus: true,
          canViewAnalytics: false,
          canManageLeads: true,
        });
        loadStaffList();
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Gagal menambahkan staff' });
      }
    } catch (error) {
      console.error('Error adding staff:', error);
      setSaveMessage({ type: 'error', text: 'Terjadi kesalahan' });
    }
  };

  const handleToggleActive = async (staffId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/v1/whatsapp-ai/staff/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      const data = await response.json();

      if (data.success) {
        setSaveMessage({ type: 'success', text: 'Status staff berhasil diupdate!' });
        loadStaffList();
      }
    } catch (error) {
      console.error('Error updating staff:', error);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Yakin ingin menghapus staff ini?')) return;

    try {
      const response = await fetch(`/api/v1/whatsapp-ai/staff/${staffId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSaveMessage({ type: 'success', text: 'Staff berhasil dihapus!' });
        loadStaffList();
      }
    } catch (error) {
      console.error('Error deleting staff:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/whatsapp-ai" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to WhatsApp AI Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-gray-600 mt-1">Kelola akses staff untuk WhatsApp commands</p>
          </div>
          <button
            onClick={() => setIsAddingStaff(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            + Add Staff
          </button>
        </div>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            saveMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          <p className={`${saveMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
            {saveMessage.text}
          </p>
        </div>
      )}

      {/* Add Staff Modal */}
      {isAddingStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Staff</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp Number (E.164 format)
                </label>
                <input
                  type="text"
                  value={newStaff.phoneNumber}
                  onChange={(e) => setNewStaff({ ...newStaff, phoneNumber: e.target.value })}
                  placeholder="e.g., 6281234567890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Format: country code + number (no spaces or +)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Permissions</label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newStaff.canUploadVehicle}
                    onChange={(e) => setNewStaff({ ...newStaff, canUploadVehicle: e.target.checked })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Can Upload Vehicle</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newStaff.canUpdateStatus}
                    onChange={(e) => setNewStaff({ ...newStaff, canUpdateStatus: e.target.checked })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Can Update Status</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newStaff.canViewAnalytics}
                    onChange={(e) => setNewStaff({ ...newStaff, canViewAnalytics: e.target.checked })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Can View Analytics</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newStaff.canManageLeads}
                    onChange={(e) => setNewStaff({ ...newStaff, canManageLeads: e.target.checked })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Can Manage Leads</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsAddingStaff(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStaff}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
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
                  Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Belum ada staff. Klik "Add Staff" untuk menambahkan.
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{staff.phoneNumber}</div>
                        <div className="text-sm text-gray-500">
                          Added {new Date(staff.createdAt).toLocaleDateString('id-ID')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {staff.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs space-y-1">
                        {staff.canUploadVehicle && (
                          <div className="text-green-600">✓ Upload Vehicle</div>
                        )}
                        {staff.canUpdateStatus && (
                          <div className="text-green-600">✓ Update Status</div>
                        )}
                        {staff.canViewAnalytics && (
                          <div className="text-green-600">✓ View Analytics</div>
                        )}
                        {staff.canManageLeads && (
                          <div className="text-green-600">✓ Manage Leads</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{staff.commandCount} commands</div>
                      {staff.lastCommandAt && (
                        <div className="text-xs">
                          Last: {new Date(staff.lastCommandAt).toLocaleDateString('id-ID')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(staff.id, staff.isActive)}
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          staff.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {staff.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleDeleteStaff(staff.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Command Examples */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">WhatsApp Command Examples</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p><strong>/upload</strong> Toyota Avanza 2020 150000000 50000 Hitam Manual</p>
          <p><strong>/status</strong> 12345 SOLD</p>
          <p><strong>/inventory</strong> AVAILABLE</p>
          <p><strong>/stats</strong> today</p>
        </div>
      </div>
    </div>
  );
}
