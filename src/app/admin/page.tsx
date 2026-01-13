'use client';

import React, { useState, useEffect } from 'react';
import TenantDashboard from '@/components/admin/tenant-dashboard';
import { Tenant } from '@/types/tenant';
import { api } from '@/lib/api-client';

export default function AdminDashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTenants = async () => {
    try {
      setIsLoading(true);

      const data = await api.get('/api/admin/tenants');

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

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleRefresh = async () => {
    await fetchTenants();
  };

  return (
    <TenantDashboard
      tenants={tenants}
      onRefresh={handleRefresh}
    />
  );
}
