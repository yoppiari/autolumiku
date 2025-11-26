'use client';

import React, { useState, useEffect } from 'react';
import SubscriptionCard from '@/components/dashboard/SubscriptionCard';

interface DashboardStats {
  vehicles: {
    total: number;
    thisMonth: number;
  };
  leads: {
    active: number;
    today: number;
  };
  team: {
    total: number;
    active: number;
  };
  sales: {
    thisMonth: number;
    lastMonth: number;
    changePercent: number;
  };
}

interface Activity {
  type: string;
  icon: string;
  message: string;
  timestamp: string;
  details: any;
}

export default function ShowroomDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      loadSubscription(parsedUser.tenantId);
      loadDashboardStats(parsedUser.tenantId);
      loadRecentActivities(parsedUser.tenantId);
    }
  }, []);

  const loadSubscription = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/subscription`);
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.data?.subscription || null);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const loadDashboardStats = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/v1/dashboard/stats?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadRecentActivities = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/v1/dashboard/activities?tenantId=${tenantId}&limit=5`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.data.activities || []);
      }
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    if (diffDays === 1) return 'Kemarin';
    if (diffDays < 7) return `${diffDays} hari yang lalu`;
    return past.toLocaleDateString('id-ID');
  };

  const getIconColor = (icon: string) => {
    switch (icon) {
      case 'blue': return 'bg-blue-600';
      case 'green': return 'bg-green-600';
      case 'purple': return 'bg-purple-600';
      case 'yellow': return 'bg-yellow-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Selamat Datang, {user?.firstName}!
        </h2>
        <p className="text-gray-600">
          Dashboard manajemen showroom Anda
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Vehicles */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Kendaraan</p>
              {loadingStats ? (
                <div className="h-10 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.vehicles.total || 0}
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🚗</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            {loadingStats ? (
              <span className="h-4 w-20 bg-gray-200 animate-pulse rounded inline-block"></span>
            ) : (
              <>
                <span className="text-green-600 font-medium">
                  +{stats?.vehicles.thisMonth || 0}
                </span> bulan ini
              </>
            )}
          </p>
        </div>

        {/* Active Leads */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Leads Aktif</p>
              {loadingStats ? (
                <div className="h-10 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.leads.active || 0}
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📞</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            {loadingStats ? (
              <span className="h-4 w-20 bg-gray-200 animate-pulse rounded inline-block"></span>
            ) : (
              <>
                <span className="text-orange-600 font-medium">
                  {stats?.leads.today || 0} baru
                </span> hari ini
              </>
            )}
          </p>
        </div>

        {/* Team Members */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tim Showroom</p>
              {loadingStats ? (
                <div className="h-10 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.team.total || 0}
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            {loadingStats ? (
              <span className="h-4 w-20 bg-gray-200 animate-pulse rounded inline-block"></span>
            ) : (
              <span className="text-green-600 font-medium">
                {stats?.team.active || 0} aktif
              </span>
            )}
          </p>
        </div>

        {/* Sales This Month */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Penjualan Bulan Ini</p>
              {loadingStats ? (
                <div className="h-10 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.sales.thisMonth || 0}
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            {loadingStats ? (
              <span className="h-4 w-20 bg-gray-200 animate-pulse rounded inline-block"></span>
            ) : (
              <>
                <span className={`font-medium ${
                  (stats?.sales.changePercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(stats?.sales.changePercent || 0) >= 0 ? '+' : ''}
                  {stats?.sales.changePercent || 0}%
                </span> vs bulan lalu
              </>
            )}
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Aktivitas Terkini</h3>
        </div>
        <div className="p-6">
          {loadingActivities ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start space-x-4">
                  <div className="w-2 h-2 bg-gray-200 rounded-full mt-2 animate-pulse"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className={`w-2 h-2 ${getIconColor(activity.icon)} rounded-full mt-2`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500">{formatRelativeTime(activity.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Belum ada aktivitas terkini</p>
            </div>
          )}
        </div>
      </div>

      {/* Subscription & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Card */}
        <div className="lg:col-span-1">
          {!loadingSubscription && <SubscriptionCard subscription={subscription} />}
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6 h-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Aksi Cepat</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="/dashboard/vehicles/upload"
                className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <span className="mr-2">➕</span>
                Tambah Kendaraan
              </a>
              <a
                href="/dashboard/leads"
                className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <span className="mr-2">📞</span>
                Lihat Leads
              </a>
              <a
                href="/dashboard/users"
                className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                <span className="mr-2">👥</span>
                Kelola Tim
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
