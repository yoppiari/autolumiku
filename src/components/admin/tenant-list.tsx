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
  'setup_required': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  'active': 'bg-green-500/20 text-green-300 border border-green-500/30',
  'suspended': 'bg-red-500/20 text-red-300 border border-red-500/30',
  'deactivated': 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
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
      <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-sm border border-white/10 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-white">Manajemen Tenant</h2>
            <p className="text-sm text-gray-300 mt-1">
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
      <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-sm border border-white/10 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Cari tenant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TenantStatus | 'all')}
              className="px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
      <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-sm border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-[#0a3d47]">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-white/5"
                  onClick={() => handleSort('name')}
                >
                  NAMA TENANT
                  {sortField === 'name' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">
                  DOMAIN
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">
                  SUBDOMAIN
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">
                  NO. WA AI
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-white/5"
                  onClick={() => handleSort('createdAt')}
                >
                  DIBUAT
                  {sortField === 'createdAt' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">
                  AUDIT & QUICK ACTION
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-300 uppercase tracking-wider">
                  AKSI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer" onClick={() => onTenantSelect?.(tenant)}>
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
                        className="text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                      >
                        {tenant.customDomain}
                      </a>
                    ) : (
                      <a
                        href={`https://${tenant.subdomain}.autolumiku.com/login`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                      >
                        {tenant.subdomain}.autolumiku.com
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-white font-medium">{tenant.subdomain}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {tenant.waNumber ? (
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.988-1.355C8.425 21.476 10.155 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.582 0-3.064-.462-4.308-1.256l-.309-.184-3.198.868.853-3.126-.202-.32A7.93 7.93 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-300">{tenant.waNumber}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 italic">Not Connected</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white font-medium">
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
                          className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                        >
                          Lihat Users
                        </a>
                        <a
                          href={tenant.customDomain ? `https://${tenant.customDomain}/dashboard/vehicles` : `https://${tenant.subdomain}.autolumiku.com/dashboard/vehicles`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-0.5 bg-green-500/20 text-green-300 rounded border border-green-500/30 hover:bg-green-500/30 transition-colors"
                        >
                          Lihat Kendaraan
                        </a>
                      </div>
                      <div className="flex items-center space-x-2">
                        <a
                          href={tenant.customDomain ? `https://${tenant.customDomain}/dashboard/whatsapp-ai` : `https://${tenant.subdomain}.autolumiku.com/dashboard/whatsapp-ai`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
                        >
                          WhatsApp AI
                        </a>
                        <a
                          href={tenant.customDomain ? `https://${tenant.customDomain}/dashboard/whatsapp-ai/analytics` : `https://${tenant.subdomain}.autolumiku.com/dashboard/whatsapp-ai/analytics`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors"
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
                        className="text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        Detail
                      </button>
                      <button
                        onClick={() => onTenantEdit?.(tenant)}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTenant(tenant.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
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
              <div className="text-gray-400">
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
