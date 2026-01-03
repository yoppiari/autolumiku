/**
 * Users Management Page
 * Admin interface for managing platform users
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId?: string;
  tenantName?: string;
  emailVerified: boolean;
  isActive: boolean;
  isWhatsAppActive: boolean;
  phone?: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface UserStats {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  managers: number;
  staff: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
    managers: 0,
    staff: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchUsers = async () => {
    try {
      // Only show loading on initial load, not on background refresh
      if (users.length === 0) setIsLoading(true);

      const data = await api.get('/api/admin/users');

      if (data.success && data.data) {
        // Map the data to match the User interface
        const mappedUsers: User[] = data.data.map((user: any) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant?.name,
          emailVerified: user.emailVerified,
          isActive: true, // Logical fix: Force active display manually until DB column is migrated
          isWhatsAppActive: user.isWhatsAppActive || false,
          phone: user.phone,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        }));

        // Calculate stats
        const userStats = mappedUsers.reduce((acc, user) => {
          acc.total++;
          if (user.isActive) acc.active++;
          else acc.inactive++;

          if (user.role === 'super_admin' || user.role === 'admin') acc.admins++;
          else if (user.role === 'manager') acc.managers++;
          else acc.staff++;

          return acc;
        }, { total: 0, active: 0, inactive: 0, admins: 0, managers: 0, staff: 0 });

        setUsers(mappedUsers);
        setStats(userStats);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    // Auto-refresh every 30 seconds
    const intervalId = setInterval(() => {
      fetchUsers();
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.tenantName && user.tenantName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && user.isActive) ||
      (statusFilter === 'inactive' && !user.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'staff': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatPhoneNumber = (phone?: string) => {
    if (!phone) return '-';
    // Remove non-digits
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('62')) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith('0')) {
      return `+62${cleaned.substring(1)}`;
    }
    if (cleaned.length > 5 && !cleaned.startsWith('+')) {
      return `+62${cleaned}`;
    }
    return phone.startsWith('+') ? phone : `+${phone}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manajemen User</h1>
          <p className="text-gray-600 mt-1">Kelola user dan akses platform</p>
        </div>

        <div className="flex space-x-4">
          <Link
            href="/admin/users/create"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Tambah User
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total User</h3>
          <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">User Aktif</h3>
          <div className="text-3xl font-bold text-green-600">{stats.active}</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">User Tidak Aktif</h3>
          <div className="text-3xl font-bold text-red-600">{stats.inactive}</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin</h3>
          <div className="text-3xl font-bold text-purple-600">{stats.admins}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Cari User</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan email, nama, atau tenant..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua Role</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak Aktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  USER
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  ROLE
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  TENANT
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  WHATSAPP / NO
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  TERAKHIR LOGIN
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                  AKSI
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className="text-sm font-bold text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black ${user.isWhatsAppActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          <span className={`flex h-1.5 w-1.5 rounded-full mr-1 ${user.isWhatsAppActive ? 'bg-green-500 animate-pulse' : 'bg-red-600 animate-pulse'}`}></span>
                          {user.isWhatsAppActive ? 'WA: ACTIVE' : 'WA: NOT ACTIVE'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={async () => {
                            try {
                              const data = await api.patch(`/api/admin/users/${user.id}`, {
                                isActive: !user.isActive
                              });
                              if (data.success) {
                                fetchUsers(); // Refresh list
                              } else {
                                alert('Gagal mengubah status: ' + (data.error || 'Unknown error'));
                              }
                            } catch (error) {
                              alert('Terjadi kesalahan: ' + (error as Error).message);
                            }
                          }}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black cursor-pointer hover:opacity-80 transition-opacity ${getStatusBadgeColor(user.isActive)}`}
                        >
                          <span className={`flex h-1.5 w-1.5 rounded-full mr-1 ${user.isActive ? 'bg-green-500 animate-pulse' : 'bg-red-600 animate-pulse'}`}></span>
                          {user.isActive ? 'LOGIN: ACTIVE' : 'LOGIN: Tidak Aktif'}
                        </button>
                        <div className="text-sm text-gray-400 font-mono">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                      {user.role.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.tenantName || 'Platform Admin'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-900 font-bold">
                        {formatPhoneNumber(user.phone)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Belum pernah login'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link
                        href={`/admin/users/${user.id}/edit`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={async () => {
                          if (window.confirm(`Apakah Anda yakin ingin menghapus user ${user.email}?`)) {
                            try {
                              const data = await api.delete(`/api/admin/users/${user.id}`);
                              if (data.success) {
                                alert('User berhasil dihapus!');
                                fetchUsers(); // Refresh list
                              } else {
                                alert('Gagal menghapus user: ' + (data.error || 'Unknown error'));
                              }
                            } catch (error) {
                              alert('Terjadi kesalahan: ' + (error as Error).message);
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {
        filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">Tidak ada user yang ditemukan</div>
            <p className="text-gray-400 mt-2">Coba ubah filter atau tambah user baru</p>
          </div>
        )
      }
    </div >
  );
}