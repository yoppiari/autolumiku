/**
 * Vehicles Listing Page
 * Route: /vehicles
 * Shows all vehicles for the tenant (SEO-friendly, no /catalog prefix needed)
 */

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

export default async function VehiclesPage() {
  const headersList = headers();
  const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';
  const tenantSlug = headersList.get('x-tenant-slug');

  if (!tenantSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Tenant Not Found</h1>
          <p className="text-gray-600">Unable to determine tenant for this request.</p>
        </div>
      </div>
    );
  }

  // Fetch tenant
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Showroom Not Found</h1>
          <p className="text-gray-600">The requested showroom could not be found.</p>
        </div>
      </div>
    );
  }

  // Fetch available vehicles
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
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Transform for component
  const transformedVehicles = vehicles.map((v) => ({
    id: v.id,
    displayId: v.displayId,
    make: v.make,
    model: v.model,
    year: v.year,
    price: v.price ? Number(v.price) : 0,
    mileage: v.mileage,
    transmissionType: v.transmissionType,
    fuelType: v.fuelType,
    color: v.color,
    status: v.status,
    photos: v.photos,
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
                  tenantSlug={tenant.slug}
                  isCustomDomain={isCustomDomain}
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
}

export async function generateMetadata(): Promise<{
  title: string;
  description: string;
}> {
  return {
    title: 'Koleksi Kendaraan Tersedia',
    description: 'Lihat semua kendaraan tersedia di showroom kami',
  };
}
