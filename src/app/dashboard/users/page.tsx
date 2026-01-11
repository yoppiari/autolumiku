'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FaSearch, FaPlus, FaEdit, FaTrash, FaUserCircle, FaWhatsapp } from 'react-icons/fa';
import { api } from '@/lib/api-client';
import { ROLE_LEVELS } from '@/lib/rbac';

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
  // profilePictureUrl?: string | null;
}

interface UserStats {
  total: number;
  byRole: Record<string, number>;
}

interface WhatsAppProfile {
  pictureUrl: string | null;
  hasPicture: boolean;
  isRegistered: boolean;
  loading: boolean;
}

export default function UsersPage() {
  const router = useRouter();
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
  const [whatsAppProfiles, setWhatsAppProfiles] = useState<Record<string, WhatsAppProfile>>({});
  const [userRoleLevel, setUserRoleLevel] = useState<number>(ROLE_LEVELS.SALES);
  const [accessDenied, setAccessDenied] = useState(false);
  const [lastProfileUpdate, setLastProfileUpdate] = useState<Date | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'SALES',
    password: '',
    confirmPassword: '',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Access guard: ADMIN (90+) only
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);

      // Fallback: compute roleLevel from role if missing
      let roleLevel = parsedUser.roleLevel;
      if (!roleLevel || roleLevel === undefined) {
        console.warn('[Users Page] roleLevel missing in localStorage, computing from role:', parsedUser.role);
        // Compute from role string
        const role = (parsedUser.role || '').toUpperCase();
        if (role === 'OWNER') roleLevel = ROLE_LEVELS.OWNER; // 100
        else if (role === 'ADMIN') roleLevel = ROLE_LEVELS.ADMIN; // 90
        else if (role === 'SUPER_ADMIN') roleLevel = 110;
        else roleLevel = ROLE_LEVELS.SALES; // 30

        // Update localStorage with computed roleLevel
        parsedUser.roleLevel = roleLevel;
        localStorage.setItem('user', JSON.stringify(parsedUser));
        console.log('[Users Page] Updated localStorage with roleLevel:', roleLevel);
      }

      console.log('[Users Page] User role:', parsedUser.role, 'roleLevel:', roleLevel);
      setUserRoleLevel(roleLevel);

      setTenantId(parsedUser.tenantId);
      loadUsers(parsedUser.tenantId);
    }
  }, [router]);

  useEffect(() => {
    applyFilters();
  }, [users, searchQuery, roleFilter]);

  // Auto-refresh WhatsApp profiles every 30 seconds
  useEffect(() => {
    if (!tenantId || users.length === 0) return;

    // Set up auto-refresh interval
    const interval = setInterval(() => {
      refreshWhatsAppProfiles();
    }, 30000); // 30 seconds

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, [tenantId, users]);

  const loadUsers = async (tid: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/api/v1/users?tenantId=${tid}`);
      if (response.success) {
        const loadedUsers = response.data?.users || [];
        setUsers(loadedUsers);
        setStats(response.data?.stats || { total: 0, byStatus: {}, byRole: {} });

        /*
        // DISABLED: Migration failed
        // Initialize WhatsApp profiles state with stored URLs to show images immediately
        const initialProfiles: Record<string, WhatsAppProfile> = {};
        loadedUsers.forEach((u: User) => {
          if (u.phone && u.profilePictureUrl) {
            initialProfiles[u.phone] = {
              pictureUrl: u.profilePictureUrl,
              hasPicture: true,
              isRegistered: true, // Optimistically assume registered if we have a pic
              loading: false // Not loading, we have data
            };
          }
        });

        // Merge with existing logic but don't overwrite if we're just setting initial
        setWhatsAppProfiles(prev => ({ ...prev, ...initialProfiles }));
        */

        // Load fresh profile pictures for users with phone numbers
        loadWhatsAppProfiles(loadedUsers, tid);
      } else {
        console.error('Failed to load users:', response.error);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWhatsAppProfiles = useCallback(async (usersList: User[], tid: string) => {
    const usersWithPhone = usersList.filter(u => u.phone);
    if (usersWithPhone.length === 0) return;

    // Load WhatsApp status and profile pictures
    usersWithPhone.forEach(async (user) => {
      const phone = user.phone!;

      // Set loading state for this specific user
      setWhatsAppProfiles(prev => ({
        ...prev,
        [phone]: { ...prev[phone], loading: true }
      }));

      try {
        // Fetch both registration status and profile picture
        const [regRes, picRes] = await Promise.all([
          fetch(`/api/v1/whatsapp-ai/check-whatsapp?phone=${phone}`),
          fetch(`/api/v1/whatsapp-ai/profile-picture?phone=${phone}`)
        ]);

        const regData = await regRes.json();
        const picData = await picRes.json();

        setWhatsAppProfiles(prev => ({
          ...prev,
          [phone]: {
            pictureUrl: picData.success ? picData.pictureUrl : null,
            hasPicture: picData.success ? picData.hasPicture : false,
            isRegistered: regData.success ? regData.isRegistered : false,
            loading: false
          }
        }));
      } catch (error) {
        console.error(`Failed to load WhatsApp data for ${phone}:`, error);
        setWhatsAppProfiles(prev => ({
          ...prev,
          [phone]: { ...prev[phone], loading: false }
        }));
      }
    });

    // Set last update time
    setLastProfileUpdate(new Date());
  }, []);

  const refreshWhatsAppProfiles = useCallback(async () => {
    if (!tenantId || users.length === 0) return;

    const usersWithPhone = users.filter(u => u.phone);
    if (usersWithPhone.length === 0) return;

    // Refresh all WhatsApp profiles
    for (const user of usersWithPhone) {
      const phone = user.phone!;

      try {
        // Fetch both registration status and profile picture with cache busting
        const [regRes, picRes] = await Promise.all([
          fetch(`/api/v1/whatsapp-ai/check-whatsapp?phone=${phone}&_t=${Date.now()}`),
          fetch(`/api/v1/whatsapp-ai/profile-picture?phone=${phone}&_t=${Date.now()}`)
        ]);

        const regData = await regRes.json();
        const picData = await picRes.json();

        setWhatsAppProfiles(prev => ({
          ...prev,
          [phone]: {
            pictureUrl: picData.success ? picData.pictureUrl : null,
            hasPicture: picData.success ? picData.hasPicture : false,
            isRegistered: regData.success ? regData.isRegistered : false,
            loading: false
          }
        }));
      } catch (error) {
        console.error(`Failed to refresh WhatsApp data for ${phone}:`, error);
      }
    }

    setLastProfileUpdate(new Date());
  }, [tenantId, users]);

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

    if (formData.password !== formData.confirmPassword) {
      setFormError('Password dan Konfirmasi Password tidak cocok');
      return;
    }

    if (!formData.password) {
      setFormError('Password wajib diisi untuk user baru');
      return;
    }

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
        setFormData({ email: '', firstName: '', lastName: '', phone: '', role: 'SALES', password: '', confirmPassword: '' });
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
      password: '',
      confirmPassword: '',
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (formData.password && formData.password !== formData.confirmPassword) {
      setFormError('Password dan Konfirmasi Password tidak cocok');
      return;
    }

    setFormError('');
    setFormLoading(true);

    try {
      const response = await api.put(`/api/v1/users/${editingUser.id}`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        role: formData.role,
        ...(formData.password ? { password: formData.password } : {}),
      });

      if (response.success) {
        // Reload users list
        await loadUsers(tenantId);
        // Reset form and close modal
        setFormData({ email: '', firstName: '', lastName: '', phone: '', role: 'SALES', password: '', confirmPassword: '' });
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

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return '-';
    // Format: 6281234567890 → +62 812-3456-7890
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('62')) {
      const part1 = cleaned.substring(2, 6); // 8123
      const part2 = cleaned.substring(6, 10); // 4567
      const part3 = cleaned.substring(10, 14); // 890
      return `+62 ${part1}-${part2}-${part3}`;
    }
    return phone;
  };

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'Belum update';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 60) {
      return `Baru saja (${diffSecs}d)`;
    } else if (diffMins < 60) {
      return `${diffMins} menit lalu`;
    } else {
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toUpperCase()) {
      case 'OWNER':
        return 'bg-amber-900/40 text-amber-200 border border-amber-700/50';
      case 'ADMIN':
        return 'bg-purple-900/40 text-purple-200 border border-purple-700/50';
      case 'SALES':
        return 'bg-green-900/40 text-green-200 border border-green-700/50';
      default:
        return 'bg-[#333] text-gray-300 border border-[#444]';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role.toUpperCase()) {
      case 'OWNER':
        return 'Owner';
      case 'ADMIN':
        return 'Admin';
      case 'SALES':
        return 'Staff/Sales';
      default:
        return role;
    }
  };

  // No access restrictions for viewing
  if (false && accessDenied) {
    return (
      <div className="p-6 flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-white mb-2">Akses Ditolak</h2>
          <p className="text-gray-400">Anda tidak memiliki akses ke halaman ini.</p>
          <p className="text-sm text-gray-500 mt-2">Mengalihkan ke Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header - with left margin on mobile for hamburger menu */}
      <div className="flex justify-between items-start mb-2 flex-shrink-0 ml-10 md:ml-0 gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg md:text-2xl font-bold text-white">Manajemen Tim</h1>
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mt-0.5">
            <p className="text-gray-400 text-[10px] md:text-sm">Kelola staff dan anggota tim showroom</p>
            {lastProfileUpdate && (
              <div className="flex items-center gap-1 md:gap-2">
                <span className="text-gray-500 text-[9px] md:text-xs">•</span>
                <span className="text-green-400 text-[9px] md:text-xs font-medium">
                  Profile WhatsApp: {formatLastUpdate(lastProfileUpdate)}
                </span>
                <span className="text-gray-500 text-[9px] md:text-xs">•</span>
                <span className="text-gray-500 text-[9px] md:text-xs">Auto-refresh 30d</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (userRoleLevel < ROLE_LEVELS.ADMIN) {
                alert('Akses Ditolak: Fitur ini hanya untuk Owner, Admin, dan Super Admin.');
                return;
              }
              setShowCreateModal(true);
            }}
            className={`flex items-center px-2 md:px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs md:text-sm whitespace-nowrap ${userRoleLevel < ROLE_LEVELS.ADMIN ? 'opacity-70 grayscale cursor-not-allowed' : ''}`}
          >
            <FaPlus className="mr-1 md:mr-2" />
            <span className="hidden md:inline">Tambah Staff</span>
            <span className="md:hidden">Tambah</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - 3 cols on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-3 mb-3 flex-shrink-0">
        <div className="bg-[#2a2a2a] rounded-lg shadow-sm border border-[#3a3a3a] p-2 md:p-3">
          <p className="text-[10px] md:text-xs font-medium text-gray-400">Total</p>
          {loading ? (
            <div className="h-6 md:h-8 w-10 md:w-12 bg-[#333] animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-white mt-1">{stats?.total || 0}</p>
          )}
        </div>

        <div className="bg-[#2a2a2a] rounded-lg shadow-sm border border-[#3a3a3a] p-2 md:p-3">
          <p className="text-[10px] md:text-xs font-medium text-amber-500">Owner</p>
          {loading ? (
            <div className="h-6 md:h-8 w-10 md:w-12 bg-[#333] animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-amber-500 mt-1">
              {stats?.byRole?.OWNER || 0}
            </p>
          )}
        </div>

        <div className="bg-[#2a2a2a] rounded-lg shadow-sm border border-[#3a3a3a] p-2 md:p-3">
          <p className="text-[10px] md:text-xs font-medium text-purple-400">Admin</p>
          {loading ? (
            <div className="h-6 md:h-8 w-10 md:w-12 bg-[#333] animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-purple-400 mt-1">
              {stats?.byRole?.ADMIN || 0}
            </p>
          )}
        </div>

        <div className="bg-[#2a2a2a] rounded-lg shadow-sm border border-[#3a3a3a] p-2 md:p-3">
          <p className="text-[10px] md:text-xs font-medium text-green-400">Staff/Sales</p>
          {loading ? (
            <div className="h-6 md:h-8 w-10 md:w-12 bg-[#333] animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-green-400 mt-1">
              {stats?.byRole?.SALES || 0}
            </p>
          )}
        </div>
      </div>

      {/* Filters - Urutan (2) */}
      <div className="bg-[#2a2a2a] rounded-lg shadow-sm border border-[#3a3a3a] p-3 mb-3 flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm" />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-[#333] border border-[#444] text-white rounded-md focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-[#333] border border-[#444] text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Semua Role</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="SALES">Staff/Sales</option>
          </select>
        </div>
      </div>

      {/* Main Content - Two Separate Scroll Areas */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
        {/* Users Table - Scrollable Area 1 (Takes 60% of available space) */}
        <div className="flex-[3] min-h-[200px] bg-[#2a2a2a] rounded-lg shadow-sm border border-[#3a3a3a] overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-[#3a3a3a]">
              <thead className="bg-[#333] sticky top-0 z-10 transition-all">
                <tr>
                  <th className="px-2 md:px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider w-auto">
                    Nama
                  </th>
                  <th className="px-2 md:px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider hidden md:table-cell w-[25%]">
                    Email
                  </th>
                  <th className="px-2 md:px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider w-[15%]">
                    Role
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider w-[120px]">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[#2a2a2a] divide-y divide-[#3a3a3a]">
                {loading ? (
                  // Loading skeleton
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">
                        <div className="h-4 bg-[#333] rounded animate-pulse w-32"></div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-4 bg-[#333] rounded animate-pulse w-28"></div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-5 bg-[#333] rounded animate-pulse w-16"></div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-5 bg-[#333] rounded animate-pulse w-16"></div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-4 bg-[#333] rounded animate-pulse w-20"></div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-4 bg-[#333] rounded animate-pulse w-16"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <FaUserCircle className="mx-auto text-4xl text-gray-600 mb-2" />
                      <p className="text-sm font-medium text-gray-400">Tidak ada staff ditemukan</p>
                      <p className="text-xs mt-1 text-gray-500">
                        {searchQuery || roleFilter !== 'all'
                          ? 'Coba ubah filter pencarian Anda'
                          : 'Mulai tambahkan staff ke tim Anda'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-[#333] transition-colors">
                      <td className="px-2 md:px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 md:h-10 md:w-10 relative">
                            {user.phone && whatsAppProfiles[user.phone]?.hasPicture && whatsAppProfiles[user.phone]?.pictureUrl ? (
                              <>
                                <img
                                  src={whatsAppProfiles[user.phone].pictureUrl!}
                                  alt={`${user.firstName} ${user.lastName}`}
                                  className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover border border-[#444] shadow-sm"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                                <div className="hidden h-8 w-8 md:h-10 md:w-10 rounded-full bg-blue-900/30 border border-blue-800 flex items-center justify-center absolute top-0 left-0">
                                  <span className="text-blue-400 font-bold text-xs md:text-sm">
                                    {user.firstName.charAt(0)}
                                    {user.lastName?.charAt(0) || ''}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-blue-900/30 border border-blue-800 flex items-center justify-center">
                                <span className="text-blue-400 font-bold text-xs md:text-sm">
                                  {user.firstName.charAt(0)}
                                  {user.lastName?.charAt(0) || ''}
                                </span>
                              </div>
                            )}
                            {/* WhatsApp Status Indicator on Profile Picture */}
                            {user.phone && whatsAppProfiles[user.phone] && !whatsAppProfiles[user.phone].loading && (
                              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border-2 border-[#2a2a2a] ${whatsAppProfiles[user.phone].isRegistered ? 'bg-green-500' : 'bg-red-500 shadow-[0_0_2px_rgba(239,68,68,0.5)]'}`}></div>
                            )}
                          </div>
                          <div className="ml-3">
                            <div className="text-xs md:text-sm font-bold text-gray-100 leading-tight">
                              {user.firstName} {user.lastName}
                            </div>
                            {user.phone && (
                              <div className="flex items-center mt-1">
                                <FaWhatsapp className="text-green-500 mr-1 text-[10px] md:text-xs" />
                                <div className="text-[10px] md:text-xs text-gray-400 font-medium">
                                  {formatPhoneNumber(user.phone)}
                                </div>
                                {whatsAppProfiles[user.phone] && !whatsAppProfiles[user.phone].loading && (
                                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] md:text-[10px] font-bold uppercase tracking-tighter ${whatsAppProfiles[user.phone].isRegistered ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                    {whatsAppProfiles[user.phone].isRegistered ? 'Active' : 'No WA'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-2 whitespace-nowrap hidden md:table-cell">
                        <div className="text-xs md:text-sm text-gray-400">{user.email}</div>
                      </td>
                      <td className="px-2 md:px-4 py-2 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 inline-flex text-[10px] md:text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                            user.role
                          )}`}
                        >
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-2 whitespace-nowrap text-right text-[10px] md:text-xs font-medium">
                        <button
                          onClick={() => {
                            // Allow ADMIN (90+), OWNER (100+), SUPER_ADMIN (110+)
                            if (userRoleLevel < ROLE_LEVELS.ADMIN) {
                              alert('Akses Ditolak: Fitur ini hanya untuk Owner, Admin, dan Super Admin.');
                              return;
                            }
                            handleEditUser(user);
                          }}
                          className={`text-blue-400 hover:text-blue-300 mr-2 md:mr-3 ${userRoleLevel < ROLE_LEVELS.ADMIN ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                          title={userRoleLevel < ROLE_LEVELS.ADMIN ? 'Akses Ditolak: Hanya untuk Admin/Owner' : 'Edit User'}
                        >
                          <FaEdit className="inline" /> <span className="hidden md:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            // Allow ADMIN (90+), OWNER (100+), SUPER_ADMIN (110+)
                            if (userRoleLevel < ROLE_LEVELS.ADMIN) {
                              alert('Akses Ditolak: Fitur ini hanya untuk Owner, Admin, dan Super Admin.');
                              return;
                            }
                            handleDeleteUser(user.id);
                          }}
                          className={`text-red-400 hover:text-red-300 ${userRoleLevel < ROLE_LEVELS.ADMIN ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                          title={userRoleLevel < ROLE_LEVELS.ADMIN ? 'Akses Ditolak: Hanya untuk Admin/Owner' : 'Hapus User'}
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
        <div className="flex-[2] min-h-[150px] overflow-auto bg-[#1f2937] rounded-lg border border-green-900/50 p-3 shadow-inner">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-md bg-green-600 text-white text-xl shadow-lg shadow-green-900/50">
                💬
              </div>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-semibold text-white mb-1">
                WhatsApp AI Commands untuk Staff
              </h3>
              <p className="text-xs text-gray-400 mb-2">
                Semua staff dengan nomor WhatsApp terdaftar dapat menggunakan AI commands untuk operasional harian.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                {/* Upload Vehicle */}
                <div className="bg-[#2a2a2a] rounded-lg p-2 border border-green-800/50 overflow-hidden hover:border-green-600 transition-colors">
                  <div className="flex items-start">
                    <span className="text-lg mr-2 flex-shrink-0">📸</span>
                    <div className="flex-1 min-w-0 overflow-auto max-h-28">
                      <h4 className="font-bold text-gray-200 text-xs mb-0.5">upload - Upload Mobil</h4>
                      <p className="text-[10px] text-gray-500 mb-1">Ketik upload + foto + info</p>
                      <code className="text-[10px] bg-[#1a1a1a] text-gray-300 px-1.5 py-0.5 rounded block whitespace-nowrap overflow-x-auto border border-[#333]">
                        upload Avanza 2020 150jt
                      </code>
                    </div>
                  </div>
                </div>

                {/* Update Status */}
                <div className="bg-[#2a2a2a] rounded-lg p-2 border border-blue-800/50 overflow-hidden hover:border-blue-600 transition-colors">
                  <div className="flex items-start">
                    <span className="text-lg mr-2 flex-shrink-0">🔄</span>
                    <div className="flex-1 min-w-0 overflow-auto max-h-28">
                      <h4 className="font-bold text-gray-200 text-xs mb-0.5">status - Update Status</h4>
                      <p className="text-[10px] text-gray-500 mb-1">Update: SOLD, BOOKED</p>
                      <code className="text-[10px] bg-[#1a1a1a] text-gray-300 px-1.5 py-0.5 rounded block whitespace-nowrap overflow-x-auto border border-[#333]">
                        status PM-001 SOLD
                      </code>
                    </div>
                  </div>
                </div>

                {/* Check Inventory */}
                <div className="bg-[#2a2a2a] rounded-lg p-2 border border-purple-800/50 overflow-hidden hover:border-purple-600 transition-colors">
                  <div className="flex items-start">
                    <span className="text-lg mr-2 flex-shrink-0">📊</span>
                    <div className="flex-1 min-w-0 overflow-auto max-h-28">
                      <h4 className="font-bold text-gray-200 text-xs mb-0.5">inventory - Cek Stok</h4>
                      <p className="text-[10px] text-gray-500 mb-1">Lihat stok & filter</p>
                      <code className="text-[10px] bg-[#1a1a1a] text-gray-300 px-1.5 py-0.5 rounded block whitespace-nowrap overflow-x-auto border border-[#333]">
                        inventory AVAILABLE
                      </code>
                    </div>
                  </div>
                </div>

                {/* Get Stats */}
                <div className="bg-[#2a2a2a] rounded-lg p-2 border border-orange-800/50 overflow-hidden hover:border-orange-600 transition-colors">
                  <div className="flex items-start">
                    <span className="text-lg mr-2 flex-shrink-0">📈</span>
                    <div className="flex-1 min-w-0 overflow-auto max-h-28">
                      <h4 className="font-bold text-gray-200 text-xs mb-0.5">stats - Statistik</h4>
                      <p className="text-[10px] text-gray-500 mb-1">Data penjualan & leads</p>
                      <code className="text-[10px] bg-[#1a1a1a] text-gray-300 px-1.5 py-0.5 rounded block whitespace-nowrap overflow-x-auto border border-[#333]">
                        stats today
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-2 pt-2 border-t border-green-800/30">
                <div className="flex items-center text-[9px] md:text-xs text-gray-400">
                  <span className="inline-block w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full mr-1.5 md:mr-2 flex-shrink-0"></span>
                  <span className="hidden md:inline">Staff harus memiliki <strong>Nomor WhatsApp</strong> terdaftar untuk menggunakan commands</span>
                  <span className="md:hidden">Staff perlu <strong>No. WA</strong> untuk commands</span>
                </div>
                <a
                  href="/dashboard/whatsapp-ai"
                  className="text-[9px] md:text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap ml-3 md:ml-0"
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto backdrop-blur-sm">
          <div className="bg-[#2a2a2a] rounded-lg shadow-xl max-w-md w-full my-auto border border-[#444]">
            <div className="p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-white mb-4">
                Tambah Staff Baru
              </h3>

              <form onSubmit={handleCreateUser} className="space-y-4">
                {formError && (
                  <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Nama Depan *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                    placeholder="John"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Nama Belakang
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                    placeholder="Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Nomor WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                    placeholder="Contoh: 6281234567890"
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
                    <option value="SALES">Staff/Sales</option>
                    <option value="ADMIN">Admin</option>
                    <option value="OWNER">Owner</option>
                  </select>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Admin & Owner dapat mengelola Tim & Pengaturan.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Konfirmasi Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="••••••••"
                    />
                  </div>
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
                        password: '',
                        confirmPassword: '',
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full my-auto">
            <div className="p-6 max-h-[90vh] overflow-y-auto">
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
                    <option value="SALES">Staff/Sales</option>
                    <option value="ADMIN">Admin</option>
                    <option value="OWNER">Owner</option>
                  </select>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Admin & Owner dapat mengelola Tim & Pengaturan.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password Baru
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Kosongkan jika tidak diubah"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Konfirmasi Password
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Kosongkan jika tidak diubah"
                    />
                  </div>
                </div>
                {formData.password && (
                  <p className="text-[10px] text-blue-600 mt-1">
                    * Password akan diperbarui setelah Anda menekan Simpan Perubahan.
                  </p>
                )}

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
                        password: '',
                        confirmPassword: '',
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
