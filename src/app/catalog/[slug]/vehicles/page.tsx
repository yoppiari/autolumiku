/**
 * Vehicles Listing Page (Catalog Route)
 * Route: /catalog/[slug]/vehicles or custom domain /vehicles
 * Shows all vehicles for the tenant
 */

// Disable caching to always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import PublicVehicleCard from '@/components/catalog/PublicVehicleCard';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Filter,
} from 'lucide-react';

interface PageProps {
  params: {
    slug: string;
  };
}

export default async function CatalogVehiclesPage({ params }: PageProps) {
  const headersList = headers();
  const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';
  const tenantSlug = params.slug;
  const tenantDomain = headersList.get('x-tenant-domain');

  try {
    console.log(`[VehiclesPage] Loading vehicles for tenant: ${tenantSlug}`);

    // Fetch tenant - try multiple lookup strategies (like home page)
    let tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    // Fallback 1: Try without -id suffix (e.g., primamobil-id -> primamobil)
    if (!tenant && tenantSlug.endsWith('-id')) {
      const slugWithoutId = tenantSlug.replace(/-id$/, '');
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
      console.log(`[VehiclesPage] Tenant not found: ${tenantSlug}`);
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Showroom Not Found</h1>
            <p className="text-gray-600">The requested showroom could not be found.</p>
          </div>
        </div>
      );
    }

    console.log(`[VehiclesPage] Tenant found: ${tenant.name} (ID: ${tenant.id})`);

    // Fetch available vehicles with main photo (displayOrder: 0 or first photo)
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        status: 'AVAILABLE',
      },
      include: {
        photos: {
          where: { displayOrder: 0 },
          select: {
            thumbnailUrl: true,
            mediumUrl: true,
            largeUrl: true,
            originalUrl: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

  // Get WhatsApp number
  const aimeowAccount = await prisma.aimeowAccount.findUnique({
    where: { tenantId: tenant.id },
    select: { phoneNumber: true, isActive: true },
  });
  const waNumber = aimeowAccount?.isActive && aimeowAccount?.phoneNumber
    ? aimeowAccount.phoneNumber
    : tenant.whatsappNumber;

  // Transform for component - ensure photos array is never undefined
  const transformedVehicles = vehicles.map((v) => ({
    id: v.id,
    displayId: v.displayId,
    make: v.make,
    model: v.model,
    year: v.year,
    variant: v.variant,
    price: v.price ? Number(v.price) : 0,
    mileage: v.mileage,
    transmissionType: v.transmissionType,
    fuelType: v.fuelType,
    color: v.color,
    status: v.status,
    photos: v.photos && v.photos.length > 0 ? v.photos : [{
      originalUrl: '',
      thumbnailUrl: '',
      mediumUrl: '',
      largeUrl: '',
    }],
    createdAt: v.createdAt,
  }));

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

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Koleksi Kendaraan
                </h1>
                <p className="text-muted-foreground">
                  Menampilkan {transformedVehicles.length} unit tersedia
                </p>
              </div>

              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </Button>
            </div>
          </div>

          {/* Vehicles Grid */}
          {transformedVehicles.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <p className="text-2xl">🚗</p>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Belum Ada Kendaraan
              </h3>
              <p className="text-muted-foreground">
                Saat ini belum ada kendaraan yang tersedia.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {transformedVehicles.map((vehicle) => (
                <PublicVehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  slug={tenant.slug}
                  isCustomDomain={isCustomDomain}
                  waNumber={waNumber || tenant.whatsappNumber || ''}
                />
              ))}
            </div>
          )}
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
  } catch (error: any) {
    console.error('[VehiclesPage] Error:', error);
    console.error('[VehiclesPage] Error details:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      tenantSlug,
    });

    // Return user-friendly error page
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <p className="text-2xl">⚠️</p>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Error Loading Vehicles
          </h2>
          <p className="text-gray-600 mb-6">
            {error?.message || 'An unexpected error occurred. Please try again.'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Reload Page
          </Button>
          <div className="mt-4 p-4 bg-red-50 text-red-800 rounded-md text-left text-xs">
            <p className="font-bold">{error.name}: {error.message}</p>
            <pre className="mt-2 break-all">{error.stack}</pre>
            <p className="mt-2 text-blue-800">Tenant Slug: {tenantSlug}</p>
          </div>
        </div>
      </div>
    );
  }
}

export async function generateMetadata({ params }: PageProps): Promise<{
  title: string;
  description: string;
}> {
  return {
    title: 'Koleksi Kendaraan Tersedia',
    description: 'Lihat semua kendaraan tersedia di showroom kami',
  };
}
