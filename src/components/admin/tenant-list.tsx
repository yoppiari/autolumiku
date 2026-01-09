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
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12.0003 2C6.47728 2 2.00028 6.477 2.00028 12C2.00028 13.844 2.47928 15.617 3.34428 17.172L2.00028 22L7.00028 20.732C8.50028 21.564 10.2003 22 12.0003 22C17.5233 22 22.0003 17.523 22.0003 12C22.0003 6.477 17.5233 2 12.0003 2ZM12.0003 3.7C16.5853 3.7 20.3003 7.415 20.3003 12C20.3003 16.585 16.5853 20.3 12.0003 20.3C10.5003 20.3 9.10028 19.9 7.80028 19.1L7.50028 18.9L4.40028 19.7L5.20028 16.7L5.00028 16.4C4.20028 15.1 3.70028 13.6 3.70028 12C3.70028 7.415 7.41528 3.7 12.0003 3.7Z" fill="#25D366" stroke="#25D366" strokeWidth="0.5" />
                          <path d="M16.6003 15.6C16.4003 15.5 15.3003 15 15.1003 14.9C14.9003 14.8 14.7003 14.8 14.6003 15C14.5003 15.2 14.1003 15.6 14.0003 15.7C13.9003 15.8 13.7003 15.8 13.5003 15.7C13.2003 15.6 12.4003 15.3 11.4003 14.4C10.7003 13.7 10.2003 12.9 10.0003 12.6C9.90028 12.4 10.0003 12.3 10.1003 12.2C10.2003 12.1 10.3003 12 10.4003 11.9C10.5003 11.8 10.5003 11.7 10.6003 11.5C10.7003 11.4 10.6003 11.2 10.6003 11.1C10.5003 10.9 10.1003 10 10.0003 9.6C9.80028 9.2 9.60028 9.3 9.50028 9.3C9.40028 9.3 9.20028 9.3 9.10028 9.3C9.00028 9.3 8.70028 9.3 8.50028 9.5C8.30028 9.7 7.80028 10.2 7.80028 11.2C7.80028 12.2 8.50028 13.1 8.60028 13.3C8.70028 13.4 10.2003 15.7 12.4003 16.6C16.0003 18.1 16.0003 17.6 16.3003 17.6C16.6003 17.6 17.3003 17.2 17.5003 16.7C17.6003 16.3 17.6003 15.9 17.6003 15.8C17.5003 15.7 17.3003 15.6 17.1003 15.6H16.6003Z" fill="#25D366" />
                          <circle cx="12.0003" cy="12" r="10" fill="#25D366" />
                          <path d="M16.6003 15.6C16.4003 15.5 15.3003 15 15.1003 14.9C14.9003 14.8 14.7003 14.8 14.6003 15C14.5003 15.2 14.1003 15.6 14.0003 15.7C13.9003 15.8 13.7003 15.8 13.5003 15.7C13.2003 15.6 12.4003 15.3 11.4003 14.4C10.7003 13.7 10.2003 12.9 10.0003 12.6C9.90028 12.4 10.0003 12.3 10.1003 12.2C10.2003 12.1 10.3003 12 10.4003 11.9C10.5003 11.8 10.5003 11.7 10.6003 11.5C10.7003 11.4 10.6003 11.2 10.6003 11.1C10.5003 10.9 10.1003 10 10.0003 9.6C9.80028 9.2 9.60028 9.3 9.50028 9.3C9.40028 9.3 9.20028 9.3 9.10028 9.3C9.00028 9.3 8.70028 9.3 8.50028 9.5C8.30028 9.7 7.80028 10.2 7.80028 11.2C7.80028 12.2 8.50028 13.1 8.60028 13.3C8.70028 13.4 10.2003 15.7 12.4003 16.6C16.0003 18.1 16.0003 17.6 16.3003 17.6C16.6003 17.6 17.3003 17.2 17.5003 16.7C17.6003 16.3 17.6003 15.9 17.6003 15.8C17.5003 15.7 17.3003 15.6 17.1003 15.6" fill="white" />
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