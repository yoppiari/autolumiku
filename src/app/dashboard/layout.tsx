'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import DashboardErrorBoundary from '@/components/dashboard/ErrorBoundary';
import SessionManager from '@/components/auth/SessionManager';
import { ROLE_LEVELS, canAccessPage, getRoleName } from '@/lib/rbac';

// Tooltip wrapper component for unauthorized navigation items
interface AuthorizedNavLinkProps {
  href: string;
  isAuthorized: boolean;
  isActive: boolean;
  children: React.ReactNode;
}

function AuthorizedNavLink({ href, isAuthorized, isActive, children }: AuthorizedNavLinkProps) {
  if (isAuthorized) {
    return (
      <Link
        href={href}
        className={`
          flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200
          ${isActive
            ? 'bg-blue-100 text-blue-700 border-2 border-yellow-500 shadow-md'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-2 border-transparent'
          }
        `}
      >
        {children}
      </Link>
    );
  }

  return (
    <div
      className="relative group/nav cursor-not-allowed"
      onClick={(e) => e.preventDefault()}
    >
      <div
        className={`
          flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
          text-gray-400 opacity-60
        `}
      >
        {children}
      </div>
      {/* Tooltip */}
      <div className="absolute z-50 hidden group-hover/nav:block left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap shadow-lg">
        You are not authorized
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
      </div>
    </div>
  );
}

interface NavItem {
  name: string;
  href: string;
  icon: string;
  minRole: number;
  excludeRoles?: number[];
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);

  // Read user from localStorage - redirect to login if not authenticated
  React.useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const authToken = localStorage.getItem('authToken');

    // Check if both user data and auth token exist
    if (!storedUser || !authToken) {
      console.log('[Dashboard] No auth data found, redirecting to login');
      window.location.href = '/login';
      return;
    }

    try {
      const userData = JSON.parse(storedUser);

      // Check if user has tenantId (showroom user)
      if (!userData.tenantId) {
        // Not a showroom user, redirect to admin login
        console.log('[Dashboard] User has no tenantId, redirecting to admin login');
        window.location.href = '/admin/login';
        return;
      }

      // Valid showroom user
      setUser(userData);
    } catch (e) {
      console.error('[Dashboard] Error parsing user data:', e);
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  }, []);

  // Fetch tenant data when user is loaded
  // Fetch directly by tenantId from user data for reliability
  React.useEffect(() => {
    if (user?.tenantId) {
      fetch(`/api/v1/tenants/${user.tenantId}`)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setTenant(data.data);
          } else if (data.tenant) {
            setTenant(data.tenant);
          }
        })
        .catch(err => {
          console.error('Error fetching tenant data:', err);
        });
    }
  }, [user]);

  // Auto-sync user roleLevel from database to fix stale localStorage data
  // This ensures ADMIN users always have correct permissions even if localStorage is outdated
  React.useEffect(() => {
    const syncUserRole = async () => {
      if (!user?.id) return;

      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        // Fetch fresh user data from API
        const response = await fetch(`/api/v1/users/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const freshUser = data.data || data.user;

          // Check if roleLevel has changed from what's in localStorage
          if (freshUser && freshUser.roleLevel !== user.roleLevel) {
            console.log(`[Dashboard] Role synced: ${user.roleLevel} → ${freshUser.roleLevel}`);

            // Update user state and localStorage with fresh roleLevel
            const updatedUser = { ...user, roleLevel: freshUser.roleLevel, role: freshUser.role };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        }
      } catch (error) {
        console.error('[Dashboard] Failed to sync user role:', error);
      }
    };

    syncUserRole();
  }, [user?.id]); // Only run when user.id changes (initial load)


  // Update document title based on tenant
  React.useEffect(() => {
    if (tenant?.name) {
      document.title = `${tenant.name} Platform`;
    }
  }, [tenant]);

  // Handle logout - manual logout only (no auto sign-out)
  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }, []);

  // All navigation items with role requirements based on Excel access matrix
  // NOTE: Analytics moved to WhatsApp AI page (/dashboard/whatsapp-ai/analytics)
  // NOTE: Invoice feature is HIDDEN for all roles
  const allNavigation: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: '🏠', minRole: ROLE_LEVELS.SALES },
    // Vehicles - Visible to all
    { name: 'Vehicles', href: '/dashboard/vehicles', icon: '🚗', minRole: ROLE_LEVELS.SALES },
    // Team - Visible to all
    { name: 'Team', href: '/dashboard/users', icon: '👥', minRole: ROLE_LEVELS.SALES },
    // WhatsApp AI - Visible to all
    { name: 'WhatsApp AI', href: '/dashboard/whatsapp-ai', icon: '💬', minRole: ROLE_LEVELS.SALES },
    // Leads - Visible to all
    { name: 'Leads', href: '/dashboard/leads', icon: '📋', minRole: ROLE_LEVELS.SALES },
    // Reports - Visible to Admin+ (HIDDEN from sidebar as per user request)
    // { name: 'Reports', href: '/dashboard/reports', icon: '📊', minRole: ROLE_LEVELS.ADMIN },
    // Blog - visible to ALL roles
    { name: 'Blog', href: '/dashboard/blog', icon: '📝', minRole: ROLE_LEVELS.SALES },
    // Settings - Visible to all
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙️', minRole: ROLE_LEVELS.SALES },
  ];

  // Get user's role level
  const userRoleLevel = user?.roleLevel || ROLE_LEVELS.SALES;

  // Show all navigation items but with authorization check using centralized RBAC
  const navigation = useMemo(() => {
    return allNavigation.map((item) => ({
      ...item,
      isAuthorized: canAccessPage(userRoleLevel, item.href)
    }));
  }, [userRoleLevel]);

  return (
    <DashboardErrorBoundary>
      <SessionManager
        inactivityTimeout={60 * 60 * 1000}  // 60 minutes of inactivity
        refreshInterval={50 * 60 * 1000}    // Refresh token every 50 minutes
        warningTime={5 * 60 * 1000}         // Show warning 5 minutes before timeout
      >
        <div className="min-h-screen bg-gray-50">
          {/* Mobile sidebar overlay */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 z-40 lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            >
              <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
            </div>
          )}

          {/* Sidebar */}
          <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
            <div className="flex flex-col h-full">
              {/* Logo - Clickable to Dashboard */}
              <Link
                href="/dashboard"
                className="flex items-center h-16 px-6 border-b border-gray-200 hover:bg-gray-50 transition-colors group"
              >
                {!tenant && !user ? (
                  /* Skeleton Loading for Logo */
                  <div className="flex items-center animate-pulse w-full">
                    <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                    <div className="ml-3 flex-1">
                      <div className="h-5 bg-gray-200 rounded w-24 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    {tenant?.logoUrl ? (
                      <img
                        src={tenant.logoUrl}
                        alt={tenant.name || 'Tenant Logo'}
                        className="w-8 h-8 object-contain rounded-lg group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                        <span className="text-white font-bold text-sm">
                          {tenant?.name?.[0] || 'A'}
                        </span>
                      </div>
                    )}
                    <div className="ml-3">
                      <div className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate max-w-[140px]">
                        {tenant?.name || 'autolumiku'}
                      </div>
                      <div className="text-xs text-gray-500">Showroom Dashboard</div>
                    </div>
                  </div>
                )}
              </Link>

              {/* Navigation - all items shown, tooltip for unauthorized */}
              <nav className="flex-1 px-4 py-6 space-y-2">
                {navigation.map((item) => {
                  // For /dashboard exact match, only highlight on exact path
                  // For other routes, highlight if path matches or starts with route
                  const isActive = item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname === item.href || pathname?.startsWith(item.href + '/');
                  return (
                    <AuthorizedNavLink
                      key={item.name}
                      href={item.href}
                      isAuthorized={item.isAuthorized}
                      isActive={isActive}
                    >
                      <span className="mr-3 text-lg">{item.icon}</span>
                      {item.name}
                    </AuthorizedNavLink>
                  );
                })}
              </nav>

              {/* User menu */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user?.firstName?.[0] || 'U'}
                    </span>
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getRoleName(userRoleLevel)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  Keluar
                </button>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:pl-64">
            {/* Mobile menu button - fixed position */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-md bg-white border border-gray-300 shadow-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Page content */}
            <main className="p-4 sm:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </SessionManager>
    </DashboardErrorBoundary>
  );
}
