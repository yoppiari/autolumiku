/**
 * URL Helper Utilities (Server-Side)
 * Uses next/headers which is only available in Server Components
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
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return path ? cleanPath : '/';
    } else {
        const base = `/catalog/${tenantSlug}`;
        if (!path) return base;

        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${base}${cleanPath}`;
    }
}

/**
 * Get vehicle detail URL
 */
export function getVehicleUrl(vehicleId: string): string {
    return getCatalogUrl(`vehicles/${vehicleId}`);
}

/**
 * Get vehicle list URL
 */
export function getVehiclesUrl(): string {
    return getCatalogUrl('vehicles');
}

/**
 * Get blog post URL
 */
export function getBlogUrl(postSlug: string): string {
    return getCatalogUrl(`blog/${postSlug}`);
}

/**
 * Get blog list URL
 */
export function getBlogsUrl(): string {
    return getCatalogUrl('blog');
}

/**
 * Get contact page URL
 */
export function getContactUrl(): string {
    return getCatalogUrl('contact');
}

/**
 * Get search page URL
 */
export function getSearchUrl(): string {
    return getCatalogUrl('search');
}

/**
 * Get canonical URL for SEO
 */
export function getCanonicalUrl(
    tenant: { domain: string; slug: string },
    path: string = ''
): string {
    const headersList = headers();
    const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';
    const originalPath = headersList.get('x-original-path') || path;

    if (isCustomDomain) {
        const cleanPath = originalPath.startsWith('/') ? originalPath : `/${originalPath}`;
        return `https://${tenant.domain}${originalPath ? cleanPath : ''}`;
    } else {
        const catalogPath = path.startsWith('/') ? path : `/${path}`;
        return `https://auto.lumiku.com/catalog/${tenant.slug}${path ? catalogPath : ''}`;
    }
}
