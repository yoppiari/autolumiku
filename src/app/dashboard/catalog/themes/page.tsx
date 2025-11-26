/**
 * Theme Selection Page
 * Epic 5: Story 5.8 - Multiple Themes
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import ThemePreview from '@/components/catalog/ThemePreview';
import { ThemeDefinition } from '@/lib/themes/theme-definitions';

export default function ThemesPage() {
  const [user, setUser] = useState<any>(null);
  const [themes, setThemes] = useState<ThemeDefinition[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('modern');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<ThemeDefinition | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      loadThemes(parsedUser.tenantId);
    }
  }, []);

  const loadThemes = async (tenantId: string) => {
    try {
      // Get all available themes
      const themesResponse = await fetch('/api/v1/catalog/theme?action=all');
      if (themesResponse.ok) {
        const themesData = await themesResponse.json();
        setThemes(themesData.data);
      }

      // Get current selected theme
      const currentResponse = await fetch(`/api/v1/catalog/theme?tenantId=${tenantId}`);
      if (currentResponse.ok) {
        const currentData = await currentResponse.json();
        setSelectedThemeId(currentData.data.selectedThemeId);
      }
    } catch (error) {
      console.error('Failed to load themes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTheme = async (themeId: string) => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/v1/catalog/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user.tenantId,
          themeId,
        }),
      });

      if (response.ok) {
        setSelectedThemeId(themeId);
        setMessage({ type: 'success', text: 'Tema berhasil diubah!' });
      } else {
        throw new Error('Failed to update theme');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal mengubah tema. Silakan coba lagi.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (theme: ThemeDefinition) => {
    setPreviewTheme(theme);
  };

  const closePreview = () => {
    setPreviewTheme(null);
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
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
            ← Kembali ke Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Pilih Tema Katalog</h1>
        <p className="text-gray-600">Ubah tampilan dan nuansa katalog showroom Anda</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Theme Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {themes.map((theme) => (
          <ThemePreview
            key={theme.id}
            theme={theme}
            isSelected={selectedThemeId === theme.id}
            onSelect={() => handleSelectTheme(theme.id)}
            onPreview={() => handlePreview(theme)}
          />
        ))}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Tips:</strong> Klik tema untuk menerapkan, atau klik "Preview Lengkap" untuk melihat tampilan detail sebelum menerapkan.
        </p>
      </div>

      {/* Preview Modal */}
      {previewTheme && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{previewTheme.name}</h2>
                <p className="text-gray-600">{previewTheme.description}</p>
              </div>
              <button
                onClick={closePreview}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Color Palette */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Palet Warna</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(previewTheme.colors.light).map(([name, color]) => (
                    <div key={name} className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-lg border-2 border-gray-200 shadow"
                        style={{ backgroundColor: color }}
                      ></div>
                      <div>
                        <p className="font-medium text-sm capitalize">{name}</p>
                        <p className="text-xs text-gray-500">{color}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typography */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Tipografi</h3>
                <div className="space-y-2">
                  <p><strong>Font Utama:</strong> {previewTheme.typography.fontFamily}</p>
                  <p><strong>Font Heading:</strong> {previewTheme.typography.headingFont}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t">
                <button
                  onClick={() => {
                    handleSelectTheme(previewTheme.id);
                    closePreview();
                  }}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                >
                  {saving ? 'Menerapkan...' : 'Terapkan Tema Ini'}
                </button>
                <button
                  onClick={closePreview}
                  className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
