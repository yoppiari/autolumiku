/**
 * Vehicles Listing Page
 * Route: /catalog/[slug]/vehicles
 * Server Component with URL-based filtering
 */

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import VehicleFilterWrapper from '@/components/catalog/VehicleFilterWrapper';
import Pagination from '@/components/catalog/Pagination';
import PublicVehicleCard from '@/components/catalog/PublicVehicleCard';
import { CatalogEngineService, CatalogFilters } from '@/lib/services/catalog/catalog-engine.service';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';


interface PageProps {
    params: {
        slug: string;
    };
    searchParams: { [key: string]: string | string[] | undefined };
}

export default async function VehiclesPage({ params, searchParams }: PageProps) {
    const { slug } = params;
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

    const tenantId = tenant.id;

    // 2. Parse Filters
    const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page) : 1;
    const limit = 12;

    const filters: CatalogFilters = {
        search: typeof searchParams.search === 'string' ? searchParams.search : undefined,
        make: typeof searchParams.make === 'string' ? searchParams.make : undefined,
        minPrice: typeof searchParams.minPrice === 'string' ? parseFloat(searchParams.minPrice) : undefined,
        maxPrice: typeof searchParams.maxPrice === 'string' ? parseFloat(searchParams.maxPrice) : undefined,
        minYear: typeof searchParams.minYear === 'string' ? parseInt(searchParams.minYear) : undefined,
        maxYear: typeof searchParams.maxYear === 'string' ? parseInt(searchParams.maxYear) : undefined,
        transmissionType: typeof searchParams.transmissionType === 'string' ? searchParams.transmissionType : undefined,
        fuelType: typeof searchParams.fuelType === 'string' ? searchParams.fuelType : undefined,
        sortBy: (typeof searchParams.sortBy === 'string' ? searchParams.sortBy : 'date-desc') as any,
        page,
        limit,
    };

    // 3. Fetch Vehicles
    const result = await CatalogEngineService.getVehicles(tenantId, filters);
    const { vehicles, totalPages, total, filters: filterOptions } = result;

    // 4. Get AI WhatsApp number (preferred) or fallback to tenant.whatsappNumber
    const aimeowAccount = await prisma.aimeowAccount.findUnique({
        where: { tenantId },
        select: { phoneNumber: true, isActive: true },
    });
    const aiWhatsappNumber = aimeowAccount?.isActive && aimeowAccount?.phoneNumber
        ? aimeowAccount.phoneNumber
        : tenant.whatsappNumber;

    // Generate URLs based on domain context
    const getUrl = (path: string) => {
        if (isCustomDomain) {
            return path; // Clean URL for custom domain
        }
        return `/catalog/${tenant.slug}${path}`; // Platform domain with catalog prefix
    };

    return (
        <ThemeProvider tenantId={tenantId}>
            <div className="min-h-screen bg-background flex flex-col">
                <CatalogHeader
                    branding={{
                        name: tenant.name,
                        logoUrl: tenant.logoUrl,
                        primaryColor: tenant.primaryColor,
                        secondaryColor: tenant.secondaryColor,
                        slug: tenant.slug,
                    }}
                    vehicleCount={total}
                    phoneNumber={tenant.phoneNumber || undefined}
                    whatsappNumber={tenant.whatsappNumber || undefined}
                    slug={tenant.slug}
                    isCustomDomain={isCustomDomain}
                />

                <main className="flex-1 container mx-auto px-4 py-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-foreground mb-2">
                            Koleksi Mobil
                        </h1>
                        <p className="text-muted-foreground">
                            Temukan berbagai pilihan mobil berkualitas dengan harga terbaik
                        </p>
                    </div>

                    {/* Filters */}
                    <VehicleFilterWrapper filterOptions={filterOptions} />

                    {/* Vehicle Grid */}
                    {vehicles.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                                {vehicles.map((vehicle) => {
                                    const waNumber = aiWhatsappNumber?.replace(/[^0-9]/g, '') || '';

                                    return (
                                        <PublicVehicleCard
                                            key={vehicle.id}
                                            vehicle={{
                                                id: vehicle.id,
                                                displayId: vehicle.displayId,
                                                make: vehicle.make,
                                                model: vehicle.model,
                                                year: vehicle.year,
                                                price: Number(vehicle.price), // Convert bigint to number
                                                transmissionType: vehicle.transmissionType,
                                                status: vehicle.status,
                                                photos: vehicle.photos,
                                            }}
                                            slug={tenant.slug}
                                            isCustomDomain={isCustomDomain}
                                            waNumber={waNumber}
                                        />
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            <Pagination
                                currentPage={page}
                                totalPages={totalPages}
                                baseUrl={getUrl('/vehicles')}
                                searchParams={searchParams}
                            />
                        </>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground text-lg">Tidak ada kendaraan yang ditemukan.</p>
                            <Button asChild variant="outline" className="mt-4">
                                <Link href={getUrl('/vehicles')}>Reset Filter</Link>
                            </Button>
                        </div>
                    )}
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
