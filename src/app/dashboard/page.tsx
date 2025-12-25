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
      const response = await fetch(`/api/v1/dashboard/activities?tenantId=${tenantId}&limit=20`);
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
      title: 'WhatsApp AI',
      value: stats?.leads.active || 0,
      subValue: stats?.leads.today || 0,
      subLabel: 'chat hari ini',
      subColor: 'text-emerald-600',
      emoji: '💬',
      gradient: 'from-emerald-500 to-emerald-600',
      bgLight: 'bg-emerald-50',
      href: '/dashboard/whatsapp-ai',
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
    <div className="flex flex-col gap-3 h-[calc(100vh-90px)] -mt-2">
      {/* Welcome Header - Elegant Rich Modern */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl px-3 md:px-6 py-3 md:py-4 shadow-lg flex-shrink-0 ml-8 md:ml-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-2xl font-bold text-white truncate">
            Selamat Datang di Prima Mobil
          </h1>
          <p className="text-xs md:text-sm text-slate-300">Dashboard manajemen showroom</p>
        </div>
        <span className="inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 ml-2 flex-shrink-0">
          <span className="w-1.5 md:w-2 h-1.5 md:h-2 bg-emerald-400 rounded-full mr-1 md:mr-2 animate-pulse"></span>
          Online
        </span>
      </div>

      {/* Stats Grid - Cards with Colored Icons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 flex-shrink-0">
        {statsConfig.map((stat, index) => (
          <Link
            key={index}
            href={stat.href}
            className={`group bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all p-2 md:p-3 ${
              index === 0 ? 'hover:border-blue-400 hover:bg-blue-50/50' :
              index === 1 ? 'hover:border-emerald-400 hover:bg-emerald-50/50' :
              index === 2 ? 'hover:border-violet-400 hover:bg-violet-50/50' :
              'hover:border-amber-400 hover:bg-amber-50/50'
            }`}
          >
            {/* Mobile: Vertical layout, Desktop: Horizontal */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              {/* Icon - Top on mobile, Right on desktop */}
              <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-all shadow-sm mx-auto md:mx-0 md:order-2 mb-2 md:mb-0 ${
                index === 0 ? 'bg-blue-100 group-hover:bg-blue-500 border-2 border-blue-200 group-hover:border-blue-500' :
                index === 1 ? 'bg-emerald-100 group-hover:bg-emerald-500 border-2 border-emerald-200 group-hover:border-emerald-500' :
                index === 2 ? 'bg-violet-100 group-hover:bg-violet-500 border-2 border-violet-200 group-hover:border-violet-500' :
                'bg-amber-100 group-hover:bg-amber-500 border-2 border-amber-200 group-hover:border-amber-500'
              }`}>
                <span className="text-xl md:text-3xl group-hover:scale-110 transition-transform">{stat.emoji}</span>
              </div>
              {/* Text - Below icon on mobile, Left on desktop */}
              <div className="flex-1 min-w-0 text-center md:text-left md:order-1">
                <p className="text-[9px] md:text-[10px] font-medium text-gray-500 uppercase tracking-wide truncate">
                  {stat.title}
                </p>
                {loadingStats ? (
                  <div className="h-5 md:h-6 w-8 md:w-10 bg-gray-100 animate-pulse rounded mt-1 mx-auto md:mx-0"></div>
                ) : (
                  <p className="text-xl md:text-2xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                )}
                {!loadingStats && (
                  <p className="text-[9px] md:text-[10px] text-gray-400 mt-0.5 truncate">
                    <span className={stat.subColor}>
                      {stat.isPercent ? `${stat.subValue >= 0 ? '+' : ''}${stat.subValue}%` : `+${stat.subValue}`}
                    </span>
                    {' '}{stat.subLabel}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Content - Activity & Subscription Row - FLEX GROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1 min-h-0">
        {/* Left: Activity */}
        <div className="md:col-span-2 min-h-0 overflow-hidden order-2 md:order-1">
          <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm md:text-base font-semibold text-gray-800">Aktivitas Terkini</h3>
              <Link href="/dashboard/vehicles?sort=newest" className="text-[10px] md:text-xs text-gray-500 hover:text-gray-700">
                Lihat Semua →
              </Link>
            </div>
            <div className="p-2 flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: 'calc(100% - 40px)' }}>
              {loadingActivities ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2 animate-pulse">
                      <div className="w-7 md:w-8 h-7 md:h-8 bg-gray-100 rounded-lg"></div>
                      <div className="flex-1 h-4 bg-gray-100 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-1">
                  {activities.map((activity, index) => (
                    <Link
                      key={index}
                      href={getActivityLink(activity)}
                      className="flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className={`w-7 h-7 md:w-8 md:h-8 ${getActivityColor(activity.icon)} rounded-lg flex items-center justify-center text-white text-xs md:text-sm flex-shrink-0`}>
                        {activity.type === 'vehicle_added' && '🚗'}
                        {activity.type === 'lead_created' && '📞'}
                        {activity.type === 'staff_joined' && '👤'}
                        {activity.type === 'sale_completed' && '💰'}
                        {!['vehicle_added', 'lead_created', 'staff_joined', 'sale_completed'].includes(activity.type) && '•'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm text-gray-700 truncate group-hover:text-gray-900">
                          {activity.message}
                        </p>
                      </div>
                      <span className="text-[10px] md:text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatRelativeTime(activity.timestamp)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs md:text-sm text-gray-400 text-center py-4 md:py-8">Belum ada aktivitas</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Subscription - Show first on mobile */}
        <div className="md:col-span-1 order-1 md:order-2">
          {!loadingSubscription && <SubscriptionCard subscription={subscription} />}
        </div>
      </div>

      {/* Quick Actions - Horizontal scroll on mobile, Grid on desktop */}
      <div className="bg-white rounded-lg border border-gray-200 flex-shrink-0">
        <div className="px-3 md:px-4 py-2 border-b border-gray-100">
          <h3 className="text-sm md:text-base font-bold text-gray-800">Aksi Cepat</h3>
        </div>
        <div className="p-2 md:p-3">
          {/* Mobile: Horizontal scroll, Desktop: Grid */}
          <div className="flex md:grid md:grid-cols-4 gap-2 md:gap-3 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
            <Link
              href="/dashboard/vehicles"
              className="flex flex-col md:flex-row items-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-xl bg-blue-50 hover:bg-blue-100 transition-all group border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg min-w-[70px] md:min-w-0"
            >
              <div className="w-9 h-9 md:w-12 md:h-12 bg-blue-100 group-hover:bg-blue-200 rounded-xl flex items-center justify-center transition-colors border border-blue-300 flex-shrink-0">
                <span className="text-lg md:text-2xl">🚗</span>
              </div>
              <span className="text-[10px] md:text-sm font-semibold text-blue-800 group-hover:text-blue-900 text-center md:text-left whitespace-nowrap md:whitespace-normal">Kendaraan</span>
            </Link>
            <Link
              href="/dashboard/whatsapp-ai/conversations"
              className="flex flex-col md:flex-row items-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-all group border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-lg min-w-[70px] md:min-w-0"
            >
              <div className="w-9 h-9 md:w-12 md:h-12 bg-emerald-100 group-hover:bg-emerald-200 rounded-xl flex items-center justify-center transition-colors border border-emerald-300 flex-shrink-0">
                <span className="text-lg md:text-2xl">💬</span>
              </div>
              <span className="text-[10px] md:text-sm font-semibold text-emerald-800 group-hover:text-emerald-900 text-center md:text-left whitespace-nowrap md:whitespace-normal">WhatsApp</span>
            </Link>
            <Link
              href="/dashboard/users"
              className="flex flex-col md:flex-row items-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-xl bg-violet-50 hover:bg-violet-100 transition-all group border-2 border-violet-200 hover:border-violet-400 hover:shadow-lg min-w-[70px] md:min-w-0"
            >
              <div className="w-9 h-9 md:w-12 md:h-12 bg-violet-100 group-hover:bg-violet-200 rounded-xl flex items-center justify-center transition-colors border border-violet-300 flex-shrink-0">
                <span className="text-lg md:text-2xl">👥</span>
              </div>
              <span className="text-[10px] md:text-sm font-semibold text-violet-800 group-hover:text-violet-900 text-center md:text-left whitespace-nowrap md:whitespace-normal">Tim</span>
            </Link>
            <Link
              href="/dashboard/blog"
              className="flex flex-col md:flex-row items-center gap-1.5 md:gap-3 p-2 md:p-3 rounded-xl bg-orange-50 hover:bg-orange-100 transition-all group border-2 border-orange-200 hover:border-orange-400 hover:shadow-lg min-w-[70px] md:min-w-0"
            >
              <div className="w-9 h-9 md:w-12 md:h-12 bg-orange-100 group-hover:bg-orange-200 rounded-xl flex items-center justify-center transition-colors border border-orange-300 flex-shrink-0">
                <span className="text-lg md:text-2xl">📝</span>
              </div>
              <span className="text-[10px] md:text-sm font-semibold text-orange-800 group-hover:text-orange-900 text-center md:text-left whitespace-nowrap md:whitespace-normal">Blog</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
