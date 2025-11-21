'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

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
}

interface TeamStats {
  total: number;
  active: number;
  inactive: number;
  onLeave: number;
  newThisMonth: number;
  departments: Array<{
    name: string;
    count: number;
  }>;
  roles: Array<{
    name: string;
    count: number;
  }>;
}

interface RecentActivity {
  id: string;
  type: 'member_added' | 'role_changed' | 'member_activated' | 'member_deactivated';
  memberName: string;
  description: string;
  timestamp: Date;
  performedBy: string;
}

export default function TeamDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load team statistics
      const statsResponse = await fetch('/api/team/analytics?reportType=overview');
      if (!statsResponse.ok) throw new Error('Failed to load team statistics');
      const statsData = await statsResponse.json();
      setStats(statsData.data);

      // Load recent team members
      const membersResponse = await fetch('/api/team/members?limit=5&sortBy=createdAt&sortOrder=desc');
      if (!membersResponse.ok) throw new Error('Failed to load team members');
      const membersData = await membersResponse.json();
      setTeamMembers(membersData.data);

      // Load recent activity (this would be implemented in a real API)
      setRecentActivity([
        {
          id: '1',
          type: 'member_added',
          memberName: 'Budi Santoso',
          description: 'Added as Sales Executive',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          performedBy: 'Admin'
        },
        {
          id: '2',
          type: 'role_changed',
          memberName: 'Siti Nurhaliza',
          description: 'Role updated to Sales Manager',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
          performedBy: 'Admin'
        },
        {
          id: '3',
          type: 'member_activated',
          memberName: 'Ahmad Rizki',
          description: 'Account activated',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          performedBy: 'System'
        }
      ]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
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

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'member_added': return '👤';
      case 'role_changed': return '🔄';
      case 'member_activated': return '✅';
      case 'member_deactivated': return '⏸️';
      default: return '📝';
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Baru saja';
    if (diffInHours < 24) return `${diffInHours} jam yang lalu`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} hari yang lalu`;

    return format(date, 'dd MMM yyyy', { locale: id });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat dashboard tim...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Terjadi Kesalahan</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
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
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Tim</h1>
              <p className="text-gray-600">Kelola tim dan pantau performa showroom Anda</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => router.push('/team/invite')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <span>➕</span>
                <span className="hidden sm:inline">Undang Anggota</span>
                <span className="sm:hidden">Undang</span>
              </button>
              <button
                onClick={loadDashboardData}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                🔄
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">👥</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Anggota</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-semibold">✅</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Aktif</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 font-semibold">📅</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Cuti</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.onLeave}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-semibold">🆕</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Baru Bulan Ini</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.newThisMonth}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Team Members */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Anggota Tim Terbaru</h2>
                  <button
                    onClick={() => router.push('/team/members')}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Lihat Semua →
                  </button>
                </div>
              </div>
              <div className="p-6">
                {teamMembers.length > 0 ? (
                  <div className="space-y-4">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-gray-600 font-semibold">
                              {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {member.firstName} {member.lastName}
                            </p>
                            <p className="text-sm text-gray-600">{member.email}</p>
                            {member.position && (
                              <p className="text-xs text-gray-500">{member.position}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(member.status)}`}>
                            {member.status === 'active' ? 'Aktif' : member.status === 'inactive' ? 'Tidak Aktif' : 'Cuti'}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            {format(member.createdAt, 'dd MMM yyyy', { locale: id })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-4xl mb-4">👥</div>
                    <p className="text-gray-600">Belum ada anggota tim</p>
                    <button
                      onClick={() => router.push('/team/invite')}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Undang Anggota Pertama
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Aktivitas Terbaru</h2>
              </div>
              <div className="p-6">
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 text-xl">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{activity.memberName}</span> - {activity.description}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatRelativeTime(activity.timestamp)} oleh {activity.performedBy}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-4xl mb-4">📊</div>
                    <p className="text-gray-600">Belum ada aktivitas</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Aksi Cepat</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/team/invite')}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="text-blue-600 text-2xl mb-2">📧</div>
              <h3 className="font-medium text-gray-900">Undang Anggota</h3>
              <p className="text-sm text-gray-600">Tambah anggota baru ke tim</p>
            </button>

            <button
              onClick={() => router.push('/team/members')}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="text-green-600 text-2xl mb-2">👥</div>
              <h3 className="font-medium text-gray-900">Kelola Anggota</h3>
              <p className="text-sm text-gray-600">Lihat dan edit anggota tim</p>
            </button>

            <button
              onClick={() => router.push('/team/roles')}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="text-purple-600 text-2xl mb-2">🔐</div>
              <h3 className="font-medium text-gray-900">Kelola Peran</h3>
              <p className="text-sm text-gray-600">Atur peran dan izin akses</p>
            </button>

            <button
              onClick={() => router.push('/team/analytics')}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className="text-orange-600 text-2xl mb-2">📊</div>
              <h3 className="font-medium text-gray-900">Analitik Tim</h3>
              <p className="text-sm text-gray-600">Pantau performa tim</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}