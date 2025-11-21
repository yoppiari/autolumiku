/**
 * SEO Service
 * Epic 5: Story 5.3 - SEO Optimization for Vehicle Pages
 *
 * Generates SEO metadata, structured data, and sitemaps
 */

import { Vehicle, TenantBranding } from '@prisma/client';

export interface SEOMetadata {
  title: string;
  description: string;
  keywords: string[];
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
}

export interface StructuredData {
  '@context': string;
  '@type': string;
  [key: string]: any;
}

export class SEOService {
  /**
   * Generate SEO metadata for vehicle detail page
   */
  generateVehicleMetadata(
    vehicle: Vehicle,
    branding: TenantBranding,
    baseUrl: string
  ): SEOMetadata {
    const title = `${vehicle.make} ${vehicle.model} ${vehicle.year} - ${branding.businessName}`;
    const description = this.generateVehicleDescription(vehicle);
    const keywords = this.generateVehicleKeywords(vehicle);
    const canonical = `${baseUrl}/vehicles/${vehicle.id}`;
    const ogImage = vehicle.photos?.[0]?.largeUrl || branding.coverImageUrl || '';

    return {
      title,
      description,
      keywords,
      canonical,
      ogTitle: title,
      ogDescription: description,
      ogImage,
      ogUrl: canonical,
      twitterCard: 'summary_large_image',
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: ogImage,
    };
  }

  /**
   * Generate SEO metadata for catalog listing page
   */
  generateCatalogMetadata(
    branding: TenantBranding,
    baseUrl: string,
    filters?: any
  ): SEOMetadata {
    let title = `Mobil Bekas Berkualitas - ${branding.businessName}`;
    let description = branding.metaDescription || `Jual beli mobil bekas berkualitas di ${branding.businessName}. ${branding.city || ''}.`;

    // Add filter info to title/description
    if (filters?.make) {
      title = `${filters.make} Bekas - ${branding.businessName}`;
      description = `Jual ${filters.make} bekas berkualitas di ${branding.businessName}. ${branding.city || ''}.`;
    }

    const keywords = branding.metaKeywords || [
      'mobil bekas',
      'jual mobil',
      'beli mobil',
      branding.city || '',
    ];

    return {
      title,
      description,
      keywords,
      canonical: baseUrl,
      ogTitle: title,
      ogDescription: description,
      ogImage: branding.coverImageUrl || '',
      ogUrl: baseUrl,
      twitterCard: 'summary_large_image',
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: branding.coverImageUrl || '',
    };
  }

  /**
   * Generate structured data (JSON-LD) for vehicle
   */
  generateVehicleStructuredData(
    vehicle: Vehicle,
    branding: TenantBranding,
    baseUrl: string
  ): StructuredData {
    return {
      '@context': 'https://schema.org',
      '@type': 'Car',
      name: `${vehicle.make} ${vehicle.model} ${vehicle.year}`,
      brand: {
        '@type': 'Brand',
        name: vehicle.make,
      },
      model: vehicle.model,
      productionDate: vehicle.year.toString(),
      vehicleEngine: {
        '@type': 'EngineSpecification',
        fuelType: vehicle.fuelType || 'Gasoline',
      },
      vehicleTransmission: vehicle.transmissionType || 'Unknown',
      mileageFromOdometer: {
        '@type': 'QuantitativeValue',
        value: vehicle.mileage || 0,
        unitText: 'KM',
      },
      offers: {
        '@type': 'Offer',
        price: vehicle.price / 100, // Convert from cents
        priceCurrency: 'IDR',
        availability: vehicle.status === 'AVAILABLE' ? 'InStock' : 'OutOfStock',
        seller: {
          '@type': 'AutoDealer',
          name: branding.businessName,
          telephone: branding.phone,
          address: {
            '@type': 'PostalAddress',
            streetAddress: branding.address,
            addressLocality: branding.city,
            addressRegion: branding.province,
            postalCode: branding.postalCode,
            addressCountry: 'ID',
          },
        },
      },
      image: vehicle.photos?.map((p: any) => p.largeUrl) || [],
      url: `${baseUrl}/vehicles/${vehicle.id}`,
      description: vehicle.descriptionId || '',
    };
  }

  /**
   * Generate structured data for business
   */
  generateBusinessStructuredData(branding: TenantBranding): StructuredData {
    return {
      '@context': 'https://schema.org',
      '@type': 'AutoDealer',
      name: branding.businessName,
      description: branding.description || '',
      url: `https://${branding.customDomain || branding.subdomain}`,
      logo: branding.logoUrl,
      image: branding.coverImageUrl,
      telephone: branding.phone,
      email: branding.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: branding.address,
        addressLocality: branding.city,
        addressRegion: branding.province,
        postalCode: branding.postalCode,
        addressCountry: 'ID',
      },
      geo: branding.latitude && branding.longitude
        ? {
            '@type': 'GeoCoordinates',
            latitude: branding.latitude,
            longitude: branding.longitude,
          }
        : undefined,
      sameAs: [
        branding.facebookUrl,
        branding.instagramUrl,
        branding.tiktokUrl,
        branding.youtubeUrl,
      ].filter(Boolean),
    };
  }

  /**
   * Generate sitemap entries for vehicles
   */
  generateSitemapEntry(
    url: string,
    lastMod: Date,
    changeFreq: string = 'weekly',
    priority: number = 0.8
  ): string {
    return `
      <url>
        <loc>${url}</loc>
        <lastmod>${lastMod.toISOString()}</lastmod>
        <changefreq>${changeFreq}</changefreq>
        <priority>${priority}</priority>
      </url>
    `;
  }

  /**
   * Generate robots.txt content
   */
  generateRobotsTxt(baseUrl: string): string {
    return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Generate vehicle description for meta tag
   */
  private generateVehicleDescription(vehicle: Vehicle): string {
    const parts = [
      `${vehicle.make} ${vehicle.model} ${vehicle.year}`,
      vehicle.variant ? `varian ${vehicle.variant}` : null,
      vehicle.transmissionType ? `transmisi ${vehicle.transmissionType}` : null,
      vehicle.fuelType ? `bahan bakar ${vehicle.fuelType}` : null,
      vehicle.mileage ? `${vehicle.mileage.toLocaleString('id-ID')} KM` : null,
      `Harga: Rp ${(vehicle.price / 100).toLocaleString('id-ID')}`,
    ].filter(Boolean);

    return parts.join(', ') + '. ' + (vehicle.descriptionId?.slice(0, 100) || '');
  }

  /**
   * Generate SEO keywords for vehicle
   */
  private generateVehicleKeywords(vehicle: Vehicle): string[] {
    const keywords = [
      vehicle.make.toLowerCase(),
      vehicle.model.toLowerCase(),
      `${vehicle.make} ${vehicle.model}`.toLowerCase(),
      `${vehicle.make} ${vehicle.model} ${vehicle.year}`,
      'mobil bekas',
      `${vehicle.make} bekas`,
      `${vehicle.model} bekas`,
    ];

    if (vehicle.variant) keywords.push(vehicle.variant.toLowerCase());
    if (vehicle.transmissionType) keywords.push(vehicle.transmissionType.toLowerCase());
    if (vehicle.fuelType) keywords.push(vehicle.fuelType.toLowerCase());
    if (vehicle.color) keywords.push(`mobil ${vehicle.color}`);

    return keywords;
  }
}

export const seoService = new SEOService();
