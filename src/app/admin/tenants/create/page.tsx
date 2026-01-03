'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TenantCreationForm from '@/components/admin/tenant-creation-form';
import TenantList from '@/components/admin/tenant-list';
import { CreateTenantRequest, Tenant } from '@/types/tenant';
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

  // Existing Tenants State (for reference list)
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);

  // Fetch tenants on mount
  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setIsListLoading(true);
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
          waNumber: t.aimeowAccount?.phoneNumber,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        }));
        setTenants(mappedTenants);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setIsListLoading(false);
    }
  };

  const handleTenantSelect = (tenant: Tenant) => {
    window.location.href = `/admin/tenants/${tenant.id}`;
  };

  const handleTenantEdit = (tenant: Tenant) => {
    window.location.href = `/admin/tenants/${tenant.id}/edit`;
  };

  const handleTenantDelete = async (tenantId: string) => {
    try {
      const data = await api.delete(`/api/admin/tenants/${tenantId}`);
      if (data.success) {
        setTenants(prev => prev.filter(t => t.id !== tenantId));
        alert('Tenant berhasil dihapus');
      } else {
        alert(data.error || 'Gagal menghapus tenant');
      }
    } catch (error) {
      console.error('Failed to delete tenant:', error);
      alert('Gagal menghapus tenant');
    }
  };

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

      // Refresh list instead of redirecting immediately, 
      // allowing user to see the new tenant in the list below if they want.
      // But user might expect redirect based on previous UX. 
      // Let's stick to redirecting to the main list as per standard practice,
      // creating a new one usually sends you back to index.
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
    <div className="space-y-8">
      {/* Creation Form */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Tenant</h1>
        <TenantCreationForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
      </div>

      <hr className="border-gray-200" />

      {/* Existing Tenants List (Reference) */}
      <div className="pt-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            Existing Tenants Reference
            <span className="ml-2 text-sm font-normal text-gray-500">
              (Live Data)
            </span>
          </h2>
          <button
            onClick={fetchTenants}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Refresh List
          </button>
        </div>

        {isListLoading ? (
          <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-500">Loading tenants...</p>
          </div>
        ) : (
          <TenantList
            tenants={tenants}
            onTenantSelect={handleTenantSelect}
            onTenantEdit={handleTenantEdit}
            onTenantDelete={handleTenantDelete}
          />
        )}
      </div>
    </div>
  );
}