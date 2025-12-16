'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaPhone, FaWhatsapp } from 'react-icons/fa';
import { Menu, X } from 'lucide-react';
import GlobalSearch from '@/components/catalog/GlobalSearch';
import { Button } from '@/components/ui/button';

interface CatalogHeaderProps {
  branding: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    slug?: string;
  };
  vehicleCount?: number;
  phoneNumber?: string;
  whatsappNumber?: string;
  slug?: string;
  isCustomDomain?: boolean;
}

export default function CatalogHeader({
  branding,
  vehicleCount,
  phoneNumber,
  whatsappNumber,
  slug,
  isCustomDomain = false
}: CatalogHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const tenantSlug = slug || branding.slug;

  // Generate URLs based on domain context
  const getUrl = (path: string) => {
    if (isCustomDomain) {
      // Custom domain: clean URLs
      // Return '/' for empty path (Home link)
      return path || '/';
    } else {
      // Platform domain: include catalog prefix
      return `/catalog/${tenantSlug}${path}`;
    }
  };

  const navLinks = [
    { href: getUrl(''), label: 'Home' },
    { href: getUrl('/vehicles'), label: 'Mobil' },
    { href: getUrl('/blog'), label: 'Blog' },
    { href: getUrl('/contact'), label: 'Contact' },
  ];

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/');
  };

  const handlePhoneClick = () => {
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  const handleWhatsAppClick = () => {
    if (whatsappNumber) {
      const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
      const message = encodeURIComponent(`Halo, saya tertarik dengan kendaraan di ${branding.name}`);
      window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
    }
  };

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      {/* Top Gradient Accent */}
      <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-primary" />

      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-24 md:h-28 transition-all duration-300">
          {/* Logo & Name - Large & Prominent */}
          <Link href={getUrl('')} className="flex items-center gap-4 hover:opacity-90 transition-opacity group">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="h-10 md:h-14 w-auto object-contain transition-transform duration-300 group-hover:scale-105 max-w-[200px] md:max-w-[280px]"
              />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xl bg-primary"
              >
                {branding.name.charAt(0)}
              </div>
            )}
            <div className="hidden md:block">
              {/* Hide text if logo exists to keep it clean, or show minimal */}
              {!branding.logoUrl && <h1 className="text-2xl font-bold text-foreground tracking-tight">{branding.name}</h1>}
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${isActive(link.href) ? 'text-primary' : 'text-muted-foreground'
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:block w-full max-w-xs mx-4">
            <GlobalSearch slug={tenantSlug} />
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-20 left-0 w-full bg-background border-b shadow-lg p-4 flex flex-col gap-4 animate-in slide-in-from-top-5">
          <GlobalSearch className="w-full max-w-none" slug={tenantSlug} />
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-3 rounded-md text-sm font-medium transition-colors hover:bg-muted ${isActive(link.href) ? 'bg-muted text-primary' : 'text-foreground'
                  }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}



            {/* Mobile Contact Buttons */}
            <div className="flex gap-2 mt-2">
              {phoneNumber && (
                <Button onClick={handlePhoneClick} className="flex-1 gap-2" variant="outline">
                  <FaPhone size={16} />
                  Telepon
                </Button>
              )}
              {whatsappNumber && (
                <Button onClick={handleWhatsAppClick} className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white">
                  <FaWhatsapp size={18} />
                  WhatsApp
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
