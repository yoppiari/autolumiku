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
        body: JSON.stringify({
          tenantId,
          ...config,
        }),
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
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/whatsapp-ai" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to WhatsApp AI Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">AI Configuration</h1>
        <p className="text-gray-600 mt-1">Customize AI behavior dan features</p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            saveMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          <p
            className={`${
              saveMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
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
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Pesan sambutan untuk customer baru"
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Business Hours</h2>

          <div className="space-y-3">
            {DAYS_OF_WEEK.map((day) => {
              const hours = config.businessHours?.[day] || { open: '09:00', close: '17:00' };
              const isClosed = hours.open === 'closed';

              return (
                <div key={day} className="flex items-center space-x-4">
                  <div className="w-24 text-sm font-medium text-gray-700">{DAY_LABELS[day]}</div>
                  <label className="flex items-center">
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
                    <span className="ml-2 text-sm text-gray-600">Open</span>
                  </label>
                  {!isClosed && (
                    <>
                      <input
                        type="time"
                        value={hours.open}
                        onChange={(e) => {
                          const newHours = { ...config.businessHours };
                          newHours[day] = { ...hours, open: e.target.value };
                          setConfig({ ...config, businessHours: newHours });
                        }}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                      />
                      <span className="text-gray-500">-</span>
                      <input
                        type="time"
                        value={hours.close}
                        onChange={(e) => {
                          const newHours = { ...config.businessHours };
                          newHours[day] = { ...hours, close: e.target.value };
                          setConfig({ ...config, businessHours: newHours });
                        }}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                      />
                    </>
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
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              placeholder="Pesan yang dikirim di luar jam kerja"
            />
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Advanced Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Model
              </label>
              <select
                value={config.aiModel}
                onChange={(e) => setConfig({ ...config, aiModel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="glm-4-plus">GLM-4 Plus (Recommended)</option>
                <option value="glm-4">GLM-4 Standard</option>
                <option value="glm-4-flash">GLM-4 Flash (Faster)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature: {config.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lower = more focused, Higher = more creative
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                value={config.maxTokens}
                onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                min="100"
                max="4000"
                step="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maksimal panjang response AI (100-4000 tokens)
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={() => router.push('/dashboard/whatsapp-ai')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
