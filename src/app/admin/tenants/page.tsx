'use client';

import React, { useState, useEffect } from 'react';
import TenantList from '@/components/admin/tenant-list';
import { Tenant } from '@/types/tenant';

// Mock data for demonstration
const mockTenants: Tenant[] = [
  {
    id: 'tenant-1',
    name: 'Showroom Mobil Jakarta Pusat',
    subdomain: 'jakarta-pusat',
    dbName: 'autolumiku_tenant_tenant_1',
    status: 'active',
    adminUserId: 'admin-user-1',
    createdAt: new Date('2025-11-15T10:00:00Z'),
    updatedAt: new Date('2025-11-20T15:30:00Z'),
  },
  {
    id: 'tenant-2',
    name: 'Auto Center Surabaya',
    subdomain: 'auto-center-sby',
    dbName: 'autolumiku_tenant_tenant_2',
    status: 'setup_required',
    adminUserId: 'admin-user-2',
    createdAt: new Date('2025-11-18T14:00:00Z'),
    updatedAt: new Date('2025-11-18T14:00:00Z'),
  },
  {
    id: 'tenant-3',
    name: 'Berkah Motor Bandung',
    subdomain: 'berkah-motor',
    dbName: 'autolumiku_tenant_tenant_3',
    status: 'active',
    adminUserId: 'admin-user-3',
    createdAt: new Date('2025-11-12T09:00:00Z'),
    updatedAt: new Date('2025-11-19T11:15:00Z'),
  },
  {
    id: 'tenant-4',
    name: 'Mobil Sejahtera Medan',
    subdomain: 'mobil-sejahtera',
    dbName: 'autolumiku_tenant_tenant_4',
    status: 'suspended',
    adminUserId: 'admin-user-4',
    createdAt: new Date('2025-11-10T16:00:00Z'),
    updatedAt: new Date('2025-11-17T13:45:00Z'),
  },
];

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>(mockTenants);
  const [isLoading, setIsLoading] = useState(false);

  const handleTenantSelect = (tenant: Tenant) => {
    // Navigate to tenant detail page
    window.location.href = `/admin/tenants/${tenant.id}`;
  };

  const handleTenantEdit = (tenant: Tenant) => {
    // Navigate to edit page
    window.location.href = `/admin/tenants/${tenant.id}/edit`;
  };

  const handleTenantDelete = async (tenantId: string) => {
    try {
      setIsLoading(true);

      // Simulate API call to delete tenant
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Remove tenant from list
      setTenants(prev => prev.filter(t => t.id !== tenantId));

      // Show success message
      alert('Tenant berhasil dihapus');
    } catch (error) {
      console.error('Failed to delete tenant:', error);
      alert('Gagal menghapus tenant');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <TenantList
        tenants={tenants}
        onTenantSelect={handleTenantSelect}
        onTenantEdit={handleTenantEdit}
        onTenantDelete={handleTenantDelete}
      />
    </div>
  );
}