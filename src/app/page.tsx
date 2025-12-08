import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering since we use headers()
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  try {
    // Check if this is a custom domain (tenant site) or platform domain
    const headersList = headers();
    const tenantDomain = headersList.get('x-tenant-domain');
    const host = headersList.get('host') || '';

    console.log('[HomePage] Request - host:', host, 'tenantDomain:', tenantDomain);

    // Platform domains that should redirect to login
    const platformDomains = [
      'auto.lumiku.com',
      'localhost',
      '127.0.0.1',
    ];

    const isPlatformDomain = platformDomains.some(domain =>
      host.includes(domain)
    );

    console.log('[HomePage] isPlatformDomain:', isPlatformDomain);

    // If custom domain (tenant site), find tenant and show catalog
    if (!isPlatformDomain && tenantDomain) {
      try {
        console.log('[HomePage] Querying tenant for domain:', tenantDomain);
        const tenant = await prisma.tenant.findFirst({
          where: { domain: tenantDomain },
          select: { slug: true },
        });

        console.log('[HomePage] Tenant found:', tenant);

        if (tenant) {
          redirect(`/catalog/${tenant.slug}`);
        }
      } catch (error) {
        console.error('[HomePage] Error finding tenant:', error);
      }
    }

    // Platform domain or tenant not found - redirect to login
    console.log('[HomePage] Redirecting to /login');
    redirect('/login');
  } catch (error) {
    console.error('[HomePage] Fatal error:', error);
    throw error;
  }
}
