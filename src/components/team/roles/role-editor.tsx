/**
 * Role Editor Component
 * Comprehensive role editing interface with permission matrix
 * Supports creating new roles and editing existing ones
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Copy, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import PermissionGrid from './permission-grid';

interface Role {
  id: string;
  name: string;
  displayName: string;
  indonesianTitle: string;
  description: string;
  department: string;
  roleLevel: number;
  isSystem: boolean;
  isActive: boolean;
  permissions: any[];
  memberCount?: number;
}

interface PermissionCategory {
  category: string;
  permissions: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
  }>;
}

interface RoleEditorProps {
  role?: Role;
  isOpen: boolean;
  onClose: () => void;
  onSave: (roleData: any) => Promise<void>;
  onClone?: (roleId: string, cloneData: any) => Promise<void>;
  onDelete?: (roleId: string) => Promise<void>;
  mode: 'create' | 'edit' | 'clone';
}

const DEPARTMENTS = [
  'Management',
  'Sales',
  'Finance',
  'Service',
  'Marketing',
  'Inventory',
  'Administration'
];

const INDONESIAN_DEPARTMENTS = {
  'Management': 'Manajemen',
  'Sales': 'Penjualan',
  'Finance': 'Keuangan',
  'Service': 'Layanan',
  'Marketing': 'Pemasaran',
  'Inventory': 'Inventaris',
  'Administration': 'Administrasi'
};

export const RoleEditor: React.FC<RoleEditorProps> = ({
  role,
  isOpen,
  onClose,
  onSave,
  onClone,
  onDelete,
  mode
}) => {
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    indonesianTitle: '',
    description: '',
    department: DEPARTMENTS[0],
    roleLevel: 50
  });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<PermissionCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'permissions'>('details');

  // Initialize form data
  useEffect(() => {
    if (role && mode === 'edit') {
      setFormData({
        name: role.name,
        displayName: role.displayName,
        indonesianTitle: role.indonesianTitle,
        description: role.description,
        department: role.department,
        roleLevel: role.roleLevel
      });
      setSelectedPermissions(role.permissions?.map((p: any) => p.permissionId) || []);
      setActiveTab('details');
    } else if (role && mode === 'clone') {
      setFormData({
        name: `${role.name}_copy`,
        displayName: `${role.displayName} (Copy)`,
        indonesianTitle: `${role.indonesianTitle} (Salinan)`,
        description: role.description,
        department: role.department,
        roleLevel: role.roleLevel
      });
      setSelectedPermissions(role.permissions?.map((p: any) => p.permissionId) || []);
      setActiveTab('details');
    } else {
      // Reset for create mode
      setFormData({
        name: '',
        displayName: '',
        indonesianTitle: '',
        description: '',
        department: DEPARTMENTS[0],
        roleLevel: 50
      });
      setSelectedPermissions([]);
      setActiveTab('details');
    }
  }, [role, mode]);

  // Load available permissions
  useEffect(() => {
    if (isOpen) {
      loadAvailablePermissions();
    }
  }, [isOpen]);

  const loadAvailablePermissions = async () => {
    try {
      const response = await fetch('/api/team/roles/permissions');
      if (response.ok) {
        const data = await response.json();
        setAvailablePermissions(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validation
      if (!formData.name.trim() || !formData.displayName.trim() ||
          !formData.indonesianTitle.trim()) {
        throw new Error('Name, display name, and Indonesian title are required');
      }

      if (formData.roleLevel < 1 || formData.roleLevel > 100) {
        throw new Error('Role level must be between 1 and 100');
      }

      const roleData = {
        ...formData,
        permissions: selectedPermissions
      };

      if (mode === 'clone' && role && onClone) {
        await onClone(role.id, roleData);
        setSuccess('Role cloned successfully!');
      } else {
        await onSave(roleData);
        setSuccess(mode === 'create' ? 'Role created successfully!' : 'Role updated successfully!');
      }

      // Close after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!role || !onDelete) return;

    if (role.memberCount && role.memberCount > 0) {
      setError('Cannot delete role that is assigned to team members');
      return;
    }

    if (!confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onDelete(role.id);
      setSuccess('Role deleted successfully!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete role');
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async () => {
    if (!role || !onClone) return;

    setLoading(true);
    setError(null);

    try {
      const cloneData = {
        ...formData,
        permissions: selectedPermissions
      };

      await onClone(role.id, cloneData);
      setSuccess('Role cloned successfully!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to clone role');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isEdit = mode === 'edit';
  const isCreate = mode === 'create';
  const isClone = mode === 'clone';
  const isSystemRole = role?.isSystem;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {isCreate && 'Create New Role'}
              {isEdit && `Edit Role: ${role?.displayName}`}
              {isClone && `Clone Role: ${role?.displayName}`}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-8 mt-4">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Role Details
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`pb-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'permissions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Permissions ({selectedPermissions.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-green-800">{success}</p>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Role Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., sales_manager"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Internal system name (no spaces, lowercase)
                  </p>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Sales Manager"
                    required
                  />
                </div>

                {/* Indonesian Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Indonesian Title *
                  </label>
                  <input
                    type="text"
                    value={formData.indonesianTitle}
                    onChange={(e) => setFormData({ ...formData, indonesianTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Manager Penjualan"
                    required
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department *
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>
                        {dept} ({INDONESIAN_DEPARTMENTS[dept as keyof typeof INDONESIAN_DEPARTMENTS]})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role Level (1-100) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.roleLevel}
                    onChange={(e) => setFormData({ ...formData, roleLevel: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    1 = Highest access, 100 = Lowest access
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the role's responsibilities and access level"
                />
              </div>

              {/* System Role Warning */}
              {isSystemRole && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <div>
                      <p className="text-yellow-800 font-medium">System Role</p>
                      <p className="text-yellow-700 text-sm">
                        This is a system role. Some fields may be restricted and permissions cannot be modified.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Member Count Warning */}
              {role && role.memberCount && role.memberCount > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    <strong>Note:</strong> This role is currently assigned to {role.memberCount} team member(s).
                    {isEdit && ' Changes will affect all assigned members.'}
                  </p>
                </div>
              )}
            </form>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <PermissionGrid
                roleId={role?.id}
                roleName={formData.displayName}
                isSystemRole={isSystemRole}
                initialPermissions={availablePermissions
                  .flatMap(cat => cat.permissions)
                  .map(p => ({
                    permissionId: p.id,
                    permissionCode: p.code,
                    permissionName: p.name,
                    category: availablePermissions.find(cat => cat.permissions.some(perm => perm.id === p.id))?.category || '',
                    description: p.description,
                    granted: selectedPermissions.includes(p.id)
                  }))
                }
                onPermissionsChange={(permissions) => setSelectedPermissions(permissions)}
                readOnly={isSystemRole}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isEdit && !isSystemRole && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading || (role.memberCount && role.memberCount > 0)}
                  className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              )}

              {isEdit && !isSystemRole && onClone && (
                <button
                  type="button"
                  onClick={handleClone}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-700"
                >
                  <Copy className="w-4 h-4" />
                  <span>Clone</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                disabled={loading || (activeTab === 'permissions' && selectedPermissions.length === 0)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>
                  {loading && 'Saving...'}
                  {!loading && isCreate && 'Create Role'}
                  {!loading && isEdit && 'Update Role'}
                  {!loading && isClone && 'Clone Role'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleEditor;