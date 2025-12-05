/**
 * WhatsApp AI - Restart Connection Page
 * One-click restart dengan webhook auto-registration
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

export default function RestartWhatsAppPage() {
  const [tenantId, setTenantId] = useState<string>('');
  const [isRestarting, setIsRestarting] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setTenantId(parsedUser.tenantId);
    }
  }, []);

  const handleRestart = async () => {
    if (!tenantId) {
      setError('Tenant ID not found');
      return;
    }

    setIsRestarting(true);
    setError('');
    setSuccess(false);
    setQrCode('');

    try {
      const response = await fetch(`/api/v1/whatsapp-ai/restart?tenantId=${tenantId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to restart connection');
      }

      // Success!
      setSuccess(true);
      setQrCode(data.data.qrCode);
      setClientId(data.data.clientId);
      setWebhookUrl(data.data.webhookUrl);
    } catch (err: any) {
      console.error('Restart error:', err);
      setError(err.message || 'Failed to restart connection');
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/whatsapp-ai"
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Back to WhatsApp AI Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Restart WhatsApp Connection</h1>
        <p className="text-gray-600 mt-1">
          Disconnect dan reinitialize connection dengan webhook URL baru
        </p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        {!success && !qrCode && (
          <div className="text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🔄</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Restart WhatsApp Connection
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Ini akan disconnect connection saat ini dan membuat connection baru dengan webhook URL
              yang benar.
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
              <h3 className="font-medium text-yellow-900 mb-2">⚠️ Perhatian:</h3>
              <ul className="text-sm text-yellow-800 text-left space-y-1">
                <li>• Connection saat ini akan di-disconnect</li>
                <li>• Anda perlu scan QR code ulang</li>
                <li>• Webhook URL akan otomatis ter-register</li>
                <li>• Riwayat conversation tetap tersimpan</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              onClick={handleRestart}
              disabled={isRestarting || !tenantId}
              className="px-8 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRestarting ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Restarting...
                </span>
              ) : (
                'Restart Connection Now'
              )}
            </button>
          </div>
        )}

        {success && qrCode && (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Connection Restarted Successfully!
            </h2>

            {/* Webhook URL Info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
              <h3 className="font-medium text-green-900 mb-2">✅ Webhook Registered:</h3>
              <p className="text-sm text-green-800 break-all">{webhookUrl}</p>
            </div>

            {/* QR Code */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Scan QR Code:</h3>
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-lg border-4 border-green-500 mb-4">
                  {qrCode.startsWith('http') ? (
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                  ) : (
                    <QRCodeSVG value={qrCode} size={256} level="L" includeMargin={true} />
                  )}
                </div>
                <p className="text-xs text-gray-500">Client ID: {clientId}</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 max-w-md mx-auto">
              <h3 className="font-medium text-blue-900 mb-3">📱 Next Steps:</h3>
              <ol className="text-sm text-blue-800 text-left space-y-2">
                <li>1. Buka WhatsApp Business di smartphone</li>
                <li>2. Pilih: Settings → Linked Devices → Link a Device</li>
                <li>3. Scan QR code di atas</li>
                <li>4. Tunggu hingga connected</li>
                <li>5. Test kirim pesan ke nomor WhatsApp Anda</li>
                <li>6. Cek conversations di dashboard</li>
              </ol>
            </div>

            <div className="flex space-x-4 justify-center">
              <Link
                href="/dashboard/whatsapp-ai/conversations"
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Check Conversations →
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Restart Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3">ℹ️ Apa yang terjadi saat restart?</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>
            <strong>1. Disconnect:</strong> Connection lama di-disconnect dari Aimeow server
          </li>
          <li>
            <strong>2. Initialize:</strong> Client baru dibuat dengan clientId baru
          </li>
          <li>
            <strong>3. Webhook:</strong> Webhook URL otomatis di-register ke:{' '}
            <code className="bg-gray-200 px-1 rounded">
              https://auto.lumiku.com/api/v1/webhooks/aimeow
            </code>
          </li>
          <li>
            <strong>4. QR Code:</strong> QR code baru di-generate untuk scanning
          </li>
          <li>
            <strong>5. Connect:</strong> Setelah scan, WhatsApp terhubung dan siap menerima pesan
          </li>
        </ul>
      </div>
    </div>
  );
}
