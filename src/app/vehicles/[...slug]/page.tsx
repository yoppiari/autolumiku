/**
 * Vehicle Detail Page - SEO Friendly URL
 * Route: /vehicles/[make]-[model]-[year]-[displayId]
 * Example: /vehicles/honda-city-2006-pm-pst-001
 *
 * Professional layout with gallery on left, sticky details on right
 */

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
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

  if (!displayId) {
    return notFound();
  }

  // Fetch vehicle by displayId or UUID (for legacy URLs)
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
    odometer: vehicle.mileage || null,
    transmission: vehicle.transmissionType || '-',
    fuelType: vehicle.fuelType || '-',
    licensePlate: vehicle.licensePlate || null,
    description: vehicle.descriptionId || null,
    status: vehicle.status,
    variant: vehicle.variant || null,
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
    // Format as full IDR number (e.g., 79.000.000)
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const whatsappNumber = aiWhatsappNumber || '6281234567890';
  const message = `Halo, saya tertarik dengan ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}${vehicleData.variant ? ` ${vehicleData.variant}` : ''} (ID: ${vehicleData.displayId || vehicleData.id.substring(0, 8)}). Bisa info lebih lanjut?`;
  const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/^0/, '62')}?text=${encodeURIComponent(message)}`;

  return (
    <ThemeProvider tenantId={tenant.id}>
      <div className="min-h-screen bg-background flex flex-col">
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

        <main className="flex-1 container mx-auto px-4 py-8">
          {/* Breadcrumb / Back Button */}
          <div className="mb-6">
            <Button asChild variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary">
              <Link href={isCustomDomain ? '/' : `/catalog/${tenant.slug}`} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Koleksi
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Gallery */}
            <div className="lg:col-span-2">
              <VehicleGallery
                photos={vehicleData.photos}
                vehicleTitle={`${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`}
                displayId={vehicleData.displayId}
                status={vehicleData.status}
              />

              {/* Description - Desktop */}
              {vehicleData.description && (
                <div className="hidden lg:block mt-8 bg-card rounded-lg border p-6">
                  <h3 className="text-lg font-semibold mb-4">Deskripsi</h3>
                  <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                    {vehicleData.description}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Details */}
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 shadow-xl lg:sticky lg:top-24 text-white">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-white mb-2">
                    {vehicleData.year} {vehicleData.make} {vehicleData.model}
                  </h1>
                  {vehicleData.variant && (
                    <p className="text-lg text-gray-300">{vehicleData.variant}</p>
                  )}
                </div>

                <div className="mb-8">
                  <p className="text-4xl font-bold text-green-400">
                    {formatPrice(vehicleData.price)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Tahun</p>
                      <p className="font-medium text-white">{vehicleData.year}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <Gauge className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Kilometer</p>
                      <p className="font-medium text-white">{vehicleData.odometer ? `${vehicleData.odometer.toLocaleString('id-ID')} km` : '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <Zap className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Transmisi</p>
                      <p className="font-medium text-white">{vehicleData.transmission}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <Droplets className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Bahan Bakar</p>
                      <p className="font-medium text-white">{vehicleData.fuelType}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700 col-span-2">
                    <Palette className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Warna</p>
                      <p className="font-medium text-white">{vehicleData.color}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    asChild
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                      <FaWhatsapp className="w-5 h-5 mr-2" />
                      Hubungi via WhatsApp
                    </a>
                  </Button>

                  <ShareButton
                    title={`${vehicleData.year} ${vehicleData.make} ${vehicleData.model}${vehicleData.variant ? ` ${vehicleData.variant}` : ''}`}
                    text={`Lihat ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} di ${tenant.name}`}
                  />
                </div>
              </div>

              {/* Description - Mobile */}
              {vehicleData.description && (
                <div className="lg:hidden bg-card rounded-lg border p-6">
                  <h3 className="text-lg font-semibold mb-4">Deskripsi</h3>
                  <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                    {vehicleData.description}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

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
