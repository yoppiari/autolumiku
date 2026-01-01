/**
 * Contact Page - Catalog
 * Display contact information and Google Maps
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { BrandingService } from '@/lib/services/catalog/branding.service';
import CatalogHeader from '@/components/catalog/CatalogHeader';
import CatalogFooter from '@/components/catalog/CatalogFooter';
import { FaPhone, FaWhatsapp, FaEnvelope, FaMapMarkerAlt, FaClock, FaArrowLeft } from 'react-icons/fa';
import { prisma } from '@/lib/prisma';


import { getTenantFromHeaders, getTenantBranding, getFullTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getTenantBranding();

  return {
    title: `Hubungi Kami - ${branding?.name || 'Showroom'}`,
    description: `Informasi kontak dan lokasi showroom ${branding?.name || 'kami'}`,
  };
}

export default async function ContactPage() {
  const branding = await getTenantBranding();
  if (!branding) {
    return <div>Showroom not found</div>;
  }

  const tenant = await getFullTenant();
  if (!tenant) {
    return <div>Tenant not found</div>;
  }

  const fullAddress = [
    tenant.address,
    tenant.city,
    tenant.province,
    tenant.postalCode
  ].filter(Boolean).join(', ');

  const businessHours = tenant.businessHours as any;
  const socialMedia = tenant.socialMedia as any;

  const handleWhatsAppClick = () => {
    if (tenant.whatsappNumber) {
      const cleanNumber = tenant.whatsappNumber.replace(/[^0-9]/g, '');
      const message = encodeURIComponent(`Halo, saya ingin menghubungi ${tenant.name}`);
      return `https://wa.me/${cleanNumber}?text=${message}`;
    }
    return '#';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <CatalogHeader branding={branding} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
          >
            <FaArrowLeft size={16} />
            <span>Kembali ke Katalog</span>
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Hubungi Kami</h1>
          <p className="text-gray-600">Kami siap membantu Anda menemukan kendaraan impian</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Information */}
          <div className="space-y-6">
            {/* Phone Numbers */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FaPhone className="text-blue-600" />
                Telepon
              </h2>
              <div className="space-y-3">
                {tenant.phoneNumber && (
                  <div>
                    <p className="text-sm text-gray-500">Primary</p>
                    <a
                      href={`tel:${tenant.phoneNumber}`}
                      className="text-lg font-medium text-blue-600 hover:text-blue-800"
                    >
                      {tenant.phoneNumber}
                    </a>
                  </div>
                )}
                {tenant.phoneNumberSecondary && (
                  <div>
                    <p className="text-sm text-gray-500">Secondary</p>
                    <a
                      href={`tel:${tenant.phoneNumberSecondary}`}
                      className="text-lg font-medium text-blue-600 hover:text-blue-800"
                    >
                      {tenant.phoneNumberSecondary}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp */}
            {tenant.whatsappNumber && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FaWhatsapp className="text-green-600" />
                  WhatsApp
                </h2>
                <a
                  href={handleWhatsAppClick()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  <FaWhatsapp size={20} />
                  Chat via WhatsApp
                </a>
              </div>
            )}

            {/* Email */}
            {tenant.email && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FaEnvelope className="text-red-600" />
                  Email
                </h2>
                <a
                  href={`mailto:${tenant.email}`}
                  className="text-lg text-blue-600 hover:text-blue-800"
                >
                  {tenant.email}
                </a>
              </div>
            )}

            {/* Business Hours */}
            {businessHours && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FaClock className="text-orange-600" />
                  Jam Operasional
                </h2>
                <div className="space-y-2">
                  {Object.entries(businessHours).map(([day, hours]: [string, any]) => (
                    <div key={day} className="flex justify-between items-center py-1">
                      <span className="font-medium capitalize">{day}</span>
                      {hours.closed ? (
                        <span className="text-red-600">Tutup</span>
                      ) : (
                        <span className="text-gray-600">{hours.open} - {hours.close}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Map & Address */}
          <div className="space-y-6">
            {/* Address */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FaMapMarkerAlt className="text-red-600" />
                Alamat
              </h2>
              <p className="text-gray-700 leading-relaxed">{fullAddress}</p>
            </div>

            {/* Google Maps */}
            {(tenant.googleMapsUrl || (tenant.latitude && tenant.longitude)) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Peta Lokasi</h2>
                <div className="aspect-video rounded-lg overflow-hidden">
                  <iframe
                    src={
                      tenant.latitude && tenant.longitude
                        ? `https://www.google.com/maps?q=${tenant.latitude},${tenant.longitude}&output=embed`
                        : tenant.googleMapsUrl?.includes('embed')
                          ? tenant.googleMapsUrl
                          : `https://www.google.com/maps?q=${encodeURIComponent(
                            [tenant.address, tenant.city, tenant.province].filter(Boolean).join(', ')
                          )}&output=embed`
                    }
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Google Maps Location"
                  ></iframe>
                </div>
                {tenant.googleMapsUrl && (
                  <a
                    href={tenant.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Buka di Google Maps
                  </a>
                )}
              </div>
            )}

            {/* Coordinates (for reference) */}
            {tenant.latitude && tenant.longitude && (
              <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-600">
                <p>Koordinat: {tenant.latitude}, {tenant.longitude}</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <CatalogFooter
        businessInfo={{
          name: tenant.name,
          phoneNumber: tenant.phoneNumber || undefined,
          phoneNumberSecondary: tenant.phoneNumberSecondary || undefined,
          whatsappNumber: tenant.whatsappNumber || undefined,
          email: tenant.email || undefined,
          address: tenant.address || undefined,
          city: tenant.city || undefined,
          province: tenant.province || undefined,
          postalCode: tenant.postalCode || undefined,
          googleMapsUrl: tenant.googleMapsUrl || undefined,
          socialMedia: socialMedia,
        }}
        slug={branding.slug}
      />
    </div>
  );
}
