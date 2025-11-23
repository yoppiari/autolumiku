/**
 * Dashboard Settings Page
 * User profile and account settings
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);

        // Fetch tenant data
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`/api/v1/tenants/${userData.tenantId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const result = await response.json();
        if (result.success) {
          setTenant(result.data);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile', name: 'Profile', icon: '👤' },
    { id: 'account', name: 'Account', icon: '⚙️' },
    { id: 'security', name: 'Security', icon: '🔒' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{user?.firstName} {user?.lastName}</h3>
                    <p className="text-gray-600">{user?.email}</p>
                    <p className="text-sm text-gray-500 mt-1">Role: {user?.role}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      defaultValue={user?.firstName}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      defaultValue={user?.lastName}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      defaultValue={user?.email}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      defaultValue={user?.phone}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Save Changes
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {tenant && (
            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Organization Name</p>
                    <p className="text-lg font-semibold">{tenant.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Subdomain</p>
                    <p className="text-lg">{tenant.slug}.autolumiku.com</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {tenant.status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Language & Region</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Language</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="id">Bahasa Indonesia</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Timezone</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                      <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                      <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Display Preferences</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
                    <span className="ml-2 text-sm text-gray-700">Show vehicle prices in catalog</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" defaultChecked />
                    <span className="ml-2 text-sm text-gray-700">Enable auto-save</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" defaultChecked />
                    <span className="ml-2 text-sm text-gray-700">Show featured vehicles first</span>
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Save Preferences
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Update Password
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Current Session</p>
                      <p className="text-sm text-gray-600">Chrome on Windows • Last active: Now</p>
                    </div>
                  </div>
                  <span className="text-green-600 text-sm font-medium">Active</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Email Notifications</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">New vehicle inquiries</span>
                    <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" defaultChecked />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Vehicle sold notifications</span>
                    <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" defaultChecked />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Weekly performance reports</span>
                    <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Team activity updates</span>
                    <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
                  </label>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Push Notifications</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">New messages</span>
                    <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" defaultChecked />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Price drops alerts</span>
                    <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Save Notification Settings
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
