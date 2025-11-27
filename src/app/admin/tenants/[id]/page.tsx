'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import ImageUpload from '@/components/admin/image-upload';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  status: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  theme: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  subscription?: {
    id: string;
    plan: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEnd?: string;
    pricePerMonth: number;
  };
  _count?: {
    users: number;
    vehicles: number;
  };
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTenantDetail();
  }, [tenantId]);

  const fetchTenantDetail = async () => {
    try {
      setIsLoading(true);

      // MOCK DATA - Replace with real API call when backend is ready
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay

      const mockTenants: Record<string, TenantDetail> = {
        '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed': {
          id: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed',
          name: 'Showroom Jakarta Premium',
          slug: 'showroom-jakarta',
          domain: undefined,
          status: 'active',
          logoUrl: undefined,
          faviconUrl: undefined,
          primaryColor: '#2563eb',
          secondaryColor: '#7c3aed',
          theme: 'light',
          createdAt: '2025-11-02T00:00:00Z',
          updatedAt: '2025-11-23T10:30:00Z',
          createdBy: 'f8e7d6c5-b4a3-4c5d-8e9f-1a2b3c4d5e6f',
          subscription: {
            id: 'sub-001',
            plan: 'enterprise',
            status: 'active',
            currentPeriodStart: '2025-11-27T00:00:00Z',
            currentPeriodEnd: '2026-11-27T00:00:00Z',
            pricePerMonth: 2500000,
          },
          _count: {
            users: 3,
            vehicles: 12,
          },
        },
        '5536722c-78e5-4dcd-9d35-d16858add414': {
          id: '5536722c-78e5-4dcd-9d35-d16858add414',
          name: 'Auto Center Surabaya',
          slug: 'autocenter-surabaya',
          domain: undefined,
          status: 'active',
          logoUrl: undefined,
          faviconUrl: undefined,
          primaryColor: '#059669',
          secondaryColor: '#0891b2',
          theme: 'light',
          createdAt: '2025-11-05T00:00:00Z',
          updatedAt: '2025-11-22T14:20:00Z',
          createdBy: 'a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d',
          subscription: {
            id: 'sub-002',
            plan: 'enterprise',
            status: 'active',
            currentPeriodStart: '2025-11-05T00:00:00Z',
            currentPeriodEnd: '2026-11-05T00:00:00Z',
            pricePerMonth: 2500000,
          },
          _count: {
            users: 2,
            vehicles: 8,
          },
        },
        '3a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d': {
          id: '3a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
          name: 'Dealer Mobil Bandung',
          slug: 'dealer-bandung',
          domain: 'dealerbandung.com',
          status: 'active',
          logoUrl: undefined,
          faviconUrl: undefined,
          primaryColor: '#dc2626',
          secondaryColor: '#ea580c',
          theme: 'light',
          createdAt: '2025-11-10T00:00:00Z',
          updatedAt: '2025-11-23T09:15:00Z',
          createdBy: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
          subscription: {
            id: 'sub-003',
            plan: 'enterprise',
            status: 'active',
            currentPeriodStart: '2025-11-10T00:00:00Z',
            currentPeriodEnd: '2026-11-10T00:00:00Z',
            pricePerMonth: 2500000,
          },
          _count: {
            users: 4,
            vehicles: 15,
          },
        },
      };

      const tenantData = mockTenants[tenantId];

      if (tenantData) {
        setTenant(tenantData);
      } else {
        throw new Error('Tenant not found');
      }
    } catch (error) {
      console.error('Error fetching tenant:', error);
      setError(error instanceof Error ? error.message : 'Failed to load tenant');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'logo');

    const response = await fetch(`/api/admin/tenants/${tenantId}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload logo');
    }

    const data = await response.json();

    // Update tenant state with new logo URL
    if (tenant) {
      setTenant({
        ...tenant,
        logoUrl: data.data.url,
      });
    }
  };

  const handleFaviconUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'favicon');

    const response = await fetch(`/api/admin/tenants/${tenantId}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload favicon');
    }

    const data = await response.json();

    // Update tenant state with new favicon URL
    if (tenant) {
      setTenant({
        ...tenant,
        faviconUrl: data.data.url,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-red-800 font-medium">Error</h3>
          <p className="text-red-600 text-sm mt-1">{error || 'Tenant not found'}</p>
          <button
            onClick={() => router.push('/admin/tenants')}
            className="mt-4 text-sm text-red-600 hover:text-red-800 underline"
          >
            Kembali ke Daftar Tenant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/tenants')}
          className="text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          ← Kembali ke Daftar Tenant
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{tenant.name}</h1>
            <p className="text-sm text-gray-600 mt-1">ID: {tenant.id}</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => router.push(`/admin/tenants/${tenant.id}/edit`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Edit Tenant
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Dasar</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Nama Tenant</dt>
                <dd className="mt-1 text-sm text-gray-900">{tenant.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Subdomain</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {tenant.slug}.autolumiku.com
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Custom Domain</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {tenant.domain ? (
                    <div className="flex items-center space-x-2">
                      <span>{tenant.domain}</span>
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                        Custom
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">Tidak ada</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {tenant.status === 'active' ? 'Aktif' : tenant.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Dibuat</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {format(new Date(tenant.createdAt), 'dd MMMM yyyy, HH:mm', { locale: localeId })}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Terakhir Diupdate</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {format(new Date(tenant.updatedAt), 'dd MMMM yyyy, HH:mm', { locale: localeId })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Branding */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Branding</h2>

            <div className="space-y-6">
              {/* Logo and Favicon Upload */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ImageUpload
                  label="Logo Tenant"
                  currentImageUrl={tenant.logoUrl}
                  onUpload={handleLogoUpload}
                  helpText="PNG, JPG, atau SVG (max 5MB)"
                />
                <ImageUpload
                  label="Favicon"
                  currentImageUrl={tenant.faviconUrl}
                  onUpload={handleFaviconUpload}
                  helpText="PNG, JPG, atau SVG (max 5MB) - Disarankan ukuran 32x32px"
                />
              </div>

              {/* Color Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Warna Utama</dt>
                  <dd className="mt-1 flex items-center space-x-2">
                    <div
                      className="w-8 h-8 rounded border border-gray-300"
                      style={{ backgroundColor: tenant.primaryColor }}
                    />
                    <span className="text-sm text-gray-900">{tenant.primaryColor}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Warna Sekunder</dt>
                  <dd className="mt-1 flex items-center space-x-2">
                    <div
                      className="w-8 h-8 rounded border border-gray-300"
                      style={{ backgroundColor: tenant.secondaryColor }}
                    />
                    <span className="text-sm text-gray-900">{tenant.secondaryColor}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Tema</dt>
                  <dd className="mt-1 text-sm text-gray-900 capitalize">{tenant.theme}</dd>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics */}
          {tenant._count && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistik</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <dt className="text-sm font-medium text-blue-600">Total User</dt>
                  <dd className="mt-1 text-3xl font-bold text-blue-900">{tenant._count.users}</dd>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <dt className="text-sm font-medium text-green-600">Total Kendaraan</dt>
                  <dd className="mt-1 text-3xl font-bold text-green-900">{tenant._count.vehicles}</dd>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Subscription Info */}
          {tenant.subscription && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Plan</dt>
                  <dd className="mt-1 text-sm text-gray-900 capitalize font-medium">{tenant.subscription.plan}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      tenant.subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                      tenant.subscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {tenant.subscription.status === 'trialing' ? 'Trial' : tenant.subscription.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Harga/Bulan</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    Rp {tenant.subscription.pricePerMonth.toLocaleString('id-ID')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Periode Saat Ini</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {format(new Date(tenant.subscription.currentPeriodStart), 'dd MMM yyyy', { locale: localeId })}
                    {' - '}
                    {format(new Date(tenant.subscription.currentPeriodEnd), 'dd MMM yyyy', { locale: localeId })}
                  </dd>
                </div>
                {tenant.subscription.trialEnd && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Trial Berakhir</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {format(new Date(tenant.subscription.trialEnd), 'dd MMM yyyy', { locale: localeId })}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
                Lihat Users
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
                Lihat Kendaraan
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
                Audit Logs
              </button>
              <hr className="my-2" />
              <button className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors">
                Deactivate Tenant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
