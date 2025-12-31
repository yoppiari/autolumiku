/**
 * Vehicle Detail Page
 * Route: /catalog/[slug]/vehicles/[id]
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import { SEOService } from '@/lib/services/catalog/seo.service';

interface PageProps {
  params: {
    slug: string;
    id: string;
  };
}

export default function VehicleDetailPage({ params }: PageProps) {
  const { slug, id } = params;

  const [branding, setBranding] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState(0);

  useEffect(() => {
    fetchBranding();
  }, [slug]);

  useEffect(() => {
    fetchVehicle();
  }, [slug, id]);

  const fetchBranding = async () => {
    try {
      const response = await fetch(`/api/public/branding/${slug}`);
      if (response.ok) {
        const data = await response.json();
        setBranding(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch branding:', err);
    }
  };

  const fetchVehicle = async () => {
    try {
      const response = await fetch(`/api/public/catalog/${slug}/vehicles/${id}`);
      if (response.ok) {
        const data = await response.json();
        setVehicle(data.data);
      } else {
        setError('Kendaraan tidak ditemukan');
      }
    } catch (err) {
      console.error('Failed to fetch vehicle:', err);
      setError('Gagal memuat data kendaraan');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return `Rp ${price.toLocaleString('id-ID')}`;
  };

  const handleWhatsAppClick = () => {
    if (!vehicle) return;

    const message = `Halo, saya tertarik dengan ${vehicle.year} ${vehicle.make} ${vehicle.model}${
      vehicle.variant ? ` ${vehicle.variant}` : ''
    } (ID: ${vehicle.displayId || vehicle.id.slice(0, 8)}). Bisa info lebih lanjut?`;

    const phoneNumber = '6281234567890'; // TODO: Get from tenant settings
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
          <p className="text-gray-600 mb-4">{error || 'Kendaraan tidak ditemukan'}</p>
          <Link
            href={`/catalog/${slug}`}
            className="text-blue-600 hover:underline"
          >
            Kembali ke Katalog
          </Link>
        </div>
      </div>
    );
  }

  const mainPhoto = vehicle.photos[selectedPhoto] || vehicle.photos[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      {branding && <CatalogHeader branding={branding} vehicleCount={0} />}

      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/catalog/${slug}`} className="text-blue-600 hover:underline">
              Katalog
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600">
              {vehicle.make} {vehicle.model}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Photos */}
          <div>
            {/* Main Photo */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-4">
              {mainPhoto ? (
                <img
                  src={mainPhoto.originalUrl}
                  alt={`${vehicle.make} ${vehicle.model}`}
                  className="w-full h-96 object-cover"
                />
              ) : (
                <div className="w-full h-96 bg-gray-200 flex items-center justify-center">
                  <svg
                    className="w-24 h-24 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Photo Thumbnails */}
            {vehicle.photos.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {vehicle.photos.map((photo: any, index: number) => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(index)}
                    className={`rounded-lg overflow-hidden border-2 ${
                      selectedPhoto === index
                        ? 'border-blue-600'
                        : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={photo.thumbnailUrl || photo.originalUrl}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-20 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column - Details */}
          <div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              {/* Title */}
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>
              {vehicle.variant && (
                <p className="text-lg text-gray-600 mb-4">{vehicle.variant}</p>
              )}

              {/* Price */}
              <div className="mb-6">
                <p className="text-4xl font-bold" style={{ color: branding?.primaryColor || '#1a56db' }}>
                  {formatPrice(vehicle.price)}
                </p>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-600">Tahun</p>
                    <p className="font-semibold">{vehicle.year}</p>
                  </div>
                </div>

                {vehicle.mileage && (
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm text-gray-600">Kilometer</p>
                      <p className="font-semibold">{vehicle.mileage.toLocaleString()} km</p>
                    </div>
                  </div>
                )}

                {vehicle.transmissionType && (
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                      />
                    </svg>
                    <div>
                      <p className="text-sm text-gray-600">Transmisi</p>
                      <p className="font-semibold">{vehicle.transmissionType}</p>
                    </div>
                  </div>
                )}

                {vehicle.fuelType && (
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm text-gray-600">Bahan Bakar</p>
                      <p className="font-semibold">{vehicle.fuelType}</p>
                    </div>
                  </div>
                )}

                {vehicle.color && (
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                      />
                    </svg>
                    <div>
                      <p className="text-sm text-gray-600">Warna</p>
                      <p className="font-semibold">{vehicle.color}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {vehicle.descriptionId && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Deskripsi</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {vehicle.descriptionId}
                  </p>
                </div>
              )}

              {/* Contact Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleWhatsAppClick}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  Hubungi via WhatsApp
                </button>

                <Link
                  href={`/catalog/${slug}`}
                  className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Kembali ke Katalog
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      {branding && (
        <footer className="bg-gray-800 text-white py-8 mt-12">
          <div className="container mx-auto px-4 text-center">
            <p className="mb-2">&copy; 2025 {branding.name}. All rights reserved.</p>
            <p className="text-sm text-gray-400">
              Powered by AutoLumiku - Platform Showroom Modern
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
