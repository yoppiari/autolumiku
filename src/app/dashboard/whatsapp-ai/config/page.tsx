/**
 * WhatsApp AI Configuration Page
 * Customize AI personality, welcome message, features, dll
 * 
 * ACCESS: ADMIN+ only (roleLevel >= 90)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { withRoleProtection } from '@/lib/auth/withRoleProtection';
import { ROLE_LEVELS } from '@/lib/rbac';

interface AIConfig {
  id: string;
  tenantId: string;
  aiName: string;
  aiPersonality: string;
  welcomeMessage: string;
  autoReply: boolean;
  customerChatEnabled: boolean;
  staffCommandsEnabled: boolean;
  businessHours: Record<string, { open: string; close: string }>;
  timezone: string;
  afterHoursMessage: string;
  aiModel: string;
  temperature: number;
  maxTokens: number;
  enableVehicleInfo: boolean;
  enablePriceNegotiation: boolean;
  enableTestDriveBooking: boolean;
  enableStaffUpload: boolean;
  enableStaffStatus: boolean;
}

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const DAY_LABELS: Record<string, string> = {
  monday: 'Senin',
  tuesday: 'Selasa',
  wednesday: 'Rabu',
  thursday: 'Kamis',
  friday: 'Jumat',
  saturday: 'Sabtu',
  sunday: 'Minggu',
};

function WhatsAppAIConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<{ isConnected: boolean; phoneNumber?: string; connectionStatus?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [userRoleLevel, setUserRoleLevel] = useState<number>(0);

  // Load configuration
  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);

      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          console.error('No user found');
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        const currentTenantId = parsedUser.tenantId;
        setTenantId(currentTenantId);

        // Robust Role Check: If roleLevel is missing or low but role is ADMIN+, bump it
        let level = parsedUser.roleLevel || 30;
        const roleName = (parsedUser.role || '').toUpperCase();
        if (level < 90 && ['ADMIN', 'OWNER', 'SUPER_ADMIN'].includes(roleName)) {
          console.log('[Config] Upgrading role level based on name:', roleName);
          level = 90; // Minimum Admin level
        }
        setUserRoleLevel(level);

        const response = await fetch(`/api/v1/whatsapp-ai/config?tenantId=${currentTenantId}`);
        const data = await response.json();

        if (data.success) {
          setConfig(data.data);
        }

        const statusResponse = await fetch(`/api/v1/whatsapp-ai/status?tenantId=${currentTenantId}`);
        const statusData = await statusResponse.json();
        if (statusData.success) {
          setStatus(statusData.data);
        }
      } catch (error) {
        console.error('Error loading config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Save configuration
  const handleSave = async () => {
    if (!config || !tenantId) return;

    if (userRoleLevel < 90) { // ROLE_LEVELS.ADMIN
      alert('Akses Ditolak: Hanya Owner, Admin, dan Super Admin yang dapat mengubah konfigurasi AI.');
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch('/api/v1/whatsapp-ai/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config), // config already includes tenantId
      });

      const data = await response.json();

      if (data.success) {
        setSaveMessage({ type: 'success', text: 'Konfigurasi berhasil disimpan!' });
        // Auto-hide success message after 3 seconds
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Gagal menyimpan konfigurasi' });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      setSaveMessage({ type: 'error', text: 'Terjadi kesalahan saat menyimpan' });
    } finally {
      setIsSaving(false);
    }
  };

  // Disconnect WhatsApp
  const handleDisconnect = async () => {
    if (userRoleLevel < 90) { // ROLE_LEVELS.ADMIN
      alert('Akses Ditolak: Hanya Owner, Admin, dan Super Admin yang dapat menonaktifkan WhatsApp.');
      return;
    }

    if (!confirm('Are you sure you want to disconnect WhatsApp? You will need to scan the QR code again to reconnect.')) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/whatsapp-ai/disconnect?tenantId=${tenantId}`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        router.push('/dashboard/whatsapp-ai/setup');
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Failed to disconnect' });
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      setSaveMessage({ type: 'error', text: 'Error disconnecting WhatsApp' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">Konfigurasi AI belum tersedia. Silakan setup WhatsApp terlebih dahulu.</p>
          <Link
            href="/dashboard/whatsapp-ai/setup"
            className="mt-4 inline-block px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Setup WhatsApp →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto">
      {/* Header - Extra left padding on mobile for hamburger menu */}
      <div className="mb-2 md:mb-4 pl-10 md:pl-0">
        <Link href="/dashboard/whatsapp-ai" className="text-blue-600 hover:text-blue-800 mb-1 md:mb-2 inline-block text-xs md:text-sm">
          ← Back to WhatsApp AI Dashboard
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-white leading-tight">AI Configuration</h1>
        <p className="text-gray-400 text-[10px] md:text-sm">Customize AI behavior and features</p>
      </div>

      {/* Connection Status Card */}
      {status && (() => {
        const isConnected = status.isConnected && status.connectionStatus === 'connected';
        const isReconnecting = status.connectionStatus === 'reconnecting';

        let bgColor = 'bg-red-50 border-red-100';
        let iconBg = 'bg-red-100';
        let iconColor = 'text-red-600';
        let title = 'WhatsApp Disconnected';
        let badgeColor = 'bg-red-500 text-white';
        let badgeText = 'DISCONNECTED';
        let animateClass = '';
        let description = 'Mohon hubungkan kembali akun WhatsApp Anda';

        if (isConnected) {
          bgColor = 'bg-green-50 border-green-200';
          iconBg = 'bg-green-100';
          iconColor = 'text-green-600';
          title = 'WhatsApp Terhubung';
          badgeColor = 'bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]';
          badgeText = 'ACTIVE';
          animateClass = 'animate-pulse';
          description = `Nomor: ${status.phoneNumber || 'Terhubung'} (NORMAL)`;
        } else if (isReconnecting) {
          bgColor = 'bg-orange-50 border-orange-200';
          iconBg = 'bg-orange-100';
          iconColor = 'text-orange-600';
          title = 'WhatsApp Reconnecting...';
          badgeColor = 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]';
          badgeText = 'RECONNECTING';
          animateClass = 'animate-pulse';
          description = 'Kendala jaringan internet (Vendor Telkomsel/TSEL)';
        }

        return (
          <div className={`mb-6 p-4 rounded-xl shadow-sm border-2 flex items-center justify-between transition-all duration-500 ${bgColor}`}>
            <div className="flex items-center space-x-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-sm transition-all duration-1000 ${iconBg} ${isConnected || isReconnecting ? 'animate-[pulse_3s_ease-in-out_infinite]' : ''}`}>
                <span className="text-xl">
                  <svg className={`w-10 h-10 ${iconColor} ${isConnected || isReconnecting ? 'drop-shadow-[0_0_5px_rgba(0,0,0,0.1)]' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{title}</p>
                <p className="text-xs text-gray-600 font-medium">{description}</p>
              </div>
            </div>
            <div className={`p-1 flex items-center justify-center rounded-md shadow-sm ${bgColor.replace('bg-', 'border-').replace('-50', '-200')} ${isConnected || isReconnecting ? 'animate-[pulse_3s_ease-in-out_infinite]' : ''}`}>
              <span className={`px-2 py-1 text-[10px] md:text-sm font-bold rounded shadow-inner tracking-wider ${badgeColor}`}>
                {badgeText}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Read-only Warning for Sales */}
      {userRoleLevel < 90 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <span className="text-xl">🔒</span>
          <div>
            <p className="text-amber-800 font-semibold text-xs">Mode Lihat Saja (Read-Only)</p>
            <p className="text-amber-700 text-[10px]">Anda dapat melihat konfigurasi ini, tetapi tidak memiliki izin untuk mengubahnya.</p>
          </div>
        </div>
      )}

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`mb-6 p-4 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
        >
          <p
            className={`${saveMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
          >
            {saveMessage.text}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Basic Settings */}
        <div className="bg-[#2a2a2a] rounded-xl shadow-sm border border-[#3a3a3a] p-4 md:p-5">
          <h2 className="text-lg font-semibold text-white mb-3">Basic Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">AI Name</label>
              <input
                type="text"
                value={config.aiName}
                onChange={(e) => setConfig({ ...config, aiName: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-[#444] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-[#333] text-white"
                placeholder="e.g., Asisten Virtual"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Personality</label>
              <select
                value={config.aiPersonality}
                onChange={(e) => setConfig({ ...config, aiPersonality: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-[#444] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-[#333] text-white"
              >
                <option value="friendly">Friendly & Casual</option>
                <option value="professional">Professional & Formal</option>
                <option value="enthusiastic">Enthusiastic & Energetic</option>
                <option value="helpful">Helpful & Patient</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-300 mb-1">Welcome Message</label>
              <textarea
                value={config.welcomeMessage}
                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                rows={2}
                className="w-full px-3 py-1.5 border border-[#444] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm resize-y min-h-[60px] bg-[#333] text-white"
                placeholder="{greeting}! 👋 Selamat datang di {showroom}!"
              />
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-[#2a2a2a] rounded-xl shadow-sm border border-[#3a3a3a] p-4 md:p-5">
          <h2 className="text-lg font-semibold text-white mb-3">Features</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.autoReply}
                onChange={(e) => setConfig({ ...config, autoReply: e.target.checked })}
                className="w-4 h-4 text-green-600 border-[#444] rounded focus:ring-green-500"
              />
              <span className="ml-2.5 text-xs md:text-sm text-gray-300">Auto Reply (balas otomatis customer)</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.customerChatEnabled}
                onChange={(e) => setConfig({ ...config, customerChatEnabled: e.target.checked })}
                className="w-4 h-4 text-green-600 border-[#444] rounded focus:ring-green-500"
              />
              <span className="ml-2.5 text-xs md:text-sm text-gray-300">Customer Chat (AI melayani customer)</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.staffCommandsEnabled}
                onChange={(e) => setConfig({ ...config, staffCommandsEnabled: e.target.checked })}
                className="w-4 h-4 text-green-600 border-[#444] rounded focus:ring-green-500"
              />
              <span className="ml-2.5 text-xs md:text-sm text-gray-300">Staff Commands (staff bisa kirim command)</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.enableVehicleInfo}
                onChange={(e) => setConfig({ ...config, enableVehicleInfo: e.target.checked })}
                className="w-4 h-4 text-green-600 border-[#444] rounded focus:ring-green-500"
              />
              <span className="ml-2.5 text-xs md:text-sm text-gray-300">Vehicle Info (AI dapat info stok)</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.enableTestDriveBooking}
                onChange={(e) => setConfig({ ...config, enableTestDriveBooking: e.target.checked })}
                className="w-4 h-4 text-green-600 border-[#444] rounded focus:ring-green-500"
              />
              <span className="ml-2.5 text-xs md:text-sm text-gray-300">Test Drive Booking (AI bantu jadwal)</span>
            </label>
          </div>
        </div>

        {/* Business Hours */}
        <div className="bg-[#2a2a2a] rounded-xl shadow-sm border border-[#3a3a3a] p-4 md:p-5">
          <h2 className="text-lg md:text-xl font-semibold text-white mb-3">Business Hours</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
            {DAYS_OF_WEEK.map((day) => {
              const hours = config.businessHours?.[day] || { open: '09:00', close: '17:00' };
              const isClosed = hours.open === 'closed';

              return (
                <div key={day} className="flex items-center gap-3">
                  <div className="w-16 text-xs font-medium text-gray-300 flex-shrink-0">{DAY_LABELS[day]}</div>
                  <label className="flex items-center flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={!isClosed}
                      onChange={(e) => {
                        const newHours = { ...config.businessHours };
                        newHours[day] = e.target.checked
                          ? { open: '09:00', close: '17:00' }
                          : { open: 'closed', close: 'closed' };
                        setConfig({ ...config, businessHours: newHours });
                      }}
                      className="w-3.5 h-3.5 text-green-600 border-[#444] rounded focus:ring-green-500"
                    />
                    <span className="ml-1 text-[10px] md:text-xs text-gray-400">Open</span>
                  </label>
                  {!isClosed && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input
                        type="time"
                        value={hours.open}
                        onChange={(e) => {
                          const newHours = { ...config.businessHours };
                          newHours[day] = { ...hours, open: e.target.value };
                          setConfig({ ...config, businessHours: newHours });
                        }}
                        className="px-1.5 py-0.5 border border-[#444] rounded text-[10px] md:text-xs w-[75px] bg-[#333] text-white"
                      />
                      <span className="text-gray-400 text-[10px]">-</span>
                      <input
                        type="time"
                        value={hours.close}
                        onChange={(e) => {
                          const newHours = { ...config.businessHours };
                          newHours[day] = { ...hours, close: e.target.value };
                          setConfig({ ...config, businessHours: newHours });
                        }}
                        className="px-1.5 py-0.5 border border-[#444] rounded text-[10px] md:text-xs w-[75px] bg-[#333] text-white"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">After Hours Message</label>
            <textarea
              value={config.afterHoursMessage}
              onChange={(e) => setConfig({ ...config, afterHoursMessage: e.target.value })}
              rows={2}
              className="w-full px-3 py-1.5 border border-[#444] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm resize-y min-h-[50px] bg-[#333] text-white"
              placeholder="Pesan yang dikirim di luar jam kerja"
            />
          </div>
        </div>

        {/* Actions - Stack on mobile */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 pt-3 md:pt-4 border-t border-[#3a3a3a]">
          {/* Save buttons - shown first on mobile */}
          <div className="flex gap-2 md:gap-4 order-1 md:order-2 w-full md:w-auto">
            <button
              onClick={() => router.push('/dashboard/whatsapp-ai')}
              className="flex-1 md:flex-none px-4 md:px-6 py-1.5 border border-[#444] rounded-lg text-gray-300 hover:bg-[#3a3a3a] transition-colors text-xs md:text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 md:flex-none px-4 md:px-6 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm whitespace-nowrap"
            >
              {isSaving ? 'Saving...' : 'Save Config'}
            </button>
          </div>

          {/* Disconnect button - shown last on mobile */}
          <button
            onClick={handleDisconnect}
            className="px-4 md:px-6 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-xs md:text-sm order-2 md:order-1"
          >
            Disconnect WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

// Protect this page - ADMIN+ only
export default withRoleProtection(WhatsAppAIConfigPage, ROLE_LEVELS.ADMIN);

