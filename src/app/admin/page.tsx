'use client';

import React, { useState, useEffect } from 'react';
import TenantDashboard from '@/components/admin/tenant-dashboard';
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
];

export default function AdminDashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>(mockTenants);
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // In real implementation, this would fetch from API
      setTenants(mockTenants);
    } catch (error) {
      console.error('Failed to refresh tenants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TenantDashboard
      tenants={tenants}
      onRefresh={handleRefresh}
    />
  );
}