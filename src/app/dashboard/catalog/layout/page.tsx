/**
 * Catalog Layout Customization Page
 * Epic 5: Story 5.7 - Layout Customization
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaGripHorizontal, FaList, FaStar } from 'react-icons/fa';

interface LayoutConfig {
  layoutType: 'GRID' | 'LIST' | 'FEATURED';
  heroEnabled: boolean;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  featuredVehicleIds: string[];
  sectionOrder: string[];
  vehiclesPerPage: number;
  showPriceRange: boolean;
  showVehicleCount: boolean;
}

export default function LayoutCustomizationPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [config, setConfig] = useState<LayoutConfig>({
    layoutType: 'GRID',
    heroEnabled: true,
    heroTitle: 'Temukan Mobil Impian Anda',
    heroSubtitle: 'Pilihan terbaik dengan harga kompetitif',
    heroImageUrl: '',
    featuredVehicleIds: [],
    sectionOrder: ['hero', 'featured', 'filters', 'vehicles'],
    vehiclesPerPage: 12,
    showPriceRange: true,
    showVehicleCount: true,
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      loadLayout(parsedUser.tenantId);
    }
  }, []);

  const loadLayout = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/v1/catalog/layout?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setConfig({
          layoutType: data.data.layoutType,
          heroEnabled: data.data.heroEnabled,
          heroTitle: data.data.heroTitle || '',
          heroSubtitle: data.data.heroSubtitle || '',
          heroImageUrl: data.data.heroImageUrl || '',
          featuredVehicleIds: data.data.featuredVehicleIds || [],
          sectionOrder: data.data.sectionOrder,
          vehiclesPerPage: data.data.vehiclesPerPage,
          showPriceRange: data.data.showPriceRange,
          showVehicleCount: data.data.showVehicleCount,
        });
      }
    } catch (error) {
      console.error('Failed to load layout:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/v1/catalog/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user.tenantId,
          ...config,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Layout berhasil disimpan!' });
      } else {
        throw new Error('Failed to save layout');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal menyimpan layout. Silakan coba lagi.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
            ← Kembali ke Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Kustomisasi Layout Katalog</h1>
        <p className="text-gray-600">Atur tampilan dan tata letak katalog showroom Anda</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Layout Type */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Tipe Layout</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setConfig({ ...config, layoutType: 'GRID' })}
              className={`cursor-pointer border-2 rounded-lg p-4 text-center transition-all ${
                config.layoutType === 'GRID'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <FaGripHorizontal className="text-3xl mx-auto mb-2 text-blue-600" />
              <h3 className="font-semibold">Grid</h3>
              <p className="text-sm text-gray-600">Tampilan kotak-kotak</p>
            </div>

            <div
              onClick={() => setConfig({ ...config, layoutType: 'LIST' })}
              className={`cursor-pointer border-2 rounded-lg p-4 text-center transition-all ${
                config.layoutType === 'LIST'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <FaList className="text-3xl mx-auto mb-2 text-blue-600" />
              <h3 className="font-semibold">List</h3>
              <p className="text-sm text-gray-600">Tampilan daftar</p>
            </div>

            <div
              onClick={() => setConfig({ ...config, layoutType: 'FEATURED' })}
              className={`cursor-pointer border-2 rounded-lg p-4 text-center transition-all ${
                config.layoutType === 'FEATURED'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <FaStar className="text-3xl mx-auto mb-2 text-blue-600" />
              <h3 className="font-semibold">Featured</h3>
              <p className="text-sm text-gray-600">Dengan unggulan</p>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Hero Section</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.heroEnabled}
                onChange={(e) => setConfig({ ...config, heroEnabled: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">Aktifkan</span>
            </label>
          </div>

          {config.heroEnabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Judul Hero
                </label>
                <input
                  type="text"
                  value={config.heroTitle}
                  onChange={(e) => setConfig({ ...config, heroTitle: e.target.value })}
                  placeholder="Temukan Mobil Impian Anda"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={config.heroSubtitle}
                  onChange={(e) => setConfig({ ...config, heroSubtitle: e.target.value })}
                  placeholder="Pilihan terbaik dengan harga kompetitif"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Gambar Background (opsional)
                </label>
                <input
                  type="url"
                  value={config.heroImageUrl}
                  onChange={(e) => setConfig({ ...config, heroImageUrl: e.target.value })}
                  placeholder="https://example.com/hero-image.jpg"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Display Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Pengaturan Tampilan</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kendaraan per Halaman
              </label>
              <select
                value={config.vehiclesPerPage}
                onChange={(e) => setConfig({ ...config, vehiclesPerPage: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value={6}>6 kendaraan</option>
                <option value={9}>9 kendaraan</option>
                <option value={12}>12 kendaraan</option>
                <option value={18}>18 kendaraan</option>
                <option value={24}>24 kendaraan</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showPriceRange}
                  onChange={(e) => setConfig({ ...config, showPriceRange: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Tampilkan range harga</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showVehicleCount}
                  onChange={(e) => setConfig({ ...config, showVehicleCount: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Tampilkan jumlah kendaraan</span>
              </label>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link
            href="/dashboard"
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Menyimpan...' : 'Simpan Layout'}
          </button>
        </div>
      </form>
    </div>
  );
}
