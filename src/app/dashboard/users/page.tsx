'use client';

import React, { useState, useEffect, useCallback } from 'react';
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

interface ProfilePicture {
  pictureUrl: string | null;
  hasPicture: boolean;
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
  const [profilePictures, setProfilePictures] = useState<Record<string, ProfilePicture>>({});

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
        const loadedUsers = response.data?.users || [];
        setUsers(loadedUsers);
        setStats(response.data?.stats || { total: 0, byStatus: {}, byRole: {} });
        // Load profile pictures for users with phone numbers
        loadProfilePictures(loadedUsers, tid);
      } else {
        console.error('Failed to load users:', response.error);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfilePictures = useCallback(async (usersList: User[], tid: string) => {
    const usersWithPhone = usersList.filter(u => u.phone);
    if (usersWithPhone.length === 0) return;

    // Load profile pictures in parallel
    // Note: Don't pass tenantId - API works better with fallback to any connected client
    const picturePromises = usersWithPhone.map(async (user) => {
      try {
        const response = await fetch(
          `/api/v1/whatsapp-ai/profile-picture?phone=${user.phone}`
        );
        const data = await response.json();
        if (data.success) {
          return {
            phone: user.phone!,
            data: {
              pictureUrl: data.pictureUrl || null,
              hasPicture: data.hasPicture || false,
            },
          };
        }
      } catch (error) {
        console.error(`Failed to load profile picture for ${user.phone}:`, error);
      }
      return null;
    });

    const results = await Promise.all(picturePromises);
    const newPictures: Record<string, ProfilePicture> = {};
    results.forEach((result) => {
      if (result) {
        newPictures[result.phone] = result.data;
      }
    });
    setProfilePictures((prev) => ({ ...prev, ...newPictures }));
  }, []);

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
    switch (role.toUpperCase()) {
      case 'OWNER':
        return 'bg-amber-100 text-amber-800';
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800';
      case 'FINANCE':
        return 'bg-emerald-100 text-emerald-800';
      case 'SALES':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role.toUpperCase()) {
      case 'OWNER':
        return 'Owner';
      case 'ADMIN':
        return 'Admin';
      case 'MANAGER':
        return 'Manager';
      case 'FINANCE':
        return 'Finance';
      case 'SALES':
        return 'Sales';
      default:
        return role;
    }
  };

  return (
    <div className="p-3 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header - with left margin on mobile for hamburger menu */}
      <div className="flex justify-between items-center mb-3 flex-shrink-0 ml-10 md:ml-0">
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-bold text-gray-900">Manajemen Tim</h1>
          <p className="text-gray-600 text-[10px] md:text-sm">Kelola staff dan anggota tim showroom</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-2 md:px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs md:text-sm whitespace-nowrap"
        >
          <FaPlus className="mr-1 md:mr-2" />
          <span className="hidden md:inline">Tambah Staff</span>
          <span className="md:hidden">Tambah</span>
        </button>
      </div>

      {/* Stats Cards - 3 cols on mobile, 6 cols on desktop */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 mb-3 flex-shrink-0">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 md:p-3">
          <p className="text-[10px] md:text-xs font-medium text-gray-600">Total</p>
          {loading ? (
            <div className="h-6 md:h-8 w-10 md:w-12 bg-gray-200 animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{stats?.total || 0}</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 md:p-3">
          <p className="text-[10px] md:text-xs font-medium text-amber-600">Owner</p>
          {loading ? (
            <div className="h-6 md:h-8 w-10 md:w-12 bg-gray-200 animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-amber-600 mt-1">
              {stats?.byRole?.OWNER || 0}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 md:p-3">
          <p className="text-[10px] md:text-xs font-medium text-purple-600">Admin</p>
          {loading ? (
            <div className="h-6 md:h-8 w-10 md:w-12 bg-gray-200 animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-purple-600 mt-1">
              {stats?.byRole?.ADMIN || 0}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 md:p-3">
          <p className="text-[10px] md:text-xs font-medium text-blue-600">Manager</p>
          {loading ? (
            <div className="h-6 md:h-8 w-10 md:w-12 bg-gray-200 animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-blue-600 mt-1">
              {stats?.byRole?.MANAGER || 0}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 md:p-3">
          <p className="text-[10px] md:text-xs font-medium text-emerald-600">Finance</p>
          {loading ? (
            <div className="h-6 md:h-8 w-10 md:w-12 bg-gray-200 animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-emerald-600 mt-1">
              {stats?.byRole?.FINANCE || 0}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 md:p-3">
          <p className="text-[10px] md:text-xs font-medium text-green-600">Sales</p>
          {loading ? (
            <div className="h-6 md:h-8 w-10 md:w-12 bg-gray-200 animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-green-600 mt-1">
              {stats?.byRole?.SALES || 0}
            </p>
          )}
        </div>
      </div>

      {/* Filters - Urutan (2) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3 flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Semua Role</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="FINANCE">Finance</option>
            <option value="SALES">Sales</option>
          </select>
        </div>
      </div>

      {/* Main Content - Two Separate Scroll Areas */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
        {/* Users Table - Scrollable Area 1 (Takes 60% of available space) */}
        <div className="flex-[3] min-h-[200px] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-2 md:px-4 py-2 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Staff
                  </th>
                  <th className="px-2 md:px-4 py-2 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="hidden md:inline">WhatsApp</span>
                    <span className="md:hidden">WA</span>
                  </th>
                  <th className="px-2 md:px-4 py-2 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="hidden md:table-cell px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden md:table-cell px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bergabung
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  // Loading skeleton
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-28"></div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-5 bg-gray-200 rounded animate-pulse w-16"></div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-5 bg-gray-200 rounded animate-pulse w-16"></div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <FaUserCircle className="mx-auto text-4xl text-gray-300 mb-2" />
                      <p className="text-sm font-medium">Tidak ada staff ditemukan</p>
                      <p className="text-xs mt-1">
                        {searchQuery || roleFilter !== 'all'
                          ? 'Coba ubah filter pencarian Anda'
                          : 'Mulai tambahkan staff ke tim Anda'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-2 md:px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-7 w-7 md:h-8 md:w-8 relative">
                            {user.phone && profilePictures[user.phone]?.hasPicture && profilePictures[user.phone]?.pictureUrl ? (
                              <img
                                src={profilePictures[user.phone].pictureUrl!}
                                alt={`${user.firstName} ${user.lastName}`}
                                className="h-7 w-7 md:h-8 md:w-8 rounded-full object-cover"
                                onError={(e) => {
                                  // Fallback to initials if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  target.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`h-7 w-7 md:h-8 md:w-8 rounded-full bg-blue-100 flex items-center justify-center ${user.phone && profilePictures[user.phone]?.hasPicture && profilePictures[user.phone]?.pictureUrl ? 'hidden' : ''}`}>
                              <span className="text-blue-600 font-semibold text-[10px] md:text-xs">
                                {user.firstName.charAt(0)}
                                {user.lastName?.charAt(0) || ''}
                              </span>
                            </div>
                            {user.phone && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 border-2 border-white rounded-full"></span>
                            )}
                          </div>
                          <div className="ml-2 md:ml-3 min-w-0">
                            <div className="text-xs md:text-sm font-medium text-gray-900 truncate max-w-[100px] md:max-w-none">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-[10px] md:text-xs text-gray-500 truncate max-w-[100px] md:max-w-none">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-2 whitespace-nowrap">
                        {user.phone ? (
                          <div className="flex items-center">
                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1 md:mr-2 flex-shrink-0"></span>
                            <span className="text-[10px] md:text-xs text-gray-900 truncate max-w-[60px] md:max-w-none">{user.phone}</span>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-1 md:mr-2 flex-shrink-0"></span>
                            <span className="text-[10px] md:text-xs text-gray-400 italic">-</span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 whitespace-nowrap">
                        <span
                          className={`px-1.5 md:px-2 py-0.5 inline-flex text-[10px] md:text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                            user.role
                          )}`}
                        >
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-2 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`px-1.5 py-0.5 inline-flex text-xs leading-4 font-medium rounded ${
                              user.emailVerified
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {user.emailVerified ? '✓ Email' : '○ Email'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 inline-flex text-xs leading-4 font-medium rounded ${
                              user.phone
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-600'
                            }`}
                          >
                            {user.phone ? '✓ WhatsApp' : '✗ WhatsApp'}
                          </span>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-2 md:px-4 py-2 whitespace-nowrap text-right text-[10px] md:text-xs font-medium">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-blue-600 hover:text-blue-900 mr-2 md:mr-3"
                        >
                          <FaEdit className="inline" /> <span className="hidden md:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FaTrash className="inline" /> <span className="hidden md:inline">Hapus</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* WhatsApp AI Integration Info - Scrollable Area 2 (Takes 40% of available space) */}
        <div className="flex-[2] min-h-[150px] overflow-auto bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200 p-3">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-md bg-green-500 text-white text-xl">
                💬
              </div>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                WhatsApp AI Commands untuk Staff
              </h3>
              <p className="text-xs text-gray-700 mb-2">
                Semua staff dengan nomor WhatsApp terdaftar dapat menggunakan AI commands untuk operasional harian.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                {/* Upload Vehicle */}
                <div className="bg-white rounded-lg p-2 border border-green-200 overflow-hidden">
                  <div className="flex items-start">
                    <span className="text-lg mr-2 flex-shrink-0">📸</span>
                    <div className="flex-1 min-w-0 overflow-auto max-h-28">
                      <h4 className="font-semibold text-gray-900 text-xs mb-0.5">upload - Upload Mobil (AI-Powered 🤖)</h4>
                      <p className="text-xs text-gray-600 mb-1">Ketik upload + foto + info mobil</p>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded block whitespace-nowrap overflow-x-auto">
                        upload Avanza 2020 150jt hitam matic km 50rb
                      </code>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded block whitespace-nowrap overflow-x-auto mt-0.5">
                        upload Brio 2021 140jt silver AT km 30rb
                      </code>
                    </div>
                  </div>
                </div>

                {/* Update Status */}
                <div className="bg-white rounded-lg p-2 border border-blue-200 overflow-hidden">
                  <div className="flex items-start">
                    <span className="text-lg mr-2 flex-shrink-0">🔄</span>
                    <div className="flex-1 min-w-0 overflow-auto max-h-28">
                      <h4 className="font-semibold text-gray-900 text-xs mb-0.5">status - Update Status</h4>
                      <p className="text-xs text-gray-600 mb-1">Update status: AVAILABLE, BOOKED, SOLD</p>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded block whitespace-nowrap overflow-x-auto">
                        status PM-PST-001 SOLD
                      </code>
                    </div>
                  </div>
                </div>

                {/* Check Inventory */}
                <div className="bg-white rounded-lg p-2 border border-purple-200 overflow-hidden">
                  <div className="flex items-start">
                    <span className="text-lg mr-2 flex-shrink-0">📊</span>
                    <div className="flex-1 min-w-0 overflow-auto max-h-28">
                      <h4 className="font-semibold text-gray-900 text-xs mb-0.5">inventory - Cek Stok</h4>
                      <p className="text-xs text-gray-600 mb-1">Lihat daftar mobil, filter by status/brand</p>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded block whitespace-nowrap overflow-x-auto">
                        inventory AVAILABLE
                      </code>
                    </div>
                  </div>
                </div>

                {/* Get Stats */}
                <div className="bg-white rounded-lg p-2 border border-orange-200 overflow-hidden">
                  <div className="flex items-start">
                    <span className="text-lg mr-2 flex-shrink-0">📈</span>
                    <div className="flex-1 min-w-0 overflow-auto max-h-28">
                      <h4 className="font-semibold text-gray-900 text-xs mb-0.5">stats - Statistik</h4>
                      <p className="text-xs text-gray-600 mb-1">Lihat statistik penjualan dan leads</p>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded block whitespace-nowrap overflow-x-auto">
                        stats today
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-2 pt-2 border-t border-green-200">
                <div className="flex items-center text-[9px] md:text-xs text-gray-600">
                  <span className="inline-block w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full mr-1.5 md:mr-2 flex-shrink-0"></span>
                  <span className="hidden md:inline">Staff harus memiliki <strong>Nomor WhatsApp</strong> terdaftar untuk menggunakan commands</span>
                  <span className="md:hidden">Staff perlu <strong>No. WA</strong> untuk commands</span>
                </div>
                <a
                  href="/dashboard/whatsapp-ai"
                  className="text-[9px] md:text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap ml-3 md:ml-0"
                >
                  WhatsApp AI →
                </a>
              </div>
            </div>
          </div>
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
                    <option value="FINANCE">Finance Accounting</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                    <option value="OWNER">Owner</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Sales tidak bisa akses fitur Invoice & Laporan Keuangan
                  </p>
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
                    <option value="FINANCE">Finance Accounting</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                    <option value="OWNER">Owner</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Sales tidak bisa akses fitur Invoice & Laporan Keuangan
                  </p>
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
