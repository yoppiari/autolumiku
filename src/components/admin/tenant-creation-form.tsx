'use client';

import React, { useState } from 'react';
import { CreateTenantRequest } from '@/types/tenant';

interface TenantCreationFormProps {
  onSubmit: (data: CreateTenantRequest) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

interface FormErrors {
  name?: string;
  domain?: string;
  adminEmail?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminPassword?: string;
  general?: string;
}

export default function TenantCreationForm({ onSubmit, onCancel, isLoading }: TenantCreationFormProps) {
  const [formData, setFormData] = useState<CreateTenantRequest>({
    name: '',
    domain: '',
    subdomain: '',
    status: 'active',
    adminEmail: '',
    adminFirstName: '',
    adminLastName: '',
    adminPassword: '',
    autoGeneratePassword: true,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Nama tenant wajib diisi';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Nama tenant maksimal 100 karakter';
    }

    // Subdomain validation
    if (!formData.subdomain?.trim()) {
      newErrors.domain = 'Subdomain wajib diisi';
    } else if (formData.subdomain.length > 50) {
      newErrors.domain = 'Subdomain maksimal 50 karakter';
    }

    // Domain validation (optional)
    if (formData.domain.trim()) {
      const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
      if (!domainRegex.test(formData.domain.trim())) {
        newErrors.domain = 'Format domain tidak valid (contoh: showroom.com)';
      }
    }

    // Email validation
    if (!formData.adminEmail.trim()) {
      newErrors.adminEmail = 'Email admin wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {
      newErrors.adminEmail = 'Format email tidak valid';
    }

    // First name validation
    if (!formData.adminFirstName.trim()) {
      newErrors.adminFirstName = 'Nama depan admin wajib diisi';
    } else if (formData.adminFirstName.length > 50) {
      newErrors.adminFirstName = 'Nama depan maksimal 50 karakter';
    }

    // Last name validation
    if (!formData.adminLastName.trim()) {
      newErrors.adminLastName = 'Nama belakang admin wajib diisi';
    } else if (formData.adminLastName.length > 50) {
      newErrors.adminLastName = 'Nama belakang maksimal 50 karakter';
    }

    // Password validation (only if not auto-generate)
    if (!formData.autoGeneratePassword) {
      if (!formData.adminPassword || formData.adminPassword.trim() === '') {
        newErrors.adminPassword = 'Password wajib diisi jika tidak auto-generate';
      } else if (formData.adminPassword.length < 8) {
        newErrors.adminPassword = 'Password minimal 8 karakter';
      } else if (formData.adminPassword.length > 50) {
        newErrors.adminPassword = 'Password maksimal 50 karakter';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAutoGenerateToggle = (checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        autoGeneratePassword: true,
        adminPassword: '',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        autoGeneratePassword: false,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Tenant creation failed:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'Gagal membuat tenant. Silakan coba lagi.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CreateTenantRequest, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };

      // Auto-generate subdomain from name if subdomain is still empty or looks like a default slug
      if (field === 'name' && (!prev.subdomain || prev.subdomain === prev.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))) {
        newData.subdomain = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }

      return newData;
    });

    // Clear error for this field when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white/5 rounded-lg shadow-sm border border-white/10 backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Buat Tenant Baru</h2>
          <p className="text-sm text-gray-400 mt-1">
            Lengkapi form di bawah untuk membuat tenant baru di platform autolumiku
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* General Error */}
          {errors.general && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-md mb-6">
              {errors.general}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left Column: Tenant Information */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2">
                Informasi Tenant
              </h3>

              {/* Tenant Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-300 mb-1 leading-tight">
                  Nama Tenant <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 bg-[#0a3d47] border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-gray-500 transition-all ${errors.name ? 'border-red-500/50 bg-red-900/20' : 'border-white/10'}`}
                  placeholder="Contoh: Showroom Mobil Jakarta"
                  disabled={isSubmitting}
                />
                {errors.name && <p className="mt-1 text-xs text-red-400 font-medium">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Subdomain */}
                <div>
                  <label htmlFor="subdomain" className="block text-sm font-semibold text-gray-300 mb-1">
                    Subdomain <span className="text-red-400">*</span>
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      id="subdomain"
                      value={formData.subdomain}
                      onChange={(e) => handleInputChange('subdomain', e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-l-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-gray-500 z-10"
                      placeholder="showroom-jakarta"
                      disabled={isSubmitting}
                    />
                    <span className="inline-flex items-center px-2 py-2 border border-l-0 border-white/10 bg-white/5 text-gray-400 text-[10px] md:text-xs rounded-r-md whitespace-nowrap overflow-hidden">
                      .autolumiku.com
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label htmlFor="status" className="block text-sm font-semibold text-gray-300 mb-1">
                    Status <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
                    disabled={isSubmitting}
                  >
                    <option value="active" className="bg-[#0a3d47]">Active</option>
                    <option value="setup_required" className="bg-[#0a3d47]">Setup Required</option>
                    <option value="inactive" className="bg-[#0a3d47]">Inactive</option>
                    <option value="suspended" className="bg-[#0a3d47]">Suspended</option>
                  </select>
                </div>
              </div>

              {/* Domain (Custom Domain) */}
              <div>
                <label htmlFor="domain" className="block text-sm font-semibold text-gray-300 mb-1">
                  Custom Domain <span className="text-gray-500 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  id="domain"
                  value={formData.domain}
                  onChange={(e) => handleInputChange('domain', e.target.value)}
                  className={`w-full px-3 py-2 bg-[#0a3d47] border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-gray-500 transition-all ${errors.domain ? 'border-red-500/50' : 'border-white/10'}`}
                  placeholder="showroom.com"
                  disabled={isSubmitting}
                />

                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-[11px] text-blue-300 font-bold mb-1 uppercase tracking-wider">ℹ️ Setup Guide:</p>
                  <p className="text-[10px] text-blue-200 leading-relaxed">
                    Point CNAME <code className="bg-white/10 px-1 rounded text-blue-100">www</code> to <code className="bg-white/10 px-1 rounded text-blue-100">proxy.autolumiku.com</code>.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Admin Information */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2">
                Informasi Administrator
              </h3>

              {/* Admin Email */}
              <div>
                <label htmlFor="adminEmail" className="block text-sm font-semibold text-gray-300 mb-1">
                  Email Administrator <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  id="adminEmail"
                  value={formData.adminEmail}
                  onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                  className={`w-full px-3 py-2 bg-[#0a3d47] border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-gray-500 transition-all ${errors.adminEmail ? 'border-red-500/50' : 'border-white/10'}`}
                  placeholder="admin@showroom.com"
                  disabled={isSubmitting}
                />
                {errors.adminEmail && <p className="mt-1 text-xs text-red-400 font-medium">{errors.adminEmail}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Admin First Name */}
                <div>
                  <label htmlFor="adminFirstName" className="block text-sm font-semibold text-gray-300 mb-1">
                    Nama Depan <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="adminFirstName"
                    value={formData.adminFirstName}
                    onChange={(e) => handleInputChange('adminFirstName', e.target.value)}
                    className={`w-full px-3 py-2 bg-[#0a3d47] border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-gray-500 ${errors.adminFirstName ? 'border-red-500/50' : 'border-white/10'}`}
                    placeholder="Budi"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Admin Last Name */}
                <div>
                  <label htmlFor="adminLastName" className="block text-sm font-semibold text-gray-300 mb-1">
                    Nama Belakang <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="adminLastName"
                    value={formData.adminLastName}
                    onChange={(e) => handleInputChange('adminLastName', e.target.value)}
                    className={`w-full px-3 py-2 bg-[#0a3d47] border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-gray-500 ${errors.adminLastName ? 'border-red-500/50' : 'border-white/10'}`}
                    placeholder="Santoso"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Admin Password */}
              <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                <label className="block text-sm font-bold text-white mb-3">
                  Akses Login
                </label>

                <div className="flex items-center mb-4 p-2 bg-[#0a3d47] rounded-lg border border-white/10 shadow-sm">
                  <input
                    type="checkbox"
                    id="autoGeneratePassword"
                    checked={formData.autoGeneratePassword}
                    onChange={(e) => handleAutoGenerateToggle(e.target.checked)}
                    className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-white/10 rounded cursor-pointer bg-white/10"
                    disabled={isSubmitting}
                  />
                  <label htmlFor="autoGeneratePassword" className="ml-3 text-sm text-gray-300 font-medium cursor-pointer">
                    Auto-generate password aman (Disarankan)
                  </label>
                </div>

                {!formData.autoGeneratePassword && (
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="adminPassword"
                      value={formData.adminPassword}
                      onChange={(e) => handleInputChange('adminPassword', e.target.value)}
                      className={`w-full px-3 py-2 pr-10 bg-[#0a3d47] border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-gray-500 ${errors.adminPassword ? 'border-red-500/50' : 'border-white/10'}`}
                      placeholder="Min. 8 karakter"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                    >
                      {showPassword ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      )}
                    </button>
                    {errors.adminPassword && <p className="mt-1 text-xs text-red-400 font-medium">{errors.adminPassword}</p>}
                  </div>
                )}

                {formData.autoGeneratePassword && (
                  <div className="p-3 bg-green-500/10 rounded-lg flex items-start gap-2 border border-green-500/20">
                    <span className="text-green-400 text-sm">✅</span>
                    <p className="text-[10px] text-green-300 font-medium">
                      Password akan dibuat otomatis dan ditampilkan setelah berhasil dibuat.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-4 space-y-3 sm:space-y-0 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 border border-white/10 rounded-lg text-sm font-bold text-gray-300 bg-white/5 hover:bg-white/10 transition-all active:scale-95"
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="px-8 py-2.5 border border-transparent rounded-lg shadow-lg text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 shadow-cyan-900/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses...' : 'Daftarkan Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}