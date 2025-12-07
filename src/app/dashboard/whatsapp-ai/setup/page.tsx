/**
 * WhatsApp AI Setup Wizard
 * QR Code scanning untuk connect WhatsApp Business
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

type SetupStep = 'init' | 'qr' | 'connecting' | 'success' | 'error';

export default function WhatsAppSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>('init');
  const [qrCode, setQrCode] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get tenantId on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      setError('User not found in localStorage');
      setStep('error');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setTenantId(parsedUser.tenantId);
  }, []);

  // Initialize WhatsApp connection
  const initializeConnection = async () => {
    if (!tenantId) {
      setError('Tenant ID not found');
      setStep('error');
      return;
    }

    setStep('qr');
    setError('');

    try {
      const response = await fetch('/api/v1/whatsapp-ai/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize WhatsApp connection');
      }

      setQrCode(data.data.qrCode);
      setClientId(data.data.clientId);
      console.log('QR Code data:', data.data.qrCode); // Debugging

      // Start polling for connection status
      startPollingStatus(data.data.clientId);
    } catch (err: any) {
      console.error('Failed to initialize:', err);
      setError(err.message || 'Failed to initialize WhatsApp connection');
      setStep('error');
    }
  };

  // Poll connection status
  const startPollingStatus = (clientIdToCheck: string) => {
    setIsPolling(true);

    // Check every 3 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        console.log('[Setup Polling] Checking status for clientId:', clientIdToCheck);
        const response = await fetch(`/api/v1/whatsapp-ai/status?clientId=${clientIdToCheck}`);
        const data = await response.json();

        console.log('[Setup Polling] Response:', data);
        console.log('[Setup Polling] isConnected:', data.data?.isConnected);
        console.log('[Setup Polling] phoneNumber:', data.data?.phoneNumber);
        console.log('[Setup Polling] connectionStatus:', data.data?.connectionStatus);

        if (data.success) {
          if (data.data.qrCode) {
            setQrCode(data.data.qrCode);
          }

          if (data.data.isConnected) {
            // Connected!
            console.log('[Setup Polling] ✅ CONNECTION DETECTED! Phone:', data.data.phoneNumber);
            setPhoneNumber(data.data.phoneNumber);
            setStep('success');
            setIsPolling(false);

            // Clear interval
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }

            // Redirect to config after 2 seconds
            setTimeout(() => {
              router.push('/dashboard/whatsapp-ai/config');
            }, 2000);
          } else {
            console.log('[Setup Polling] Still waiting... isConnected:', data.data.isConnected);
          }
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    }, 3000);

    // Stop polling after 5 minutes (QR code expired)
    setTimeout(() => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        setIsPolling(false);

        if (step === 'qr') {
          setError('QR code expired. Please try again.');
          setStep('error');
        }
      }
    }, 300000); // 5 minutes
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Restart setup
  const restartSetup = () => {
    setStep('init');
    setQrCode('');
    setClientId('');
    setPhoneNumber('');
    setError('');
    setIsPolling(false);

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/whatsapp-ai" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to WhatsApp AI Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Setup WhatsApp AI</h1>
        <p className="text-gray-600 mt-1">Connect WhatsApp Business untuk mengaktifkan AI assistant</p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center ${step !== 'init' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step !== 'init' ? 'bg-green-100' : 'bg-gray-100'
              }`}>
              {step !== 'init' ? '✓' : '1'}
            </div>
            <span className="ml-2 text-sm font-medium">Initialize</span>
          </div>
          <div className="w-16 h-1 bg-gray-200"></div>
          <div className={`flex items-center ${step === 'success' ? 'text-green-600' : step === 'qr' || step === 'connecting' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === 'success' ? 'bg-green-100' : step === 'qr' || step === 'connecting' ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
              {step === 'success' ? '✓' : '2'}
            </div>
            <span className="ml-2 text-sm font-medium">Connect</span>
          </div>
          <div className="w-16 h-1 bg-gray-200"></div>
          <div className={`flex items-center ${step === 'success' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === 'success' ? 'bg-green-100' : 'bg-gray-100'
              }`}>
              {step === 'success' ? '✓' : '3'}
            </div>
            <span className="ml-2 text-sm font-medium">Done</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        {/* Init Step */}
        {step === 'init' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">📱</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Connect?</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Pastikan Anda sudah memiliki WhatsApp Business terpasang di smartphone Anda. Kami akan generate QR code untuk scanning.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
              <h3 className="font-medium text-blue-900 mb-2">Persyaratan:</h3>
              <ul className="text-sm text-blue-800 text-left space-y-1">
                <li>✓ WhatsApp Business installed</li>
                <li>✓ Nomor WhatsApp aktif</li>
                <li>✓ Koneksi internet stabil</li>
              </ul>
            </div>
            <button
              onClick={initializeConnection}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Generate QR Code →
            </button>
          </div>
        )}

        {/* QR Code Step */}
        {step === 'qr' && (
          <div className="text-center">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Scan QR Code</h2>
              <p className="text-gray-600">Buka WhatsApp Business → Settings → Linked Devices → Link a Device</p>
            </div>

            {qrCode ? (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-lg border-4 border-green-500 mb-4">
                  {qrCode.startsWith('http') ? (
                    <img
                      src={qrCode}
                      alt="WhatsApp QR Code"
                      className="w-64 h-64"
                    />
                  ) : (
                    <QRCodeSVG
                      value={qrCode}
                      size={256}
                      level={"L"}
                      includeMargin={true}
                    />
                  )}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                  Menunggu scanning... (expire dalam 60 detik)
                </div>
                <p className="text-xs text-gray-500 mt-4">Client ID: {clientId}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
                <p className="text-gray-600">Generating QR code...</p>
              </div>
            )}

            <button
              onClick={restartSetup}
              className="mt-6 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel & Restart
            </button>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Connected Successfully!</h2>
            <p className="text-gray-600 mb-2">
              WhatsApp Business Anda berhasil terhubung
            </p>
            {phoneNumber && (
              <p className="text-lg font-medium text-green-600 mb-6">
                📱 {phoneNumber}
              </p>
            )}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
              <p className="text-sm text-green-800">
                Redirecting ke configuration page...
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/whatsapp-ai/config')}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Configure AI Now →
            </button>
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">❌</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Connection Failed</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button
              onClick={restartSetup}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3">Troubleshooting:</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• Pastikan WhatsApp Business sudah terbaru</li>
          <li>• QR code expire dalam 60 detik, generate ulang jika sudah expire</li>
          <li>• Pastikan smartphone dan komputer terhubung ke internet</li>
          <li>• Jika masih error, coba restart WhatsApp Business</li>
        </ul>
      </div>
    </div>
  );
}
