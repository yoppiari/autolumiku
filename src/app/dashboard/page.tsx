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
        return '/dashboard/leads';
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
    <div className="space-y-6">
      {/* Welcome Section with Gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl shadow-lg p-6 sm:p-8">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]"></div>
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Selamat Datang, {user?.firstName || 'User'}! 👋
              </h1>
              <p className="text-blue-100 mt-2">
                Dashboard manajemen showroom Anda
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-white/20 text-white backdrop-blur-sm">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                Online
              </span>
            </div>
          </div>
        </div>
        {/* Decorative Elements */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      </div>

      {/* Stats Grid - Clickable Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statsConfig.map((stat, index) => (
          <Link
            key={index}
            href={stat.href}
            className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-transparent"
          >
            {/* Gradient Border on Hover */}
            <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`}></div>

            {/* Card Content */}
            <div className="relative bg-white m-[2px] rounded-2xl p-5 sm:p-6 group-hover:bg-gray-50/80 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 group-hover:text-gray-600">
                    {stat.title}
                  </p>
                  {loadingStats ? (
                    <div className="h-10 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
                  ) : (
                    <p className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 group-hover:text-gray-800">
                      {stat.value}
                    </p>
                  )}
                </div>

                {/* Icon with Gradient Background */}
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-2xl sm:text-3xl">{stat.emoji}</span>
                </div>
              </div>

              {/* Sub Info */}
              <div className="mt-4 flex items-center">
                {loadingStats ? (
                  <span className="h-4 w-24 bg-gray-200 animate-pulse rounded"></span>
                ) : (
                  <span className="text-sm">
                    <span className={`font-semibold ${stat.subColor}`}>
                      {stat.isPercent
                        ? `${stat.subValue >= 0 ? '+' : ''}${stat.subValue}%`
                        : `+${stat.subValue}`
                      }
                    </span>
                    <span className="text-gray-500 ml-1">{stat.subLabel}</span>
                  </span>
                )}
              </div>

              {/* Hover Arrow */}
              <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aktivitas Terkini - 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  Aktivitas Terkini
                </h3>
                <Link
                  href="/dashboard/vehicles?sort=newest"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:gap-2 transition-all"
                >
                  Lihat Semua
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
            <div className="p-6">
              {loadingActivities ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start space-x-4 animate-pulse">
                      <div className="w-10 h-10 bg-gray-200 rounded-xl"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-2">
                  {activities.map((activity, index) => (
                    <Link
                      key={index}
                      href={getActivityLink(activity)}
                      className="flex items-start space-x-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                    >
                      <div className={`w-10 h-10 ${getActivityColor(activity.icon)} rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform`}>
                        {activity.type === 'vehicle_added' && '🚗'}
                        {activity.type === 'lead_created' && '📞'}
                        {activity.type === 'staff_joined' && '👥'}
                        {activity.type === 'sale_completed' && '💰'}
                        {!['vehicle_added', 'lead_created', 'staff_joined', 'sale_completed'].includes(activity.type) && '📌'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {activity.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatRelativeTime(activity.timestamp)}
                        </p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">📭</span>
                  </div>
                  <p className="text-gray-500 text-sm">Belum ada aktivitas terkini</p>
                  <p className="text-gray-400 text-xs mt-1">Aktivitas akan muncul di sini</p>
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

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-xl">⚡</span>
            Aksi Cepat
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashboard/vehicles/upload"
              className="group relative flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-slate-700 hover:border-slate-700 transition-all duration-300 hover:shadow-md"
            >
              <div className="w-12 h-12 bg-slate-100 group-hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                <span className="text-2xl">➕</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800 group-hover:text-white transition-colors">Tambah Kendaraan</p>
                <p className="text-gray-500 group-hover:text-gray-300 text-sm transition-colors">Upload unit baru</p>
              </div>
            </Link>

            <Link
              href="/dashboard/leads"
              className="group relative flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-slate-700 hover:border-slate-700 transition-all duration-300 hover:shadow-md"
            >
              <div className="w-12 h-12 bg-slate-100 group-hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                <span className="text-2xl">📞</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800 group-hover:text-white transition-colors">Lihat Leads</p>
                <p className="text-gray-500 group-hover:text-gray-300 text-sm transition-colors">Kelola customer</p>
              </div>
            </Link>

            <Link
              href="/dashboard/users"
              className="group relative flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-slate-700 hover:border-slate-700 transition-all duration-300 hover:shadow-md"
            >
              <div className="w-12 h-12 bg-slate-100 group-hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                <span className="text-2xl">👥</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800 group-hover:text-white transition-colors">Kelola Tim</p>
                <p className="text-gray-500 group-hover:text-gray-300 text-sm transition-colors">Manage staff</p>
              </div>
            </Link>

            <Link
              href="/dashboard/whatsapp-ai"
              className="group relative flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-slate-700 hover:border-slate-700 transition-all duration-300 hover:shadow-md"
            >
              <div className="w-12 h-12 bg-slate-100 group-hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                <span className="text-2xl">💬</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800 group-hover:text-white transition-colors">WhatsApp AI</p>
                <p className="text-gray-500 group-hover:text-gray-300 text-sm transition-colors">Setup chatbot</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
