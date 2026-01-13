/**
 * Create User Page
 * Admin interface for creating new platform users
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';

interface CreateUserForm {
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'admin' | 'manager' | 'staff';
  tenantId?: string;
  password: string;
  confirmPassword: string;
  emailVerified: boolean;
  isActive: boolean;
  phone?: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export default function CreateUserPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [formData, setFormData] = useState<CreateUserForm>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'staff',
    tenantId: '',
    password: '',
    confirmPassword: '',
    emailVerified: true,
    isActive: true,
    phone: '',
  });

  // Fetch active tenants from API
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const data = await api.get('/api/admin/tenants');
        if (data.success && data.data) {
          setTenants(data.data);
        }
      } catch (error) {
        console.error('Failed to load tenants:', error);
      }
    };

    fetchTenants();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      };

      // If role becomes super_admin or admin, clear tenantId
      if (name === 'role' && (value === 'super_admin' || value === 'admin')) {
        newData.tenantId = '';
      }

      return newData;
    });
  };

  const validateForm = () => {
    const errors: string[] = [];

    if (!formData.email) errors.push('Email wajib diisi');
    if (!formData.firstName) errors.push('Nama depan wajib diisi');
    if (!formData.lastName) errors.push('Nama belakang wajib diisi');
    if (!formData.password) errors.push('Password wajib diisi');
    if (formData.password.length < 8) errors.push('Password minimal 8 karakter');
    if (formData.password !== formData.confirmPassword) errors.push('Password dan konfirmasi tidak cocok');

    // Tenant requirement check
    if ((formData.role === 'manager' || formData.role === 'staff') && !formData.tenantId) {
      errors.push('Tenant wajib dipilih untuk role Manager atau Staff');
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      alert('Error:\n' + errors.join('\n'));
      return;
    }

    setIsLoading(true);

    try {
      const data = await api.post('/api/admin/users', formData);

      if (data.success) {
        alert('User berhasil dibuat!');
        router.push('/admin/users');
      } else {
        alert('Gagal membuat user: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Terjadi kesalahan: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'manager': return 'Manager';
      case 'staff': return 'Staff';
      default: return role;
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Buat User Baru</h1>
        <p className="text-gray-300 mt-1">Tambahkan user baru ke platform AutoLumiku</p>
      </div>

      {/* Form */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl shadow-sm border border-white/10">
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* User Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Minimal 8 karakter"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Depan *
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Belakang *
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Konfirmasi Password *
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ulangi password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              no Whatsapp
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+628123456789"
            />
          </div>

          {/* Role and Tenant */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role *
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tenant {formData.role === 'manager' || formData.role === 'staff' ? '*' : ''}
              </label>
              <select
                name="tenantId"
                value={formData.tenantId}
                onChange={handleInputChange}
                disabled={formData.role === 'super_admin' || formData.role === 'admin'}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formData.role === 'super_admin' || formData.role === 'admin' ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''
                  }`}
              >
                {formData.role === 'super_admin' || formData.role === 'admin' ? (
                  <option value="">Platform Admin (Akses Semua Tenant)</option>
                ) : (
                  <>
                    <option value="">Pilih Tenant...</option>
                    {tenants.map(tenant => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="emailVerified"
                checked={formData.emailVerified}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">
                Email sudah diverifikasi
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">
                User aktif
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-4">
            <Link
              href="/admin/users"
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Menyimpan...' : 'Buat User'}
            </button>
          </div>
        </form>
      </div>

      {/* Role Information */}
      <div className="mt-6 bg-blue-50/50 border border-blue-100 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Informasi Role
        </h3>
        <div className="space-y-4">
          <div className="flex gap-3">
            <span className="font-black text-blue-700 min-w-[100px]">Super Admin:</span>
            <span className="text-blue-800">Akses penuh ke semua fitur platform</span>
          </div>
          <div className="flex gap-3">
            <span className="font-black text-blue-700 min-w-[100px]">Admin:</span>
            <span className="text-blue-800">Akses ke semua tenant dan fitur admin</span>
          </div>
          <div className="flex gap-3">
            <span className="font-black text-blue-700 min-w-[100px]">Manager:</span>
            <span className="text-blue-800">Akses ke tenant tertentu dan fitur manajemen</span>
          </div>
          <div className="flex gap-3">
            <span className="font-black text-blue-700 min-w-[100px]">Staff:</span>
            <span className="text-blue-800">Akses terbatas ke tenant tertentu</span>
          </div>
        </div>
      </div>
    </div>
  );
}
