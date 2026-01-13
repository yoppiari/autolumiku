/**
 * Global Platform Settings Management
 * Story 1.11: Platform administrator settings for global configuration
 */

'use client';

import React, { useState } from 'react';

interface GlobalSettings {
  platform: {
    maintenanceMode: boolean;
    maintenanceMessage: string;
    platformName: string;
    supportEmail: string;
  };
  indonesian: {
    timezone: string;
    currency: string;
    language: string;
    dateFormat: string;
    complianceMode: boolean;
  };
  system: {
    maxTenantsPerDb: number;
    defaultStorageQuota: number;
    apiRateLimit: number;
    sessionTimeout: number;
  };
  security: {
    passwordMinLength: number;
    passwordRequireSpecial: boolean;
    mfaRequired: boolean;
    sessionInactivityTimeout: number;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    whatsappEnabled: boolean;
    defaultSender: string;
  };
}

export default function GlobalSettingsPage() {
  const [activeTab, setActiveTab] = useState<'platform' | 'indonesian' | 'system' | 'security' | 'notifications'>('platform');
  const [settings, setSettings] = useState<GlobalSettings>({
    platform: {
      maintenanceMode: false,
      maintenanceMessage: 'Platform sedang dalam pemeliharaan. Mohon coba lagi nanti.',
      platformName: 'AutoLumiKu',
      supportEmail: 'support@autolumiku.com',
    },
    indonesian: {
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      language: 'id',
      dateFormat: 'DD/MM/YYYY',
      complianceMode: true,
    },
    system: {
      maxTenantsPerDb: 100,
      defaultStorageQuota: 10240, // MB
      apiRateLimit: 1000,
      sessionTimeout: 3600, // seconds
    },
    security: {
      passwordMinLength: 8,
      passwordRequireSpecial: true,
      mfaRequired: false,
      sessionInactivityTimeout: 1800, // seconds
    },
    notifications: {
      emailEnabled: true,
      smsEnabled: false,
      whatsappEnabled: true,
      defaultSender: 'AutoLumiKu',
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In real implementation:
      // await fetch('/api/admin/settings', {
      //   method: 'PUT',
      //   body: JSON.stringify(settings)
      // });

      setSaveMessage({ type: 'success', text: 'Pengaturan berhasil disimpan' });
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Gagal menyimpan pengaturan' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const tabs = [
    { id: 'platform' as const, name: 'Platform', icon: '🏠' },
    { id: 'indonesian' as const, name: 'Indonesia', icon: '🇮🇩' },
    { id: 'system' as const, name: 'System', icon: '⚙️' },
    { id: 'security' as const, name: 'Security', icon: '🔒' },
    { id: 'notifications' as const, name: 'Notifications', icon: '🔔' },
  ];

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Global Platform Settings</h1>
        <p className="text-gray-300 mt-1">Manage platform-wide configurations and preferences</p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`mb-6 p-4 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
          {saveMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-white/10 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === tab.id
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-white/20'
                }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6">
        {/* Platform Tab */}
        {activeTab === 'platform' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Platform Configuration</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Platform Name
              </label>
              <input
                type="text"
                value={settings.platform.platformName}
                onChange={(e) => setSettings({
                  ...settings,
                  platform: { ...settings.platform, platformName: e.target.value }
                })}
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Support Email
              </label>
              <input
                type="email"
                value={settings.platform.supportEmail}
                onChange={(e) => setSettings({
                  ...settings,
                  platform: { ...settings.platform, supportEmail: e.target.value }
                })}
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="border-t border-white/10 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-white">Maintenance Mode</h3>
                  <p className="text-sm text-gray-400">Enable maintenance mode for all tenants</p>
                </div>
                <button
                  onClick={() => setSettings({
                    ...settings,
                    platform: { ...settings.platform, maintenanceMode: !settings.platform.maintenanceMode }
                  })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.platform.maintenanceMode ? 'bg-cyan-600' : 'bg-white/10'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.platform.maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              {settings.platform.maintenanceMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Maintenance Message (Bahasa Indonesia)
                  </label>
                  <textarea
                    value={settings.platform.maintenanceMessage}
                    onChange={(e) => setSettings({
                      ...settings,
                      platform: { ...settings.platform, maintenanceMessage: e.target.value }
                    })}
                    rows={3}
                    className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Indonesian Market Tab */}
        {activeTab === 'indonesian' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Indonesian Market Configuration</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Default Timezone
              </label>
              <select
                value={settings.indonesian.timezone}
                onChange={(e) => setSettings({
                  ...settings,
                  indonesian: { ...settings.indonesian, timezone: e.target.value }
                })}
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="Asia/Jakarta">WIB - Jakarta, Sumatera, Jawa</option>
                <option value="Asia/Makassar">WITA - Kalimantan, Sulawesi, Bali</option>
                <option value="Asia/Jayapura">WIT - Papua, Maluku</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Currency
              </label>
              <input
                type="text"
                value={settings.indonesian.currency}
                disabled
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Indonesian Rupiah (IDR) only</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Default Language
              </label>
              <select
                value={settings.indonesian.language}
                onChange={(e) => setSettings({
                  ...settings,
                  indonesian: { ...settings.indonesian, language: e.target.value }
                })}
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Date Format
              </label>
              <select
                value={settings.indonesian.dateFormat}
                onChange={(e) => setSettings({
                  ...settings,
                  indonesian: { ...settings.indonesian, dateFormat: e.target.value }
                })}
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (Indonesian standard)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (US format)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO format)</option>
              </select>
            </div>

            <div className="border-t border-white/10 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">Indonesian Compliance Mode</h3>
                  <p className="text-sm text-gray-400">Enable Indonesian regulatory compliance features</p>
                </div>
                <button
                  onClick={() => setSettings({
                    ...settings,
                    indonesian: { ...settings.indonesian, complianceMode: !settings.indonesian.complianceMode }
                  })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.indonesian.complianceMode ? 'bg-cyan-600' : 'bg-white/10'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.indonesian.complianceMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">System Configuration</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Tenants Per Database
              </label>
              <input
                type="number"
                value={settings.system.maxTenantsPerDb}
                onChange={(e) => setSettings({
                  ...settings,
                  system: { ...settings.system, maxTenantsPerDb: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Default Storage Quota (MB)
              </label>
              <input
                type="number"
                value={settings.system.defaultStorageQuota}
                onChange={(e) => setSettings({
                  ...settings,
                  system: { ...settings.system, defaultStorageQuota: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Rate Limit (requests/minute)
              </label>
              <input
                type="number"
                value={settings.system.apiRateLimit}
                onChange={(e) => setSettings({
                  ...settings,
                  system: { ...settings.system, apiRateLimit: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Session Timeout (seconds)
              </label>
              <input
                type="number"
                value={settings.system.sessionTimeout}
                onChange={(e) => setSettings({
                  ...settings,
                  system: { ...settings.system, sessionTimeout: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Security Configuration</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum Password Length
              </label>
              <input
                type="number"
                min="6"
                max="32"
                value={settings.security.passwordMinLength}
                onChange={(e) => setSettings({
                  ...settings,
                  security: { ...settings.security, passwordMinLength: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">Require Special Characters</h3>
                <p className="text-sm text-gray-400">Password must contain special characters</p>
              </div>
              <button
                onClick={() => setSettings({
                  ...settings,
                  security: { ...settings.security, passwordRequireSpecial: !settings.security.passwordRequireSpecial }
                })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.security.passwordRequireSpecial ? 'bg-cyan-600' : 'bg-white/10'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.security.passwordRequireSpecial ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">Require Multi-Factor Authentication (MFA)</h3>
                <p className="text-sm text-gray-400">All users must enable MFA</p>
              </div>
              <button
                onClick={() => setSettings({
                  ...settings,
                  security: { ...settings.security, mfaRequired: !settings.security.mfaRequired }
                })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.security.mfaRequired ? 'bg-cyan-600' : 'bg-white/10'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.security.mfaRequired ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Session Inactivity Timeout (seconds)
              </label>
              <input
                type="number"
                value={settings.security.sessionInactivityTimeout}
                onChange={(e) => setSettings({
                  ...settings,
                  security: { ...settings.security, sessionInactivityTimeout: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Notification Configuration</h2>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">Email Notifications</h3>
                <p className="text-sm text-gray-400">Enable email notification system</p>
              </div>
              <button
                onClick={() => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, emailEnabled: !settings.notifications.emailEnabled }
                })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.notifications.emailEnabled ? 'bg-cyan-600' : 'bg-white/10'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notifications.emailEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">SMS Notifications</h3>
                <p className="text-sm text-gray-400">Enable SMS notification system</p>
              </div>
              <button
                onClick={() => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, smsEnabled: !settings.notifications.smsEnabled }
                })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.notifications.smsEnabled ? 'bg-cyan-600' : 'bg-white/10'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notifications.smsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">WhatsApp Notifications</h3>
                <p className="text-sm text-gray-400">Enable WhatsApp notification system</p>
              </div>
              <button
                onClick={() => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, whatsappEnabled: !settings.notifications.whatsappEnabled }
                })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.notifications.whatsappEnabled ? 'bg-cyan-600' : 'bg-white/10'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notifications.whatsappEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Default Sender Name
              </label>
              <input
                type="text"
                value={settings.notifications.defaultSender}
                onChange={(e) => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, defaultSender: e.target.value }
                })}
                className="w-full px-3 py-2 bg-[#0a3d47] border border-white/10 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>
    </div>
  );
}
