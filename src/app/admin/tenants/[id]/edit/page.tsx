'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface TenantEditForm {
  name: string;
  slug: string;
  domain: string;
  primaryColor: string;
  secondaryColor: string;
  theme: string;
  status: string;
}

export default function TenantEditPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [formData, setFormData] = useState<TenantEditForm>({
    name: '',
    slug: '',
    domain: '',
    primaryColor: '#1a56db',
    secondaryColor: '#7c3aed',
    theme: 'light',
    status: 'active',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTenantData();
  }, [tenantId]);

  const fetchTenantData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/tenants/${tenantId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setFormData({
          name: data.data.name || '',
          slug: data.data.slug || '',
          domain: data.data.domain || '',
          primaryColor: data.data.primaryColor || '#1a56db',
          secondaryColor: data.data.secondaryColor || '#7c3aed',
          theme: data.data.theme || 'light',
          status: data.data.status || 'active',
        });
      } else {
        setError('Tenant not found');
      }
    } catch (error) {
      console.error('Error fetching tenant:', error);
      setError('Failed to load tenant data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        alert('Tenant berhasil diupdate!');
        router.push(`/admin/tenants/${tenantId}`);
      } else {
        setError(data.error || 'Failed to update tenant');
      }
    } catch (error) {
      console.error('Error updating tenant:', error);
      setError('Failed to update tenant');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof TenantEditForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          className="text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          ← Kembali ke Detail Tenant
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Edit Tenant</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Dasar</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nama Tenant <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
                Subdomain <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <input
                  type="text"
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <div className="px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-600">
                  .autolumiku.com
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                Custom Domain <span className="text-gray-500">(Opsional)</span>
              </label>
              <input
                type="text"
                id="domain"
                value={formData.domain}
                onChange={(e) => handleChange('domain', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="www.showroom.com"
              />
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800 font-medium mb-1">ℹ️ Petunjuk Setup Custom Domain:</p>
                <ol className="text-xs text-blue-700 space-y-1 ml-4 list-decimal">
                  <li>Buat CNAME record di DNS provider Anda yang mengarah ke: <code className="bg-blue-100 px-1 py-0.5 rounded">proxy.autolumiku.com</code></li>
                  <li>Tunggu propagasi DNS (biasanya 5-15 menit)</li>
                  <li>SSL certificate akan otomatis di-provision setelah domain terverifikasi</li>
                </ol>
              </div>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Branding</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 mb-1">
                Warna Utama
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  id="primaryColor"
                  value={formData.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="secondaryColor" className="block text-sm font-medium text-gray-700 mb-1">
                Warna Sekunder
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  id="secondaryColor"
                  value={formData.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="theme" className="block text-sm font-medium text-gray-700 mb-1">
                Tema
              </label>
              <select
                id="theme"
                value={formData.theme}
                onChange={(e) => handleChange('theme', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.push(`/admin/tenants/${tenantId}`)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={isSaving}
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
}
