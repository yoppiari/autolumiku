'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);

  // Read user from localStorage
  React.useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);

        // Check if user has tenantId (showroom user)
        if (!userData.tenantId) {
          // Not a showroom user, redirect to admin login
          window.location.href = '/admin/login';
          return;
        }

        setUser(userData);
      } catch (e) {
        console.error('Error parsing user data:', e);
        window.location.href = '/login';
      }
    } else {
      // Development mode: auto-inject mock user
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 [Dev Mode] Auto-injecting mock authentication...');
        const mockUser = {
          id: 'dev-user-123',
          tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed', // Showroom Jakarta Premium
          name: 'Dev User',
          email: 'dev@showroom.com',
          role: 'admin',
          _isMock: true
        };
        localStorage.setItem('user', JSON.stringify(mockUser));
        setUser(mockUser);
        console.log('✅ [Dev Mode] Mock user authenticated:', mockUser);
        console.log('💡 To switch tenant, run: localStorage.setItem("user", JSON.stringify({...JSON.parse(localStorage.getItem("user")), tenantId: "NEW_TENANT_ID"}))');
      } else {
        // No user data, redirect to login (production)
        window.location.href = '/login';
      }
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

  // Update document title and favicon based on tenant
  React.useEffect(() => {
    if (tenant) {
      // Update page title to "Tenant Name Platform"
      document.title = `${tenant.name} Platform`;

      // Update favicon if tenant has a logo
      if (tenant.logoUrl) {
        // Remove existing favicons
        const existingFavicons = document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']");
        existingFavicons.forEach(el => el.remove());

        // Add new favicon
        const favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.type = 'image/png';
        favicon.href = tenant.logoUrl;
        document.head.appendChild(favicon);

        // Also add shortcut icon for better compatibility
        const shortcutIcon = document.createElement('link');
        shortcutIcon.rel = 'shortcut icon';
        shortcutIcon.href = tenant.logoUrl;
        document.head.appendChild(shortcutIcon);
      }
    }
  }, [tenant]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
    { name: 'Kendaraan', href: '/dashboard/vehicles', icon: '🚗' },
    { name: 'Leads', href: '/dashboard/leads', icon: '📞' },
    { name: 'WhatsApp AI', href: '/dashboard/whatsapp-ai', icon: '💬' },
    { name: 'Blog', href: '/dashboard/blog', icon: '📝' },
    { name: 'Tim', href: '/dashboard/users', icon: '👥' },
    { name: 'Pengaturan', href: '/dashboard/settings', icon: '⚙️' },
  ];

  return (
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
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <div className="flex items-center">
              {tenant?.logoUrl ? (
                <img
                  src={tenant.logoUrl}
                  alt={tenant.name || 'Tenant Logo'}
                  className="w-8 h-8 object-contain rounded-lg"
                />
              ) : (
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {tenant?.name?.[0] || 'A'}
                  </span>
                </div>
              )}
              <div className="ml-3">
                <div className="text-lg font-bold text-gray-900">
                  {tenant?.name || 'autolumiku'}
                </div>
                <div className="text-xs text-gray-500">Showroom Dashboard</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              // For /dashboard exact match, only highlight on exact path
              // For other routes, highlight if path matches or starts with route
              const isActive = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                    ${isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                    <span className="mr-3 text-lg">{item.icon}</span>
                    {item.name}
                </Link>
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
                <div className="text-xs text-gray-500 capitalize">
                  {user?.role?.replace('_', ' ')}
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
  );
}
