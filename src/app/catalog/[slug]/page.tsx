/**
 * Showroom Homepage
 * Featured vehicles, stats, and blog preview
 */

// Disable caching to always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { FaWhatsapp } from 'react-icons/fa';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import HeroSection from '@/components/catalog/HeroSection';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import HomepageVehicleCard from '@/components/catalog/HomepageVehicleCard';
import { Button } from '@/components/ui/button';
import BlogCard from '@/components/catalog/BlogCard';
import {
  getCatalogUrl,
  getVehiclesUrl,
  getVehicleUrl,
  getBlogsUrl,
  getBlogUrl,
  getContactUrl,
} from '@/lib/utils/url-helper';
import { prisma } from '@/lib/prisma';

export default async function ShowroomHomePage({ params }: { params: { slug: string } }) {
  try {
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
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Showroom Not Found</h1>
            <p className="text-gray-600">This showroom is not configured properly.</p>
          </div>
        </div>
      );
    }

    const tenantId = tenant.id;

    // Fetch featured vehicles (6 latest) - include AVAILABLE and SOLD
    const featuredVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: { in: ['AVAILABLE', 'SOLD'] },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 6,
      select: {
        id: true,
        displayId: true,
        make: true,
        model: true,
        variant: true,
        year: true,
        price: true,
        mileage: true,
        transmissionType: true,
        fuelType: true,
        status: true,
        photos: {
          orderBy: { displayOrder: 'asc' },
          select: { thumbnailUrl: true, originalUrl: true },
        },
      },
    });

    // Fetch blog preview (3 latest published posts)
    const blogPosts = await prisma.blogPost.findMany({
      where: {
        tenantId,
        status: 'PUBLISHED',
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: 3,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        featuredImage: true,
        publishedAt: true,
        views: true,
      },
    });

    // Get stats
    const [totalVehicles, totalMakes] = await Promise.all([
      prisma.vehicle.count({
        where: { tenantId, status: 'AVAILABLE' },
      }),
      prisma.vehicle.findMany({
        where: { tenantId, status: 'AVAILABLE' },
        select: { make: true },
        distinct: ['make'],
      }),
    ]);

    // Get AI WhatsApp number (preferred) or fallback to tenant.whatsappNumber
    const aimeowAccount = await prisma.aimeowAccount.findUnique({
      where: { tenantId },
      select: { phoneNumber: true, isActive: true },
    });
    const aiWhatsappNumber = aimeowAccount?.isActive && aimeowAccount?.phoneNumber
      ? aimeowAccount.phoneNumber
      : tenant.whatsappNumber;

    const formatPrice = (price: bigint | number) => {
      const priceNumber = typeof price === 'bigint' ? Number(price) : price;
      return `Rp ${priceNumber.toLocaleString('id-ID')}`;
    };

    const getExcerpt = (content: string | null, maxLength: number = 150): string => {
      if (!content) return '';
      // Remove HTML tags and get first paragraph
      const text = content.replace(/<[^>]*>/g, '');
      const firstPara = text.split('\n\n')[0] || text.split('\n')[0] || text;
      if (firstPara.length > maxLength) {
        return firstPara.substring(0, maxLength) + '...';
      }
      return firstPara;
    };

    // Determine forced theme based on tenant configuration
    const forcedTheme = tenant.selectedTheme === 'automotive-dark' || tenant.theme === 'dark' ? 'dark' : null;

    return (
      <ThemeProvider tenantId={tenantId} forcedTheme={forcedTheme}>
        <div className="min-h-screen bg-background flex flex-col">
          <CatalogHeader
            branding={{
              name: tenant.name,
              logoUrl: tenant.logoUrl,
              primaryColor: tenant.primaryColor,
              secondaryColor: tenant.secondaryColor,
              slug: tenant.slug,
            }}
            vehicleCount={totalVehicles}
            phoneNumber={tenant.phoneNumber || undefined}
            whatsappNumber={aiWhatsappNumber || undefined}
            slug={tenant.slug}
            isCustomDomain={isCustomDomain}
          />

          <main className="flex-1">
            {/* Hero Section */}
            <div className="container mx-auto px-4 pt-8">
              <HeroSection
                title={`Selamat Datang di ${tenant.name}`}
                subtitle="Temukan kendaraan impian Anda dengan harga terbaik"
                primaryColor={tenant.primaryColor}
                slug={slug}
                isCustomDomain={isCustomDomain}
              />
            </div>

            {/* Stats Section */}
            <section className="py-8 bg-card border-y">
              <div className="container mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                  <div>
                    <div className="text-3xl font-bold text-primary">
                      {totalVehicles}+
                    </div>
                    <div className="text-muted-foreground">Mobil Tersedia</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-primary">
                      {totalMakes.length}+
                    </div>
                    <div className="text-muted-foreground">Merk</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-primary">
                      100%
                    </div>
                    <div className="text-muted-foreground">Terpercaya</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-primary">
                      24/7
                    </div>
                    <div className="text-muted-foreground">Layanan</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Featured Vehicles */}
            <section className="py-12" id="vehicles">
              <div className="container mx-auto px-4">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-4xl font-bold text-foreground tracking-tight">Koleksi Pilihan</h2>
                  <Button asChild variant="ghost" className="text-primary hover:text-primary/80">
                    <Link href={getVehiclesUrl()}>Lihat Semua →</Link>
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredVehicles.map((vehicle) => {
                    const waNumber = aiWhatsappNumber?.replace(/[^0-9]/g, '') || '';
                    const waMessage = encodeURIComponent(`Halo, saya tertarik dengan ${vehicle.make} ${vehicle.model} ${vehicle.year} (${formatPrice(vehicle.price)}). Apakah unit masih tersedia?`);
                    const waLink = `https://wa.me/${waNumber}?text=${waMessage}`;

                    return (
                      <HomepageVehicleCard
                        key={vehicle.id}
                        vehicle={{
                          id: vehicle.id,
                          displayId: vehicle.displayId,
                          make: vehicle.make,
                          model: vehicle.model,
                          year: vehicle.year,
                          price: Number(vehicle.price),
                          transmissionType: vehicle.transmissionType,
                          status: vehicle.status,
                          photos: vehicle.photos,
                        }}
                        vehicleUrl={getVehicleUrl(vehicle.id)}
                        waLink={waLink}
                        waNumber={waNumber}
                      />
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Blog Preview */}
            {blogPosts.length > 0 && (
              <section className="py-12 bg-muted/30">
                <div className="container mx-auto px-4">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold text-foreground">Artikel Terbaru</h2>
                    <Button asChild variant="outline">
                      <Link href={getBlogsUrl()}>Lihat Semua →</Link>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {blogPosts.map((post) => (
                      <BlogCard
                        key={post.id}
                        post={post}
                        blogUrl={getBlogUrl(post.slug)}
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* CTA Section */}
            <section
              className="py-16 text-primary-foreground"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              <div className="container mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold mb-4">Siap Menemukan Mobil Impian Anda?</h2>
                <p className="text-xl mb-8 opacity-90">
                  Hubungi kami sekarang untuk konsultasi dan penawaran terbaik
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  {aiWhatsappNumber && (
                    <Button
                      asChild
                      size="lg"
                      className="bg-black hover:bg-black/80 text-white border-none transition-colors duration-300"
                    >
                      <a
                        href={`https://wa.me/${aiWhatsappNumber.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaWhatsapp className="mr-2 h-5 w-5" />
                        Chat via WhatsApp
                      </a>
                    </Button>
                  )}
                  <Button asChild size="lg" className="bg-black hover:bg-black/80 text-white border-none transition-colors duration-300">
                    <Link href={getContactUrl()}>Lihat Lokasi Kami</Link>
                  </Button>
                </div>
              </div>
            </section>
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
  } catch (error: any) {
    console.error('ShowroomHomePage Error:', error);
    return (
      <div className="min-h-screen bg-black text-white p-10 font-mono">
        <h1 className="text-3xl text-red-500 mb-4">Critical Error</h1>
        <div className="bg-gray-900 p-4 rounded overflow-auto">
          <h2 className="text-xl font-bold mb-2">{error.name}: {error.message}</h2>
          <pre className="text-sm text-gray-400 whitespace-pre-wrap">
            {error.stack}
          </pre>
        </div>
      </div>
    );
  }
}
