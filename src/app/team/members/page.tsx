'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { debounce } from 'lodash';

// Types
interface TeamMember {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  department?: string;
  position?: string;
  status: 'active' | 'inactive' | 'on_leave';
  roles: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  lastLogin?: Date;
  createdAt: Date;
  hireDate?: Date;
  onlineStatus: 'online' | 'offline' | 'away';
}

interface Filters {
  search: string;
  status: string;
  department: string;
  role: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function TeamMembersList() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: '',
    department: '',
    role: '',
    sortBy: 'firstName',
    sortOrder: 'asc'
  });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search function
  const debouncedSearch = debounce((searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm }));
  }, 300);

  useEffect(() => {
    loadTeamMembers();
  }, [filters, pagination.page]);

  useEffect(() => {
    setShowBulkActions(selectedMembers.length > 0);
  }, [selectedMembers]);

  const loadTeamMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      });

      if (filters.search) queryParams.append('search', filters.search);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.department) queryParams.append('department', filters.department);
      if (filters.role) queryParams.append('role', filters.role);

      const response = await fetch(`/api/team/members?${queryParams}`);
      if (!response.ok) throw new Error('Failed to load team members');

      const data = await response.json();
      setTeamMembers(data.data);
      setPagination(prev => ({
        ...prev,
        ...data.pagination
      }));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handleSearchChange = (value: string) => {
    debouncedSearch(value);
  };

  const handleSelectMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === teamMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(teamMembers.map(member => member.id));
    }
  };

  const handleBulkAction = async (action: string) => {
    try {
      // Implementation for bulk actions
      console.log(`Bulk action: ${action} for members:`, selectedMembers);
      // This would make API calls to perform bulk operations
      setSelectedMembers([]);
      await loadTeamMembers();
    } catch (err) {
      console.error('Bulk action failed:', err);
    }
  };

  const handleDeactivateMember = async (memberId: string) => {
    if (!confirm('Apakah Anda yakin ingin menonaktifkan anggota ini?')) return;

    try {
      const response = await fetch(`/api/team/members/${memberId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to deactivate member');

      await loadTeamMembers();
    } catch (err) {
      console.error('Failed to deactivate member:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'on_leave': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOnlineStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-400';
      case 'away': return 'bg-yellow-400';
      case 'offline': return 'bg-gray-300';
      default: return 'bg-gray-300';
    }
  };

  const getRoleColor = (roleName: string) => {
    const roleColors: Record<string, string> = {
      'Showroom Manager': 'bg-purple-100 text-purple-800',
      'Sales Manager': 'bg-blue-100 text-blue-800',
      'Sales Executive': 'bg-green-100 text-green-800',
      'Finance Manager': 'bg-orange-100 text-orange-800',
      'Service Advisor': 'bg-indigo-100 text-indigo-800',
      'Marketing Coordinator': 'bg-pink-100 text-pink-800',
      'Inventory Manager': 'bg-teal-100 text-teal-800',
      'Read-only Staff': 'bg-gray-100 text-gray-800'
    };
    return roleColors[roleName] || 'bg-gray-100 text-gray-800';
  };

  const formatRelativeTime = (date?: Date) => {
    if (!date) return 'Tidak pernah login';
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 5) return 'Baru saja';
    if (diffInMinutes < 60) return `${diffInMinutes} menit yang lalu`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} jam yang lalu`;
    return format(date, 'dd MMM yyyy', { locale: id });
  };

  if (error && teamMembers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Terjadi Kesalahan</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadTeamMembers}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-6 space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Anggota Tim</h1>
              <p className="text-gray-600">Kelola dan pantau semua anggota tim showroom</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => router.push('/team')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Kembali
              </button>
              <button
                onClick={() => router.push('/team/invite')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <span>➕</span>
                <span>Undang Anggota</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cari Anggota
              </label>
              <input
                type="text"
                placeholder="Nama, email, atau posisi..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
                <option value="on_leave">Cuti</option>
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departemen
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
              >
                <option value="">Semua Departemen</option>
                <option value="Sales">Sales</option>
                <option value="Finance">Finance</option>
                <option value="Service">Service</option>
                <option value="Marketing">Marketing</option>
                <option value="Inventory">Inventory</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Urutkan
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              >
                <option value="firstName">Nama</option>
                <option value="email">Email</option>
                <option value="createdAt">Tanggal Bergabung</option>
                <option value="lastLogin">Terakhir Login</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Urutan
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value as 'asc' | 'desc')}
              >
                <option value="asc">A-Z</option>
                <option value="desc">Z-A</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => setFilters({
                  search: '',
                  status: '',
                  department: '',
                  role: '',
                  sortBy: 'firstName',
                  sortOrder: 'asc'
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset Filter
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {showBulkActions && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-blue-800">
                {selectedMembers.length} anggota dipilih
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBulkAction('activate')}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                >
                  Aktifkan
                </button>
                <button
                  onClick={() => handleBulkAction('deactivate')}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                >
                  Nonaktifkan
                </button>
                <button
                  onClick={() => setSelectedMembers([])}
                  className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
                >
                  Batal Pilih
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Team Members List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Memuat data anggota...</p>
            </div>
          ) : teamMembers.length > 0 ? (
            <>
              {/* Table Header */}
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={selectedMembers.length === teamMembers.length}
                    onChange={handleSelectAll}
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    {pagination.total} anggota total
                  </span>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {teamMembers.map((member) => (
                  <div key={member.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => handleSelectMember(member.id)}
                      />

                      {/* Avatar */}
                      <div className="flex-shrink-0 relative">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-semibold text-lg">
                            {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                          </span>
                        </div>
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getOnlineStatusColor(member.onlineStatus)}`}></div>
                      </div>

                      {/* Member Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {member.firstName} {member.lastName}
                            </h3>
                            <p className="text-sm text-gray-600">{member.email}</p>
                            <div className="flex items-center mt-1 space-x-2">
                              {member.position && (
                                <span className="text-xs text-gray-500">{member.position}</span>
                              )}
                              {member.department && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-xs text-gray-500">{member.department}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end space-y-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(member.status)}`}>
                              {member.status === 'active' ? 'Aktif' : member.status === 'inactive' ? 'Tidak Aktif' : 'Cuti'}
                            </span>
                            <button
                              onClick={() => handleDeactivateMember(member.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Nonaktifkan
                            </button>
                          </div>
                        </div>

                        {/* Roles */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {member.roles.map((role) => (
                            <span
                              key={role.id}
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(role.name)}`}
                            >
                              {role.name}
                            </span>
                          ))}
                        </div>

                        {/* Additional Info */}
                        <div className="flex items-center mt-3 text-xs text-gray-500 space-x-4">
                          <span>Bergabung: {format(member.createdAt, 'dd MMM yyyy', { locale: id })}</span>
                          <span>Login terakhir: {formatRelativeTime(member.lastLogin)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Menampilkan {((pagination.page - 1) * pagination.limit) + 1} hingga{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total} anggota
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={pagination.page === 1}
                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1 text-sm text-gray-700">
                        Halaman {pagination.page} dari {pagination.totalPages}
                      </span>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={pagination.page === pagination.totalPages}
                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">👥</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada anggota tim</h3>
              <p className="text-gray-600 mb-4">
                {filters.search || filters.status || filters.department
                  ? 'Tidak ada anggota yang cocok dengan filter yang dipilih'
                  : 'Mulai dengan mengundang anggota ke tim Anda'
                }
              </p>
              {!filters.search && !filters.status && !filters.department && (
                <button
                  onClick={() => router.push('/team/invite')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Undang Anggota Pertama
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}