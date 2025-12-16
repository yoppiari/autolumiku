'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  primaryColor?: string;
  slug?: string;
}

export default function HeroSection({
  title = 'Temukan Mobil Impian Anda',
  subtitle = 'Pilihan terbaik dengan harga kompetitif',
  imageUrl,
  primaryColor = '#1a56db',
  slug,
}: HeroSectionProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl mb-12 ${!imageUrl ? 'bg-background' : ''}`}
      style={imageUrl ? {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      {/* Gradient Overlay for Text Readability - Subtle */}
      <div className={`absolute inset-0 ${imageUrl ? 'bg-gradient-to-r from-black/80 via-black/40 to-transparent' : ''}`} />

      <div className="relative z-10 p-8 md:p-16 flex flex-col justify-center min-h-[400px] md:min-h-[500px]">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-5xl md:text-7xl font-extrabold text-foreground tracking-tighter leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-xl">
              {subtitle}
            </p>
          )}

          <div className="pt-4 flex flex-col sm:flex-row gap-4 sm:gap-4 max-w-md sm:max-w-none">
            <Button asChild size="lg" className="bg-white text-gray-900 hover:bg-gray-100 w-full sm:w-auto">
              <Link href={slug ? `/catalog/${slug}/vehicles` : '/vehicles'}>Lihat Koleksi</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-gray-900 bg-transparent w-full sm:w-auto">
              <Link href={slug ? `/catalog/${slug}/contact` : '/contact'}>Hubungi Kami</Link>
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
