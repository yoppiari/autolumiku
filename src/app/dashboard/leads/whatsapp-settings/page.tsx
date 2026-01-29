/**
 * WhatsApp Settings Page
 * Admin interface for managing WhatsApp numbers and settings
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface WhatsAppSettings {
  id: string;
  tenantId: string;
  tenantName: string;
  phoneNumber: string;
  isActive: boolean;
  defaultMessage: string;
  autoReply: boolean;
  workingHours: {
    start: string;
    end: string;
    timezone: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function WhatsAppSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<WhatsAppSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSetting, setEditingSetting] = useState<WhatsAppSettings | null>(null);

  // Load settings from API
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);

      try {
        // Get tenantId from localStorage
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          console.error('No user found in localStorage');
          setIsLoading(false);
          return;
        }

        const user = JSON.parse(userStr);
        const tenantId = user.tenantId;

        if (!tenantId) {
          console.error('No tenantId found in user data');
          setIsLoading(false);
          return;
        }

        // Fetch WhatsApp settings from API
        const response = await fetch(`/api/v1/whatsapp-settings?tenantId=${tenantId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch settings: ${response.statusText}`);
        }

        const result = await response.json();
        // API returns single object, wrap in array for consistency
        setSettings(result.data ? [result.data] : []);
      } catch (error) {
        console.error('Error loading WhatsApp settings:', error);
        alert('Gagal memuat WhatsApp settings. Silakan coba lagi.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleToggleActive = async (settingId: string) => {
    try {
      // Find the current setting to toggle
      const currentSetting = settings.find(s => s.id === settingId);
      if (!currentSetting) return;

      const updatedSetting = { ...currentSetting, isActive: !currentSetting.isActive };

      // Call real API to update setting
      const response = await fetch('/api/v1/whatsapp-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSetting),
      });

      if (!response.ok) {
        throw new Error(`Failed to toggle active status: ${response.statusText}`);
      }

      const result = await response.json();
      const savedSetting = result.data;

      // Update local state
      setSettings(prev => prev.map(setting =>
        setting.id === settingId ? savedSetting : setting
      ));
    } catch (error) {
      console.error('Error toggling active status:', error);
      alert('Gagal mengubah status. Silakan coba lagi.');
    }
  };

  const handleEdit = (setting: WhatsAppSettings) => {
    setEditingSetting(setting);
  };

  const handleSave = async (updatedSetting: WhatsAppSettings) => {
    try {
      // Call real API to update/create setting
      const response = await fetch('/api/v1/whatsapp-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSetting),
      });

      if (!response.ok) {
        throw new Error(`Failed to save setting: ${response.statusText}`);
      }

      const result = await response.json();
      const savedSetting = result.data;

      // Update local state with the saved setting
      setSettings(prev => {
        const exists = prev.find(s => s.id === savedSetting.id);
        if (exists) {
          return prev.map(setting =>
            setting.id === savedSetting.id ? savedSetting : setting
          );
        } else {
          return [...prev, savedSetting];
        }
      });

      setEditingSetting(null);
      alert('WhatsApp setting berhasil disimpan!');
    } catch (error) {
      console.error('Error saving WhatsApp setting:', error);
      alert('Gagal menyimpan WhatsApp setting. Silakan coba lagi.');
    }
  };

  const handleCancel = () => {
    setEditingSetting(null);
  };

  const handleDelete = async (settingId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus WhatsApp setting ini?')) {
      try {
        // Call real API to delete setting
        const response = await fetch(`/api/v1/whatsapp-settings/${settingId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error(`Failed to delete setting: ${response.statusText}`);
        }

        // Update local state to remove the deleted setting
        setSettings(prev => prev.filter(setting => setting.id !== settingId));
        alert('WhatsApp setting berhasil dihapus!');
      } catch (error) {
        console.error('Error deleting WhatsApp setting:', error);
        alert('Gagal menghapus WhatsApp setting. Silakan coba lagi.');
      }
    }
  };

  const handleAddNew = () => {
    try {
      // Get tenantId from localStorage
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        alert('User tidak ditemukan. Silakan login kembali.');
        return;
      }

      const user = JSON.parse(userStr);
      const tenantId = user.tenantId;

      if (!tenantId) {
        alert('TenantId tidak ditemukan. Silakan login kembali.');
        return;
      }

      const newSetting: WhatsAppSettings = {
        id: Date.now().toString(),
        tenantId: tenantId,
        tenantName: 'New Tenant',
        phoneNumber: '+62-',
        isActive: true,
        defaultMessage: 'Halo! Terima kasih telah menghubungi kami. Ada yang bisa kami bantu?',
        autoReply: true,
        workingHours: {
          start: '08:00',
          end: '17:00',
          timezone: 'Asia/Jakarta',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setEditingSetting(newSetting);
    } catch (error) {
      console.error('Error creating new setting:', error);
      alert('Gagal membuat WhatsApp setting baru. Silakan coba lagi.');
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Format phone number for display (Indonesian format)
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');

    // Handle +62 prefix (Indonesian country code)
    if (cleaned.startsWith('+62')) {
      const digits = cleaned.slice(3);
      if (digits.length >= 9) {
        // Format: +62-xxx-xxxx-xxxx
        return `+62-${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
      }
    } else if (cleaned.startsWith('62')) {
      const digits = cleaned.slice(2);
      if (digits.length >= 9) {
        return `+62-${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
      }
    } else if (cleaned.startsWith('0')) {
      const digits = cleaned.slice(1);
      if (digits.length >= 9) {
        return `+62-${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
      }
    }

    // Return original if format not recognized
    return phone;
  };

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    return `https://wa.me/${cleanPhone}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a1a1a]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#1a1a1a]">
      {/* Header */}
      {/* Header - Responsive */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">WhatsApp Settings</h1>
          <p className="text-sm md:text-base text-gray-400 mt-1">Kelola nomor WhatsApp dan pengaturan otomatis</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/dashboard/leads"
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            ← Kembali ke Leads
          </Link>
          <button
            onClick={handleAddNew}
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            + Tambah WhatsApp
          </button>
        </div>
      </div>

      {/* Settings List */}
      <div className="space-y-4">
        {settings.map((setting) => (
          <div key={setting.id} className="bg-[#2a2a2a] rounded-xl shadow-sm border border-[#3a3a3a] overflow-hidden">
            {/* Header */}
            {/* Header - Responsive */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 md:p-6 border-b border-[#3a3a3a] gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-green-500 text-xl">📱</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{setting.tenantName}</h3>
                  <p className="text-sm text-gray-400">{formatPhoneNumber(setting.phoneNumber)}</p>
                </div>
              </div>

              <div className="flex flex-col w-full md:w-auto md:flex-row md:items-center gap-2">
                <button
                  onClick={() => handleToggleActive(setting.id)}
                  className={`px-4 py-2 rounded-lg md:rounded-full text-sm font-medium transition-colors text-center w-full md:w-auto ${setting.isActive
                    ? 'bg-green-900/30 text-green-300 hover:bg-green-900/50'
                    : 'bg-[#333] text-gray-300 hover:bg-[#444]'
                    }`}
                >
                  {setting.isActive ? 'Aktif' : 'Tidak Aktif'}
                </button>
                <button
                  onClick={() => handleEdit(setting)}
                  className="px-4 py-2 bg-blue-900/30 text-blue-300 rounded-lg md:rounded-full text-sm font-medium hover:bg-blue-900/50 transition-colors text-center w-full md:w-auto"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(setting.id)}
                  className="px-4 py-2 bg-red-900/30 text-red-300 rounded-lg md:rounded-full text-sm font-medium hover:bg-red-900/50 transition-colors text-center w-full md:w-auto"
                >
                  Hapus
                </button>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Default Message</label>
                  <div className="p-3 bg-[#333] rounded-lg text-sm text-gray-200">
                    {setting.defaultMessage}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Auto Reply</label>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${setting.autoReply
                      ? 'bg-green-900/30 text-green-300'
                      : 'bg-[#333] text-gray-300'
                      }`}>
                      {setting.autoReply ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Jam Kerja</label>
                  <div className="text-sm text-gray-200">
                    {setting.workingHours.start} - {setting.workingHours.end} ({setting.workingHours.timezone})
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${setting.isActive
                      ? 'bg-green-900/30 text-green-300'
                      : 'bg-[#333] text-gray-300'
                      }`}>
                      {setting.isActive ? 'Online' : 'Offline'}
                    </span>
                    <a
                      href={getWhatsAppLink(setting.phoneNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-500 hover:text-green-400 text-sm font-medium"
                    >
                      Test WhatsApp →
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Dibuat</label>
                  <div className="text-sm text-gray-200">
                    {new Date(setting.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Terakhir Diupdate</label>
                  <div className="text-sm text-gray-200">
                    {new Date(setting.updatedAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {settings.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">Belum ada WhatsApp settings</div>
          <p className="text-gray-400 mt-2">Tambahkan nomor WhatsApp untuk mulai menerima leads</p>
        </div>
      )}

      {/* Edit Modal */}
      {editingSetting && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-[#2a2a2a] rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 border border-[#3a3a3a]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingSetting.id.includes('new') ? 'Tambah WhatsApp' : 'Edit WhatsApp'}
              </h2>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nama Tenant</label>
                <input
                  type="text"
                  value={editingSetting.tenantName}
                  onChange={(e) => setEditingSetting({ ...editingSetting, tenantName: e.target.value })}
                  className="w-full px-3 py-2 bg-[#333] border border-[#444] text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nama tenant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nomor WhatsApp</label>
                <input
                  type="text"
                  value={editingSetting.phoneNumber}
                  onChange={(e) => setEditingSetting({ ...editingSetting, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-[#333] border border-[#444] text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+62-8xx-xxxx-xxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Default Message</label>
                <textarea
                  value={editingSetting.defaultMessage}
                  onChange={(e) => setEditingSetting({ ...editingSetting, defaultMessage: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-[#333] border border-[#444] text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Pesan default untuk auto reply"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Jam Mulai</label>
                  <input
                    type="time"
                    value={editingSetting.workingHours.start}
                    onChange={(e) => setEditingSetting({
                      ...editingSetting,
                      workingHours: { ...editingSetting.workingHours, start: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-[#333] border border-[#444] text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Jam Selesai</label>
                  <input
                    type="time"
                    value={editingSetting.workingHours.end}
                    onChange={(e) => setEditingSetting({
                      ...editingSetting,
                      workingHours: { ...editingSetting.workingHours, end: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-[#333] border border-[#444] text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoReply"
                    checked={editingSetting.autoReply}
                    onChange={(e) => setEditingSetting({ ...editingSetting, autoReply: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-500 rounded bg-[#333]"
                  />
                  <label htmlFor="autoReply" className="ml-2 text-sm text-gray-300">
                    Aktifkan Auto Reply
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editingSetting.isActive}
                    onChange={(e) => setEditingSetting({ ...editingSetting, isActive: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-500 rounded bg-[#333]"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-gray-300">
                    Aktif
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-300 bg-[#333] rounded-lg hover:bg-[#444] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleSave(editingSetting)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
