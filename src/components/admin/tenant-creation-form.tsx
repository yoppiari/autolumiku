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

  const generateRandomPassword = (): string => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
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
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Buat Tenant Baru</h2>
          <p className="text-sm text-gray-600 mt-1">
            Lengkapi form di bawah untuk membuat tenant baru di platform autolumiku
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* General Error */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
              {errors.general}
            </div>
          )}

          {/* Tenant Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
              Informasi Tenant
            </h3>

            {/* Tenant Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nama Tenant <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Contoh: Showroom Mobil Jakarta"
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Subdomain */}
              <div>
                <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700 mb-1">
                  Subdomain <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    id="subdomain"
                    value={formData.subdomain}
                    onChange={(e) => handleInputChange('subdomain', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="showroom-jakarta"
                    disabled={isSubmitting}
                  />
                  <span className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-r-md">
                    .autolumiku.com
                  </span>
                </div>
              </div>

              {/* Status */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                >
                  <option value="active">Active</option>
                  <option value="setup_required">Setup Required</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            {/* Domain (Custom Domain) */}
            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                Custom Domain <span className="text-gray-400 font-normal">(Opsional, ketik subdomain di atas jika tidak ada)</span>
              </label>
              <input
                type="text"
                id="domain"
                value={formData.domain}
                onChange={(e) => handleInputChange('domain', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.domain ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="showroom.com atau www.showroom.com"
                disabled={isSubmitting}
              />
              {errors.domain && (
                <p className="mt-1 text-sm text-red-600">{errors.domain}</p>
              )}
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800 font-medium mb-1">ℹ️ Petunjuk Setup Domain:</p>
                <ol className="text-xs text-blue-700 space-y-1 ml-4 list-decimal">
                  <li>Buat CNAME record di DNS provider Anda yang mengarah ke: <code className="bg-blue-100 px-1 py-0.5 rounded">proxy.autolumiku.com</code></li>
                  <li>Contoh: <code className="bg-blue-100 px-1 py-0.5 rounded">www.showroom.com</code> → <code className="bg-blue-100 px-1 py-0.5 rounded">proxy.autolumiku.com</code></li>
                  <li>Tunggu propagasi DNS (biasanya 5-15 menit)</li>
                  <li>SSL certificate akan otomatis di-provision setelah domain terverifikasi</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Admin Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
              Informasi Administrator
            </h3>

            {/* Admin Email */}
            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Email Administrator <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="adminEmail"
                value={formData.adminEmail}
                onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.adminEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="admin@showroom.com"
                disabled={isSubmitting}
              />
              {errors.adminEmail && (
                <p className="mt-1 text-sm text-red-600">{errors.adminEmail}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Admin First Name */}
              <div>
                <label htmlFor="adminFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Deppan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="adminFirstName"
                  value={formData.adminFirstName}
                  onChange={(e) => handleInputChange('adminFirstName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.adminFirstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  placeholder="Budi"
                  disabled={isSubmitting}
                />
                {errors.adminFirstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.adminFirstName}</p>
                )}
              </div>

              {/* Admin Last Name */}
              <div>
                <label htmlFor="adminLastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Belakang <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="adminLastName"
                  value={formData.adminLastName}
                  onChange={(e) => handleInputChange('adminLastName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.adminLastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  placeholder="Santoso"
                  disabled={isSubmitting}
                />
                {errors.adminLastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.adminLastName}</p>
                )}
              </div>
            </div>

            {/* Admin Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Password Administrator
              </label>

              {/* Auto-generate toggle */}
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="autoGeneratePassword"
                  checked={formData.autoGeneratePassword}
                  onChange={(e) => handleAutoGenerateToggle(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={isSubmitting}
                />
                <label htmlFor="autoGeneratePassword" className="ml-2 text-sm text-gray-700">
                  Auto-generate password yang aman (Rekomendasi)
                </label>
              </div>

              {!formData.autoGeneratePassword && (
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="adminPassword"
                    value={formData.adminPassword}
                    onChange={(e) => handleInputChange('adminPassword', e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.adminPassword ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Masukkan password (min. 8 karakter)"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                  {errors.adminPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.adminPassword}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Password harus minimal 8 karakter
                  </p>
                </div>
              )}

              {formData.autoGeneratePassword && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    ✓ Password akan di-generate otomatis dan dikirim via email ke administrator
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-4 space-y-4 sm:space-y-0 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Membuat Tenant...' : 'Buat Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}