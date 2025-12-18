/**
 * Plate Overlay Component
 * Displays tenant logo to cover license plate area on vehicle images
 * Used on public pages only - not on dashboard
 */

'use client';

import React from 'react';

interface PlateOverlayProps {
  logoUrl?: string | null;
  tenantName?: string;
  position?: 'bottom-center' | 'bottom-left' | 'bottom-right';
  size?: 'sm' | 'md' | 'lg';
}

export default function PlateOverlay({
  logoUrl,
  tenantName = 'PRIMA MOBIL',
  position = 'bottom-center',
  size = 'md'
}: PlateOverlayProps) {
  // Position the overlay where license plates typically appear on car photos
  // For 3/4 view photos, plates are usually around 15-25% from bottom of image
  const positionClasses = {
    'bottom-center': 'bottom-[18%] left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-[18%] left-[15%]',
    'bottom-right': 'bottom-[18%] right-[15%]',
  };

  const sizeClasses = {
    sm: 'h-6 min-w-[80px] text-[10px] px-2',
    md: 'h-8 min-w-[100px] text-xs px-3',
    lg: 'h-10 min-w-[120px] text-sm px-4',
  };

  // If logo URL provided, use image
  if (logoUrl) {
    return (
      <div className={`absolute ${positionClasses[position]} z-10`}>
        <div className="bg-black/90 rounded px-2 py-1 shadow-lg">
          <img
            src={logoUrl}
            alt={tenantName}
            className={`${size === 'sm' ? 'h-4' : size === 'md' ? 'h-5' : 'h-6'} w-auto object-contain`}
          />
        </div>
      </div>
    );
  }

  // Fallback: Text-based plate cover styled like Prima Mobil branding
  return (
    <div className={`absolute ${positionClasses[position]} z-10`}>
      <div className={`
        ${sizeClasses[size]}
        bg-black rounded shadow-lg
        flex flex-col items-center justify-center
        border border-gray-800
      `}>
        {/* Main text */}
        <span className="font-bold text-white tracking-wider italic" style={{ fontFamily: 'Arial Black, sans-serif' }}>
          {tenantName}
        </span>
        {/* Decorative stripe */}
        <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b overflow-hidden flex">
          <div className="flex-1 bg-red-600"></div>
          <div className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600"></div>
        </div>
      </div>
    </div>
  );
}
