'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import TenantCreationForm from '@/components/admin/tenant-creation-form';
import TenantCreationSuccessModal from '@/components/admin/tenant-creation-success-modal';
import { CreateTenantRequest } from '@/types/tenant';
import { api } from '@/lib/api-client';

const generateRandomPassword = (): string => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

export default function CreateTenantPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [successData, setSuccessData] = useState<{
    tenantId: string;
    tenantName: string;
    tenantSubdomain: string;
    adminEmail: string;
    adminPassword: string;
  } | null>(null);

  const handleSubmit = async (data: CreateTenantRequest) => {
    try {
      setIsLoading(true);

      // Generate password if auto-generate is enabled
      const password = data.autoGeneratePassword
        ? generateRandomPassword()
        : data.adminPassword;

      // Call API to create tenant (server-side)
      const result = await api.post('/api/admin/tenants', {
        name: data.name,
        domain: data.domain, // Main domain field
        adminUser: {
          email: data.adminEmail,
          firstName: data.adminFirstName,
          lastName: data.adminLastName,
          phone: '', // Optional
        },
        adminPassword: password, // Include password
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create tenant');
      }

      // Show success message with credentials
      alert(
        `Tenant "${result.data.name}" berhasil dibuat!\n\n` +
        `Admin Login Credentials:\n` +
        `Email: ${data.adminEmail}\n` +
        `Password: ${password}\n\n` +
        `PENTING: Simpan password ini karena tidak akan ditampilkan lagi!`
      );

      // Redirect back to tenant list
      router.push('/admin/tenants');
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