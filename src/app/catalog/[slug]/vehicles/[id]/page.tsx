/**
 * Vehicle Detail Page
 * Route: /catalog/[slug]/vehicles/[id]
 * Server Component
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
    slug: string;
    id: string;
  };
}

export default async function VehicleDetailPage({ params }: PageProps) {
  const { slug, id } = params;
  const headersList = headers();
  const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';
  const tenantDomain = headersList.get('x-tenant-domain');

  // 1. Fetch Tenant - try multiple lookup strategies
  let tenant = await prisma.tenant.findUnique({
    where: { slug },
  });

  // Fallback 1: Try without -id suffix (e.g., primamobil-id -> primamobil)
  if (!tenant && slug.endsWith('-id')) {
    const slugWithoutId = slug.replace(/-id$/, '');
    tenant = await prisma.tenant.findUnique({
      where: { slug: slugWithoutId },
    });
  }

  // Fallback 2: Try by domain for custom domains
  if (!tenant && isCustomDomain && tenantDomain) {
    tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { domain: tenantDomain },
          { domain: `www.${tenantDomain}` },
          { domain: tenantDomain.replace('www.', '') },
        ],
      },
    });
  }

  if (!tenant) {
    return notFound();
  }

  // Generate URLs based on domain context
  const getUrl = (path: string) => {
    if (isCustomDomain) {
      return path; // Clean URL for custom domain
    }
    return `/catalog/${tenant.slug}${path}`; // Platform domain with catalog prefix
  };

  // 2. Fetch Vehicle
  const vehicle = await CatalogEngineService.getVehicleById(id, tenant.id);

  if (!vehicle) {
    return notFound();
  }

  // 3. Get AI WhatsApp number (preferred) or fallback to tenant.whatsappNumber
  const aimeowAccount = await prisma.aimeowAccount.findUnique({
    where: { tenantId: tenant.id },
    select: { phoneNumber: true, isActive: true },
  });
  const aiWhatsappNumber = aimeowAccount?.isActive && aimeowAccount?.phoneNumber
    ? aimeowAccount.phoneNumber
    : tenant.whatsappNumber;

  const formatPrice = (price: number) => {
    const rupiah = price / 100;
    return `Rp ${rupiah.toLocaleString('id-ID')}`;
  };

  // WhatsApp Message Construction
  const whatsappNumber = aiWhatsappNumber?.replace(/[^0-9]/g, '') || '';
  const message = `Halo, saya tertarik dengan ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ''
    } (ID: ${vehicle.displayId || vehicle.id.slice(0, 8)}). Bisa info lebih lanjut?`;
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : '#';

  return (
    <ThemeProvider tenantId={tenant.id}>
      <div className="min-h-screen bg-background flex flex-col">
        <CatalogHeader
          branding={{
            name: tenant.name,
            logoUrl: tenant.logoUrl,
            primaryColor: tenant.primaryColor,
            secondaryColor: tenant.secondaryColor,
            slug: tenant.slug,
          }}
          vehicleCount={0} // We don't need total count here, or we could fetch it if needed
          phoneNumber={tenant.phoneNumber || undefined}
          whatsappNumber={tenant.whatsappNumber || undefined}
          slug={tenant.slug}
          isCustomDomain={isCustomDomain}
        />

        <main className="flex-1 container mx-auto px-4 py-8">
          {/* Breadcrumb / Back Button */}
          <div className="mb-6">
            <Button asChild variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary">
              <Link href={getUrl('/vehicles')} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Koleksi
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Gallery */}
            <div className="lg:col-span-2">
              <VehicleGallery
                photos={vehicle.photos}
                vehicleTitle={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                displayId={vehicle.displayId}
                status={vehicle.status}
              />

              {/* Description - Desktop */}
              {vehicle.descriptionId && (
                <div className="hidden lg:block mt-8 bg-card rounded-lg border p-6">
                  <h3 className="text-lg font-semibold mb-4">Deskripsi</h3>
                  <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                    {vehicle.descriptionId}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Details */}
            <div className="space-y-6">
              <div className="bg-card rounded-lg border p-6 shadow-sm lg:sticky lg:top-24">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-foreground mb-2">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h1>
                  {vehicle.variant && (
                    <p className="text-lg text-muted-foreground">{vehicle.variant}</p>
                  )}
                </div>

                <div className="mb-8">
                  <p className="text-3xl font-bold text-primary">
                    {formatPrice(vehicle.price)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Tahun</p>
                      <p className="font-medium">{vehicle.year}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Gauge className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Kilometer</p>
                      <p className="font-medium">{vehicle.mileage?.toLocaleString() || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Zap className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Transmisi</p>
                      <p className="font-medium">{vehicle.transmissionType || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Droplets className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Bahan Bakar</p>
                      <p className="font-medium">{vehicle.fuelType || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg col-span-2">
                    <Palette className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Warna</p>
                      <p className="font-medium">{vehicle.color || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {whatsappNumber ? (
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
                  ) : (
                    <Button disabled className="w-full" size="lg">
                      WhatsApp Tidak Tersedia
                    </Button>
                  )}

                  <ShareButton
                    title={`${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ''}`}
                    text={`Lihat ${vehicle.year} ${vehicle.make} ${vehicle.model} di ${tenant.name}`}
                  />
                </div>
              </div>

              {/* Description - Mobile */}
              {vehicle.descriptionId && (
                <div className="lg:hidden bg-card rounded-lg border p-6">
                  <h3 className="text-lg font-semibold mb-4">Deskripsi</h3>
                  <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                    {vehicle.descriptionId}
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
