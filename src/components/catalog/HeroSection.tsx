'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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
      <div className="container mx-auto px-4 py-12 md:py-24">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
            {title}
          </h1>
          <p className="text-base md:text-xl text-gray-100 mb-8 max-w-2xl mx-auto">
            {subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-white text-gray-900 hover:bg-gray-100 w-full sm:w-auto">
              <Link href="#vehicles">Lihat Koleksi</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-gray-900 bg-transparent w-full sm:w-auto">
              <Link href="#contact">Hubungi Kami</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-white opacity-5 rounded-full -mr-16 md:-mr-32 -mt-16 md:-mt-32"></div>
      <div className="absolute bottom-0 left-0 w-24 md:w-48 h-24 md:h-48 bg-white opacity-5 rounded-full -ml-12 md:-ml-24 -mb-12 md:-mb-24"></div>
    </div>
  );
}
