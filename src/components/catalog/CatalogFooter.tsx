/**
 * Catalog Footer Component
 * Displays business information in catalog footer
 */

'use client';

import Link from 'next/link';
import { FaPhone, FaWhatsapp, FaEnvelope, FaMapMarkerAlt, FaInstagram, FaFacebook, FaTiktok } from 'react-icons/fa';

interface BusinessInfo {
  name: string;
  phoneNumber?: string;
  phoneNumberSecondary?: string;
  whatsappNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  googleMapsUrl?: string;
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
}

interface CatalogFooterProps {
  businessInfo: BusinessInfo;
  slug: string;
}

export default function CatalogFooter({ businessInfo, slug }: CatalogFooterProps) {
  const fullAddress = [
    businessInfo.address,
    businessInfo.city,
    businessInfo.province,
    businessInfo.postalCode
  ].filter(Boolean).join(', ');

  const handleWhatsAppClick = () => {
    if (businessInfo.whatsappNumber) {
      const cleanNumber = businessInfo.whatsappNumber.replace(/[^0-9]/g, '');
      const message = encodeURIComponent(`Halo, saya tertarik dengan kendaraan di ${businessInfo.name}`);
      window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
    }
  };

  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Business Info */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4">{businessInfo.name}</h3>
            <p className="text-sm text-gray-400 mb-4">
              Showroom kendaraan terpercaya dengan berbagai pilihan mobil berkualitas.
            </p>
            {businessInfo.socialMedia && (
              <div className="flex gap-4">
                {businessInfo.socialMedia.instagram && (
                  <a
                    href={businessInfo.socialMedia.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-pink-500 transition-colors"
                  >
                    <FaInstagram size={24} />
                  </a>
                )}
                {businessInfo.socialMedia.facebook && (
                  <a
                    href={businessInfo.socialMedia.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-500 transition-colors"
                  >
                    <FaFacebook size={24} />
                  </a>
                )}
                {businessInfo.socialMedia.tiktok && (
                  <a
                    href={businessInfo.socialMedia.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    <FaTiktok size={24} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Hubungi Kami</h4>
            <div className="space-y-3">
              {businessInfo.phoneNumber && (
                <a
                  href={`tel:${businessInfo.phoneNumber}`}
                  className="flex items-center gap-3 hover:text-white transition-colors"
                >
                  <FaPhone className="text-green-500" />
                  <span>{businessInfo.phoneNumber}</span>
                </a>
              )}
              {businessInfo.whatsappNumber && (
                <button
                  onClick={handleWhatsAppClick}
                  className="flex items-center gap-3 hover:text-white transition-colors text-left"
                >
                  <FaWhatsapp className="text-green-500" size={20} />
                  <span>{businessInfo.whatsappNumber}</span>
                </button>
              )}
              {businessInfo.email && (
                <a
                  href={`mailto:${businessInfo.email}`}
                  className="flex items-center gap-3 hover:text-white transition-colors"
                >
                  <FaEnvelope className="text-blue-500" />
                  <span>{businessInfo.email}</span>
                </a>
              )}
            </div>
          </div>

          {/* Address */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Lokasi</h4>
            {fullAddress && (
              <div className="flex items-start gap-3 mb-3">
                <FaMapMarkerAlt className="text-red-500 mt-1 flex-shrink-0" />
                <p className="text-sm">{fullAddress}</p>
              </div>
            )}
            {businessInfo.googleMapsUrl && (
              <Link
                href={`/catalog/${slug}/contact`}
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                Lihat Peta
              </Link>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} {businessInfo.name}. Powered by AutoLumiku.</p>
        </div>
      </div>
    </footer>
  );
}
