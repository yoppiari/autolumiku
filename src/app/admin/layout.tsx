'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';


interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  // Read user from localStorage and check if super_admin
  React.useEffect(() => {
    // Skip auth check for login page
    if (pathname === '/admin/login') {
      return;
    }

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);

        // STRICT AUTH CHECK: Only Platform Admins allowed
        // 1. Super Admin
        // 2. Admin with NO tenantId (Platform Admin)
        const isSuperAdmin = userData.role === 'super_admin';
        const isPlatformAdmin = userData.role === 'admin' && !userData.tenantId;

        if (!isSuperAdmin && !isPlatformAdmin) {
          console.warn('[AdminAccess] Access denied: User is not a Platform Admin', userData);
          // Redirect Tenant Admins to their specific dashboard
          window.location.href = '/dashboard';
          return;
        }

        setUser(userData);
      } catch (e) {
        console.error('Error parsing user data:', e);
        // Redirect to admin login if user data is invalid
        window.location.href = '/admin/login';
      }
    } else {
      // No user data, redirect to admin login
      window.location.href = '/admin/login';
    }
  }, [pathname]);

  // Skip layout for login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = () => {
    // Clear auth token and redirect
    const storedUser = localStorage.getItem('user');
    let userRole = null;

    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        userRole = userData.role;
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }

    localStorage.removeItem('authToken');
    localStorage.removeItem('user');

    // Redirect based on role
    if (userRole === 'super_admin') {
      window.location.href = '/admin/login';
    } else {
      window.location.href = '/login';
    }
  };

  const navigation = [
    { name: 'Management Dashboard', href: '/admin', icon: '🏠' },
    { name: 'Tenants', href: '/admin/tenants', icon: '🏢' },
    { name: 'Users', href: '/admin/users', icon: '👥' },
    { name: 'Analytics', href: '/admin/health', icon: '📊' },
    {
      name: 'Data Management', href: '/admin/data-management', icon: '🗄️', submenu: [
        { name: 'Vehicle Scraper', href: '/admin/data-management/scraper', icon: '🤖' },
      ]
    },
    { name: 'Audit Logs', href: '/admin/audit', icon: '📋' },
    { name: 'Settings', href: '/admin/settings', icon: '⚙️' },
  ];

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuName)
        ? prev.filter(m => m !== menuName)
        : [...prev, menuName]
    );
  };

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
        fixed inset-y-0 left-0 z-50 w-64 admin-sidebar transform transition-transform duration-300 ease-in-out bg-[#113f47] text-white
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-20 px-6 border-b border-[#1e5763] bg-[#0d343b]">
            <img src="/autolumiku-logo.png" alt="AutoLumiKu" className="h-14 w-auto object-contain" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.submenu ? (
                  // Parent menu with submenu
                  <div>
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors
                        ${pathname.startsWith(item.href)
                          ? 'bg-[#06b6d4] text-white'
                          : 'text-gray-300 hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      <div className="flex items-center">
                        <span className="mr-3 text-lg">{item.icon}</span>
                        {item.name}
                      </div>
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedMenus.includes(item.name) ? 'rotate-180' : ''
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {/* Submenu items */}
                    {expandedMenus.includes(item.name) && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.submenu.map((subitem: any) => (
                          <Link
                            key={subitem.name}
                            href={subitem.href}
                            className={`
                              flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                              ${pathname === subitem.href
                                ? 'bg-[#06b6d4] text-white'
                                : 'text-gray-300 hover:bg-white/10 hover:text-white'
                              }
                            `}
                          >
                            <span className="mr-3 text-lg">{subitem.icon}</span>
                            {subitem.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Regular menu item
                  <Link
                    href={item.href}
                    className={`
                      flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                      ${pathname === item.href
                        ? 'bg-[#06b6d4] text-white'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    <span className="mr-3 text-lg">{item.icon}</span>
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* User menu */}
          <div className="border-t border-[#1e5763] p-4">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">
                  {user?.firstName?.[0] || 'A'}
                </span>
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-white">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-xs text-gray-400">
                  {user?.role?.replace('_', ' ')}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 text-sm font-medium text-white bg-white/10 border border-transparent rounded-md hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="admin-header h-16 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center">
              {/* Mobile menu button */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Page title */}
              <div className="ml-4 lg:ml-0">
                <h1 className="text-xl font-semibold text-gray-900">
                  {navigation.find(item => item.href === pathname)?.name || 'Admin'}
                </h1>
              </div>
            </div>

            {/* Right side items */}
            <div className="flex items-center space-x-4">
              {/* User avatar */}
              <div className="relative">
                <button className="flex items-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 text-sm">
                      {user?.firstName?.[0] || 'A'}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="admin-content p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}