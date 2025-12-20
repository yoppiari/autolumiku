'use client';

import React, { useState, useEffect } from 'react';
import { FaSearch, FaPlus, FaEdit, FaTrash, FaUserCircle } from 'react-icons/fa';
import { api } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface UserStats {
  total: number;
  byRole: Record<string, number>;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'SALES',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setTenantId(parsedUser.tenantId);
      loadUsers(parsedUser.tenantId);
    }
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchQuery, roleFilter]);

  const loadUsers = async (tid: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/api/v1/users?tenantId=${tid}`);
      if (response.success) {
        setUsers(response.data?.users || []);
        setStats(response.data?.stats || { total: 0, byStatus: {}, byRole: {} });
      } else {
        console.error('Failed to load users:', response.error);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...users];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.firstName.toLowerCase().includes(query) ||
          user.lastName.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const response = await api.post('/api/v1/users', {
        ...formData,
        tenantId,
      });

      if (response.success) {
        // Reload users list
        await loadUsers(tenantId);
        // Reset form and close modal
        setFormData({ email: '', firstName: '', lastName: '', phone: '', role: 'SALES' });
        setShowCreateModal(false);
      } else {
        setFormError(response.error || 'Failed to create user');
      }
    } catch (error) {
      setFormError('An error occurred while creating user');
      console.error('Create user error:', error);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: (user as any).phone || '',
      role: user.role,
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setFormError('');
    setFormLoading(true);

    try {
      const response = await api.put(`/api/v1/users/${editingUser.id}`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        role: formData.role,
      });

      if (response.success) {
        // Reload users list
        await loadUsers(tenantId);
        // Reset form and close modal
        setFormData({ email: '', firstName: '', lastName: '', phone: '', role: 'SALES' });
        setEditingUser(null);
        setShowEditModal(false);
      } else {
        setFormError(response.error || 'Failed to update user');
      }
    } catch (error) {
      setFormError('An error occurred while updating user');
      console.error('Update user error:', error);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus user ini?')) {
      return;
    }

    try {
      const response = await api.delete(`/api/v1/users/${userId}`);

      if (response.success) {
        // Reload users list
        await loadUsers(tenantId);
      } else {
        alert(response.error || 'Failed to delete user');
      }
    } catch (error) {
      alert('An error occurred while deleting user');
      console.error('Delete user error:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800';
      case 'SALES':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Tim</h1>
          <p className="text-gray-600 mt-1">Kelola staff dan anggota tim showroom</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <FaPlus className="mr-2" />
          Tambah Staff
        </button>
      </div>

      {/* WhatsApp AI Integration Info */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200 p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white text-2xl">
              💬
            </div>
          </div>
          <div className="ml-4 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              WhatsApp AI Commands untuk Staff
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Semua staff dengan nomor WhatsApp terdaftar dapat menggunakan AI commands untuk operasional harian.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Upload Vehicle */}
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">📸</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">/upload - Upload Mobil (AI-Powered 🤖)</h4>
                    <p className="text-xs text-gray-600 mb-2">Upload mobil dengan natural language - AI otomatis memproses!</p>
                    <div className="space-y-1">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded block">
                        /upload Toyota Avanza tahun 2020 harga 150 juta km 50rb hitam manual
                      </code>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded block">
                        /upload Avanza 2020 hitam matic 150jt km 50ribu
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Update Status */}
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">🔄</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">/status - Update Status</h4>
                    <p className="text-xs text-gray-600 mb-2">Update status mobil (AVAILABLE, BOOKED, SOLD)</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded block">
                      /status 12345 SOLD
                    </code>
                  </div>
                </div>
              </div>

              {/* Check Inventory */}
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">📊</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">/inventory - Cek Stok</h4>
                    <p className="text-xs text-gray-600 mb-2">Lihat daftar mobil dan filter by status/brand</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded block">
                      /inventory AVAILABLE
                    </code>
                  </div>
                </div>
              </div>

              {/* Get Stats */}
              <div className="bg-white rounded-lg p-4 border border-orange-200">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">📈</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">/stats - Statistik</h4>
                    <p className="text-xs text-gray-600 mb-2">Lihat statistik penjualan dan leads</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded block">
                      /stats today
                    </code>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-green-200">
              <div className="flex items-center text-sm text-gray-600">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span>Staff harus memiliki <strong>Nomor WhatsApp</strong> terdaftar untuk menggunakan commands</span>
              </div>
              <a
                href="/dashboard/whatsapp-ai"
                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                Lihat WhatsApp AI Dashboard →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Total Staff</p>
          {loading ? (
            <div className="h-10 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
          ) : (
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.total || 0}</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Admin</p>
          {loading ? (
            <div className="h-10 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
          ) : (
            <p className="text-3xl font-bold text-purple-600 mt-2">
              {stats?.byRole?.ADMIN || 0}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Sales</p>
          {loading ? (
            <div className="h-10 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
          ) : (
            <p className="text-3xl font-bold text-green-600 mt-2">
              {stats?.byRole?.SALES || 0}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Semua Role</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="SALES">Sales</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  WhatsApp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bergabung
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                // Loading skeleton
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-28"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 bg-gray-200 rounded animate-pulse w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 bg-gray-200 rounded animate-pulse w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <FaUserCircle className="mx-auto text-6xl text-gray-300 mb-4" />
                    <p className="text-lg font-medium">Tidak ada staff ditemukan</p>
                    <p className="text-sm mt-1">
                      {searchQuery || roleFilter !== 'all'
                        ? 'Coba ubah filter pencarian Anda'
                        : 'Mulai tambahkan staff ke tim Anda'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {user.firstName.charAt(0)}
                              {user.lastName?.charAt(0) || ''}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.phone ? (
                        <div className="flex items-center">
                          <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                          <span className="text-sm text-gray-900">{user.phone}</span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                          <span className="text-sm text-gray-400 italic">Belum diisi</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                          user.role
                        )}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`px-2 py-0.5 inline-flex text-xs leading-4 font-medium rounded ${
                            user.emailVerified
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {user.emailVerified ? '✓ Email' : '○ Email'}
                        </span>
                        <span
                          className={`px-2 py-0.5 inline-flex text-xs leading-4 font-medium rounded ${
                            user.phone
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {user.phone ? '✓ WhatsApp' : '✗ WhatsApp'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        <FaEdit className="inline" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <FaTrash className="inline" /> Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Tambah Staff Baru
              </h3>

              <form onSubmit={handleCreateUser} className="space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Depan *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="John"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Belakang
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="6281234567890"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Format: kode negara + nomor (tanpa + atau spasi). Contoh: 6281234567890
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="SALES">Sales</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormError('');
                      setFormData({
                        email: '',
                        firstName: '',
                        lastName: '',
                        phone: '',
                        role: 'SALES',
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={formLoading}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    disabled={formLoading}
                  >
                    {formLoading ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Edit Staff
              </h3>

              <form onSubmit={handleUpdateUser} className="space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={formData.email}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email tidak dapat diubah</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Depan *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Belakang
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="6281234567890"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Digunakan untuk WhatsApp AI commands
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="SALES">Sales</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingUser(null);
                      setFormError('');
                      setFormData({
                        email: '',
                        firstName: '',
                        lastName: '',
                        phone: '',
                        role: 'SALES',
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={formLoading}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    disabled={formLoading}
                  >
                    {formLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
