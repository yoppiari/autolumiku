/**
 * Catalog Header Component
 */

import React from 'react';
import Link from 'next/link';

interface CatalogHeaderProps {
  branding: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
  vehicleCount: number;
}

export default function CatalogHeader({ branding, vehicleCount }: CatalogHeaderProps) {
  return (
    <header
      className="bg-white shadow-md"
      style={{ borderBottom: `4px solid ${branding.primaryColor}` }}
    >
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          {/* Logo & Name */}
          <div className="flex items-center gap-4">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="h-12 w-auto"
              />
            ) : (
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: branding.primaryColor }}
              >
                {branding.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{branding.name}</h1>
              <p className="text-sm text-gray-600">
                {vehicleCount}+ Mobil Berkualitas
              </p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="#contact"
              className="px-4 py-2 text-sm font-medium text-white rounded-md hover:opacity-90 transition-opacity"
              style={{ backgroundColor: branding.primaryColor }}
            >
              Hubungi Kami
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
