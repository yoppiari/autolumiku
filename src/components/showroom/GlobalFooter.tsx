import React from 'react';
import Link from 'next/link';
import { FaPhone, FaWhatsapp, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';
import { Button } from '@/components/ui/button';

interface GlobalFooterProps {
  tenant: {
    name: string;
    phoneNumber: string | null;
    phoneNumberSecondary: string | null;
    whatsappNumber: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    primaryColor: string;
  };
}

export default function GlobalFooter({ tenant }: GlobalFooterProps) {
  const fullAddress = [tenant.address, tenant.city, tenant.province]
    .filter(Boolean)
    .join(', ');

  return (
    <footer className="bg-black text-zinc-400 mt-auto border-t border-zinc-800">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-bold mb-4 text-white">{tenant.name}</h3>
            <p className="mb-4">
              Showroom kendaraan terpercaya dengan berbagai pilihan mobil berkualitas.
            </p>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">Hubungi Kami</h4>
            <div className="space-y-3">
              {tenant.phoneNumber && (
                <div className="flex items-center gap-2">
                  <FaPhone className="text-primary" />
                  <a
                    href={`tel:${tenant.phoneNumber.replace(/[^0-9+]/g, '')}`}
                    className="hover:text-white transition-colors"
                  >
                    {tenant.phoneNumber}
                  </a>
                </div>
              )}
              {tenant.whatsappNumber && (
                <div className="flex items-center gap-2">
                  <FaWhatsapp className="text-green-500" />
                  <a
                    href={`https://wa.me/${tenant.whatsappNumber.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    WhatsApp
                  </a>
                </div>
              )}
              {tenant.email && (
                <div className="flex items-center gap-2">
                  <FaEnvelope className="text-destructive" />
                  <a href={`mailto:${tenant.email}`} className="hover:text-white transition-colors">
                    {tenant.email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-white">Lokasi</h4>
            {fullAddress && (
              <div className="flex items-start gap-2 mb-4">
                <FaMapMarkerAlt className="text-destructive mt-1" />
                <p>{fullAddress}</p>
              </div>
            )}
            <div>
              <Button asChild variant="default">
                <Link href="/contact">Lihat Peta</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-zinc-800 mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
          <p className="mt-2">Powered by AutoLumiku - Platform Showroom Modern</p>
        </div>
      </div>
    </footer>
  );
}
