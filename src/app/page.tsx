/**
 * Root Page - handles custom domain showroom homepage
 * For platform domain, redirects to /catalog/[slug]
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const headersList = headers();
  const isCustomDomain = headersList.get('x-is-custom-domain') === 'true';
  const tenantSlug = headersList.get('x-tenant-slug');

  // If this is a platform domain request, redirect to platform home or 404
  if (!isCustomDomain) {
    // Platform domain accessing root - redirect to a default page or show 404
    redirect('/dashboard');
  }

  // Custom domain: redirect to catalog page
  // Middleware already rewrites custom domain / to /catalog/[slug]
  // This should not be reached, but if it is, redirect properly
  if (tenantSlug) {
    redirect(`/catalog/${tenantSlug}`);
  }

  // No tenant slug - configuration error
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Configuration Error</h1>
        <p className="text-gray-600">This custom domain is not properly configured.</p>
      </div>
    </div>
  );
}
