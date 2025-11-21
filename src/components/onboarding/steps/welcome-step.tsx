'use client';

import React from 'react';

interface WelcomeStepProps {
  data: any;
  onChange: (data: any) => void;
  onNext: (data?: any) => void;
  onPrevious: () => void;
  onSave: () => void;
  language: 'id' | 'en';
  suggestions: any[];
}

/**
 * Welcome Step Component
 *
 * First step of the onboarding process that introduces users to autolumiku
 */
export function WelcomeStep({
  data,
  onChange,
  onNext,
  onPrevious,
  onSave,
  language,
  suggestions
}: WelcomeStepProps) {
  const content = {
    id: {
      title: 'Selamat Datang di autolumiku! 🚗',
      subtitle: 'Platform Digital untuk Showroom Mobil Modern',
      description: 'Kami akan memandu Anda melalui proses setup showroom digital Anda. Ini hanya memakan waktu sekitar 20-30 menit.',
      features: [
        'Website otomatis untuk showroom Anda',
        'Manajemen inventaris yang mudah',
        'AI untuk deskripsi mobil otomatis',
        'Integrasi WhatsApp dan komunikasi pelanggan',
        'Analitik dan reporting lengkap'
      ],
      whatYoullNeed: [
        'Informasi dasar showroom (nama, alamat, kontak)',
        'Logo showroom (jika ada)',
        'Informasi anggota tim (opsional)'
      ],
      cta: 'Mulai Setup Showroom'
    },
    en: {
      title: 'Welcome to autolumiku! 🚗',
      subtitle: 'Digital Platform for Modern Car Showrooms',
      description: 'We\'ll guide you through setting up your digital showroom. This takes about 20-30 minutes.',
      features: [
        'Automatic website for your showroom',
        'Easy inventory management',
        'AI for automatic car descriptions',
        'WhatsApp integration and customer communication',
        'Complete analytics and reporting'
      ],
      whatYoullNeed: [
        'Basic showroom information (name, address, contact)',
        'Showroom logo (if available)',
        'Team member information (optional)'
      ],
      cta: 'Start Showroom Setup'
    }
  };

  const t = content[language];

  const handleNext = () => {
    // Save any welcome step data (e.g., user preferences, language selection)
    const stepData = {
      startedAt: new Date().toISOString(),
      language,
      deviceInfo: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'
    };
    onChange(stepData);
    onNext(stepData);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mb-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
            <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
              <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
            </svg>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t.title}
        </h1>
        <p className="text-xl text-gray-600 mb-4">
          {t.subtitle}
        </p>
        <p className="text-gray-700 max-w-2xl mx-auto">
          {t.description}
        </p>
      </div>

      {/* Features */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {language === 'id' ? 'Apa yang Anda dapatkan:' : 'What you\'ll get:'}
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {t.features.map((feature, index) => (
            <div key={index} className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <span className="text-gray-700">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* What You'll Need */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {language === 'id' ? 'Apa yang perlu disiapkan:' : 'What you\'ll need:'}
        </h2>
        <div className="space-y-2">
          {t.whatYoullNeed.map((item, index) => (
            <div key={index} className="flex items-center">
              <svg className="w-5 h-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
              </svg>
              <span className="text-gray-700">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      {suggestions.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            <div className="text-sm text-yellow-800">
              <strong>{language === 'id' ? 'Tips:' : 'Tip:'}</strong> {suggestions[0]?.content}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6 border-t">
        <div></div> {/* Empty div for spacing */}
        <button
          onClick={handleNext}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          {t.cta}
          <svg className="w-5 h-5 ml-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}