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

      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/tenants', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (data.success && data.data) {
        const mappedTenants: Tenant[] = data.data.map((t: any) => ({
          id: t.id,
          name: t.name,
          subdomain: t.slug,
          customDomain: t.domain || undefined,
          dbName: `autolumiku_tenant_${t.slug}`,
          status: t.status || 'active',
          adminUserId: t.createdBy,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        }));
        setTenants(mappedTenants);
      }
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

      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        // Remove tenant from list
        setTenants(prev => prev.filter(t => t.id !== tenantId));
        alert('Tenant berhasil dihapus');
      } else {
        alert(data.error || 'Gagal menghapus tenant');
      }
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