/**
 * URL Helper Utilities (Client-Safe)
 * Does NOT import next/headers
 * 
 * For client components, use the clientUrlHelpers object.
 */

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
