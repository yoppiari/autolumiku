/**
 * Showroom Homepage
 * Featured vehicles, stats, and blog preview
 */

import React from 'react';
import Link from 'next/link';
import { PrismaClient } from '@prisma/client';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import HeroSection from '@/components/catalog/HeroSection';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getCatalogUrl,
  getVehiclesUrl,
  getVehicleUrl,
  getBlogsUrl,
  getBlogUrl,
  getContactUrl,
} from '@/lib/utils/url-helper';

const prisma = new PrismaClient();

export default async function ShowroomHomePage({ params }: { params: { slug: string } }) {
  const { slug } = params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
  });

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

  // Fetch featured vehicles (6 latest)
  const featuredVehicles = await prisma.vehicle.findMany({
    where: {
      tenantId,
      status: 'AVAILABLE',
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

  const formatPrice = (price: bigint | number) => {
    const priceNumber = typeof price === 'bigint' ? Number(price) : price;
    const rupiah = priceNumber / 100;
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
          vehicleCount={totalVehicles}
          phoneNumber={tenant.phoneNumber || undefined}
          whatsappNumber={tenant.whatsappNumber || undefined}
          slug={tenant.slug}
        />

        <main className="flex-1">
          {/* Hero Section */}
          <div className="container mx-auto px-4 pt-8">
            <HeroSection
              title={`Selamat Datang di ${tenant.name}`}
              subtitle="Temukan kendaraan impian Anda dengan harga terbaik"
              primaryColor={tenant.primaryColor}
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
                <h2 className="text-3xl font-bold text-foreground">Kendaraan Terbaru</h2>
                <Button asChild variant="outline">
                  <Link href={getVehiclesUrl()}>Lihat Semua →</Link>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredVehicles.map((vehicle) => {
                  const mainPhoto = vehicle.photos[0];
                  return (
                    <Card key={vehicle.id} className="hover:shadow-xl transition-shadow overflow-hidden">
                      <CardHeader className="p-0">
                        <div className="aspect-video relative">
                          {mainPhoto ? (
                            <img
                              src={mainPhoto.thumbnailUrl || mainPhoto.originalUrl}
                              alt={`${vehicle.make} ${vehicle.model}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <span className="text-muted-foreground">No Image</span>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        <CardTitle className="text-lg mb-2 line-clamp-1">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </CardTitle>
                        {vehicle.variant && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{vehicle.variant}</p>
                        )}
                        <p className="text-xl font-bold text-primary">
                          {formatPrice(vehicle.price)}
                        </p>
                        <div className="flex gap-2 mt-2 text-sm text-muted-foreground">
                          {vehicle.mileage && <span>{vehicle.mileage.toLocaleString()} km</span>}
                          {vehicle.transmissionType && <span>• {vehicle.transmissionType}</span>}
                        </div>
                      </CardContent>
                      <CardFooter className="p-4 pt-0">
                        <Button asChild className="w-full">
                          <Link href={getVehicleUrl(vehicle.id)}>Lihat Detail</Link>
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
                    <Card key={post.id} className="hover:shadow-xl transition-shadow overflow-hidden">
                      {post.featuredImage && (
                        <CardHeader className="p-0">
                          <div className="aspect-video relative">
                            <img
                              src={post.featuredImage}
                              alt={post.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </CardHeader>
                      )}
                      <CardContent className="p-4">
                        <CardTitle className="text-lg mb-2 line-clamp-2">{post.title}</CardTitle>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {getExcerpt(post.excerpt)}
                        </p>
                        <div className="mt-4 text-xs text-muted-foreground">
                          {post.publishedAt && new Date(post.publishedAt).toLocaleDateString('id-ID')} • {post.views} views
                        </div>
                      </CardContent>
                      <CardFooter className="p-4 pt-0">
                        <Button asChild variant="outline" className="w-full">
                          <Link href={getBlogUrl(post.slug)}>Baca Selengkapnya</Link>
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
            className="py-16 text-primary-foreground"
            style={{ backgroundColor: tenant.primaryColor }}
          >
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-3xl font-bold mb-4">Siap Menemukan Mobil Impian Anda?</h2>
              <p className="text-xl mb-8 opacity-90">
                Hubungi kami sekarang untuk konsultasi dan penawaran terbaik
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                {tenant.whatsappNumber && (
                  <Button
                    asChild
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-white border-none"
                  >
                    <a
                      href={`https://wa.me/${tenant.whatsappNumber.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Chat via WhatsApp
                    </a>
                  </Button>
                )}
                <Button asChild size="lg" variant="secondary">
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
}
