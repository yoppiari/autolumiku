/**
 * WhatsApp Contact Modal
 * Dual contact option: AI Assistant (24/7) vs Human Staff
 */

'use client';

import React, { useState, useEffect } from 'react';

interface WhatsAppContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
  };
  tenantId: string;
}

export default function WhatsAppContactModal({
  isOpen,
  onClose,
  vehicle,
  tenantId,
}: WhatsAppContactModalProps) {
  const [whatsappConfig, setWhatsappConfig] = useState<{
    aiPhoneNumber?: string;
    humanPhoneNumber?: string;
    aiEnabled: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load WhatsApp configuration
  useEffect(() => {
    if (isOpen && tenantId) {
      loadWhatsAppConfig();
    }
  }, [isOpen, tenantId]);

  const loadWhatsAppConfig = async () => {
    setIsLoading(true);
    try {
      // Get WhatsApp AI status
      const aiResponse = await fetch(`/api/v1/whatsapp-ai/status?tenantId=${tenantId}`);

      if (!aiResponse.ok) {
        throw new Error(`AI status API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();

      // Get tenant info for human contact
      const tenantResponse = await fetch(`/api/v1/tenants/${tenantId}`);

      if (!tenantResponse.ok) {
        throw new Error(`Tenant API error: ${tenantResponse.status}`);
      }

      const tenantData = await tenantResponse.json();

      setWhatsappConfig({
        aiPhoneNumber: aiData.success && aiData.data.isConnected ? aiData.data.phoneNumber : null,
        humanPhoneNumber: tenantData.success ? tenantData.data.whatsappNumber : null,
        aiEnabled: aiData.success && aiData.data.isConnected,
      });
    } catch (error) {
      console.error('Failed to load WhatsApp config:', error);
      setWhatsappConfig({
        aiEnabled: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactChoice = (type: 'ai' | 'human') => {
    const phoneNumber = type === 'ai' ? whatsappConfig?.aiPhoneNumber : whatsappConfig?.humanPhoneNumber;

    if (!phoneNumber) {
      alert('Nomor WhatsApp tidak tersedia. Silakan hubungi admin.');
      return;
    }

    // Generate WhatsApp message
    // FIX: Use consistent price formatting (price is stored in rupiah, not cents)
    const formattedPrice = new Intl.NumberFormat('id-ID').format(vehicle.price);
    const message = encodeURIComponent(
      `Halo! Saya tertarik dengan mobil:\n\n` +
      `${vehicle.year} ${vehicle.make} ${vehicle.model}\n` +
      `Harga: Rp ${formattedPrice}\n\n` +
      `Boleh minta info lebih lanjut?`
    );

    // Open WhatsApp
    // FIX: Preserve + prefix for international numbers
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '').replace(/^\+/, '');
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');

    // Track lead
    trackWhatsAppLead(type);

    // Close modal
    onClose();
  };

  const trackWhatsAppLead = async (type: 'ai' | 'human') => {
    try {
      await fetch('/api/v1/leads/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          vehicleId: vehicle.id,
          source: type === 'ai' ? 'whatsapp_ai' : 'whatsapp_human',
          metadata: {
            vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            price: vehicle.price,
            contactType: type,
          },
        }),
      });
    } catch (error) {
      console.error('Failed to track lead:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-1">Hubungi Kami</h2>
              <p className="text-sm opacity-90">Pilih cara berkomunikasi yang Anda inginkan</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Vehicle Info */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Menanyakan tentang:</p>
          <p className="font-semibold text-gray-900">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          <p className="text-lg font-bold text-blue-600 mt-1">
            Rp {new Intl.NumberFormat('id-ID').format(vehicle.price)}
          </p>
        </div>

        {/* Contact Options */}
        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : (
            <>
              {/* AI Assistant Option */}
              {whatsappConfig?.aiEnabled && whatsappConfig?.aiPhoneNumber && (
                <button
                  onClick={() => handleContactChoice('ai')}
                  className="w-full p-4 border-2 border-green-500 rounded-xl hover:bg-green-50 transition-colors group"
                >
                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 transition-colors">
                      <span className="text-2xl">🤖</span>
                    </div>
                    <div className="ml-4 text-left flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">AI Assistant</h3>
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          Recommended
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Chat otomatis 24/7 dengan AI</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="flex items-center text-green-600">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Respon Instan
                        </span>
                        <span className="flex items-center text-green-600">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          24/7 Available
                        </span>
                        <span className="flex items-center text-green-600">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Info Lengkap
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Human Staff Option */}
              {whatsappConfig?.humanPhoneNumber && (
                <button
                  onClick={() => handleContactChoice('human')}
                  className="w-full p-4 border-2 border-blue-300 rounded-xl hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                      <span className="text-2xl">👨‍💼</span>
                    </div>
                    <div className="ml-4 text-left flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">Sales Staff</h3>
                      <p className="text-sm text-gray-600 mb-2">Chat langsung dengan staff kami</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="flex items-center text-blue-600">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Personal Touch
                        </span>
                        <span className="flex items-center text-blue-600">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Nego Harga
                        </span>
                        <span className="flex items-center text-blue-600">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Test Drive
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* No WhatsApp Available */}
              {!whatsappConfig?.aiPhoneNumber && !whatsappConfig?.humanPhoneNumber && (
                <div className="text-center py-8 text-gray-500">
                  <p>WhatsApp belum dikonfigurasi. Silakan hubungi admin.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Note */}
        <div className="px-6 pb-6">
          <p className="text-xs text-gray-500 text-center">
            💡 Tip: AI Assistant bisa menjawab pertanyaan umum dengan cepat. Untuk nego harga atau test drive, pilih Sales Staff.
          </p>
        </div>
      </div>
    </div>
  );
}
