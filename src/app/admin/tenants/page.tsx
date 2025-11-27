'use client';

import React, { useState, useEffect } from 'react';
import TenantList from '@/components/admin/tenant-list';
import { Tenant } from '@/types/tenant';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch tenants from API
  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setIsLoading(true);

      // MOCK DATA - Replace with real API call when backend is ready
      // const response = await fetch('/api/admin/tenants');
      // const data = await response.json();

      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay

      const mockTenants: Tenant[] = [
        {
          id: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed',
          name: 'Showroom Jakarta Premium',
          subdomain: 'showroom-jakarta',
          customDomain: undefined,
          dbName: 'autolumiku_tenant_showroom-jakarta',
          status: 'active',
          adminUserId: 'f8e7d6c5-b4a3-4c5d-8e9f-1a2b3c4d5e6f',
          createdAt: new Date('2025-11-02T00:00:00Z'),
          updatedAt: new Date('2025-11-23T10:30:00Z'),
        },
        {
          id: '5536722c-78e5-4dcd-9d35-d16858add414',
          name: 'Auto Center Surabaya',
          subdomain: 'autocenter-surabaya',
          customDomain: undefined,
          dbName: 'autolumiku_tenant_autocenter-surabaya',
          status: 'active',
          adminUserId: 'a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d',
          createdAt: new Date('2025-11-05T00:00:00Z'),
          updatedAt: new Date('2025-11-22T14:20:00Z'),
        },
        {
          id: '3a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
          name: 'Dealer Mobil Bandung',
          subdomain: 'dealer-bandung',
          customDomain: 'dealerbandung.com',
          dbName: 'autolumiku_tenant_dealer-bandung',
          status: 'active',
          adminUserId: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
          createdAt: new Date('2025-11-10T00:00:00Z'),
          updatedAt: new Date('2025-11-23T09:15:00Z'),
        },
      ];

      setTenants(mockTenants);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setIsLoading(false);
    }
  };

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