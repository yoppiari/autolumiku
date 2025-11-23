'use client';

import React, { useState } from 'react';

interface TenantCreationSuccessModalProps {
  isOpen: boolean;
  tenantName: string;
  tenantSubdomain: string;
  adminEmail: string;
  adminPassword: string;
  onClose: () => void;
  onViewTenant: () => void;
}

export default function TenantCreationSuccessModal({
  isOpen,
  tenantName,
  tenantSubdomain,
  adminEmail,
  adminPassword,
  onClose,
  onViewTenant,
}: TenantCreationSuccessModalProps) {
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({});

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [key]: true });
    setTimeout(() => {
      setCopied({ ...copied, [key]: false });
    }, 2000);
  };

  const tenantUrl = `https://${tenantSubdomain}.autolumiku.com`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
          {/* Success Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full mb-4">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Tenant Berhasil Dibuat!
            </h3>
            <p className="text-sm text-gray-600">
              Tenant <span className="font-semibold">{tenantName}</span> telah berhasil dibuat
            </p>
          </div>

          {/* Credentials Section */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-yellow-800 mb-1">
                  PENTING: Simpan Informasi Login Ini
                </h4>
                <p className="text-xs text-yellow-700">
                  Password ini hanya ditampilkan sekali. Pastikan Anda menyimpan atau
                  mengirimkannya ke administrator tenant sebelum menutup dialog ini.
                </p>
              </div>
            </div>
          </div>

          {/* Credentials Details */}
          <div className="space-y-4 mb-6">
            {/* Tenant URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Tenant
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={tenantUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                />
                <button
                  onClick={() => handleCopy(tenantUrl, 'url')}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  {copied.url ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Admin Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Administrator
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={adminEmail}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                />
                <button
                  onClick={() => handleCopy(adminEmail, 'email')}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  {copied.email ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Admin Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password Administrator
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={adminPassword}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                />
                <button
                  onClick={() => handleCopy(adminPassword, 'password')}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  {copied.password ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Copy All Button */}
            <button
              onClick={() => {
                const allCredentials = `
Tenant: ${tenantName}
URL: ${tenantUrl}
Email: ${adminEmail}
Password: ${adminPassword}
                `.trim();
                handleCopy(allCredentials, 'all');
              }}
              className="w-full px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors text-sm font-medium"
            >
              {copied.all ? '✓ Semua Credential Copied' : 'Copy Semua Credential'}
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0">
            <button
              onClick={onViewTenant}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Lihat Detail Tenant
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
            >
              Kembali ke Daftar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
