/**
 * Dynamic Sitemap Generation
 * Generates sitemap based on domain context (custom domain vs platform domain)
 */

import { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { generateVehicleSlug } from '@/lib/utils/vehicle-slug';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = headers();
  const tenantDomain = headersList.get('x-tenant-domain');
  const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';

  // Platform domain doesn't generate sitemap for catalog
  if (!tenantDomain || !isCustomDomain) {
    return [];
  }

  try {
    // Find tenant by domain
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { domain: tenantDomain },
          { domain: `www.${tenantDomain}` },
        ],
      },
    });

    if (!tenant) {
      return [];
    }

    // Fetch all available vehicles
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        status: 'AVAILABLE',
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        displayId: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Fetch all published blog posts
    const blogPosts = await prisma.blogPost.findMany({
      where: {
        tenantId: tenant.id,
        status: 'PUBLISHED',
      },
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
    });

    const baseUrl = `https://${tenant.domain}`;

    // Build sitemap entries
    const sitemap: MetadataRoute.Sitemap = [
      // Homepage
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
      },
      // Vehicles list page
      {
        url: `${baseUrl}/vehicles`,
        lastModified: new Date(),
        changeFrequency: 'hourly',
        priority: 0.9,
      },
      // Individual vehicle pages (SEO-friendly URLs)
      ...vehicles.map((vehicle) => ({
        url: `${baseUrl}/vehicles/${generateVehicleSlug({
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          displayId: vehicle.displayId || vehicle.id.substring(0, 8),
        })}`,
        lastModified: vehicle.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      // Blog list page (if has posts)
      ...(blogPosts.length > 0
        ? [
          {
            url: `${baseUrl}/blog`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.7,
          },
        ]
        : []),
      // Individual blog posts
      ...blogPosts.map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })),
      // Contact page
      {
        url: `${baseUrl}/contact`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.5,
      },
      // Search page
      {
        url: `${baseUrl}/search`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.4,
      },
    ];

    return sitemap;
  } catch (error) {
    console.error('[Sitemap] Error generating sitemap:', error);
    return [];
  }
}
