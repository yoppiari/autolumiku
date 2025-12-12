/**
 * Root Page
 *
 * NOTE: This page is mostly bypassed by middleware rewrites.
 * - Custom domains: middleware rewrites to /catalog/[slug]
 * - Platform domain: redirects to /dashboard
 *
 * This page should rarely execute in production.
 */

import { redirect } from 'next/navigation';

export default function RootPage() {
  // Default behavior: redirect to dashboard
  // This handles the platform domain (auto.lumiku.com) case
  redirect('/dashboard');
}
