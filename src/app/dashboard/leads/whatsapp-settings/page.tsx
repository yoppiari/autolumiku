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

  // Mock data for development
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      
      // Mock WhatsApp settings data
      const mockSettings: WhatsAppSettings[] = [
        {
          id: '1',
          tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed' // MOCK_DATA,
          tenantName: 'Showroom Jakarta',
          phoneNumber: '+62-21-5550-1234',
          isActive: true,
          defaultMessage: 'Halo! Terima kasih telah menghubungi Showroom Jakarta. Ada yang bisa kami bantu?',
          autoReply: true,
          workingHours: {
            start: '08:00',
            end: '17:00',
            timezone: 'Asia/Jakarta',
          },
          createdAt: '2025-11-01T00:00:00Z',
          updatedAt: '2025-11-23T10:30:00Z',
        },
        {
          id: '2',
          tenantId: '5536722c-78e5-4dcd-9d35-d16858add414' // MOCK_DATA,
          tenantName: 'Dealer Mobil',
          phoneNumber: '+62-22-6666-5678',
          isActive: true,
          defaultMessage: 'Selamat datang di Dealer Mobil! Kami siap membantu Anda menemukan mobil impian.',
          autoReply: false,
          workingHours: {
            start: '09:00',
            end: '18:00',
            timezone: 'Asia/Jakarta',
          },
          createdAt: '2025-11-02T00:00:00Z',
          updatedAt: '2025-11-20T14:15:00Z',
        },
        {
          id: '3',
          tenantId: '508b3141-31c4-47fb-8473-d5b5ba940ac6' // MOCK_DATA,
          tenantName: 'AutoMobil',
          phoneNumber: '+62-24-7777-8901',
          isActive: false,
          defaultMessage: 'Terima kasih telah menghubungi AutoMobil. Kami akan segera merespons.',
          autoReply: true,
          workingHours: {
            start: '08:30',
            end: '16:30',
            timezone: 'Asia/Jakarta',
          },
          createdAt: '2025-11-05T00:00:00Z',
          updatedAt: '2025-11-15T11:45:00Z',
        },
      ];

      setSettings(mockSettings);
      setIsLoading(false);
    };

    loadSettings();
  }, []);

  const handleToggleActive = async (settingId: string) => {
    // Mock API call
    setSettings(prev => prev.map(setting => 
      setting.id === settingId ? { ...setting, isActive: !setting.isActive } : setting
    ));
    console.log('Toggle active status for:', settingId);
  };

  const handleEdit = (setting: WhatsAppSettings) => {
    setEditingSetting(setting);
  };

  const handleSave = async (updatedSetting: WhatsAppSettings) => {
    // Mock API call
    setSettings(prev => prev.map(setting => 
      setting.id === updatedSetting.id ? updatedSetting : setting
    ));
    setEditingSetting(null);
    console.log('Save setting:', updatedSetting);
  };

  const handleCancel = () => {
    setEditingSetting(null);
  };

  const handleDelete = async (settingId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus WhatsApp setting ini?')) {
      setSettings(prev => prev.filter(setting => setting.id !== settingId));
      console.log('Delete setting:', settingId);
    }
  };

  const handleAddNew = () => {
    const newSetting: WhatsAppSettings = {
      id: Date.now().toString(),
      tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed' // MOCK_DATA,
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
  };

  const formatPhoneNumber = (phone: string) => {
    // Format phone number for display
    return phone.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3-$4');
  };

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    return `https://wa.me/${cleanPhone}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Settings</h1>
          <p className="text-gray-600 mt-1">Kelola nomor WhatsApp dan pengaturan otomatis</p>
        </div>

        <div className="flex space-x-4">
          <Link
            href="/admin/leads"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Kembali ke Leads
          </Link>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            + Tambah WhatsApp
          </button>
        </div>
      </div>

      {/* Settings List */}
      <div className="space-y-4">
        {settings.map((setting) => (
          <div key={setting.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-xl">📱</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{setting.tenantName}</h3>
                  <p className="text-sm text-gray-600">{formatPhoneNumber(setting.phoneNumber)}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleToggleActive(setting.id)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    setting.isActive 
                      ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {setting.isActive ? 'Aktif' : 'Tidak Aktif'}
                </button>
                <button
                  onClick={() => handleEdit(setting)}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium hover:bg-blue-200 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(setting.id)}
                  className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium hover:bg-red-200 transition-colors"
                >
                  Hapus
                </button>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Default Message</label>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-900">
                    {setting.defaultMessage}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Auto Reply</label>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      setting.autoReply 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {setting.autoReply ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jam Kerja</label>
                  <div className="text-sm text-gray-900">
                    {setting.workingHours.start} - {setting.workingHours.end} ({setting.workingHours.timezone})
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      setting.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {setting.isActive ? 'Online' : 'Offline'}
                    </span>
                    <a
                      href={getWhatsAppLink(setting.phoneNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      Test WhatsApp →
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dibuat</label>
                  <div className="text-sm text-gray-900">
                    {new Date(setting.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Terakhir Diupdate</label>
                  <div className="text-sm text-gray-900">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSetting.id.includes('new') ? 'Tambah WhatsApp' : 'Edit WhatsApp'}
              </h2>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Tenant</label>
                <input
                  type="text"
                  value={editingSetting.tenantName}
                  onChange={(e) => setEditingSetting({...editingSetting, tenantName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nama tenant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nomor WhatsApp</label>
                <input
                  type="text"
                  value={editingSetting.phoneNumber}
                  onChange={(e) => setEditingSetting({...editingSetting, phoneNumber: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+62-8xx-xxxx-xxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Message</label>
                <textarea
                  value={editingSetting.defaultMessage}
                  onChange={(e) => setEditingSetting({...editingSetting, defaultMessage: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Pesan default untuk auto reply"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jam Mulai</label>
                  <input
                    type="time"
                    value={editingSetting.workingHours.start}
                    onChange={(e) => setEditingSetting({
                      ...editingSetting, 
                      workingHours: {...editingSetting.workingHours, start: e.target.value}
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jam Selesai</label>
                  <input
                    type="time"
                    value={editingSetting.workingHours.end}
                    onChange={(e) => setEditingSetting({
                      ...editingSetting, 
                      workingHours: {...editingSetting.workingHours, end: e.target.value}
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoReply"
                    checked={editingSetting.autoReply}
                    onChange={(e) => setEditingSetting({...editingSetting, autoReply: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="autoReply" className="ml-2 text-sm text-gray-700">
                    Aktifkan Auto Reply
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editingSetting.isActive}
                    onChange={(e) => setEditingSetting({...editingSetting, isActive: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                    Aktif
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
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