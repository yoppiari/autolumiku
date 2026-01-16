/**
 * Vehicle Detail Page
 * Route: /catalog/[slug]/vehicles/[id]
 * Handles both UUIDs and SEO-friendly slugs
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import VehicleGallery from '@/components/catalog/VehicleGallery';
import { Button } from '@/components/ui/button';
import {
    Calendar,
    Gauge,
    Zap,
    Fuel,
    Palette,
    ArrowLeft,
    Share2
} from 'lucide-react';
import { parseVehicleSlug, createVehicleSlug } from '@/lib/utils';
import { FaWhatsapp } from 'react-icons/fa';

interface PageProps {
    params: {
        slug: string;
        id: string;
    };
}

export default async function VehicleDetailPage({ params }: PageProps) {
    const { slug, id } = await params;
    const headersList = headers();
    const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';
    const tenantDomain = headersList.get('x-tenant-domain');

    // 1. Fetch Tenant
    let tenant = await prisma.tenant.findUnique({
        where: { slug },
    });

    if (!tenant && slug.endsWith('-id')) {
        const slugWithoutId = slug.replace(/-id$/, '');
        tenant = await prisma.tenant.findUnique({
            where: { slug: slugWithoutId },
        });
    }

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

    // 2. Parse Vehicle ID/Slug
    const parsed = parseVehicleSlug(id);
    const idCandidate = parsed.id;
    const isUuid = parsed.isUuid;

    // 3. Fetch Vehicle
    let vehicle = null;

    // A. Try as UUID (Original ID)
    if (isUuid) {
        vehicle = await prisma.vehicle.findUnique({
            where: { id: idCandidate },
            include: {
                photos: {
                    orderBy: { displayOrder: 'asc' },
                },
            },
        });
    }

    // B. Try as Display ID (from Slug)
    if (!vehicle) {
        vehicle = await prisma.vehicle.findUnique({
            where: { displayId: idCandidate },
            include: {
                photos: {
                    orderBy: { displayOrder: 'asc' },
                },
            },
        });
    }

    // C. Fallback: Search in Tenant Context (if simple ID or mismatch)
    if (!vehicle) {
        vehicle = await prisma.vehicle.findFirst({
            where: {
                tenantId: tenant.id,
                OR: [
                    { displayId: idCandidate },
                    { displayId: id }, // Try raw param
                ]
            },
            include: {
                photos: {
                    orderBy: { displayOrder: 'asc' },
                },
            },
        });
    }

    if (!vehicle) {
        return notFound();
    }

    // Redirect to canonical slug URL if accessed via raw UUID (SEO Best Practice)
    const canonicalSlug = createVehicleSlug({
        id: vehicle.id,
        displayId: vehicle.displayId,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year
    });

    // Validasi tenant ownership
    if (vehicle.tenantId !== tenant.id) {
        return notFound();
    }

    const formatPrice = (price: bigint | number) => {
        const p = Number(price);
        return `Rp ${p.toLocaleString('id-ID')}`;
    };

    const waNumber = tenant.whatsappNumber?.replace(/[^0-9]/g, '') || '';
    const waMessage = encodeURIComponent(
        `Halo, saya tertarik dengan ${vehicle.make} ${vehicle.model} ${vehicle.year} (${formatPrice(vehicle.price)}). Apakah unit masih tersedia?`
    );
    const waLink = `https://wa.me/${waNumber}?text=${waMessage}`;

    const getBackUrl = () => {
        return isCustomDomain ? '/vehicles' : `/catalog/${tenant?.slug}/vehicles`;
    };

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
                    phoneNumber={tenant.phoneNumber || undefined}
                    whatsappNumber={tenant.whatsappNumber || undefined}
                    slug={tenant.slug}
                    isCustomDomain={isCustomDomain}
                />

                <main className="flex-1 container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        {/* Breadcrumb / Back */}
                        <div className="mb-6">
                            <Link
                                href={getBackUrl()}
                                className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Kembali ke Katalog
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                            {/* Left Column: Gallery */}
                            <div>
                                <VehicleGallery
                                    photos={vehicle.photos}
                                    alt={`${vehicle.make} ${vehicle.model}`}
                                />
                            </div>

                            {/* Right Column: Details */}
                            <div>
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                                            {vehicle.year}
                                        </span>
                                        {vehicle.status === 'SOLD' && (
                                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                                TERJUAL
                                            </span>
                                        )}
                                        {vehicle.status === 'BOOKED' && (
                                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                                BOOKED
                                            </span>
                                        )}
                                        {vehicle.condition && (
                                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                                {vehicle.condition}
                                            </span>
                                        )}
                                    </div>

                                    <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                                        {vehicle.make} {vehicle.model}
                                    </h1>
                                    {vehicle.variant && (
                                        <p className="text-xl text-muted-foreground mb-4">
                                            {vehicle.variant}
                                        </p>
                                    )}

                                    <div className="text-3xl font-bold text-primary mb-6">
                                        {formatPrice(vehicle.price)}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                                <Gauge className="w-4 h-4" />
                                                <span className="text-sm">Kilometer</span>
                                            </div>
                                            <p className="font-semibold">{vehicle.mileage?.toLocaleString() || '-'} km</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                                <Zap className="w-4 h-4" />
                                                <span className="text-sm">Transmisi</span>
                                            </div>
                                            <p className="font-semibold">{vehicle.transmissionType || '-'}</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                                <Fuel className="w-4 h-4" />
                                                <span className="text-sm">Bahan Bakar</span>
                                            </div>
                                            <p className="font-semibold">{vehicle.fuelType || '-'}</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                                <Palette className="w-4 h-4" />
                                                <span className="text-sm">Warna</span>
                                            </div>
                                            <p className="font-semibold">{vehicle.color || '-'}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        {vehicle.status === 'AVAILABLE' && waNumber && (
                                            <Button asChild size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white border-none">
                                                <a href={waLink} target="_blank" rel="noopener noreferrer">
                                                    <FaWhatsapp className="w-5 h-5 mr-2" />
                                                    Hubungi Penjual via WhatsApp
                                                </a>
                                            </Button>
                                        )}

                                        <Button variant="outline" size="lg" className="w-full">
                                            <Share2 className="w-4 h-4 mr-2" />
                                            Bagikan Penawaran
                                        </Button>
                                    </div>
                                </div>

                                {/* Description */}
                                {vehicle.description && (
                                    <div className="border-t pt-8">
                                        <h3 className="text-lg font-semibold mb-4">Deskripsi</h3>
                                        <div className="prose dark:prose-invert max-w-none text-muted-foreground whitespace-pre-line">
                                            {vehicle.description}
                                        </div>
                                    </div>
                                )}
                            </div>
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
