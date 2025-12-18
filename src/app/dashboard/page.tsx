'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  link?: string;
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

  const getActivityColor = (icon: string) => {
    switch (icon) {
      case 'blue': return 'bg-blue-500';
      case 'green': return 'bg-green-500';
      case 'purple': return 'bg-purple-500';
      case 'yellow': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  // Get activity link based on type and details
  const getActivityLink = (activity: Activity): string => {
    switch (activity.type) {
      case 'vehicle_added':
        return activity.details?.vehicleId
          ? `/dashboard/vehicles/${activity.details.vehicleId}`
          : '/dashboard/vehicles';
      case 'staff_joined':
        return '/dashboard/users';
      case 'lead_created':
        return activity.details?.leadId
          ? `/dashboard/leads?id=${activity.details.leadId}`
          : '/dashboard/leads';
      case 'sale_completed':
        return activity.details?.vehicleId
          ? `/dashboard/vehicles/${activity.details.vehicleId}`
          : '/dashboard/vehicles?status=SOLD';
      default:
        return '/dashboard';
    }
  };

  // Stats card configuration with links
  const statsConfig = [
    {
      title: 'Total Kendaraan',
      value: stats?.vehicles.total || 0,
      subValue: stats?.vehicles.thisMonth || 0,
      subLabel: 'bulan ini',
      subColor: 'text-emerald-600',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 11V7a2 2 0 012-2h10a2 2 0 012 2v4M7 13v2a2 2 0 002 2h6a2 2 0 002-2v-2" />
        </svg>
      ),
      emoji: '🚗',
      gradient: 'from-blue-500 to-blue-600',
      bgLight: 'bg-blue-50',
      href: '/dashboard/vehicles',
    },
    {
      title: 'Leads Aktif',
      value: stats?.leads.active || 0,
      subValue: stats?.leads.today || 0,
      subLabel: 'baru hari ini',
      subColor: 'text-orange-600',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      emoji: '📞',
      gradient: 'from-emerald-500 to-emerald-600',
      bgLight: 'bg-emerald-50',
      href: '/dashboard/leads',
    },
    {
      title: 'Tim Showroom',
      value: stats?.team.total || 0,
      subValue: stats?.team.active || 0,
      subLabel: 'aktif',
      subColor: 'text-emerald-600',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      emoji: '👥',
      gradient: 'from-violet-500 to-violet-600',
      bgLight: 'bg-violet-50',
      href: '/dashboard/users',
    },
    {
      title: 'Penjualan',
      value: stats?.sales.thisMonth || 0,
      subValue: stats?.sales.changePercent || 0,
      subLabel: 'vs bulan lalu',
      subColor: (stats?.sales.changePercent || 0) >= 0 ? 'text-emerald-600' : 'text-red-600',
      isPercent: true,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      emoji: '💰',
      gradient: 'from-amber-500 to-amber-600',
      bgLight: 'bg-amber-50',
      href: '/dashboard/vehicles?status=SOLD',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Welcome Section with Gradient - Compact */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-xl shadow-md p-4">
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              Selamat Datang, {user?.firstName || 'User'}! 👋
            </h1>
            <p className="text-blue-100 text-sm">
              Dashboard manajemen showroom Anda
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse"></span>
            Online
          </span>
        </div>
      </div>

      {/* Stats Grid - Compact Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statsConfig.map((stat, index) => (
          <Link
            key={index}
            href={stat.href}
            className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 truncate">
                  {stat.title}
                </p>
                {loadingStats ? (
                  <div className="h-7 w-12 bg-gray-200 animate-pulse rounded mt-1"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">
                    {stat.value}
                  </p>
                )}
              </div>
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white shadow group-hover:scale-105 transition-transform`}>
                <span className="text-lg">{stat.emoji}</span>
              </div>
            </div>
            <div className="mt-2 flex items-center">
              {loadingStats ? (
                <span className="h-3 w-16 bg-gray-200 animate-pulse rounded"></span>
              ) : (
                <span className="text-xs">
                  <span className={`font-semibold ${stat.subColor}`}>
                    {stat.isPercent
                      ? `${stat.subValue >= 0 ? '+' : ''}${stat.subValue}%`
                      : `+${stat.subValue}`
                    }
                  </span>
                  <span className="text-gray-400 ml-1">{stat.subLabel}</span>
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Main Content Grid - Compact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Aktivitas Terkini - 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <span>📊</span>
                  Aktivitas Terkini
                </h3>
                <Link
                  href="/dashboard/vehicles?sort=newest"
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
                >
                  Lihat Semua
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
            <div className="p-3">
              {loadingActivities ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center space-x-3 animate-pulse">
                      <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-2 bg-gray-200 rounded w-1/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-1">
                  {activities.map((activity, index) => (
                    <Link
                      key={index}
                      href={getActivityLink(activity)}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className={`w-8 h-8 ${getActivityColor(activity.icon)} rounded-lg flex items-center justify-center text-white text-sm`}>
                        {activity.type === 'vehicle_added' && '🚗'}
                        {activity.type === 'lead_created' && '📞'}
                        {activity.type === 'staff_joined' && '👥'}
                        {activity.type === 'sale_completed' && '💰'}
                        {!['vehicle_added', 'lead_created', 'staff_joined', 'sale_completed'].includes(activity.type) && '📌'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate group-hover:text-blue-600">
                          {activity.message}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {formatRelativeTime(activity.timestamp)}
                        </p>
                      </div>
                      <svg className="w-3 h-3 text-gray-300 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <span className="text-2xl">📭</span>
                  <p className="text-gray-500 text-xs mt-2">Belum ada aktivitas</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subscription Card - 1 column */}
        <div className="lg:col-span-1">
          {!loadingSubscription && <SubscriptionCard subscription={subscription} />}
        </div>
      </div>

      {/* Quick Actions - Compact */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <span>⚡</span>
            Aksi Cepat
          </h3>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Link
              href="/dashboard/vehicles/upload"
              className="group flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:bg-slate-700 hover:border-slate-700 transition-all"
            >
              <div className="w-9 h-9 bg-slate-100 group-hover:bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-base">➕</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 group-hover:text-white truncate">Tambah Kendaraan</p>
                <p className="text-[10px] text-gray-400 group-hover:text-gray-300">Upload unit baru</p>
              </div>
            </Link>

            <Link
              href="/dashboard/leads"
              className="group flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:bg-slate-700 hover:border-slate-700 transition-all"
            >
              <div className="w-9 h-9 bg-slate-100 group-hover:bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-base">📞</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 group-hover:text-white truncate">Lihat Leads</p>
                <p className="text-[10px] text-gray-400 group-hover:text-gray-300">Kelola customer</p>
              </div>
            </Link>

            <Link
              href="/dashboard/users"
              className="group flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:bg-slate-700 hover:border-slate-700 transition-all"
            >
              <div className="w-9 h-9 bg-slate-100 group-hover:bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-base">👥</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 group-hover:text-white truncate">Kelola Tim</p>
                <p className="text-[10px] text-gray-400 group-hover:text-gray-300">Manage staff</p>
              </div>
            </Link>

            <Link
              href="/dashboard/whatsapp-ai"
              className="group flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:bg-slate-700 hover:border-slate-700 transition-all"
            >
              <div className="w-9 h-9 bg-slate-100 group-hover:bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-base">💬</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 group-hover:text-white truncate">WhatsApp AI</p>
                <p className="text-[10px] text-gray-400 group-hover:text-gray-300">Setup chatbot</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
