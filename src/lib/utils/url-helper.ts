/**
 * URL Helper Utilities
 * Generates correct URLs based on domain context (custom domain vs platform domain)
 *
 * Usage:
 * - In server components: Can access headers() directly
 * - In client components: Pass domain context as props
 */

import { headers } from 'next/headers';

/**
 * Get catalog base URL based on domain context
 * @param path - Relative path within catalog (e.g., 'vehicles', 'blog/post-123')
 * @returns Absolute path for the catalog URL
 */
export function getCatalogUrl(path: string = ''): string {
  const headersList = headers();
  const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';
  const tenantSlug = headersList.get('x-tenant-slug') || '';

  if (isCustomDomain) {
    // Custom domain: clean URLs without catalog prefix
    // Example: /vehicles, /blog/post-123
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return path ? cleanPath : '/';
  } else {
    // Platform domain: slug-based URLs with catalog prefix
    // Example: /catalog/primamobil/vehicles
    const base = `/catalog/${tenantSlug}`;
    if (!path) return base;

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  }
}

/**
 * Get vehicle detail URL
 * @param vehicleId - Vehicle ID
 * @returns Absolute path for vehicle detail page
 */
export function getVehicleUrl(vehicleId: string): string {
  return getCatalogUrl(`vehicles/${vehicleId}`);
}

/**
 * Get vehicle list URL
 * @returns Absolute path for vehicle list page
 */
export function getVehiclesUrl(): string {
  return getCatalogUrl('vehicles');
}

/**
 * Get blog post URL
 * @param postSlug - Blog post slug
 * @returns Absolute path for blog post page
 */
export function getBlogUrl(postSlug: string): string {
  return getCatalogUrl(`blog/${postSlug}`);
}

/**
 * Get blog list URL
 * @returns Absolute path for blog list page
 */
export function getBlogsUrl(): string {
  return getCatalogUrl('blog');
}

/**
 * Get contact page URL
 * @returns Absolute path for contact page
 */
export function getContactUrl(): string {
  return getCatalogUrl('contact');
}

/**
 * Get search page URL
 * @returns Absolute path for search page
 */
export function getSearchUrl(): string {
  return getCatalogUrl('search');
}

/**
 * Get canonical URL for SEO
 * @param tenant - Tenant object with domain and slug
 * @param path - Relative path (optional)
 * @returns Full canonical URL with domain
 */
export function getCanonicalUrl(
  tenant: { domain: string; slug: string },
  path: string = ''
): string {
  const headersList = headers();
  const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';
  const originalPath = headersList.get('x-original-path') || path;

  if (isCustomDomain) {
    // Custom domain: use tenant's custom domain
    const cleanPath = originalPath.startsWith('/') ? originalPath : `/${originalPath}`;
    return `https://${tenant.domain}${originalPath ? cleanPath : ''}`;
  } else {
    // Platform domain: use platform domain with catalog prefix
    const catalogPath = path.startsWith('/') ? path : `/${path}`;
    return `https://auto.lumiku.com/catalog/${tenant.slug}${path ? catalogPath : ''}`;
  }
}

/**
 * Client-side URL helpers (for use in client components)
 * These don't access headers and require domain context to be passed as props
 */
export const clientUrlHelpers = {
  getCatalogUrl(isCustomDomain: boolean, tenantSlug: string, path: string = ''): string {
    if (isCustomDomain) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return path ? cleanPath : '/';
    } else {
      const base = `/catalog/${tenantSlug}`;
      if (!path) return base;
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `${base}${cleanPath}`;
    }
  },

  getVehicleUrl(isCustomDomain: boolean, tenantSlug: string, vehicleId: string): string {
    return this.getCatalogUrl(isCustomDomain, tenantSlug, `vehicles/${vehicleId}`);
  },

  getVehiclesUrl(isCustomDomain: boolean, tenantSlug: string): string {
    return this.getCatalogUrl(isCustomDomain, tenantSlug, 'vehicles');
  },

  getBlogUrl(isCustomDomain: boolean, tenantSlug: string, postSlug: string): string {
    return this.getCatalogUrl(isCustomDomain, tenantSlug, `blog/${postSlug}`);
  },

  getBlogsUrl(isCustomDomain: boolean, tenantSlug: string): string {
    return this.getCatalogUrl(isCustomDomain, tenantSlug, 'blog');
  },

  getContactUrl(isCustomDomain: boolean, tenantSlug: string): string {
    return this.getCatalogUrl(isCustomDomain, tenantSlug, 'contact');
  },

  getSearchUrl(isCustomDomain: boolean, tenantSlug: string): string {
    return this.getCatalogUrl(isCustomDomain, tenantSlug, 'search');
  },
};
