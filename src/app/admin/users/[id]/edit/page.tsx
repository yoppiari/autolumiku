/**
 * Edit User Page
 * Admin interface for editing existing platform users
 */

'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';

interface UserForm {
    email: string;
    firstName: string;
    lastName: string;
    role: 'super_admin' | 'admin' | 'manager' | 'staff';
    tenantId?: string;
    password?: string;
    confirmPassword?: string;
    emailVerified: boolean;
    isActive: boolean;
    phone?: string;
}

interface Tenant {
    id: string;
    name: string;
    slug: string;
}

export default function EditUserPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
    const router = useRouter();
    // Support both Next.js 14 (sync) and 15 (promise)
    const resolvedParams = params instanceof Promise ? use(params) : params;
    const userId = resolvedParams.id;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [formData, setFormData] = useState<UserForm>({
        email: '',
        firstName: '',
        lastName: '',
        role: 'staff',
        tenantId: '',
        password: '',
        confirmPassword: '',
        emailVerified: false,
        isActive: true,
        phone: '',
    });

    // Fetch user data and tenants
    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);

                // Fetch tenants first
                const tenantsData = await api.get('/api/admin/tenants');
                if (tenantsData.success && tenantsData.data) {
                    setTenants(tenantsData.data);
                }

                // Fetch user data
                const userData = await api.get(`/api/admin/users/${userId}`);
                if (userData.success && userData.data) {
                    const user = userData.data;
                    setFormData({
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role,
                        tenantId: user.tenantId || '',
                        password: '',
                        confirmPassword: '',
                        emailVerified: user.emailVerified,
                        isActive: user.isActive,
                        phone: user.phone || '',
                    });
                } else {
                    alert('Gagal memuat data user: ' + (userData.error || 'User tidak ditemukan'));
                    router.push('/admin/users');
                }
            } catch (error) {
                console.error('Failed to load data:', error);
                alert('Terjadi kesalahan saat memuat data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [userId, router]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }));
    };

    const validateForm = () => {
        const errors: string[] = [];

        if (!formData.email) errors.push('Email wajib diisi');
        if (!formData.firstName) errors.push('Nama depan wajib diisi');
        if (!formData.lastName) errors.push('Nama belakang wajib diisi');

        if (formData.password) {
            if (formData.password.length < 8) errors.push('Password minimal 8 karakter');
            if (formData.password !== formData.confirmPassword) errors.push('Password dan konfirmasi tidak cocok');
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

        setIsSaving(true);

        try {
            // Prepare data for update (only send password if it's filled)
            const updatePayload: any = { ...formData };
            if (!updatePayload.password) {
                delete updatePayload.password;
                delete updatePayload.confirmPassword;
            }

            const data = await api.patch(`/api/admin/users/${userId}`, updatePayload);

            if (data.success) {
                alert('User berhasil diperbarui!');
                router.push('/admin/users');
            } else {
                alert('Gagal memperbarui user: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Terjadi kesalahan: ' + (error as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Edit User</h1>
                <p className="text-gray-600 mt-1">Perbarui informasi user dan hak akses</p>
            </div>

            {/* Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
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
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Ganti Password (Biarkan kosong jika tetap)
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
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
                            />
                        </div>
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

                    {formData.password && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Konfirmasi Password Baru *
                            </label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    )}

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
                                Tenant
                            </label>
                            <select
                                name="tenantId"
                                value={formData.tenantId}
                                onChange={handleInputChange}
                                disabled={formData.role === 'super_admin'}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 bg-white"
                            >
                                <option value="">Pilih Tenant (Opsional/Platform Admin)</option>
                                {tenants.map(tenant => (
                                    <option key={tenant.id} value={tenant.id}>
                                        {tenant.name}
                                    </option>
                                ))}
                            </select>
                            {formData.role === 'super_admin' && (
                                <p className="mt-1 text-xs text-gray-500 italic">Super Admin tidak terikat tenant</p>
                            )}
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
                            disabled={isSaving}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
