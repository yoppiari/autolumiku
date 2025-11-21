import React from 'react';
import { BrandingPreview as BrandingPreviewType } from '../../types/branding.types';

interface BrandingPreviewProps {
  data: BrandingPreviewType;
  title?: string;
}

export const BrandingPreview: React.FC<BrandingPreviewProps> = ({
  data,
  title = "Preview Branding"
}) => {
  // Apply custom CSS properties for dynamic theming
  const previewStyle: React.CSSProperties = {
    '--primary-color': data.primaryColor,
    '--secondary-color': data.secondaryColor,
  } as React.CSSProperties;

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Preview Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <span className="mr-2">👁️</span>
          {title}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Lihat tampilan branding yang akan terlihat oleh pelanggan
        </p>
      </div>

      {/* Preview Content */}
      <div className="p-6 space-y-6">
        {/* Website Header Preview */}
        <div className="border rounded-lg overflow-hidden">
          <div
            className="p-4 flex items-center justify-between"
            style={{
              backgroundColor: data.primaryColor,
              color: '#ffffff'
            }}
          >
            <div className="flex items-center space-x-4">
              {/* Logo Preview */}
              {data.logoUrl ? (
                <img
                  src={data.logoUrl}
                  alt="Company Logo"
                  className="h-10 w-auto object-contain bg-white p-1 rounded"
                />
              ) : (
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded flex items-center justify-center">
                  <span className="text-2xl">🚗</span>
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold">{data.companyName}</h3>
                <p className="text-sm opacity-90">Website Mobil Showroom</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button className="px-3 py-1 bg-white bg-opacity-20 rounded text-sm hover:bg-opacity-30 transition-colors">
                Beranda
              </button>
              <button className="px-3 py-1 bg-white bg-opacity-20 rounded text-sm hover:bg-opacity-30 transition-colors">
                Kendaraan
              </button>
              <button className="px-3 py-1 bg-white bg-opacity-20 rounded text-sm hover:bg-opacity-30 transition-colors">
                Kontak
              </button>
            </div>
          </div>
        </div>

        {/* Vehicle Card Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vehicle Listing Card */}
          <div className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="aspect-video bg-gray-200 flex items-center justify-center">
              <span className="text-gray-400 text-6xl">📷</span>
            </div>
            <div className="p-4">
              <h4
                className="text-lg font-bold mb-2"
                style={{ color: data.primaryColor }}
              >
                Toyota Avanza 2023
              </h4>
              <p className="text-gray-600 text-sm mb-3">
                Tipe: G | Transmisi: Automatic | Bahan Bakar: Bensin
              </p>
              <div className="flex items-center justify-between">
                <span
                  className="text-xl font-bold"
                  style={{ color: data.primaryColor }}
                >
                  Rp 235.000.000
                </span>
                <button
                  className="px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: data.primaryColor }}
                >
                  Lihat Detail
                </button>
              </div>
            </div>
          </div>

          {/* Company Information Card */}
          <div className="border rounded-lg p-4 shadow-sm">
            <h4
              className="text-lg font-bold mb-4"
              style={{ color: data.primaryColor }}
            >
              Informasi Perusahaan
            </h4>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <span className="text-xl">🏢</span>
                <div>
                  <p className="font-medium text-gray-900">Nama Perusahaan</p>
                  <p className="text-gray-600 text-sm">{data.companyName}</p>
                </div>
              </div>
              {data.companyAddress && (
                <div className="flex items-start space-x-3">
                  <span className="text-xl">📍</span>
                  <div>
                    <p className="font-medium text-gray-900">Alamat</p>
                    <p className="text-gray-600 text-sm">{data.companyAddress}</p>
                  </div>
                </div>
              )}
              {data.companyPhone && (
                <div className="flex items-start space-x-3">
                  <span className="text-xl">📞</span>
                  <div>
                    <p className="font-medium text-gray-900">Telepon</p>
                    <p className="text-gray-600 text-sm">{data.companyPhone}</p>
                  </div>
                </div>
              )}
              {data.companyEmail && (
                <div className="flex items-start space-x-3">
                  <span className="text-xl">📧</span>
                  <div>
                    <p className="font-medium text-gray-900">Email</p>
                    <p className="text-gray-600 text-sm">{data.companyEmail}</p>
                  </div>
                </div>
              )}
              {data.companyWebsite && (
                <div className="flex items-start space-x-3">
                  <span className="text-xl">🌐</span>
                  <div>
                    <p className="font-medium text-gray-900">Website</p>
                    <p className="text-gray-600 text-sm">{data.companyWebsite}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contact Form Preview */}
        <div className="border rounded-lg p-6 bg-gray-50">
          <h4
            className="text-lg font-bold mb-4"
            style={{ color: data.primaryColor }}
          >
            Form Hubungi Kami
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Nama Lengkap"
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
              style={{ focusRingColor: data.primaryColor }}
              disabled
            />
            <input
              type="email"
              placeholder="Email"
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
              style={{ focusRingColor: data.primaryColor }}
              disabled
            />
            <input
              type="tel"
              placeholder="Nomor Telepon"
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
              style={{ focusRingColor: data.primaryColor }}
              disabled
            />
            <input
              type="text"
              placeholder="Subjek"
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
              style={{ focusRingColor: data.primaryColor }}
              disabled
            />
          </div>
          <textarea
            placeholder="Pesan Anda"
            rows={4}
            className="w-full mt-4 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
            style={{ focusRingColor: data.primaryColor }}
            disabled
          />
          <button
            className="mt-4 px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: data.primaryColor }}
            disabled
          >
            Kirim Pesan
          </button>
        </div>

        {/* Color Scheme Preview */}
        <div className="border rounded-lg p-4">
          <h4 className="text-lg font-bold mb-4 text-gray-900">Palet Warna</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Warna Primer</p>
              <div className="flex items-center space-x-3">
                <div
                  className="w-16 h-16 rounded-lg border-2 border-gray-300"
                  style={{ backgroundColor: data.primaryColor }}
                />
                <div>
                  <p className="font-mono text-sm">{data.primaryColor}</p>
                  <p className="text-xs text-gray-600">Header, Tombol, Link</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Warna Sekunder</p>
              <div className="flex items-center space-x-3">
                <div
                  className="w-16 h-16 rounded-lg border-2 border-gray-300"
                  style={{ backgroundColor: data.secondaryColor }}
                />
                <div>
                  <p className="font-mono text-sm">{data.secondaryColor}</p>
                  <p className="text-xs text-gray-600">Subtitle, Accent</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Preview */}
        <div className="border rounded-lg p-4 bg-gray-100">
          <h4 className="text-lg font-bold mb-4 text-gray-900">Tampilan Mobile</h4>
          <div className="mx-auto" style={{ maxWidth: '375px' }}>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Mobile Header */}
              <div
                className="p-3 flex items-center justify-between"
                style={{
                  backgroundColor: data.primaryColor,
                  color: '#ffffff'
                }}
              >
                <div className="flex items-center space-x-2">
                  {data.logoUrl ? (
                    <img
                      src={data.logoUrl}
                      alt="Logo"
                      className="h-6 w-auto object-contain bg-white p-0.5 rounded"
                    />
                  ) : (
                    <span className="text-lg">🚗</span>
                  )}
                  <span className="text-sm font-bold truncate">
                    {data.companyName}
                  </span>
                </div>
                <button className="p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>

              {/* Mobile Content */}
              <div className="p-3">
                <div className="aspect-video bg-gray-200 rounded mb-3 flex items-center justify-center">
                  <span className="text-gray-400 text-4xl">📷</span>
                </div>
                <h5
                  className="font-bold mb-1"
                  style={{ color: data.primaryColor }}
                >
                  Honda Jazz 2023
                </h5>
                <p className="text-sm text-gray-600 mb-2">RS CVT Automatic</p>
                <div className="flex items-center justify-between">
                  <span
                    className="font-bold"
                    style={{ color: data.primaryColor }}
                  >
                    Rp 285.000.000
                  </span>
                  <button
                    className="px-3 py-1 text-white rounded text-xs font-medium"
                    style={{ backgroundColor: data.primaryColor }}
                  >
                    Detail
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Footer */}
      <div className="bg-gray-50 px-6 py-4 border-t">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Preview ini menunjukkan tampilan aktual yang akan dilihat pelanggan
          </p>
          <div className="flex space-x-2">
            <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">
              🖥️ Desktop
            </button>
            <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">
              📱 Mobile
            </button>
            <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">
              📄 Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingPreview;