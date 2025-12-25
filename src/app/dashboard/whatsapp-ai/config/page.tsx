/**
 * WhatsApp AI Configuration Page
 * Customize AI personality, welcome message, features, dll
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

export default function WhatsAppAIConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tenantId, setTenantId] = useState<string>('');

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

        const response = await fetch(`/api/v1/whatsapp-ai/config?tenantId=${currentTenantId}`);
        const data = await response.json();

        if (data.success) {
          setConfig(data.data);
        } else {
          console.error('Failed to load config:', data.error);
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
      <div className="mb-4 md:mb-8 pl-10 md:pl-0">
        <Link href="/dashboard/whatsapp-ai" className="text-blue-600 hover:text-blue-800 mb-2 md:mb-4 inline-block text-sm md:text-base">
          ← Back to WhatsApp AI Dashboard
        </Link>
        <h1 className="text-xl md:text-3xl font-bold text-gray-900">AI Configuration</h1>
        <p className="text-gray-600 text-xs md:text-base mt-1">Customize AI behavior dan features</p>
      </div>

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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">AI Name</label>
              <input
                type="text"
                value={config.aiName}
                onChange={(e) => setConfig({ ...config, aiName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., Asisten Virtual, Bot Showroom"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Personality</label>
              <select
                value={config.aiPersonality}
                onChange={(e) => setConfig({ ...config, aiPersonality: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="friendly">Friendly & Casual</option>
                <option value="professional">Professional & Formal</option>
                <option value="enthusiastic">Enthusiastic & Energetic</option>
                <option value="helpful">Helpful & Patient</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Welcome Message</label>
              <textarea
                value={config.welcomeMessage}
                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm resize-y min-h-[100px]"
                placeholder="{greeting}! 👋 Selamat datang di {showroom}! 😊 Ada yang bisa kami bantu?"
              />
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Features</h2>

          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.autoReply}
                onChange={(e) => setConfig({ ...config, autoReply: e.target.checked })}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="ml-3 text-sm text-gray-700">Auto Reply (balas otomatis customer)</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.customerChatEnabled}
                onChange={(e) => setConfig({ ...config, customerChatEnabled: e.target.checked })}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="ml-3 text-sm text-gray-700">Customer Chat (AI melayani customer)</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.staffCommandsEnabled}
                onChange={(e) => setConfig({ ...config, staffCommandsEnabled: e.target.checked })}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="ml-3 text-sm text-gray-700">Staff Commands (staff bisa kirim command via WA)</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.enableVehicleInfo}
                onChange={(e) => setConfig({ ...config, enableVehicleInfo: e.target.checked })}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="ml-3 text-sm text-gray-700">Vehicle Info (AI dapat memberikan info mobil)</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.enableTestDriveBooking}
                onChange={(e) => setConfig({ ...config, enableTestDriveBooking: e.target.checked })}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="ml-3 text-sm text-gray-700">Test Drive Booking (AI bantu jadwalkan test drive)</span>
            </label>
          </div>
        </div>

        {/* Business Hours */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Business Hours</h2>

          <div className="space-y-3 overflow-x-auto">
            {DAYS_OF_WEEK.map((day) => {
              const hours = config.businessHours?.[day] || { open: '09:00', close: '17:00' };
              const isClosed = hours.open === 'closed';

              return (
                <div key={day} className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-4 min-w-0">
                  <div className="w-16 md:w-24 text-sm font-medium text-gray-700 flex-shrink-0">{DAY_LABELS[day]}</div>
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
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="ml-1.5 md:ml-2 text-xs md:text-sm text-gray-600">Open</span>
                  </label>
                  {!isClosed && (
                    <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                      <input
                        type="time"
                        value={hours.open}
                        onChange={(e) => {
                          const newHours = { ...config.businessHours };
                          newHours[day] = { ...hours, open: e.target.value };
                          setConfig({ ...config, businessHours: newHours });
                        }}
                        className="px-2 py-1 border border-gray-300 rounded-lg text-xs md:text-sm w-[85px] md:w-auto"
                      />
                      <span className="text-gray-500 text-xs">-</span>
                      <input
                        type="time"
                        value={hours.close}
                        onChange={(e) => {
                          const newHours = { ...config.businessHours };
                          newHours[day] = { ...hours, close: e.target.value };
                          setConfig({ ...config, businessHours: newHours });
                        }}
                        className="px-2 py-1 border border-gray-300 rounded-lg text-xs md:text-sm w-[85px] md:w-auto"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">After Hours Message</label>
            <textarea
              value={config.afterHoursMessage}
              onChange={(e) => setConfig({ ...config, afterHoursMessage: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm resize-y min-h-[80px]"
              placeholder="Pesan yang dikirim di luar jam kerja"
            />
          </div>
        </div>

        {/* Actions - Stack on mobile */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 pt-4 md:pt-6 border-t border-gray-200">
          {/* Save buttons - shown first on mobile */}
          <div className="flex gap-2 md:gap-4 order-1 md:order-2">
            <button
              onClick={() => router.push('/dashboard/whatsapp-ai')}
              className="flex-1 md:flex-none px-4 md:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm md:text-base"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 md:flex-none px-4 md:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base whitespace-nowrap"
            >
              {isSaving ? 'Saving...' : 'Save Config'}
            </button>
          </div>

          {/* Disconnect button - shown last on mobile */}
          <button
            onClick={handleDisconnect}
            className="px-4 md:px-6 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm md:text-base order-2 md:order-1"
          >
            Disconnect WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
