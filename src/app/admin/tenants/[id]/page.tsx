'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import ImageUpload from '@/components/admin/image-upload';
import { api } from '@/lib/api-client';

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

      const data = await api.get(`/api/admin/tenants/${tenantId}`);

      if (data.success && data.data) {
        setTenant(data.data);
      } else {
        throw new Error(data.error || 'Tenant not found');
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

    const data = await api.post(`/api/admin/tenants/${tenantId}/upload`, formData);

    if (!data.success) {
      throw new Error(data.error || 'Failed to upload logo');
    }

    // Update tenant state with new logo URL
    if (tenant && data.data) {
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

    const data = await api.post(`/api/admin/tenants/${tenantId}/upload`, formData);

    if (!data.success) {
      throw new Error(data.error || 'Failed to upload favicon');
    }

    // Update tenant state with new favicon URL
    if (tenant && data.data) {
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
          className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1 transition-colors"
        >
          ← Kembali ke Daftar Tenant
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white shadow-sm">{tenant.name}</h1>
            <p className="text-sm text-gray-400 mt-1 font-mono">ID: {tenant.id}</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => router.push(`/admin/tenants/${tenant.id}/edit`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20 border border-blue-500/50"
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
          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-sm border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">Informasi Dasar</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-400">Nama Tenant</dt>
                <dd className="mt-1 text-sm text-white font-medium">{tenant.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-400">Subdomain</dt>
                <dd className="mt-1 text-sm text-cyan-300 font-mono">
                  {tenant.slug}.autolumiku.com
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-400">Custom Domain</dt>
                <dd className="mt-1 text-sm text-white">
                  {tenant.domain ? (
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-cyan-300">{tenant.domain}</span>
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded border border-blue-500/30 bg-blue-500/20 text-blue-300">
                        Custom
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-500 italic">Tidak ada</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-400">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${tenant.status === 'active' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-gray-500/20 text-gray-300 border-gray-500/30'
                    }`}>
                    {tenant.status === 'active' ? 'Aktif' : tenant.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-400">Dibuat</dt>
                <dd className="mt-1 text-sm text-white">
                  {format(new Date(tenant.createdAt), 'dd MMMM yyyy, HH:mm', { locale: localeId })}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-400">Terakhir Diupdate</dt>
                <dd className="mt-1 text-sm text-white">
                  {format(new Date(tenant.updatedAt), 'dd MMMM yyyy, HH:mm', { locale: localeId })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Branding */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-sm border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">Branding</h2>

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <dt className="text-sm font-medium text-gray-400">Warna Utama</dt>
                  <dd className="mt-1 flex items-center space-x-2">
                    <div
                      className="w-8 h-8 rounded border border-white/20 shadow-sm"
                      style={{ backgroundColor: tenant.primaryColor }}
                    />
                    <span className="text-sm text-white font-mono">{tenant.primaryColor}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-400">Warna Sekunder</dt>
                  <dd className="mt-1 flex items-center space-x-2">
                    <div
                      className="w-8 h-8 rounded border border-white/20 shadow-sm"
                      style={{ backgroundColor: tenant.secondaryColor }}
                    />
                    <span className="text-sm text-white font-mono">{tenant.secondaryColor}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-400">Tema</dt>
                  <dd className="mt-1 text-sm text-white capitalize">{tenant.theme}</dd>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics */}
          {tenant._count && (
            <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-sm border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">Statistik</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <dt className="text-sm font-medium text-blue-300">Total User</dt>
                  <dd className="mt-1 text-3xl font-bold text-white">{tenant._count.users}</dd>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <dt className="text-sm font-medium text-green-300">Total Kendaraan</dt>
                  <dd className="mt-1 text-3xl font-bold text-white">{tenant._count.vehicles}</dd>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Subscription Info */}
          {tenant.subscription && (
            <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-sm border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">Subscription</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-400">Plan</dt>
                  <dd className="mt-1 text-sm text-white capitalize font-medium">{tenant.subscription.plan}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-400">Status</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${tenant.subscription.status === 'active' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                        tenant.subscription.status === 'trialing' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                          'bg-gray-500/20 text-gray-300 border-gray-500/30'
                      }`}>
                      {tenant.subscription.status === 'trialing' ? 'Trial' : tenant.subscription.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-400">Harga/Bulan</dt>
                  <dd className="mt-1 text-sm text-white font-mono">
                    Rp {tenant.subscription.pricePerMonth.toLocaleString('id-ID')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-400">Periode Saat Ini</dt>
                  <dd className="mt-1 text-sm text-white">
                    {format(new Date(tenant.subscription.currentPeriodStart), 'dd MMM yyyy', { locale: localeId })}
                    {' - '}
                    {format(new Date(tenant.subscription.currentPeriodEnd), 'dd MMM yyyy', { locale: localeId })}
                  </dd>
                </div>
                {tenant.subscription.trialEnd && (
                  <div>
                    <dt className="text-sm font-medium text-gray-400">Trial Berakhir</dt>
                    <dd className="mt-1 text-sm text-white">
                      {format(new Date(tenant.subscription.trialEnd), 'dd MMM yyyy', { locale: localeId })}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-sm border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">Quick Actions</h2>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-colors border border-transparent hover:border-white/5">
                Lihat Users
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-colors border border-transparent hover:border-white/5">
                Lihat Kendaraan
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 rounded-md transition-colors border border-transparent hover:border-white/5">
                Audit Logs
              </button>
              <hr className="my-2 border-white/10" />
              <button className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-md transition-colors border border-transparent hover:border-red-500/20">
                Deactivate Tenant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
