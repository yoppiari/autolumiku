'use client';

import Image from 'next/image';
import Link from 'next/link';

interface TenantInfo {
  id: string;
  name: string;
  subdomain: string;
  branding: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

interface CatalogHeaderProps {
  tenant: TenantInfo;
}

export function CatalogHeader({ tenant }: CatalogHeaderProps) {
  const primaryColor = tenant.branding.primaryColor || '#2563eb';
  const secondaryColor = tenant.branding.secondaryColor || '#64748b';

  return (
    <header
      className="bg-white shadow-sm border-b"
      style={{ borderBottomColor: `${primaryColor}20` }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Tenant Name */}
          <div className="flex items-center gap-4">
            <Link href={`/catalog/${tenant.subdomain}`} className="flex items-center gap-3">
              {tenant.branding.logo ? (
                <Image
                  src={tenant.branding.logo}
                  alt={`${tenant.name} logo`}
                  width={40}
                  height={40}
                  className="rounded-lg object-contain"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  {tenant.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1
                  className="text-xl font-bold text-gray-900"
                  style={{ color: primaryColor }}
                >
                  {tenant.name}
                </h1>
                <p className="text-sm text-gray-600">Vehicle Catalog</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href={`/catalog/${tenant.subdomain}`}
              className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
            >
              Home
            </Link>
            <Link
              href={`/catalog/${tenant.subdomain}?featured=true`}
              className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              Featured
            </Link>
            <Link
              href={`/catalog/${tenant.subdomain}/about`}
              className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              About
            </Link>
            <Link
              href={`/catalog/${tenant.subdomain}/contact`}
              className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              Contact
            </Link>
          </nav>

          {/* CTA Button */}
          <div className="flex items-center gap-4">
            <button
              className="px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              Schedule Test Drive
            </button>

            {/* Mobile Menu Button */}
            <button className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-200">
        <div className="px-4 py-2 space-y-1">
          <Link
            href={`/catalog/${tenant.subdomain}`}
            className="block px-3 py-2 text-base font-medium text-gray-900 hover:bg-gray-50 rounded-md"
          >
            Home
          </Link>
          <Link
            href={`/catalog/${tenant.subdomain}?featured=true`}
            className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
          >
            Featured
          </Link>
          <Link
            href={`/catalog/${tenant.subdomain}/about`}
            className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
          >
            About
          </Link>
          <Link
            href={`/catalog/${tenant.subdomain}/contact`}
            className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
          >
            Contact
          </Link>
        </div>
      </div>
    </header>
  );
}