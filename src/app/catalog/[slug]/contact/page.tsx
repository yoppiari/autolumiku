/**
 * Contact Page
 * Route: /catalog/[slug]/contact
 */

import React from 'react';
import { PrismaClient } from '@prisma/client';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import GlobalFooter from '@/components/showroom/GlobalFooter';
import ThemeProvider from '@/components/catalog/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FaPhone, FaWhatsapp, FaEnvelope, FaMapMarkerAlt, FaClock } from 'react-icons/fa';

const prisma = new PrismaClient();

export default async function ContactPage({ params }: { params: { slug: string } }) {
  const { slug } = params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
  });

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Showroom Not Found</h1>
        </div>
      </div>
    );
  }

  const fullAddress = [tenant.address, tenant.city, tenant.province]
    .filter(Boolean)
    .join(', ');

  // Construct Google Maps Embed URL
  // Using the embed API with the address as the query
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress || tenant.name)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

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
        />

        <main className="flex-1 container mx-auto px-4 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Hubungi Kami
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Kunjungi showroom kami atau hubungi kami melalui kontak di bawah ini untuk informasi lebih lanjut mengenai kendaraan impian Anda.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Contact Info */}
              <div className="lg:col-span-1 space-y-6">
                {/* Contact Methods */}
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-6">Informasi Kontak</h2>
                    <div className="space-y-6">
                      {tenant.phoneNumber && (
                        <div className="flex items-start gap-4">
                          <div className="bg-primary/10 p-3 rounded-full text-primary">
                            <FaPhone className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground mb-1">Telepon</h3>
                            <a href={`tel:${tenant.phoneNumber}`} className="text-muted-foreground hover:text-primary transition-colors block">
                              {tenant.phoneNumber}
                            </a>
                            {tenant.phoneNumberSecondary && (
                              <a href={`tel:${tenant.phoneNumberSecondary}`} className="text-muted-foreground hover:text-primary transition-colors block">
                                {tenant.phoneNumberSecondary}
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {tenant.whatsappNumber && (
                        <div className="flex items-start gap-4">
                          <div className="bg-green-500/10 p-3 rounded-full text-green-500">
                            <FaWhatsapp className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground mb-1">WhatsApp</h3>
                            <a
                              href={`https://wa.me/${tenant.whatsappNumber.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-green-500 transition-colors block"
                            >
                              Chat WhatsApp
                            </a>
                          </div>
                        </div>
                      )}

                      {tenant.email && (
                        <div className="flex items-start gap-4">
                          <div className="bg-red-500/10 p-3 rounded-full text-red-500">
                            <FaEnvelope className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground mb-1">Email</h3>
                            <a href={`mailto:${tenant.email}`} className="text-muted-foreground hover:text-red-500 transition-colors block">
                              {tenant.email}
                            </a>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-4">
                        <div className="bg-blue-500/10 p-3 rounded-full text-blue-500">
                          <FaClock className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground mb-1">Jam Operasional</h3>
                          <p className="text-muted-foreground">
                            Senin - Minggu<br />
                            09:00 - 18:00 WIB
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <h2 className="text-2xl font-bold mb-6">Alamat Showroom</h2>
                  <div className="flex items-start gap-4">
                    <div className="bg-zinc-800 p-3 rounded-full text-zinc-400">
                      <FaMapMarkerAlt className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-4 leading-relaxed">
                        {tenant.address}<br />
                        {tenant.city}, {tenant.province}
                      </p>
                      <Button asChild variant="outline" className="w-full">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Buka di Google Maps
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map */}
              <div className="lg:col-span-2">
                <div className="h-full min-h-[500px] rounded-2xl overflow-hidden bg-muted relative">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0, minHeight: '500px' }}
                    loading="lazy"
                    allowFullScreen
                    src={mapUrl}
                    title="Showroom Location"
                    className="grayscale hover:grayscale-0 transition-all duration-500"
                  ></iframe>
                </div>
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
