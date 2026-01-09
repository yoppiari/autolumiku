'use client';

import React, { useState, useEffect } from 'react';
import { Tenant, TenantStatus } from '@/types/tenant';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface TenantListProps {
  tenants: Tenant[];
  onTenantSelect?: (tenant: Tenant) => void;
  onTenantDelete?: (tenantId: string) => void;
  onTenantEdit?: (tenant: Tenant) => void;
}

const statusColors: Record<TenantStatus, string> = {
  'setup_required': 'bg-yellow-100 text-yellow-800',
  'active': 'bg-green-100 text-green-800',
  'suspended': 'bg-red-100 text-red-800',
  'deactivated': 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<TenantStatus, string> = {
  'setup_required': 'Setup Required',
  'active': 'Active',
  'suspended': 'Suspended',
  'deactivated': 'Deactivated',
};

export default function TenantList({
  tenants,
  onTenantSelect,
  onTenantDelete,
  onTenantEdit,
}: TenantListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | 'all'>('all');
  const [sortField, setSortField] = useState<keyof Tenant>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);

  // Filter and sort tenants
  const filteredTenants = tenants
    .filter(tenant => {
      const matchesSearch =
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.subdomain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (field: keyof Tenant) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTenants(filteredTenants.map(t => t.id));
    } else {
      setSelectedTenants([]);
    }
  };

  const handleSelectTenant = (tenantId: string, checked: boolean) => {
    if (checked) {
      setSelectedTenants([...selectedTenants, tenantId]);
    } else {
      setSelectedTenants(selectedTenants.filter(id => id !== tenantId));
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus tenant ini? Tindakan ini tidak dapat dibatalkan.')) {
      await onTenantDelete?.(tenantId);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTenants.length === 0) return;

    if (window.confirm(`Apakah Anda yakin ingin menghapus ${selectedTenants.length} tenant?`)) {
      for (const tenantId of selectedTenants) {
        await onTenantDelete?.(tenantId);
      }
      setSelectedTenants([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Manajemen Tenant</h2>
            <p className="text-sm text-gray-600 mt-1">
              Total {tenants.length} tenant • {tenants.filter(t => t.status === 'active').length} aktif
            </p>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => window.location.href = '/admin/tenants/create'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              + Buat Tenant Baru
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Cari tenant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TenantStatus | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="setup_required">Setup Required</option>
              <option value="suspended">Suspended</option>
              <option value="deactivated">Deactivated</option>
            </select>

            {selectedTenants.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Hapus ({selectedTenants.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tenant Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  NAMA TENANT
                  {sortField === 'name' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  DOMAIN
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  SUBDOMAIN
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  NO. WA AI
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('createdAt')}
                >
                  DIBUAT
                  {sortField === 'createdAt' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  AUDIT & QUICK ACTION
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  AKSI
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-blue-600 hover:underline cursor-pointer" onClick={() => onTenantSelect?.(tenant)}>
                          {tenant.name}
                        </span>
                        <div className="relative flex items-center">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full ${statusColors[tenant.status]}`}>
                            {(tenant.status === 'active' || tenant.status === 'suspended') && (
                              <span className={`flex h-1.5 w-1.5 rounded-full mr-1.5 ${tenant.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-600 animate-pulse'}`}></span>
                            )}
                            {statusLabels[tenant.status]}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        ID: {tenant.id.slice(0, 8)}...
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {tenant.customDomain ? (
                      <a
                        href={`https://${tenant.customDomain}/login`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {tenant.customDomain}
                      </a>
                    ) : (
                      <a
                        href={`https://${tenant.subdomain}.autolumiku.com/login`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {tenant.subdomain}.autolumiku.com
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 font-medium">{tenant.subdomain}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {tenant.waNumber ? (
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.031 6.172c-2.32 0-4.591 1.342-5.728 3.456-1.076 1.997-1.139 4.411-.165 6.467l-1.133 4.14 4.232-1.111c1.88.98 4.04 1.13 6.104.538 2.063-.592 3.86-1.928 5.01-3.722 1.15-1.794 1.484-3.951.93-6.04-.555-2.09-1.956-3.867-3.9-4.947-1.758-.973-3.774-1.282-5.35-1.282zm6.367 11.233c-.092.153-.418.337-.58.358-.16.021-.36.038-.592-.014-.234-.052-.51-.15-.812-.282-1.28-.557-2.146-1.854-2.21-1.94-.064-.085-.568-.755-.568-1.432 0-.677.354-1.008.48-1.144.126-.135.275-.17.367-.17.092 0 .184.001.265.005.085.004.2.015.313.284.116.275.4.966.435 1.033.033.07.056.15.01.242-.046.09-.098.156-.201.272-.104.117-.213.264-.304.354-.105.101-.215.21-.092.42.124.21.547.902 1.17 1.458.802.716 1.474.938 1.684 1.044.21.104.332.088.455-.05.123-.138.53-.618.67-.828.14-.21.282-.178.477-.107.194.072 1.234.582 1.446.688.213.107.354.16.406.25.052.09.052.522-.162.723zM12 2C6.477 2 2 6.477 2 12c0 1.91.536 3.692 1.465 5.213l-1.4 5.115 5.253-1.378C8.75 21.84 10.334 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                        </svg>
                        <span className="text-sm font-bold text-green-600 font-medium">{tenant.waNumber}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Not Connected</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-medium">
                      {format(new Date(tenant.createdAt), 'dd MMM yyyy', { locale: id })}
                    </div>
                    <div className="text-xs text-gray-400 uppercase tracking-tighter">
                      Created Date
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-2">
                        <a
                          href={tenant.customDomain ? `https://${tenant.customDomain}/dashboard/users` : `https://${tenant.subdomain}.autolumiku.com/dashboard/users`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          Lihat Users
                        </a>
                        <a
                          href={tenant.customDomain ? `https://${tenant.customDomain}/dashboard/vehicles` : `https://${tenant.subdomain}.autolumiku.com/dashboard/vehicles`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded border border-green-200 hover:bg-green-100 transition-colors"
                        >
                          Lihat Kendaraan
                        </a>
                      </div>
                      <div className="flex items-center space-x-2">
                        <a
                          href={tenant.customDomain ? `https://${tenant.customDomain}/dashboard/whatsapp-ai` : `https://${tenant.subdomain}.autolumiku.com/dashboard/whatsapp-ai`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded border border-purple-200 hover:bg-purple-100 transition-colors"
                        >
                          WhatsApp AI
                        </a>
                        <a
                          href={tenant.customDomain ? `https://${tenant.customDomain}/dashboard/whatsapp-ai/analytics` : `https://${tenant.subdomain}.autolumiku.com/dashboard/whatsapp-ai/analytics`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors"
                        >
                          Analytics
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onTenantSelect?.(tenant)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                      >
                        Detail
                      </button>
                      <button
                        onClick={() => onTenantEdit?.(tenant)}
                        className="text-indigo-600 hover:text-indigo-900 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTenant(tenant.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTenants.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500">
                {searchTerm || statusFilter !== 'all'
                  ? 'Tidak ada tenant yang cocok dengan filter Anda'
                  : 'Belum ada tenant yang dibuat'
                }
              </div>
              {(!searchTerm && statusFilter === 'all') && (
                <button
                  onClick={() => window.location.href = '/admin/tenants/create'}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Buat Tenant Pertama
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}