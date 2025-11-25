/**
 * Users Management Page
 * Admin interface for managing platform users
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

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

  // Mock data for development
  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true);
      
      // Mock users data
      const mockUsers: User[] = [
        {
          id: '1',
          email: 'admin@autolumiku.com',
          firstName: 'Super',
          lastName: 'Admin',
          role: 'super_admin',
          emailVerified: true,
          isActive: true,
          createdAt: '2025-11-01T00:00:00Z',
          lastLoginAt: '2025-11-23T10:30:00Z',
        },
        {
          id: '2',
          email: 'admin@showroomjakarta.com',
          firstName: 'Admin',
          lastName: 'Showroom',
          role: 'admin',
          tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed' // MOCK_DATA,
          tenantName: 'Showroom Jakarta',
          emailVerified: true,
          isActive: true,
          createdAt: '2025-11-02T00:00:00Z',
          lastLoginAt: '2025-11-23T09:15:00Z',
        },
        {
          id: '3',
          email: 'manager@showroomjakarta.com',
          firstName: 'Budi',
          lastName: 'Santoso',
          role: 'manager',
          tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed' // MOCK_DATA,
          tenantName: 'Showroom Jakarta',
          emailVerified: true,
          isActive: true,
          createdAt: '2025-11-03T00:00:00Z',
          lastLoginAt: '2025-11-23T08:45:00Z',
        },
        {
          id: '4',
          email: 'sales@showroomjakarta.com',
          firstName: 'Siti',
          lastName: 'Rahayu',
          role: 'staff',
          tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed' // MOCK_DATA,
          tenantName: 'Showroom Jakarta',
          emailVerified: true,
          isActive: true,
          createdAt: '2025-11-05T00:00:00Z',
          lastLoginAt: '2025-11-22T16:20:00Z',
        },
        {
          id: '5',
          email: 'user@dealermobil.com',
          firstName: 'Ahmad',
          lastName: 'Pratama',
          role: 'staff',
          tenantId: '5536722c-78e5-4dcd-9d35-d16858add414' // MOCK_DATA,
          tenantName: 'Dealer Mobil',
          emailVerified: true,
          isActive: false,
          createdAt: '2025-11-10T00:00:00Z',
          lastLoginAt: '2025-11-15T14:30:00Z',
        },
      ];

      // Calculate stats
      const userStats = mockUsers.reduce((acc, user) => {
        acc.total++;
        if (user.isActive) acc.active++;
        else acc.inactive++;
        
        if (user.role === 'super_admin' || user.role === 'admin') acc.admins++;
        else if (user.role === 'manager') acc.managers++;
        else acc.staff++;
        
        return acc;
      }, { total: 0, active: 0, inactive: 0, admins: 0, managers: 0, staff: 0 });

      setUsers(mockUsers);
      setStats(userStats);
      setIsLoading(false);
    };

    loadUsers();
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Terakhir Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.email}
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(user.isActive)}`}>
                      {user.isActive ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Belum pernah login'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link
                        href={`/admin/users/${user.id}/edit`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => {
                          if (window.confirm(`Apakah Anda yakin ingin menghapus user ${user.email}?`)) {
                            // Handle delete
                            console.log('Delete user:', user.id);
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

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">Tidak ada user yang ditemukan</div>
          <p className="text-gray-400 mt-2">Coba ubah filter atau tambah user baru</p>
        </div>
      )}
    </div>
  );
}