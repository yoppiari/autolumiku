'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import GlobalSearch from '@/components/catalog/GlobalSearch';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

interface GlobalHeaderProps {
  branding: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    slug: string;
  };
}

export default function GlobalHeader({ branding }: GlobalHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/vehicles', label: 'Mobil' },
    { href: '/blog', label: 'Blog' },
    { href: '/contact', label: 'Contact' },
  ];

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname?.startsWith(path)) return true;
    return false;
  };

  return (
    <header
      className="bg-background shadow-md sticky top-0 z-50 border-b"
      style={{ borderTop: `4px solid ${branding.primaryColor}` }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Name */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="h-12 w-auto object-contain"
              />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xl"
                style={{ backgroundColor: branding.primaryColor }}
              >
                {branding.name.charAt(0)}
              </div>
            )}
            <span className="text-xl font-bold text-foreground hidden md:block">
              {branding.name}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${isActive(link.href) ? 'text-primary' : 'text-muted-foreground'
                  }`}
                style={{ color: isActive(link.href) ? branding.primaryColor : undefined }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:block w-full max-w-xs mx-4">
            <GlobalSearch slug={branding.slug} />
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
          <GlobalSearch className="w-full max-w-none" slug={branding.slug} />
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-3 rounded-md text-sm font-medium transition-colors hover:bg-muted ${isActive(link.href) ? 'bg-muted text-primary' : 'text-foreground'
                  }`}
                style={{ color: isActive(link.href) ? branding.primaryColor : undefined }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
