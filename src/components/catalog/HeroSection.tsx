/**
 * Hero Section Component for Catalog
 * Epic 5: Story 5.7 - Layout Customization
 */

'use client';

import React from 'react';

interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  primaryColor?: string;
}

export default function HeroSection({
  title = 'Temukan Mobil Impian Anda',
  subtitle = 'Pilihan terbaik dengan harga kompetitif',
  imageUrl,
  primaryColor = '#1a56db',
}: HeroSectionProps) {
  return (
    <div
      className="relative overflow-hidden rounded-lg mb-8"
      style={{
        background: imageUrl
          ? `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${imageUrl})`
          : `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            {title}
          </h1>
          <p className="text-lg md:text-xl text-gray-100 mb-8">
            {subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#vehicles"
              className="px-8 py-3 bg-white text-gray-900 rounded-md font-medium hover:bg-gray-100 transition-colors"
            >
              Lihat Koleksi
            </a>
            <a
              href="#contact"
              className="px-8 py-3 bg-transparent border-2 border-white text-white rounded-md font-medium hover:bg-white hover:text-gray-900 transition-colors"
            >
              Hubungi Kami
            </a>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
    </div>
  );
}
