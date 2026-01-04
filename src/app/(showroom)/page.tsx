/**
 * Showroom Homepage
 * Featured vehicles, stats, and blog preview
 */

import React from 'react';
import Link from 'next/link';
import GlobalHeader from '@/components/showroom/GlobalHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import { getTenantFromHeaders, getFullTenant, getTenantBranding } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { prisma } from '@/lib/prisma';


export default async function ShowroomHomePage() {
  // Get tenant from headers
  const { id: tenantId } = await getTenantFromHeaders();

  if (!tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Showroom Not Found</h1>
          <p className="text-gray-600">This showroom is not configured properly.</p>
        </div>
      </div>
    );
  }

  // Get full tenant data and branding
  const [tenant, branding] = await Promise.all([
    getFullTenant(),
    getTenantBranding(),
  ]);

  if (!tenant || !branding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Showroom Not Found</h1>
        </div>
      </div>
    );
  }

  // Get AI WhatsApp number (preferred) or fallback to tenant.whatsappNumber
  const aimeowAccount = await prisma.aimeowAccount.findUnique({
    where: { tenantId },
    select: { phoneNumber: true, isActive: true },
  });
  const aiWhatsappNumber = aimeowAccount?.isActive && aimeowAccount?.phoneNumber
    ? aimeowAccount.phoneNumber
    : tenant.whatsappNumber;

  // Fetch featured vehicles (6 latest)
  const featuredVehicles = await prisma.vehicle.findMany({
    where: {
      tenantId,
      status: { in: ['AVAILABLE', 'BOOKED'] },
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
      photos: {
        take: 1,
        orderBy: { createdAt: 'asc' },
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
      where: { tenantId, status: { in: ['AVAILABLE', 'BOOKED'] } },
    }),
    prisma.vehicle.findMany({
      where: { tenantId, status: { in: ['AVAILABLE', 'BOOKED'] } },
      select: { make: true },
      distinct: ['make'],
    }),
  ]);

  const formatPrice = (price: bigint | number) => {
    const rupiah = Number(price) / 100;
    return `Rp ${rupiah.toLocaleString('id-ID')}`;
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <GlobalHeader
        branding={{
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          slug: tenant.slug,
        }}
      />

      <main className="flex-1">
        {/* Hero Section */}
        <section
          className="py-20 text-white"
          style={{
            background: `linear-gradient(135deg, ${tenant.primaryColor} 0%, ${tenant.secondaryColor} 100%)`,
          }}
        >
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Selamat Datang di {tenant.name}
            </h1>
            <p className="text-xl mb-8 text-white/90">
              Temukan kendaraan impian Anda dengan harga terbaik
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" variant="secondary">
                <Link href="/vehicles">Lihat Semua Mobil</Link>
              </Button>
              <Button
                asChild
                size="lg"
                style={{
                  backgroundColor: 'white',
                  color: tenant.primaryColor,
                }}
              >
                <Link href="/contact">Hubungi Kami</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-8 bg-white border-b">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold" style={{ color: tenant.primaryColor }}>
                  {totalVehicles}+
                </div>
                <div className="text-gray-600">Mobil Tersedia</div>
              </div>
              <div>
                <div className="text-3xl font-bold" style={{ color: tenant.primaryColor }}>
                  {totalMakes.length}+
                </div>
                <div className="text-gray-600">Merk</div>
              </div>
              <div>
                <div className="text-3xl font-bold" style={{ color: tenant.primaryColor }}>
                  100%
                </div>
                <div className="text-gray-600">Terpercaya</div>
              </div>
              <div>
                <div className="text-3xl font-bold" style={{ color: tenant.primaryColor }}>
                  24/7
                </div>
                <div className="text-gray-600">Layanan</div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Vehicles */}
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Kendaraan Terbaru</h2>
              <Button asChild variant="outline">
                <Link href="/vehicles">Lihat Semua →</Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredVehicles.map((vehicle) => {
                const mainPhoto = vehicle.photos[0];
                return (
                  <Card key={vehicle.id} className="hover:shadow-xl transition-shadow">
                    <CardHeader className="p-0 relative group">
                      {mainPhoto ? (
                        <img
                          src={mainPhoto.thumbnailUrl || mainPhoto.originalUrl}
                          alt={`${vehicle.make} ${vehicle.model}`}
                          className="w-full h-48 object-cover rounded-t-lg transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 rounded-t-lg flex items-center justify-center">
                          <span className="text-gray-400">No Image</span>
                        </div>
                      )}
                      {/* Status Badge */}
                      {vehicle.status === 'BOOKED' ? (
                        <div className="absolute top-3 left-3 bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg border border-amber-300/30 flex items-center gap-1.5 animate-status-booking z-10">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                          UNIT BOOKING
                        </div>
                      ) : (
                        <div className="absolute top-3 left-3 bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg border border-green-300/30 flex items-center gap-1.5 animate-status-ready z-10">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                          READY STOCK
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="p-4">
                      <CardTitle className="text-lg mb-2">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </CardTitle>
                      {vehicle.variant && (
                        <p className="text-sm text-gray-600 mb-2">{vehicle.variant}</p>
                      )}
                      <p className="text-xl font-bold" style={{ color: tenant.primaryColor }}>
                        {formatPrice(vehicle.price)}
                      </p>
                      <div className="flex gap-2 mt-2 text-sm text-gray-600">
                        {vehicle.mileage && <span>{vehicle.mileage.toLocaleString()} km</span>}
                        {vehicle.transmissionType && <span>• {vehicle.transmissionType}</span>}
                      </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-0">
                      <Button asChild className="w-full">
                        <Link href={`/vehicles/${vehicle.id}`}>Lihat Detail</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Blog Preview */}
        {blogPosts.length > 0 && (
          <section className="py-12 bg-white">
            <div className="container mx-auto px-4">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900">Artikel Terbaru</h2>
                <Button asChild variant="outline">
                  <Link href="/blog">Lihat Semua →</Link>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {blogPosts.map((post) => (
                  <Card key={post.id} className="hover:shadow-xl transition-shadow">
                    {post.featuredImage && (
                      <CardHeader className="p-0">
                        <img
                          src={post.featuredImage}
                          alt={post.title}
                          className="w-full h-48 object-cover rounded-t-lg"
                        />
                      </CardHeader>
                    )}
                    <CardContent className="p-4">
                      <CardTitle className="text-lg mb-2 line-clamp-2">{post.title}</CardTitle>
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {getExcerpt(post.excerpt)}
                      </p>
                      <div className="mt-4 text-xs text-gray-500">
                        {post.publishedAt && new Date(post.publishedAt).toLocaleDateString('id-ID')} • {post.views} views
                      </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-0">
                      <Button asChild variant="outline" className="w-full">
                        <Link href={`/blog/${post.slug}`}>Baca Selengkapnya</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section
          className="py-16 text-white"
          style={{ backgroundColor: tenant.primaryColor }}
        >
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Siap Menemukan Mobil Impian Anda?</h2>
            <p className="text-xl mb-8 text-white/90">
              Hubungi kami sekarang untuk konsultasi dan penawaran terbaik
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {aiWhatsappNumber && (
                <Button
                  asChild
                  size="lg"
                  style={{ backgroundColor: '#25D366' }}
                  className="hover:opacity-90"
                >
                  <a
                    href={`https://wa.me/${aiWhatsappNumber.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Chat via WhatsApp
                  </a>
                </Button>
              )}
              <Button asChild size="lg" variant="secondary">
                <Link href="/contact">Lihat Lokasi Kami</Link>
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
  );
}
