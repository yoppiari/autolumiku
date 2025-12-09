/**
 * Dynamic Robots.txt Generation
 * Generates robots rules based on domain context
 */

import { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export default function robots(): MetadataRoute.Robots {
  const headersList = headers();
  const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';
  const tenantDomain = headersList.get('x-tenant-domain');

  // Custom domain: Allow crawling of catalog pages
  if (isCustomDomain && tenantDomain) {
    return {
      rules: {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/admin/',
          '/team/',
          '/login',
        ],
      },
      sitemap: `https://${tenantDomain}/sitemap.xml`,
    };
  }

  // Platform domain: Restrict crawling except catalog
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/catalog/',
        disallow: [
          '/',
          '/admin/',
          '/dashboard/',
          '/team/',
          '/api/',
          '/login',
        ],
      },
    ],
  };
}
