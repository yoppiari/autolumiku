'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import TenantCreationForm from '@/components/admin/tenant-creation-form';
import { CreateTenantRequest } from '@/types/tenant';
import { tenantService } from '@/services/tenant-service';

export default function CreateTenantPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: CreateTenantRequest) => {
    try {
      setIsLoading(true);

      // Create tenant using the service
      const tenant = await tenantService.createTenant(data);

      // Show success message
      alert(`Tenant "${tenant.name}" berhasil dibuat!`);

      // Redirect to tenant detail page
      router.push(`/admin/tenants/${tenant.id}`);
    } catch (error) {
      console.error('Failed to create tenant:', error);
      throw error; // Let the form handle the error display
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/admin/tenants');
  };

  return (
    <div>
      <TenantCreationForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
      />
    </div>
  );
}