/**
 * Vehicle Detail Page - SEO Friendly URL
 * Route: /vehicles/[make]-[model]-[year]-[displayId]
 * Example: /vehicles/honda-city-2006-pm-pst-001
 *
 * This route provides SEO-friendly URLs while maintaining ID-based lookup
 */

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { CatalogEngineService } from '@/lib/services/catalog/catalog-engine.service';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import VehicleGallery from '@/components/catalog/VehicleGallery';
import ShareButton from '@/components/catalog/ShareButton';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Gauge,
  Zap,
  Droplets,
  Palette,
  ArrowLeft,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { prisma } from '@/lib/prisma';

interface PageProps {
  params: {
    slug: string[];
  };
}

/**
 * Parse vehicle slug and extract displayId
 * Examples:
 * - honda-city-2006-pm-pst-001 → displayId: "PM-PST-001" (convert to uppercase)
 * - toyota-avanza-g-2021-PST-075 → displayId: "PST-075"
 * - 978e0b31-4d57-4bb9-92b3-219b12f3b32a (UUID) → isUuid: true
 *
 * Format: {make}-{model}-{year}-{displayId}
 * DisplayId may contain hyphens, so we need to find where year ends
 */
function parseVehicleSlug(slug: string[]): { displayId: string | null; isUuid: boolean } {
  if (!slug || slug.length === 0) {
    return { displayId: null, isUuid: false };
  }

  // Join all slug segments
  const fullSlug = slug.join('-');

  // Check if it's a UUID format (legacy URLs)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (slug.length === 1 && uuidRegex.test(slug[0])) {
    return { displayId: slug[0], isUuid: true };
  }

  // Find the year (4 digits) - everything after it is the displayId
  const yearMatch = fullSlug.match(/-(\d{4})-/);

  if (!yearMatch) {
    // If no year found, try to get the last segments (fallback)
    // Take at least the last 3 segments for displayId
    const minSegments = Math.max(3, slug.length - 4);
    const displayIdParts = slug.slice(-minSegments);
    const displayId = displayIdParts.join('-').replace(/\.(pdf|jpg|png|html?)$/i, '').toUpperCase();
    return { displayId, isUuid: false };
  }

  // Get everything after the year and convert to UPPERCASE (for database matching)
  const yearIndex = (yearMatch.index ?? 0) + yearMatch[0].length;
  const displayId = fullSlug.substring(yearIndex).replace(/\.(pdf|jpg|png|html?)$/i, '').toUpperCase();

  return { displayId, isUuid: false };
}

export default async function VehicleDetailPageSEO({ params }: PageProps) {
  const { slug } = params;
  const headersList = headers();
  const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';

  // Parse slug to get displayId or check if it's UUID
  const { displayId, isUuid } = parseVehicleSlug(slug);

  // DEBUG LOGGING
  console.log('[Vehicle Page] slug:', slug);
  console.log('[Vehicle Page] displayId:', displayId);
  console.log('[Vehicle Page] isUuid:', isUuid);

  if (!displayId) {
    console.log('[Vehicle Page] ❌ No displayId extracted');
    return notFound();
  }

  // Fetch vehicle by displayId or UUID (for legacy URLs)
  console.log('[Vehicle Page] Querying vehicle with:', isUuid ? { id: displayId } : { displayId });
  const vehicle = await prisma.vehicle.findUnique({
    where: isUuid ? { id: displayId } : { displayId },
    include: {
      tenant: true,
      photos: {
        orderBy: { displayOrder: 'asc' },
        take: 20,
      },
    },
  });

  console.log('[Vehicle Page] Vehicle found:', !!vehicle);

  if (!vehicle) {
    console.log('[Vehicle Page] ❌ Vehicle not found in database');
    return notFound();
  }

  const tenant = vehicle.tenant;

  // Get AI WhatsApp number
  const aimeowAccount = await prisma.aimeowAccount.findUnique({
    where: { tenantId: tenant.id },
    select: { phoneNumber: true, isActive: true },
  });
  const aiWhatsappNumber = aimeowAccount?.isActive && aimeowAccount?.phoneNumber
    ? aimeowAccount.phoneNumber
    : tenant.whatsappNumber;

  // Build vehicle data for catalog components
  const vehicleData = {
    id: vehicle.id,
    displayId: vehicle.displayId,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    price: vehicle.price ? Number(vehicle.price) : 0,
    color: vehicle.color || '-',
    odometer: vehicle.mileage || null,
    transmission: vehicle.transmissionType || '-',
    fuelType: vehicle.fuelType || '-',
    licensePlate: vehicle.licensePlate || null,
    description: vehicle.descriptionId || null,
    status: vehicle.status,
    photos: vehicle.photos.map(p => ({
      id: p.id,
      originalUrl: p.largeUrl || p.mediumUrl || p.originalUrl,
      thumbnailUrl: p.thumbnailUrl || p.largeUrl || p.mediumUrl || p.originalUrl,
      displayOrder: p.displayOrder,
    })),
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
    tenantId: tenant.id,
  };

  const formatPrice = (price: number) => {
    const inMillions = price / 1000000;
    if (inMillions >= 1) {
      return `Rp ${inMillions.toLocaleString('id-ID', { maximumFractionDigits: 2 })} Juta`;
    }
    return `Rp ${(price / 1000).toLocaleString('id-ID')} Ribu`;
  };

  const formatWhatsAppMessage = (v: typeof vehicleData) => {
    const price = formatPrice(v.price);
    return `Halo, saya tertarik dengan ${v.make} ${v.model} ${v.year} yang dijual Rp ${price}.\n\nLink: ${typeof window !== 'undefined' ? window.location.href : ''}\n\nApakah unit ini masih tersedia?`;
  };

  const specs = [
    { icon: Calendar, label: 'Tahun', value: vehicle.year.toString() },
    { icon: Droplets, label: 'Bahan Bakar', value: vehicle.fuelType || '-' },
    { icon: Zap, label: 'Transmisi', value: vehicle.transmissionType || '-' },
    { icon: Gauge, label: 'Odometer', value: vehicle.mileage ? `${vehicle.mileage.toLocaleString('id-ID')} km` : '-' },
    { icon: Palette, label: 'Warna', value: vehicle.color || '-' },
  ];

  const whatsappNumber = aiWhatsappNumber || '6281234567890';
  const message = formatWhatsAppMessage(vehicleData);
  const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/^0/, '62')}?text=${encodeURIComponent(message)}`;

  return (
    <ThemeProvider tenantId={tenant.id}>
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <CatalogHeader
          branding={{
            name: tenant.name,
            logoUrl: tenant.logoUrl,
            primaryColor: tenant.primaryColor,
            secondaryColor: tenant.secondaryColor,
            slug: tenant.slug,
          }}
          isCustomDomain={isCustomDomain}
        />

        {/* Back Button */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link
              href={isCustomDomain ? '/' : `/catalog/${tenant.slug}`}
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke Katalog
            </Link>
          </div>
        </div>

        {/* Vehicle Details */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Title & Price */}
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {vehicle.make} {vehicle.model} {vehicle.year}
              </h1>
              <p className="text-3xl sm:text-4xl font-bold text-blue-600">
                {formatPrice(vehicleData.price)}
              </p>
            </div>

            {/* Gallery */}
            <div className="mb-8">
              <VehicleGallery photos={vehicleData.photos} vehicleTitle={`${vehicle.make} ${vehicle.model} ${vehicle.year}`} displayId={vehicle.displayId} status={vehicle.status} />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 mb-8">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                <FaWhatsapp className="w-5 h-5 mr-2" />
                Hubungi via WhatsApp
              </a>
              <ShareButton
                title={`${vehicle.make} ${vehicle.model} ${vehicle.year}`}
                text={`${vehicle.make} ${vehicle.model} ${vehicle.year} - ${formatPrice(vehicleData.price)}`}
                url={typeof window !== 'undefined' ? window.location.href : ''}
              />
            </div>

            {/* Specifications */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Spesifikasi</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {specs.map((spec, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-lg border">
                    <spec.icon className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="text-xs text-gray-600 mb-1">{spec.label}</p>
                    <p className="font-semibold text-gray-900">{spec.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            {vehicleData.description && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Deskripsi</h2>
                <div className="bg-white p-6 rounded-lg border">
                  <p className="text-gray-700 whitespace-pre-wrap">{vehicleData.description}</p>
                </div>
              </div>
            )}

            {/* Status Badge */}
            <div className="mb-8">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                vehicle.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' :
                vehicle.status === 'SOLD' ? 'bg-red-100 text-red-800' :
                vehicle.status === 'BOOKED' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {vehicle.status === 'AVAILABLE' ? 'Tersedia' :
                 vehicle.status === 'SOLD' ? 'Terjual' :
                 vehicle.status === 'BOOKED' ? 'Booked' : vehicle.status}
              </span>
            </div>
          </div>
        </main>

        {/* Footer */}
        <GlobalFooter
          tenant={{
            name: tenant.name,
            phoneNumber: tenant.phoneNumber,
            phoneNumberSecondary: tenant.phoneNumberSecondary,
            whatsappNumber: tenant.whatsappNumber,
            email: tenant.email,
            address: tenant.address,
            city: tenant.city,
            province: tenant.province,
            primaryColor: tenant.primaryColor,
          }}
        />
      </div>
    </ThemeProvider>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = params;
  const { displayId, isUuid } = parseVehicleSlug(slug);

  if (!displayId) {
    return {
      title: 'Unit Tidak Ditemukan',
    };
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: isUuid ? { id: displayId } : { displayId },
    include: { tenant: true },
  });

  if (!vehicle) {
    return {
      title: 'Unit Tidak Ditemukan',
    };
  }

  const tenant = vehicle.tenant;
  const title = `${vehicle.make} ${vehicle.model} ${vehicle.year} - ${tenant.name}`;
  const description = vehicle.descriptionId
    ? vehicle.descriptionId.substring(0, 160)
    : `Lihat ${vehicle.make} ${vehicle.model} ${vehicle.year} di ${tenant.name}. ${vehicle.transmissionType || ''}, ${vehicle.fuelType || ''}, ${vehicle.color || ''}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'id_ID',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
