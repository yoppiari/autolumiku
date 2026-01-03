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
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${statusColors[tenant.status]}`}>
                          {statusLabels[tenant.status]}
                        </span>
                      </div>
                      <div className="flex flex-col text-[11px] text-gray-500">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">ID:</span> {tenant.id.slice(0, 8)}...
                        </div>
                        <div className="flex items-center gap-1 font-mono">
                          <span className="text-gray-400">URL:</span> {tenant.customDomain || `${tenant.subdomain}.autolumiku.com`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-medium">
                      {format(new Date(tenant.createdAt), 'dd MMM yyyy', { locale: id })}
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-tighter">
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
                          className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          Lihat Users
                        </a>
                        <a
                          href={tenant.customDomain ? `https://${tenant.customDomain}/dashboard/vehicles` : `https://${tenant.subdomain}.autolumiku.com/dashboard/vehicles`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-2 py-0.5 bg-green-50 text-green-600 rounded border border-green-200 hover:bg-green-100 transition-colors"
                        >
                          Lihat Kendaraan
                        </a>
                      </div>
                      <div className="flex items-center space-x-2">
                        <a
                          href={tenant.customDomain ? `https://${tenant.customDomain}/dashboard/whatsapp-ai` : `https://${tenant.subdomain}.autolumiku.com/dashboard/whatsapp-ai`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-600 rounded border border-purple-200 hover:bg-purple-100 transition-colors"
                        >
                          WhatsApp AI
                        </a>
                        <a
                          href={tenant.customDomain ? `https://${tenant.customDomain}/dashboard/whatsapp-ai/analytics` : `https://${tenant.subdomain}.autolumiku.com/dashboard/whatsapp-ai/analytics`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors"
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