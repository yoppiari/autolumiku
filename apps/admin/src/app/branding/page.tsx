'use client';

import React, { useState, useEffect } from 'react';
import { BrandingConfig, ApiResponse } from '../../types/branding.types';
import { ThemeProvider } from '../../components/branding/ThemeProvider';
import BrandingConfigurationForm from '../../components/branding/BrandingConfigurationForm';

// Mock data for development
const MOCK_BRANDING_CONFIG: BrandingConfig = {
  id: '1',
  tenantId: 'tenant-123',
  logoUrl: 'https://via.placeholder.com/120x60/2563eb/ffffff?text=LOGO',
  faviconUrl: 'https://via.placeholder.com/32x32/2563eb/ffffff?text=F',
  primaryColor: '#2563eb',
  secondaryColor: '#64748b',
  companyInfo: {
    name: 'Showroom Motor Indonesia',
    address: 'Jl. Sudirman No. 123, Jakarta Pusat, DKI Jakarta 10110',
    phone: '+62 21 1234 5678',
    email: 'info@showroommotor.co.id',
    website: 'https://www.showroommotor.co.id',
  },
  createdAt: '2025-11-20T10:00:00Z',
  updatedAt: '2025-11-20T10:00:00Z',
};

const MOCK_API_RESPONSE: ApiResponse = {
  success: true,
  data: MOCK_BRANDING_CONFIG,
  meta: {
    requestId: 'req-123',
    timestamp: new Date().toISOString(),
  },
};

export default function BrandingPage() {
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantId] = useState('tenant-123'); // Would come from auth context

  useEffect(() => {
    loadBrandingConfig();
  }, [tenantId]);

  const loadBrandingConfig = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // In a real implementation, this would call the actual API
      // const response = await fetch(`/api/tenants/${tenantId}/branding`);
      // const data: ApiResponse<BrandingConfig> = await response.json();

      // Mock API call with delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate API response
      setBrandingConfig(MOCK_BRANDING_CONFIG);

    } catch (err) {
      console.error('Error loading branding config:', err);
      setError('Gagal memuat konfigurasi branding. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBranding = async (data: BrandingConfig): Promise<ApiResponse> => {
    try {
      // In a real implementation, this would call the actual API
      // const response = await fetch(`/api/tenants/${tenantId}/branding`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data),
      // });
      // return await response.json();

      // Mock API call with delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update local state
      setBrandingConfig({
        ...data,
        updatedAt: new Date().toISOString(),
      });

      // Return mock success response
      return {
        success: true,
        data: {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        meta: {
          requestId: `req-${Date.now()}`,
          timestamp: new Date().toISOString(),
        },
      };

    } catch (err) {
      console.error('Error saving branding config:', err);
      return {
        success: false,
        error: {
          code: 'SAVE_FAILED',
          message: 'Gagal menyimpan konfigurasi branding. Silakan coba lagi.',
        },
        meta: {
          requestId: `req-${Date.now()}`,
          timestamp: new Date().toISOString(),
        },
      };
    }
  };

  const handleCancel = () => {
    // In a real implementation, this might navigate back or show a confirmation
    console.log('Branding configuration cancelled');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Memuat Konfigurasi Branding...
          </h2>
          <p className="text-gray-600">
            Sedang mengambil data branding showroom Anda
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-6xl mb-4">😓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Terjadi Kesalahan
          </h2>
          <p className="text-gray-600 mb-6">
            {error}
          </p>
          <button
            onClick={loadBrandingConfig}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider tenantId={tenantId}>
      <div className="min-h-screen bg-gray-50">
        {/* Page Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  ⚙️ Konfigurasi Branding
                </h1>
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                  Aktif
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => window.history.back()}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200"
                >
                  ← Kembali
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Instructions for Senior Users */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <div className="flex items-start space-x-4">
              <span className="text-3xl">💡</span>
              <div>
                <h3 className="text-lg font-bold text-blue-900 mb-2">
                  Panduan Konfigurasi Branding
                </h3>
                <p className="text-blue-800 mb-3">
                  Halaman ini memungkinkan Anda untuk menyesuaikan tampilan showroom sesuai dengan identitas perusahaan. Ikuti langkah-langkah berikut:
                </p>
                <ol className="text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Upload logo dan favicon perusahaan Anda</li>
                  <li>Pilih warna primer dan sekunder yang sesuai dengan brand Anda</li>
                  <li>Lengkapi informasi perusahaan (nama, alamat, kontak)</li>
                  <li>Lihat preview real-time di sisi kanan untuk melihat hasilnya</li>
                  <li>Klik "Simpan Perubahan" untuk menerapkan branding</li>
                </ol>
                <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                  <p className="text-sm text-blue-900 font-medium">
                    💡 <strong>Tip:</strong> Perubahan akan langsung terlihat di website showroom Anda setelah disimpan.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Branding Form */}
          {brandingConfig && (
            <BrandingConfigurationForm
              tenantId={tenantId}
              initialData={brandingConfig}
              onSave={handleSaveBranding}
              onCancel={handleCancel}
              disabled={false}
            />
          )}

          {/* Additional Information */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                📝 Informasi Penting
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Logo dan favicon akan otomatis dioptimalkan untuk performa terbaik</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Perubahan branding akan langsung berlaku di semua halaman showroom</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Semua warna telah divalidasi untuk memenuhi standar aksesibilitas</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Format file yang didukung: PNG, JPG, SVG (maksimal 5MB)</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                🎯 Panduan Aksesibilitas
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Pilih warna dengan kontras yang baik untuk keterbacaan</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Gunakan logo yang jelas dan mudah dikenali</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Pastikan informasi kontak lengkap dan akurat</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Preview real-time membantu Anda melihat hasil sebelum menyimpan</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Help Section */}
          <div className="mt-8 bg-gray-100 rounded-lg p-6 text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Butuh Bantuan?
            </h3>
            <p className="text-gray-600 mb-4">
              Jika Anda mengalami kesulitan dalam mengkonfigurasi branding, tim support kami siap membantu.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium">
                📧 Hubungi Support
              </button>
              <button className="px-6 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium">
                📖 Panduan Lengkap
              </button>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}