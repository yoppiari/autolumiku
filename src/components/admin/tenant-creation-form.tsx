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
  subdomain?: string;
  adminEmail?: string;
  adminFirstName?: string;
  adminLastName?: string;
  general?: string;
}

export default function TenantCreationForm({ onSubmit, onCancel, isLoading }: TenantCreationFormProps) {
  const [formData, setFormData] = useState<CreateTenantRequest>({
    name: '',
    subdomain: '',
    adminEmail: '',
    adminFirstName: '',
    adminLastName: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Nama tenant wajib diisi';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Nama tenant maksimal 100 karakter';
    }

    // Subdomain validation
    if (!formData.subdomain.trim()) {
      newErrors.subdomain = 'Subdomain wajib diisi';
    } else if (!/^[a-z0-9][a-z0-9-]*$/.test(formData.subdomain)) {
      newErrors.subdomain = 'Subdomain hanya boleh huruf kecil, angka, dan strip (-), dimulai dengan huruf';
    } else if (formData.subdomain.length < 3) {
      newErrors.subdomain = 'Subdomain minimal 3 karakter';
    } else if (formData.subdomain.length > 50) {
      newErrors.subdomain = 'Subdomain maksimal 50 karakter';
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
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error for this field when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const generateSubdomain = () => {
    if (formData.name) {
      const cleanName = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      setFormData(prev => ({ ...prev, subdomain: cleanName }));
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
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Contoh: Showroom Mobil Jakarta"
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Subdomain */}
            <div>
              <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700 mb-1">
                Subdomain <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <input
                  type="text"
                  id="subdomain"
                  value={formData.subdomain}
                  onChange={(e) => handleInputChange('subdomain', e.target.value)}
                  className={`flex-1 px-3 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.subdomain ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="showroom-mobil-jakarta"
                  disabled={isSubmitting}
                />
                <div className="px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-600">
                  .autolumiku.com
                </div>
              </div>
              {errors.subdomain && (
                <p className="mt-1 text-sm text-red-600">{errors.subdomain}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Subdomain akan digunakan untuk URL: https://subdomain.autolumiku.com
              </p>
              <button
                type="button"
                onClick={generateSubdomain}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                disabled={isSubmitting}
              >
                Generate dari nama tenant
              </button>
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
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.adminEmail ? 'border-red-500' : 'border-gray-300'
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
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.adminFirstName ? 'border-red-500' : 'border-gray-300'
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
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.adminLastName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Santoso"
                  disabled={isSubmitting}
                />
                {errors.adminLastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.adminLastName}</p>
                )}
              </div>
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