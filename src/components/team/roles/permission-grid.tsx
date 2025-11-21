/**
 * Permission Grid Component
 * Interactive permission matrix for role management
 * Displays permissions grouped by category with toggle functionality
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, Shield, Users, Settings, Eye, Edit, Trash2, Copy } from 'lucide-react';

interface Permission {
  permissionId: string;
  permissionCode: string;
  permissionName: string;
  category: string;
  description: string;
  granted: boolean;
  isInherited?: boolean;
}

interface PermissionCategory {
  category: string;
  permissions: Permission[];
}

interface PermissionGridProps {
  roleId?: string;
  roleName?: string;
  isSystemRole?: boolean;
  initialPermissions?: Permission[];
  onPermissionsChange?: (permissions: string[]) => void;
  readOnly?: boolean;
  className?: string;
}

export const PermissionGrid: React.FC<PermissionGridProps> = ({
  roleId,
  roleName,
  isSystemRole = false,
  initialPermissions = [],
  onPermissionsChange,
  readOnly = false,
  className = ''
}) => {
  const [permissions, setPermissions] = useState<Permission[]>(initialPermissions);
  const [categories, setCategories] = useState<PermissionCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Group permissions by category
  useEffect(() => {
    const grouped = permissions.reduce((acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);

    const categoryList = Object.entries(grouped).map(([category, perms]) => ({
      category,
      permissions: perms.sort((a, b) => a.permissionName.localeCompare(b.permissionName))
    }));

    setCategories(categoryList);
  }, [permissions]);

  // Handle permission toggle
  const togglePermission = (permissionCode: string) => {
    if (readOnly || isSystemRole) return;

    const updatedPermissions = permissions.map(p =>
      p.permissionCode === permissionCode
        ? { ...p, granted: !p.granted }
        : p
    );

    setPermissions(updatedPermissions);
    const grantedPermissions = updatedPermissions
      .filter(p => p.granted)
      .map(p => p.permissionId);
    onPermissionsChange?.(grantedPermissions);
  });

  // Toggle all permissions in a category
  const toggleCategory = (category: string, grant: boolean) => {
    if (readOnly || isSystemRole) return;

    const updatedPermissions = permissions.map(p =>
      p.category === category
        ? { ...p, granted: grant }
        : p
    );

    setPermissions(updatedPermissions);
    const grantedPermissions = updatedPermissions
      .filter(p => p.granted)
      .map(p => p.permissionId);
    onPermissionsChange?.(grantedPermissions);
  };

  // Filter permissions based on search and selected categories
  const filteredCategories = categories.filter(cat => {
    const matchesSearch = searchTerm === '' ||
      cat.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.permissions.some(p =>
        p.permissionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesCategory = selectedCategories.length === 0 ||
      selectedCategories.includes(cat.category);

    return matchesSearch && matchesCategory;
  });

  // Get permission icon based on category
  const getPermissionIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'team':
        return <Users className="w-4 h-4" />;
      case 'inventory':
        return <Settings className="w-4 h-4" />;
      case 'billing':
        return <Shield className="w-4 h-4" />;
      case 'analytics':
        return <Eye className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  // Get category statistics
  const getCategoryStats = (category: PermissionCategory) => {
    const granted = category.permissions.filter(p => p.granted).length;
    const total = category.permissions.length;
    return { granted, total };
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Permission Matrix
            {roleName && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                for {roleName}
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-600">
            Configure role permissions by toggling individual permissions or entire categories
          </p>
        </div>

        {!readOnly && !isSystemRole && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const allPermissions = permissions.map(p => p.permissionId);
                onPermissionsChange?.(allPermissions);
                setPermissions(permissions.map(p => ({ ...p, granted: true })));
              }}
              className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200"
            >
              Grant All
            </button>
            <button
              onClick={() => {
                onPermissionsChange?.([]);
                setPermissions(permissions.map(p => ({ ...p, granted: false })));
              }}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
            >
              Revoke All
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat.category}
              onClick={() => {
                setSelectedCategories(prev =>
                  prev.includes(cat.category)
                    ? prev.filter(c => c !== cat.category)
                    : [...prev, cat.category]
                );
              }}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedCategories.includes(cat.category)
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.category}
            </button>
          ))}
        </div>
      </div>

      {/* Permission Categories */}
      <div className="space-y-4">
        {filteredCategories.map(category => {
          const stats = getCategoryStats(category);
          const allGranted = stats.granted === stats.total;
          const noneGranted = stats.granted === 0;

          return (
            <div key={category.category} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Category Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getPermissionIcon(category.category)}
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {category.category}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {stats.granted} of {stats.total} permissions granted
                      </p>
                    </div>
                  </div>

                  {!readOnly && !isSystemRole && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleCategory(category.category, true)}
                        disabled={allGranted}
                        className={`px-2 py-1 text-xs rounded ${
                          allGranted
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        Grant All
                      </button>
                      <button
                        onClick={() => toggleCategory(category.category, false)}
                        disabled={noneGranted}
                        className={`px-2 py-1 text-xs rounded ${
                          noneGranted
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        Revoke All
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Permission List */}
              <div className="divide-y divide-gray-200">
                {category.permissions.map(permission => (
                  <div
                    key={permission.permissionCode}
                    className={`px-4 py-3 hover:bg-gray-50 ${
                      readOnly || isSystemRole ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    onClick={() => togglePermission(permission.permissionCode)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                            permission.granted
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300'
                          }`}>
                            {permission.granted && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {permission.permissionName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {permission.description}
                            </p>
                            {permission.isInherited && (
                              <p className="text-xs text-blue-600">
                                Inherited from parent role
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {permission.permissionCode}
                        </code>
                        {permission.granted ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm || selectedCategories.length > 0
                ? 'No permissions match your search criteria'
                : 'No permissions available'}
            </p>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h4 className="font-medium text-blue-900">Permission Summary</h4>
        </div>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-bold text-blue-900">
              {permissions.filter(p => p.granted).length}
            </p>
            <p className="text-sm text-blue-700">Granted</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-600">
              {permissions.filter(p => !p.granted).length}
            </p>
            <p className="text-sm text-gray-600">Denied</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {categories.length}
            </p>
            <p className="text-sm text-gray-600">Categories</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {permissions.length}
            </p>
            <p className="text-sm text-gray-600">Total</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionGrid;