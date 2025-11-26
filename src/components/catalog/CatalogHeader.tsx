/**
 * Catalog Header Component
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { FaPhone, FaWhatsapp } from 'react-icons/fa';

interface CatalogHeaderProps {
  branding: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
  vehicleCount?: number;
  phoneNumber?: string;
  whatsappNumber?: string;
  slug?: string;
}

export default function CatalogHeader({
  branding,
  vehicleCount,
  phoneNumber,
  whatsappNumber,
  slug
}: CatalogHeaderProps) {
  const handlePhoneClick = () => {
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  const handleWhatsAppClick = () => {
    if (whatsappNumber) {
      const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
      const message = encodeURIComponent(`Halo, saya tertarik dengan kendaraan di ${branding.name}`);
      window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
    }
  };

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
              {vehicleCount !== undefined && (
                <p className="text-sm text-gray-600">
                  {vehicleCount}+ Mobil Berkualitas
                </p>
              )}
            </div>
          </div>

          {/* Contact Buttons */}
          <div className="flex items-center gap-3">
            {phoneNumber && (
              <button
                onClick={handlePhoneClick}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                title="Telepon"
              >
                <FaPhone size={16} />
                <span className="hidden lg:inline">Telepon</span>
              </button>
            )}

            {whatsappNumber && (
              <button
                onClick={handleWhatsAppClick}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                title="WhatsApp"
              >
                <FaWhatsapp size={18} />
                <span className="hidden lg:inline">WhatsApp</span>
              </button>
            )}

            {slug && (
              <Link
                href={`/catalog/${slug}/contact`}
                className="hidden sm:block px-4 py-2 text-sm font-medium text-white rounded-md hover:opacity-90 transition-opacity"
                style={{ backgroundColor: branding.primaryColor }}
              >
                Hubungi Kami
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
