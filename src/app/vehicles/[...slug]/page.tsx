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
 * - honda-city-2006-pm-pst-001 → displayId: "pm-pst-001"
 * - toyota-avanza-g-2021-PST-075 → displayId: "PST-075"
 */
function parseVehicleSlug(slug: string[]): { displayId: string | null } {
  if (!slug || slug.length === 0) {
    return { displayId: null };
  }

  // The last segment should be the displayId
  const lastSegment = slug[slug.length - 1];

  // Remove any file extension if present
  const displayId = lastSegment.replace(/\.(pdf|jpg|png|html?)$/i, '').toLowerCase();

  return { displayId };
}

export default async function VehicleDetailPageSEO({ params }: PageProps) {
  const { slug } = params;
  const headersList = headers();
  const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';

  // Parse slug to get displayId
  const { displayId } = parseVehicleSlug(slug);

  if (!displayId) {
    return notFound();
  }

  // Fetch vehicle by displayId
  const vehicle = await prisma.vehicle.findUnique({
    where: { displayId },
    include: {
      tenant: true,
      photos: {
        orderBy: { position: 'asc' },
        take: 20,
      },
    },
  });

  if (!vehicle) {
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
    odometer: vehicle.odometer || null,
    transmission: vehicle.transmission || '-',
    fuelType: vehicle.fuelType || '-',
    licensePlate: vehicle.licensePlate || null,
    description: vehicle.description || null,
    status: vehicle.status,
    photos: vehicle.photos.map(p => ({
      id: p.id,
      url: p.url,
      caption: p.caption,
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
    { icon: Zap, label: 'Transmisi', value: vehicle.transmission || '-' },
    { icon: Gauge, label: 'Odometer', value: vehicle.odometer ? `${vehicle.odometer.toLocaleString('id-ID')} km` : '-' },
    { icon: Palette, label: 'Warna', value: vehicle.color || '-' },
  ];

  const whatsappNumber = aiWhatsappNumber || '6281234567890';
  const message = formatWhatsAppMessage(vehicleData);
  const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/^0/, '62')}?text=${encodeURIComponent(message)}`;

  return (
    <ThemeProvider theme={tenant.catalogTheme || null}>
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <CatalogHeader
          tenantName={tenant.name}
          tenantSlug={tenant.slug}
          logoUrl={tenant.logoUrl}
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
              <VehicleGallery photos={vehicleData.photos} vehicleName={`${vehicle.make} ${vehicle.model} ${vehicle.year}`} />
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
                url={typeof window !== 'undefined' ? window.location.href : ''}
                description={`${vehicle.make} ${vehicle.model} ${vehicle.year} - ${formatPrice(vehicleData.price)}`}
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
        <GlobalFooter />
      </div>
    </ThemeProvider>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = params;
  const { displayId } = parseVehicleSlug(slug);

  if (!displayId) {
    return {
      title: 'Unit Tidak Ditemukan',
    };
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { displayId },
    include: { tenant: true },
  });

  if (!vehicle) {
    return {
      title: 'Unit Tidak Ditemukan',
    };
  }

  const tenant = vehicle.tenant;
  const title = `${vehicle.make} ${vehicle.model} ${vehicle.year} - ${tenant.name}`;
  const description = vehicle.description
    ? vehicle.description.substring(0, 160)
    : `Lihat ${vehicle.make} ${vehicle.model} ${vehicle.year} di ${tenant.name}. ${vehicle.transmission || ''}, ${vehicle.fuelType || ''}, ${vehicle.color || ''}.`;

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
