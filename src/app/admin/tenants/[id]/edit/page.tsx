'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ImageUpload from '@/components/admin/image-upload';
import { api } from '@/lib/api-client';

interface TenantEditForm {
  name: string;
  slug: string;
  domain: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  theme: string;
  status: string;
}

interface TenantUpdateResponse {
  success: boolean;
  data: any;
  message?: string;
  error?: string;
  traefikSynced?: string;
  traefikError?: string;
  details?: string;
}

export default function TenantEditPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [formData, setFormData] = useState<TenantEditForm>({
    name: '',
    slug: '',
    domain: '',
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#1a56db',
    secondaryColor: '#7c3aed',
    theme: 'light',
    status: 'active',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchTenantData();
  }, [tenantId]);

  const fetchTenantData = async () => {
    try {
      setIsLoading(true);

      const data = await api.get(`/api/admin/tenants/${tenantId}`);

      if (data.success && data.data) {
        const tenant = data.data;
        setFormData({
          name: tenant.name || '',
          slug: tenant.slug || '',
          domain: tenant.domain || '',
          logoUrl: tenant.logoUrl || '',
          faviconUrl: tenant.faviconUrl || '',
          primaryColor: tenant.primaryColor || '#1a56db',
          secondaryColor: tenant.secondaryColor || '#7c3aed',
          theme: tenant.theme || 'light',
          status: tenant.status || 'active',
        });
      } else {
        setError(data.error || 'Tenant not found');
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
    setErrorDetails(null);
    setSyncStatus(null);

    try {
      const data = await api.put(`/api/admin/tenants/${tenantId}`, formData) as TenantUpdateResponse;

      if (data.success) {
        // Show sync status if domain was changed
        if (data.traefikSynced === 'success') {
          setSyncStatus('Traefik configuration synced successfully!');
        } else if (data.traefikSynced === 'failed') {
          setSyncStatus('Warning: Traefik sync failed. Please sync manually.');
          if (data.traefikError) setErrorDetails(data.traefikError);
        }

        alert('Tenant berhasil diupdate!' + (data.traefikSynced === 'success' ? ' Domain dikonfigurasi di Traefik.' : ''));
        router.push(`/admin/tenants/${tenantId}`);
      } else {
        setError(data.error || 'Failed to update tenant');
        if (data.details) setErrorDetails(data.details);
      }
    } catch (error: any) {
      console.error('Error updating tenant:', error);
      setError('Failed to update tenant');
      setErrorDetails(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    setError(null);
    setErrorDetails(null);

    try {
      const data = await api.post('/api/admin/tenants/sync-traefik', {}) as TenantUpdateResponse;

      if (data.success) {
        setSyncStatus('✅ Traefik configuration synced successfully!');
        alert('Traefik synced! All tenant domains are now configured.');
      } else {
        setError(data.error || 'Failed to sync Traefik');
        if (data.details) setErrorDetails(data.details);
      }
    } catch (error: any) {
      console.error('Error syncing Traefik:', error);
      setError('Failed to sync Traefik configuration');
      setErrorDetails(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleChange = (field: keyof TenantEditForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const logoUrl = reader.result as string;
      setFormData(prev => ({ ...prev, logoUrl }));
    };
    reader.readAsDataURL(file);
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  const handleFaviconUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const faviconUrl = reader.result as string;
      setFormData(prev => ({ ...prev, faviconUrl }));
    };
    reader.readAsDataURL(file);
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          className="group flex items-center text-sm text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
          Kembali ke Detail Tenant
        </button>
        <h1 className="text-3xl font-bold text-white tracking-tight shadow-sm">Edit Tenant</h1>
        <p className="text-gray-400 mt-1">Kelola konfigurasi, branding, dan domain untuk showroom ini.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Error Notification */}
        {error && (
          <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-red-500 text-xl font-bold">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-bold text-red-300">{error}</h3>
                {errorDetails && (
                  <div className="mt-2 text-xs text-red-300 font-mono bg-red-500/10 p-2 rounded border border-red-500/20 overflow-x-auto max-h-32">
                    {errorDetails}
                  </div>
                )}
                <p className="mt-2 text-xs text-red-400 italic">
                  Database tenant tetap diupdate, namun sinkronisasi jaringan (Traefik) terkendala.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success/Sync Notification */}
        {syncStatus && (
          <div className="bg-green-500/10 border-l-4 border-green-500 p-4 rounded-r-lg shadow-sm">
            <div className="flex">
              <span className="text-green-500 mr-3">✅</span>
              <p className="text-sm font-medium text-green-300">{syncStatus}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Column 1: Core Configuration */}
          <div className="space-y-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-sm border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 border-b border-white/10">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Informasi Dasar
                </h2>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-bold text-gray-300 mb-1.5 leading-tight">
                    Nama Tenant <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0a3d47] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white transition-all shadow-sm placeholder-gray-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="slug" className="block text-sm font-bold text-gray-300 mb-1.5 leading-tight">
                    Subdomain (Slug) <span className="text-red-400">*</span>
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => handleChange('slug', e.target.value)}
                      className="flex-1 min-w-0 px-4 py-2.5 bg-[#0a3d47] border border-white/10 border-r-0 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white transition-all shadow-sm font-mono z-10 placeholder-gray-500"
                      placeholder="primamobil-id"
                      required
                    />
                    <span className="inline-flex items-center px-3 py-2 border border-white/10 bg-white/5 text-gray-400 text-[10px] md:text-sm rounded-r-xl whitespace-nowrap overflow-hidden font-medium">
                      .autolumiku.com
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1.5 px-1 font-medium italic">
                    Contoh: auto.lumiku.com/catalog/primamobil-id
                  </p>
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-bold text-gray-300 mb-1.5">
                    Status Operasional
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0a3d47] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white transition-all shadow-sm font-medium"
                  >
                    <option value="active" className="bg-[#0a3d47] text-white">Aktif (Online)</option>
                    <option value="inactive" className="bg-[#0a3d47] text-white">Tidak Aktif</option>
                    <option value="suspended" className="bg-[#0a3d47] text-white">Suspended (Blokir)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-sm border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 border-b border-white/10">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  Konfigurasi Domain & Jaringan
                </h2>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label htmlFor="domain" className="block text-sm font-bold text-gray-300 mb-1.5 leading-tight">
                    Custom Domain / Hostname <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="domain"
                      value={formData.domain}
                      onChange={(e) => handleChange('domain', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#0a3d47] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-cyan-400 font-mono font-bold transition-all shadow-sm placeholder-gray-600"
                      placeholder="primamobil.id"
                      required
                    />
                    <div className="absolute right-3 top-2.5 text-cyan-500">🌐</div>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                  <h3 className="text-[11px] font-black text-blue-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    🚀 DNS Setup Guide
                  </h3>
                  <ul className="text-[10px] text-blue-200 space-y-2 font-medium">
                    <li className="flex items-start gap-2">
                      <span className="pt-0.5">1.</span>
                      <span>Arahkan A Record / CNAME domain Anda ke IP server platform.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="pt-0.5">2.</span>
                      <span>Setelah domain mengarah ke server, klik tombol Sync Traefik di bawah.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="pt-0.5">3.</span>
                      <span>SSL (HTTPS) akan otomatis diaktifkan dalam waktu ~2 menit.</span>
                    </li>
                  </ul>

                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white border border-transparent rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 font-bold text-xs disabled:opacity-50 active:scale-95"
                  >
                    {isSyncing ? '🔄 Sedang Sinkronisasi...' : '🔄 Sinkronisasi Traefik (Manual)'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Visual Branding */}
          <div className="space-y-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-sm border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 border-b border-white/10">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  Visual Branding & Media
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <ImageUpload
                    label="Logo Showroom"
                    currentImageUrl={formData.logoUrl}
                    onUpload={handleLogoUpload}
                    helpText="Format: PNG/SVG (Max 2MB)"
                  />
                  <ImageUpload
                    label="Favicon Browser"
                    currentImageUrl={formData.faviconUrl}
                    onUpload={handleFaviconUpload}
                    helpText="Ukuran: 32x32px (ICO/PNG)"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl shadow-sm border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 border-b border-white/10">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                  Warna & Tema Portal
                </h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="primaryColor" className="block text-sm font-bold text-gray-300 mb-2 leading-tight">
                      Warna Utama
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        id="primaryColor"
                        value={formData.primaryColor}
                        onChange={(e) => handleChange('primaryColor', e.target.value)}
                        className="h-12 w-16 border border-white/10 rounded-xl cursor-pointer p-0 bg-transparent"
                      />
                      <input
                        type="text"
                        value={formData.primaryColor}
                        onChange={(e) => handleChange('primaryColor', e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-xl text-sm font-mono uppercase text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="secondaryColor" className="block text-sm font-bold text-gray-300 mb-2 leading-tight">
                      Warna Sekunder
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        id="secondaryColor"
                        value={formData.secondaryColor}
                        onChange={(e) => handleChange('secondaryColor', e.target.value)}
                        className="h-12 w-16 border border-white/10 rounded-xl cursor-pointer p-0 bg-transparent"
                      />
                      <input
                        type="text"
                        value={formData.secondaryColor}
                        onChange={(e) => handleChange('secondaryColor', e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-xl text-sm font-mono uppercase text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="theme" className="block text-sm font-bold text-gray-300 mb-2">
                    Mode Tampilan Default
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleChange('theme', 'light')}
                      className={`px-4 py-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${formData.theme === 'light' ? 'bg-blue-500/20 border-blue-500 ring-1 ring-blue-500' : 'bg-white/5 border-white/10 hover:border-blue-500/50'}`}
                    >
                      <span className="text-xl">☀️</span>
                      <span className={`text-xs font-bold ${formData.theme === 'light' ? 'text-blue-400' : 'text-gray-400'}`}>Light Mode</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange('theme', 'dark')}
                      className={`px-4 py-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${formData.theme === 'dark' ? 'bg-indigo-500/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white/5 border-white/10 hover:border-indigo-500/50'}`}
                    >
                      <span className="text-xl">🌙</span>
                      <span className={`text-xs font-bold ${formData.theme === 'dark' ? 'text-indigo-400' : 'text-gray-400'}`}>Dark Mode</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-8 border-t border-white/10">
          <button
            type="button"
            onClick={() => router.push(`/admin/tenants/${tenantId}`)}
            className="w-full sm:w-auto px-8 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-gray-300 hover:bg-white/10 transition-all active:scale-95 shadow-sm"
            disabled={isSaving}
          >
            Batal
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto px-12 py-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-900/20 active:scale-95 disabled:opacity-50 text-sm font-black uppercase tracking-wider"
            disabled={isSaving}
          >
            {isSaving ? 'Menyimpan Perubahan...' : 'Simpan & Update Konfigurasi'}
          </button>
        </div>
      </form>
    </div>
  );
}
